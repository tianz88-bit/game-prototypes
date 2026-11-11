// One running planet room: the authority for every ship on that planet.
// Players drop in and out at any time; the tick loop runs only while someone is connected.
import { TUNE, stepSeconds } from '../../sim/tune';
import { copyShip, newShip, stepShip } from '../../sim/ship';
import type { ShipInput, ShipState } from '../../sim/ship';
import { CLOSE, MSG, decodeClient, encodePing, encodeSnapshot, encodeWelcome } from '../../sim/protocol';
import type { SnapshotShip } from '../../sim/protocol';
import { wrapDist2 } from '../../sim/wrap';

/** A Cloudflare server-side socket: accepted in this object, not hibernated (the room ticks continuously). */
export interface CfSocket extends WebSocket {
  accept(): void;
}

/** Accept a server-side socket and ask for binary frames as ArrayBuffer (the runtime default can be Blob). */
export function acceptBinary(ws: CfSocket): void {
  ws.accept();
  try {
    ws.binaryType = 'arraybuffer';
  } catch {
    // Older runtimes without settable binaryType: onMessage falls back to reading Blobs in order.
  }
}

interface Player {
  id: number;
  ws: CfSocket;
  ship: ShipState;
  /** Inputs received and not yet applied, oldest first. */
  queue: ShipInput[];
  /** Last applied input, repeated (without dash) when the queue runs dry. */
  last: ShipInput;
  /** Steps simulated with a guessed input because the real one was late. Late inputs fill these slots and are dropped. */
  deficit: number;
  /** A dash from a dropped late input, applied on the next step. */
  owedDash: boolean;
  /** Keeps incoming messages in arrival order when any must be read asynchronously. */
  reading: Promise<void>;
  /** False until the first input arrives. */
  started: boolean;
  /** Consecutive ticks with a non-zero deficit. */
  deficitTicks: number;
}


const IDLE_INPUT: ShipInput = { seq: 0, turn: 0, aim: NaN, thrust: 0, dash: false };

export class Room {
  private players = new Map<number, Player>();
  private nextId = 1;
  private tick = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastStepAt = 0;
  private readonly dt = stepSeconds(TUNE);
  private readonly snapshotEvery = Math.max(1, Math.round(TUNE.net.tickHz / TUNE.net.snapshotHz));

  get playerCount(): number {
    return this.players.size;
  }

  /** Attach a freshly accepted socket. Returns false (and closes it) when the room is full. */
  join(ws: CfSocket): boolean {
    if (this.players.size >= TUNE.net.maxPlayersPerRoom) {
      ws.close(CLOSE.ROOM_FULL, 'room full');
      return false;
    }
    const id = this.allocateId();
    // Milestone 1: everyone spawns in one drop zone near the map centre so testers find each other.
    // Real spawn points come with loot and bots.
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * TUNE.net.interestRadius * 0.3;
    const spawn = newShip(TUNE.world.width / 2 + Math.cos(a) * d, TUNE.world.height / 2 + Math.sin(a) * d, Math.random() * Math.PI * 2 - Math.PI, TUNE.ship.cruiseSpeed);
    const player: Player = { id, ws, ship: spawn, queue: [], last: { ...IDLE_INPUT }, deficit: 0, owedDash: false, reading: Promise.resolve(), started: false, deficitTicks: 0 };
    this.players.set(id, player);

    ws.addEventListener('message', (e: MessageEvent) => this.onMessage(player, e.data));
    ws.addEventListener('close', () => this.leave(id));
    ws.addEventListener('error', () => this.leave(id));

    this.send(player, encodeWelcome(id, this.tick));
    this.send(player, this.snapshotFor(player));
    this.start();
    return true;
  }

  private allocateId(): number {
    // u16 ids, skipping any still in use.
    for (;;) {
      const id = this.nextId;
      this.nextId = this.nextId >= 0xffff ? 1 : this.nextId + 1;
      if (!this.players.has(id)) return id;
    }
  }

  private onMessage(player: Player, data: unknown): void {
    if (typeof data === 'string' || data === null || typeof data !== 'object') {
      player.ws.close(CLOSE.BAD_PROTOCOL, 'binary only');
      return;
    }
    // binaryType is set to arraybuffer on accept. If a runtime still hands over a Blob, read it
    // asynchronously but in arrival order, so inputs are never reordered.
    if (typeof (data as Blob).arrayBuffer === 'function' && !(data as ArrayBuffer).byteLength) {
      player.reading = player.reading.then(async () => this.handleBuffer(player, await (data as Blob).arrayBuffer()));
      return;
    }
    player.reading = player.reading.then(() => this.handleBuffer(player, data as ArrayBuffer));
  }

