import {applyServerConfig} from '../liveConfig';
// Connection to a planet room, with the client half of the netcode:
//  - own ship: predicted every fixed step from local input, then reconciled against
//    the server (rewind to the server state, replay unacknowledged inputs), with the
//    visual error smoothed out over a few frames instead of snapping;
//  - other ships: buffered snapshots, drawn interpDelayMs in the past and interpolated.
import { TUNE, stepSeconds } from '../../sim/tune';
import { copyShip, muzzleShot, stepShip } from '../../sim/ship';
import { asteroidPos } from '../../sim/asteroids';
import type { Asteroid } from '../../sim/asteroids';
import type { ShipInput, ShipState } from '../../sim/ship';
import { loadSave } from '../save';
import { CLOSE, MSG, PROTOCOL_VERSION, decodeServer, encodeBuy, encodeInput, encodePing } from '../../sim/protocol';
import type { OrdnanceView, RosterEntry, ServerMessage, SnapshotShip } from '../../sim/protocol';
import { angleDelta, wrap, wrapDelta } from '../../sim/wrap';
import { TURRET_SIDE } from '../../sim/turrets';
import type { PlanetId } from '../../sim/planets';
import { clientTune } from '../clientTune';
import { SIM_LAG_MS, serverOrigin } from '../base';

export type NetStatus = 'connecting' | 'open' | 'full' | 'closed' | 'destroyed' | 'extracted';

/** A bullet as drawn. Damage is decided by the server; this is only what the player sees. */
export interface VisualBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Milliseconds left. */
  life: number;
  mine: boolean;
  /** A turret shot: drawn smaller. */
  small?: boolean;
  /** Cosmetic gun family, fixed when the shot is created. */
  look?: number;
}

