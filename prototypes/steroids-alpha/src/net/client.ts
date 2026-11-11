// Connection to a planet room, with the client half of the netcode:
//  - own ship: predicted every fixed step from local input, then reconciled against
//    the server (rewind to the server state, replay unacknowledged inputs), with the
//    visual error smoothed out over a few frames instead of snapping;
//  - other ships: buffered snapshots, drawn interpDelayMs in the past and interpolated.
import { TUNE, stepSeconds } from '../../sim/tune';
import { copyShip, stepShip } from '../../sim/ship';
import type { ShipInput, ShipState } from '../../sim/ship';
import { CLOSE, MSG, PROTOCOL_VERSION, decodeServer, encodeInput, encodePing } from '../../sim/protocol';
import type { ServerMessage, SnapshotShip } from '../../sim/protocol';
import { angleDelta, wrap, wrapDelta } from '../../sim/wrap';
import type { PlanetId } from '../../sim/planets';
import { clientTune } from '../clientTune';
import { SIM_LAG_MS, serverOrigin } from '../base';

export type NetStatus = 'connecting' | 'open' | 'full' | 'closed';

interface Timed {
  t: number;
  s: ShipState;
}

interface Remote {
  buf: Timed[];
  lastSeen: number;
}

const W = TUNE.world.width;
const H = TUNE.world.height;
const STEP_MS = stepSeconds(TUNE) * 1000;

export class NetClient {
  status: NetStatus = 'connecting';
  myId = 0;
  /** Predicted own ship (simulation state). */
  predicted: ShipState | null = null;
  /** Visual-only offset that decays to zero, hiding reconciliation corrections. */
  private visualError = { x: 0, y: 0, heading: 0 };
  private pending: ShipInput[] = [];
  private seq = 0;
  private accumulator = 0;
  private remotes = new Map<number, Remote>();
  /** Estimated (server time - local time) in ms. */
  private clockOffset: number | null = null;
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  // Debug stats.
  rttMs = 0;
  serverTick = 0;
  lastAck = 0;
  get inputSeq(): number {
    return this.seq;
  }
  lastCorrection = 0;
  /** Own-ship snapshots, how many needed a visible correction (>1px), and the largest one. Reset by the test hook. */
  corrections = { snapshots: 0, count: 0, max: 0 };
  bytesIn = 0;
  snapshots = 0;

  constructor(readonly planet: PlanetId) {}