  private handleBuffer(player: Player, buf: ArrayBuffer): void {
    if (!this.players.has(player.id)) return;
    let msg;
    try {
      msg = decodeClient(buf);
    } catch {
      msg = null;
    }
    if (!msg) return;
    if (msg.type === MSG.PING) {
      this.send(player, encodePing(MSG.PONG, msg.clientTime));
      return;
    }
    // Ignore replays and out-of-order inputs.
    const newest = player.queue.length ? player.queue[player.queue.length - 1].seq : player.last.seq;
    if (msg.input.seq <= newest) return;
    player.queue.push(msg.input);
  }

  private leave(id: number): void {
    if (!this.players.delete(id)) return;
    if (this.players.size === 0) this.stop();
  }

  private start(): void {
    if (this.timer) return;
    this.lastStepAt = Date.now();
    this.timer = setInterval(() => this.pump(), 1000 / TUNE.net.tickHz / 2);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Run as many fixed steps as real time calls for (at most a few, so a stall does not spiral). */
  private pump(): void {
    const now = Date.now();
    const stepMs = this.dt * 1000;
    let steps = 0;
    while (now - this.lastStepAt >= stepMs && steps < 4) {
      this.step();
      this.lastStepAt += stepMs;
      steps++;
    }
    if (now - this.lastStepAt > stepMs * 4) this.lastStepAt = now;
  }

  private step(): void {
    for (const p of this.players.values()) this.stepPlayer(p);
    this.tick++;
    if (this.tick % this.snapshotEvery === 0) {
      for (const p of this.players.values()) this.send(p, this.snapshotFor(p));
    }
  }

  /**
   * One simulation step per tick, each consuming one client input, so the server and the
   * client's prediction take the same number of steps. Ships always fly forward, so a late
   * input cannot simply be waited for: the step runs with the last input repeated, and the
   * late input, when it arrives, is acknowledged and dropped in place of that guessed slot.
   */
  private stepPlayer(p: Player): void {
    // The ship waits at its spawn until a small buffer of inputs has arrived (jitter buffer). Input 1
    // then fills the first step, and a client whose frames are uneven never runs the queue dry.
    // Starting with an empty queue would put the server permanently ahead of the input stream.
    if (!p.started) {
      if (p.queue.length < TUNE.net.inputBufferSteps) return;
      p.started = true;
    }
    while (p.deficit > 0 && p.queue.length) {
      const late = p.queue.shift() as ShipInput;
      p.owedDash ||= late.dash;
      p.last = late;
      p.deficit--;
    }
    // A deficit that does not drain means this client sends fewer inputs than real time (a long frame,
    // a throttled tab). Waiting would leave every later input applied one step late, so forgive it:
    // the client sees one correction and the ship goes back to real inputs.
    p.deficitTicks = p.deficit > 0 ? p.deficitTicks + 1 : 0;
    if (p.deficitTicks > TUNE.net.forgiveGuessAfterTicks) {
      p.deficit = 0;
      p.deficitTicks = 0;
    }
    const steps = p.queue.length > TUNE.net.maxQueuedInputs ? 2 : 1; // catch up after a burst
    for (let i = 0; i < steps; i++) {
      const input = p.queue.shift();
      if (input) p.last = input;
      else if (p.deficit < TUNE.net.maxGuessedSteps) p.deficit++;
      // A guessed step repeats the last input without its dash; a dash owed from a dropped input applies now.
      const dash = (input ? input.dash : false) || p.owedDash;
      p.owedDash = false;
      stepShip(p.ship, { ...(input ?? p.last), dash }, this.dt, TUNE);
    }
  }

  /** Everything near this player, using wrapped distance. Their own ship always comes first. */
  private snapshotFor(p: Player): ArrayBuffer {
    const r2 = TUNE.net.interestRadius * TUNE.net.interestRadius;
    const ships: SnapshotShip[] = [{ id: p.id, ...copyShip(p.ship) }];
    for (const o of this.players.values()) {
      if (o.id === p.id) continue;
      if (wrapDist2(o.ship.x, o.ship.y, p.ship.x, p.ship.y, TUNE.world.width, TUNE.world.height) > r2) continue;
      ships.push({ id: o.id, ...copyShip(o.ship) });
    }
    // Acknowledge the guessed slots too: the ship already includes those steps, so the client must not
    // replay its own inputs for them on top. If a guess was wrong, the client sees a real correction.
    return encodeSnapshot(this.tick, p.last.seq + p.deficit, ships);
  }

  private send(p: Player, buf: ArrayBuffer): void {
    try {
      p.ws.send(buf);
    } catch {
      this.leave(p.id);
    }
  }
}