/** Things the scene should show once: a gun firing, an asteroid breaking, a bullet striking. */
export type NetFx =
  | { kind: 'shot'; id: number; side: number }
  /** A turret on ship id fired at angle (radians, world). */
  | { kind: 'turret'; id: number; index: number; angle: number }
  | { kind: 'burst'; x: number; y: number; size: number }
  | { kind: 'spark'; x: number; y: number; angle?: number }
  | { kind: 'explosion'; x: number; y: number; killer: number }
  | { kind: 'heal'; x: number; y: number }
  /** A dash ram landed here. */
  | { kind: 'ram'; x: number; y: number }
  /** A missile or mine went off (r = blast radius); shot: it was shot down. */
  | { kind: 'warpout'; x: number; y: number }
  | { kind: 'gold'; x: number; y: number }
  | { kind: 'blast'; x: number; y: number; r: number; ordnance: 'missile' | 'mine'; shot: boolean }
  | { kind: 'mineral'; x: number; y: number }
  | { kind: 'shield'; id: number; x: number; y: number }
  | { kind: 'hull'; id: number; x: number; y: number };

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

  /** Names and kills of everyone on the planet, by id. */
  roster = new Map<number, RosterEntry>();
  /** Health boosts lying on the planet. */
  readonly pickups = new Map<number, { id: number; x: number; y: number; kind: 'heal' | 'mineral' | 'salvage'; value: number }>();
  /** The hot zone (server): centre, radius, and when it moves (performance.now() ms). */
  hotZone: { x: number; y: number; r: number; movesAt: number } | null = null;
  /** Set when our own ship is destroyed: where, and who did it (0 = an asteroid). */
  death: { x: number; y: number; killer: number; killerName: string } | null = null;
  /** Set when our warp run completed and we left the planet: what we carried out. */
  extracted: { power: number; kills: number; salvage: number } | null = null;
  /** After an extraction: what the bank credited and the new balance (or why it could not). */
  banked: { amount: number; balance: number | null; error: string } | null = null;
  /** Every asteroid on the planet, by id. */
  readonly asteroids = new Map<number, Asteroid>();
  /** When each asteroid was last hit (performance.now), for the hit flash. */
  readonly asteroidHitAt = new Map<number, number>();
  bullets: VisualBullet[] = [];
  private fx: NetFx[] = [];
  private rttSmooth = 0;
  /** Asteroids destroyed that split into pieces (test hook). */
  splits = 0;

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

  constructor(
    readonly planet: PlanetId,
    private readonly name = '',
  ) {}

  connect(): void {
    const url = `${serverOrigin()}/ws/${this.planet}?v=${PROTOCOL_VERSION}${this.name ? `&name=${encodeURIComponent(this.name)}` : ''}`;
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.status = 'open';
      // Name our bank account first, so the room can credit an extraction to it.
      const secret = loadSave().account?.secret;
      if (secret) ws.send(JSON.stringify({ type: 'auth', secret, look: loadSave().look ?? {} }));
      this.ping();
      this.pingTimer = setInterval(() => this.ping(), clientTune.net.pingIntervalMs);
    });
    ws.addEventListener('message', (e) => {
      const data=e.data;
      const receive=():void=>{
        if(typeof data==='string'){
          try{const msg=JSON.parse(data);if(msg.type==='config'&&applyServerConfig(msg.record)){this.pending=[];this.accumulator=0;this.visualError={x:0,y:0,heading:0};}else this.handleText(msg);}
          catch{ws.close(CLOSE.BAD_PROTOCOL,'invalid server settings');}return;
        }
        if(data instanceof ArrayBuffer)this.receive(data);
      };
      // Preserve config/snapshot ordering even in the artificial-lag test mode.
      if(SIM_LAG_MS>0)setTimeout(receive,SIM_LAG_MS);else receive();
    });
    ws.addEventListener('close', (e) => {
      this.status = e.code === CLOSE.ROOM_FULL ? 'full' : e.code === CLOSE.DESTROYED ? 'destroyed' : e.code === CLOSE.EXTRACTED ? 'extracted' : 'closed';
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

  /** Roster, deaths and pickups arrive as JSON text frames. */
  private handleText(msg: { type?: string; id?: number; power?: number; kills?: number; ships?: { id: number; x: number; y: number }[]; x?: number; y?: number; blasts?: { x: number; y: number; r: number; kind: 'missile' | 'mine'; shot: boolean }[]; rams?: { id: number; target: number; x: number; y: number }[]; hits?: { id: number; x: number; y: number; shielded: boolean; hull?: boolean }[]; players?: RosterEntry[]; deaths?: { id: number; x: number; y: number; killer: number }[]; add?: { id: number; x: number; y: number; kind: 'heal' | 'mineral' | 'salvage'; value: number }[]; r?: number; seconds?: number; salvage?: number; amount?: number; balance?: number | null; error?: string; remove?: { id: number; by: number }[] }): void {
    if (msg.type === 'roster' && Array.isArray(msg.players)) {
      this.roster = new Map(msg.players.map((p) => [p.id, p]));
    } else if (msg.type === 'extracted') {
      this.extracted = { power: Number(msg.power) || 0, kills: Number(msg.kills) || 0, salvage: Number(msg.salvage) || 0 };
    } else if (msg.type === 'banked') {
      this.banked = { amount: Number(msg.amount) || 0, balance: typeof msg.balance === 'number' ? msg.balance : null, error: typeof msg.error === 'string' ? msg.error : '' };
    } else if (msg.type === 'hotzone') {
      this.hotZone = { x: Number(msg.x) || 0, y: Number(msg.y) || 0, r: Number(msg.r) || 0, movesAt: performance.now() + (Number(msg.seconds) || 0) * 1000 };
    } else if (msg.type === 'warpouts' && Array.isArray(msg.ships)) {
      for (const w of msg.ships) {
        this.fx.push({ kind: 'warpout', x: w.x, y: w.y });
        this.remotes.delete(w.id);
      }
    } else if (msg.type === 'bounty' && typeof msg.id === 'number') {
      this.bounty = msg.id ? { id: msg.id, x: Number(msg.x) || 0, y: Number(msg.y) || 0 } : null;
    } else if (msg.type === 'deaths' && Array.isArray(msg.deaths)) {
      for (const d of msg.deaths) {
        this.fx.push({ kind: 'explosion', x: d.x, y: d.y, killer: d.killer });
        this.remotes.delete(d.id);
        if (d.id === this.myId) this.death = { x: d.x, y: d.y, killer: d.killer, killerName: this.roster.get(d.killer)?.name ?? '' };
      }
    } else if (msg.type === 'hits' && Array.isArray(msg.hits)) {
      for (const h of msg.hits) {
        if (h.shielded) this.fx.push({ kind: 'shield', id: h.id, x: h.x, y: h.y });
        if (h.hull===true || (h.hull===undefined && !h.shielded)) this.fx.push({ kind: 'hull', id: h.id, x: h.x, y: h.y });
      }
    } else if (msg.type === 'blasts' && Array.isArray(msg.blasts)) {
      for (const b of msg.blasts) this.fx.push({ kind: 'blast', x: b.x, y: b.y, r: b.r, ordnance: b.kind, shot: b.shot });
    } else if (msg.type === 'rams' && Array.isArray(msg.rams)) {
      for (const r of msg.rams) this.fx.push({ kind: 'ram', x: r.x, y: r.y });
    } else if (msg.type === 'pickups') {
      for (const k of msg.add ?? []) this.pickups.set(k.id, k);
      for (const g of msg.remove ?? []) {
        const k = this.pickups.get(g.id);
        this.pickups.delete(g.id);
        if (k && g.by) this.fx.push({ kind: k.kind === 'mineral' ? 'mineral' : k.kind === 'salvage' ? 'gold' : 'heal', x: k.x, y: k.y });
      }
    }
  }

  private receive(data: ArrayBuffer): void {
    this.bytesIn += data.byteLength;
    const msg = decodeServer(data);
    if (msg) this.handle(msg);
  }

  private handle(msg: ServerMessage): void {
    if (msg.type === MSG.PONG) {
      this.rttMs = performance.now() - msg.clientTime;
      this.rttSmooth = this.rttSmooth ? this.rttSmooth + (this.rttMs - this.rttSmooth) * 0.2 : this.rttMs;
      return;
    }
    if (msg.type === MSG.ASTEROIDS) {
      for (const a of msg.asteroids) {
        const old = this.asteroids.get(a.id);
        if (old && a.hp < old.hp) this.asteroidHitAt.set(a.id, performance.now());
        this.asteroids.set(a.id, a);
      }
      return;
    }
    if (msg.type === MSG.GONE) {
      for (const g of msg.gone) {
        const a = this.asteroids.get(g.id);
        if (!a) continue;
        this.asteroids.delete(g.id);
        this.asteroidHitAt.delete(g.id);
        this.fx.push({ kind: 'burst', x: g.x, y: g.y, size: a.size });
        if (a.size < 2) this.splits++;
      }
      return;
    }
    if (msg.type === MSG.SHOTS) {
      for (const s of msg.shots) {
        if (s.side >= TURRET_SIDE) {
          const life = ((TUNE.turret.range + 60) / TUNE.turret.bulletSpeed) * 1000;
          this.bullets.push({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, life, mine: s.owner === this.myId, small: true });
          this.fx.push({ kind: 'turret', id: s.owner, index: s.side - TURRET_SIDE, angle: Math.atan2(s.vy, s.vx) });
          continue;
        }
        this.bullets.push({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, life: TUNE.weapon.bulletLifeSteps * STEP_MS, mine: false, look:s.side===1?0:1 });
        this.fx.push({ kind: 'shot', id: s.owner, side: s.side });
      }
      return;
    }
    if (msg.type === MSG.WELCOME) {
      this.myId = msg.id;
      return;
    }
    if (msg.type === MSG.ORDNANCE) {
      // Missiles and mines near us; each list replaces the last. Kept with the arrival time so the
      // scene can carry missiles forward between snapshots.
      const now = performance.now();
      this.ordnance = new Map(msg.items.map((o) => [o.id, { ...o, at: now }]));
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
  update(input: { turn: number; aim: number; thrust: number; dash: boolean; dashAim: number; fire: boolean; missile: boolean; mine: boolean; warp: boolean }): void {
    const now = performance.now();
    const deltaMs = this.lastFrameAt ? now - this.lastFrameAt : 0;
    this.lastFrameAt = now;
    // A dash pressed between two fixed steps is kept for the next step.
    this.dashQueued ||= input.dash;
    this.missileQueued ||= input.missile;
    this.mineQueued ||= input.mine;
    this.warpQueued ||= input.warp;
    if (this.predicted && this.status === 'open' && !this.death && !this.extracted) {
      this.accumulator += Math.min(deltaMs, 250);
      while (this.accumulator >= STEP_MS) {
        this.accumulator -= STEP_MS;
        // Round to the 32-bit floats that go on the wire, so prediction uses exactly what the server gets.
        const cmd: ShipInput = { seq: ++this.seq, turn: Math.fround(input.turn), aim: Math.fround(input.aim), thrust: Math.fround(input.thrust), dash: this.dashQueued, fire: input.fire, dashAim: Math.fround(input.dashAim), missile: this.missileQueued, mine: this.mineQueued, warp: this.warpQueued };
        this.dashQueued = false;
        this.missileQueued = false;
        this.mineQueued = false;
        this.warpQueued = false;
        this.pending.push(cmd);
        if (this.pending.length > 120) this.pending.shift();
        this.send(encodeInput(cmd));
        const shots = this.predicted.shots;
        stepShip(this.predicted, cmd, stepSeconds(TUNE), TUNE);
        if (this.predicted.shots !== shots) {
          // Our own bullet appears at once; the server fires its real one when this input arrives.
          // Same aim assist as the server, against where this client sees the targets.
          const targets = [
            ...this.remoteRender().map((r) => ({ x: r.s.x, y: r.s.y, ship: true })),
            ...this.asteroidRender().map((r) => ({ x: r.x, y: r.y, ship: false })),
          ];
          const shot = muzzleShot(this.predicted, TUNE, targets);
          this.bullets.push({ x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy, life: TUNE.weapon.bulletLifeSteps * STEP_MS, mine: true, look:shot.side===1?0:1 });
          this.fx.push({ kind: 'shot', id: this.myId, side: shot.side });
        }
      }
    }
    this.stepBullets(deltaMs);
    const k = Math.pow(1 - clientTune.net.correctionDecay, deltaMs / 16.67);
    this.visualError.x *= k;
    this.visualError.y *= k;
    this.visualError.heading *= k;
    for (const [id, r] of this.remotes) if (now - r.lastSeen > clientTune.net.remoteTimeoutMs) this.remotes.delete(id);
  }

  private dashQueued = false;
  private missileQueued = false;
  private mineQueued = false;
  private warpQueued = false;
  /** Missiles and mines near us (server's view), with when each list arrived. */
  ordnance = new Map<number, OrdnanceView & { at: number }>();
  /** The strongest real player carries the bounty (server, twice a second); null when nobody does. */
  bounty: { id: number; x: number; y: number } | null = null;

  /** Ask the server for a shop purchase (it decides); tier is the one on offer, so a double tap buys once. */
  buy(item: number, tier: number): void {
    if (this.status === 'open' && !this.death) this.send(encodeBuy(item, tier));
  }

  /** Move the drawn bullets; one that reaches an asteroid or another ship stops there with a spark. */
  private stepBullets(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const tick = this.asteroidTick();
    const rocks = [...this.asteroids.values()].map((a) => ({ p: asteroidPos(a, tick, TUNE), r: TUNE.asteroid.radius[a.size] }));
    const ships = this.remoteRender().map((r) => r.s);
    this.bullets = this.bullets.filter((b) => {
      b.x = wrap(b.x + b.vx * dt, W);
      b.y = wrap(b.y + b.vy * dt, H);
      b.life -= deltaMs;
      if (b.life <= 0) return false;
      const near = (x: number, y: number, r: number): boolean => wrapDelta(b.x, x, W) ** 2 + wrapDelta(b.y, y, H) ** 2 <= r * r;
      const struck = rocks.some((k) => near(k.p.x, k.p.y, k.r)) || (b.mine && ships.some((s) => near(s.x, s.y, TUNE.ship.radius)));
      if (struck) this.fx.push({ kind: 'spark', x: b.x, y: b.y, angle: Math.atan2(-b.vy,-b.vx) });
      return !struck;
    });
  }

  /**
   * The tick at which to draw asteroids: the server's time when the input we are sending now will
   * be applied (one way trip plus the server's input buffer), so rocks appear where they will be
   * when our steering and shots take effect.
   */
  asteroidTick(): number {
    if (this.clockOffset === null) return 0;
    const ms = performance.now() + this.clockOffset + this.rttSmooth + TUNE.net.inputBufferSteps * STEP_MS;
    return ms / STEP_MS;
  }

  /** Asteroids with their current positions. */
  asteroidRender(): { a: Asteroid; x: number; y: number }[] {
    const tick = this.asteroidTick();
    const out: { a: Asteroid; x: number; y: number }[] = [];
    for (const a of this.asteroids.values()) {
      const p = asteroidPos(a, tick, TUNE);
      out.push({ a, x: p.x, y: p.y });
    }
    return out;
  }

  drainFx(): NetFx[] {
    const out = this.fx;
    this.fx = [];
    return out;
  }

  /** Own ship as it should be drawn: prediction plus the decaying correction. */
  ownRender(): ShipState | null {
    const p = this.predicted;
    if (!p || this.death) return null;
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