  connect(): void {
    const url = `${serverOrigin()}/ws/${this.planet}?v=${PROTOCOL_VERSION}`;
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.status = 'open';
      this.ping();
      this.pingTimer = setInterval(() => this.ping(), clientTune.net.pingIntervalMs);
    });
    ws.addEventListener('message', (e) => {
      if (!(e.data instanceof ArrayBuffer)) return;
      const data = e.data;
      if (SIM_LAG_MS > 0) setTimeout(() => this.receive(data), SIM_LAG_MS);
      else this.receive(data);
    });
    ws.addEventListener('close', (e) => {
      this.status = e.code === CLOSE.ROOM_FULL ? 'full' : 'closed';
      if (this.pingTimer) clearInterval(this.pingTimer);
    });
  }

  close(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
  }

  private send(buf: ArrayBuffer): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (SIM_LAG_MS > 0) setTimeout(() => ws.readyState === WebSocket.OPEN && ws.send(buf), SIM_LAG_MS);
    else ws.send(buf);
  }

  private ping(): void {
    this.send(encodePing(MSG.PING, performance.now()));
  }

  private receive(data: ArrayBuffer): void {
    this.bytesIn += data.byteLength;
    const msg = decodeServer(data);
    if (msg) this.handle(msg);
  }

  private handle(msg: ServerMessage): void {
    if (msg.type === MSG.PONG) {
      this.rttMs = performance.now() - msg.clientTime;
      return;
    }
    if (msg.type === MSG.WELCOME) {
      this.myId = msg.id;
      return;
    }
    this.snapshots++;
    this.serverTick = msg.tick;
    this.lastAck = msg.ackSeq;
    const now = performance.now();
    const serverMs = msg.tick * STEP_MS;
    // The smallest observed (server - local) is the least delayed sample; drift slowly toward newer ones.
    const sample = serverMs - now;
    if (this.clockOffset === null || sample > this.clockOffset) this.clockOffset = sample;
    else this.clockOffset += (sample - this.clockOffset) * 0.02;

    const seen = new Set<number>();
    for (const s of msg.ships) {
      seen.add(s.id);
      if (s.id === this.myId) this.reconcile(s, msg.ackSeq);
      else this.bufferRemote(s, serverMs, now);
    }
  }

  private reconcile(auth: SnapshotShip, ackSeq: number): void {
    this.pending = this.pending.filter((i) => i.seq > ackSeq);
    const replay = copyShip(auth);
    for (const input of this.pending) stepShip(replay, input, stepSeconds(TUNE), TUNE);
    if (!this.predicted) {
      this.predicted = replay;
      return;
    }
    const ex = wrapDelta(this.predicted.x, replay.x, W);
    const ey = wrapDelta(this.predicted.y, replay.y, H);
    const eh = angleDelta(this.predicted.heading, replay.heading);
    this.lastCorrection = Math.hypot(ex, ey);
    this.corrections.snapshots++;
    if (this.lastCorrection > 1) this.corrections.count++;
    this.corrections.max = Math.max(this.corrections.max, this.lastCorrection);
    if (this.lastCorrection > clientTune.net.snapCorrectionAbove) {
      this.visualError = { x: 0, y: 0, heading: 0 };
    } else {
      this.visualError.x += ex;
      this.visualError.y += ey;
      this.visualError.heading += eh;
    }
    this.predicted = replay;
  }

  private bufferRemote(s: SnapshotShip, serverMs: number, now: number): void {
    let r = this.remotes.get(s.id);
    if (!r) {
      r = { buf: [], lastSeen: now };
      this.remotes.set(s.id, r);
    }
    r.lastSeen = now;
    r.buf.push({ t: serverMs, s: copyShip(s) });
    if (r.buf.length > 30) r.buf.shift();
  }

  private lastFrameAt = 0;

  /**
   * Advance the local fixed-step prediction. Call once per frame. Uses the real clock, not the
   * engine's frame delta: Phaser smooths its delta and under-reports time when the frame rate drops,
   * which made a 37 fps client send 22 inputs a second to a server consuming 30.
   */
  update(input: { turn: number; aim: number; thrust: number; dash: boolean }): void {
    const now = performance.now();
    const deltaMs = this.lastFrameAt ? now - this.lastFrameAt : 0;
    this.lastFrameAt = now;
    // A dash pressed between two fixed steps is kept for the next step.
    this.dashQueued ||= input.dash;
    if (this.predicted && this.status === 'open') {
      this.accumulator += Math.min(deltaMs, 250);
      while (this.accumulator >= STEP_MS) {
        this.accumulator -= STEP_MS;
        // Round to the 32-bit floats that go on the wire, so prediction uses exactly what the server gets.
        const cmd: ShipInput = { seq: ++this.seq, turn: Math.fround(input.turn), aim: Math.fround(input.aim), thrust: Math.fround(input.thrust), dash: this.dashQueued };
        this.dashQueued = false;
        this.pending.push(cmd);
        if (this.pending.length > 120) this.pending.shift();
        this.send(encodeInput(cmd));
        stepShip(this.predicted, cmd, stepSeconds(TUNE), TUNE);
      }
    }
    const k = Math.pow(1 - clientTune.net.correctionDecay, deltaMs / 16.67);
    this.visualError.x *= k;
    this.visualError.y *= k;
    this.visualError.heading *= k;
    for (const [id, r] of this.remotes) if (now - r.lastSeen > clientTune.net.remoteTimeoutMs) this.remotes.delete(id);
  }

  private dashQueued = false;

  /** Own ship as it should be drawn: prediction plus the decaying correction. */
  ownRender(): ShipState | null {
    const p = this.predicted;
    if (!p) return null;
    return {
      ...p,
      x: wrap(p.x + this.visualError.x, W),
      y: wrap(p.y + this.visualError.y, H),
      heading: p.heading + this.visualError.heading,
    };
  }

  /** Other ships interpolated at (server now - interpolation delay). */
  remoteRender(): { id: number; s: ShipState }[] {
    if (this.clockOffset === null) return [];
    const t = performance.now() + this.clockOffset - clientTune.net.interpDelayMs;
    const out: { id: number; s: ShipState }[] = [];
    for (const [id, r] of this.remotes) {
      const b = r.buf;
      if (!b.length) continue;
      while (b.length >= 3 && b[1].t <= t) b.shift();
      const a = b[0];
      const c = b[1];
      if (!c || t <= a.t) {
        out.push({ id, s: a.s });
        continue;
      }
      const f = Math.min(1, (t - a.t) / Math.max(1, c.t - a.t));
      out.push({
        id,
        s: {
          ...c.s,
          x: wrap(a.s.x + wrapDelta(c.s.x, a.s.x, W) * f, W),
          y: wrap(a.s.y + wrapDelta(c.s.y, a.s.y, H) * f, H),
          heading: a.s.heading + angleDelta(c.s.heading, a.s.heading) * f,
        },
      });
    }
    return out;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get remoteCount(): number {
    return this.remotes.size;
  }
}
