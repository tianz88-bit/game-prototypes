import { bundledRecord } from '../../sim/liveConfig';
import type { ConfigRecord } from '../../sim/liveConfig';
// One running planet room: the authority for every ship on that planet.
// Players drop in and out at any time; the tick loop runs only while someone is connected.
import { TUNE, stepSeconds } from '../../sim/tune';
import { copyShip } from '../../sim/ship';
import type { ShipInput, ShipState } from '../../sim/ship';
import { World } from '../../sim/world';
import { CLOSE, MSG, cleanName, decodeClient, encodeAsteroids, encodeGone, encodePing, encodeShots, encodeSnapshot, encodeWelcome } from '../../sim/protocol';
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
  budgetAt:number;
  packets:number;
  /** Shown under the ship and on the leaderboard. */
  name: string;
  /** Ships this player has destroyed since they last dropped in. Resets on death (a new life). */
  kills: number;
}


const IDLE_INPUT: ShipInput = { seq: 0, turn: 0, aim: NaN, thrust: 0, dash: false, fire: false };

export class Room {
  private players = new Map<number, Player>();
  private nextId = 1;
  /** Game rules for this planet: ships, bullets, asteroids. Its tick is the room's clock. */
  private world: World;

  /** shipHp (any value) makes ships take no damage, for local test runs only (see TEST_SHIP_HP in index.ts). */
  private config:ConfigRecord=bundledRecord();
  private tune=structuredClone(TUNE);
  constructor(private shipHp?: number, private refreshConfig:()=>void=()=>{}) {
    this.world = new World(this.tune);
    if(shipHp)this.world.invulnerable=true;
  }
  /** Called between fixed ticks. Announce a complete version before its new snapshots. */
  applyConfig(record:ConfigRecord):void{
    if(record.version===this.config.version)return;
    this.config=record;
    for(const group of ['ship','weapon','asteroid','planet'] as const)Object.assign(this.tune[group],structuredClone(record.data.tune[group]));
    for(const p of this.players.values()){
      p.ship.speed=Math.max(this.tune.ship.minSpeed,Math.min(this.tune.ship.maxSpeed,p.ship.speed));
      p.ship.hp=Math.min(this.tune.ship.maxHp,p.ship.hp);
      p.ship.shield=Math.min(this.tune.ship.maxShield,p.ship.shield);
      if(p.queue.length)p.last=p.queue[p.queue.length-1];p.queue=[];p.deficit=0;p.deficitTicks=0;p.owedDash=false;p.started=false;
      this.send(p,JSON.stringify({type:'config',record}));this.send(p,this.snapshotFor(p));
    }
  }

  private get tick(): number {
    return this.world.tick;
  }
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastStepAt = 0;
  private readonly dt = stepSeconds(TUNE);
  private readonly snapshotEvery = Math.max(1, Math.round(TUNE.net.tickHz / TUNE.net.snapshotHz));

  get playerCount(): number {
    return this.players.size;
  }

  /** Attach a freshly accepted socket. Returns false (and closes it) when the room is full. */
  join(ws: CfSocket, requestedName?: string | null): boolean {
    if (this.players.size >= TUNE.net.maxPlayersPerRoom) {
      ws.close(CLOSE.ROOM_FULL, 'room full');
      return false;
    }
    const id = this.allocateId();
    const spawn = this.world.addShip(id);
    const player: Player = { id, ws, ship: spawn, queue: [], last: { ...IDLE_INPUT }, deficit: 0, owedDash: false, reading: Promise.resolve(), started: false, deficitTicks: 0, budgetAt:Date.now(), packets:0, name: cleanName(requestedName) || `Pilot ${id}`, kills: 0 };
    this.players.set(id, player);

    ws.addEventListener('message', (e: MessageEvent) => this.onMessage(player, e.data));
    ws.addEventListener('close', () => this.leave(id));
    ws.addEventListener('error', () => this.leave(id));

    this.send(player,JSON.stringify({type:'config',record:this.config}));
    this.send(player, encodeWelcome(id, this.tick));
    this.send(player, encodeAsteroids([...this.world.asteroids.values()]));
    this.send(player, JSON.stringify({ type: 'pickups', add: [...this.world.pickups.values()].map(({ id, x, y, kind, value }) => ({ id, x, y, kind, value })), remove: [] }));
    this.send(player, this.snapshotFor(player));
    this.broadcastRoster();
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
    if(Date.now()-player.budgetAt>=1000){player.budgetAt=Date.now();player.packets=0;}
    if(++player.packets>120){player.ws.close(1008,'input rate exceeded');return;}
    const bytes=data instanceof ArrayBuffer?data.byteLength:data instanceof Blob?data.size:0;
    if(bytes!==9&&bytes!==18){player.ws.close(CLOSE.BAD_PROTOCOL,'invalid input size');return;}
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
    if (msg.input.seq <= newest || msg.input.seq > newest + 512) return;
    player.queue.push(msg.input);
    while(player.queue.length > TUNE.net.maxQueuedInputs) player.queue.shift();
  }

  private leave(id: number): void {
    if (!this.players.delete(id)) return;
    this.world.removeShip(id);
    this.broadcastRoster();
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
    this.refreshConfig();
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
    this.world.step();
    const ev = this.world.drain();
    if (ev.asteroids.length) this.broadcast(encodeAsteroids(ev.asteroids));
    if (ev.gone.length) this.broadcast(encodeGone(ev.gone));
    if (ev.shots.length) {
      // Each player hears every shot but their own, which they already drew when they fired.
      for (const p of this.players.values()) {
        const others = ev.shots.filter((s) => s.owner !== p.id);
        if (others.length) this.send(p, encodeShots(this.tick, others));
      }
    }
    if (ev.hits.length) this.broadcast(JSON.stringify({ type: 'hits', hits: ev.hits }));
    if (ev.pickups.length || ev.pickupsGone.length) this.broadcast(JSON.stringify({ type: 'pickups', add: ev.pickups, remove: ev.pickupsGone }));
    const dead = new Set(ev.deaths.map((d) => d.id));
    if (ev.deaths.length) {
      // Everyone sees the explosion; whoever fired the killing shot scores.
      this.broadcast(JSON.stringify({ type: 'deaths', deaths: ev.deaths }));
      for (const d of ev.deaths) {
        const killer = d.killer ? this.players.get(d.killer) : undefined;
        if (killer && !dead.has(killer.id)) killer.kills++;
      }
    }
    // Power changes all the time; the leaderboard hears about it twice a second at most.
    if (this.tick % Math.max(1, Math.round(this.tune.net.tickHz / 2)) === 0) {
      const key = [...this.players.values()].map((p) => `${p.id}:${Math.round(p.ship.hp)}`).join(',');
      if (key !== this.rosterKey) this.broadcastRoster();
    }
    if (this.tick % this.snapshotEvery === 0 || dead.size) {
      for (const p of this.players.values()) {
        if (this.tick % this.snapshotEvery === 0 || dead.has(p.id)) this.send(p, this.snapshotFor(p));
      }
    }
    // A destroyed ship leaves the planet. (Wrecks and loot come with the stash milestone.)
    for (const id of dead) {
      const p = this.players.get(id);
      if (!p) continue;
      this.leave(id);
      try {
        p.ws.close(CLOSE.DESTROYED, 'destroyed');
      } catch {
        // Already closed.
      }
    }
  }

  /** Names, kills and power (hull, i.e. minerals carried) for the leaderboard and name tags. */
  private rosterKey = '';
  private broadcastRoster(): void {
    const players = [...this.players.values()];
    this.rosterKey = players.map((p) => `${p.id}:${Math.round(p.ship.hp)}`).join(',');
    this.broadcast(JSON.stringify({ type: 'roster', players: players.map((p) => ({ id: p.id, name: p.name, kills: p.kills, power: Math.round(p.ship.hp) })) }));
  }

  private broadcast(buf: ArrayBuffer | string): void {
    for (const p of this.players.values()) this.send(p, buf);
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
    const steps = 1; // Server clock is authoritative, even when a client floods the queue
    for (let i = 0; i < steps; i++) {
      const input = p.queue.shift();
      if (input) p.last = input;
      else if (p.deficit < TUNE.net.maxGuessedSteps) p.deficit++;
      // A guessed step repeats the last input without its dash; a dash owed from a dropped input applies now.
      const dash = (input ? input.dash : false) || p.owedDash;
      p.owedDash = false;
      this.world.stepShip(p.id, { ...(input ?? p.last), dash });
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

  private send(p: Player, buf: ArrayBuffer|string): void {
    try {
      p.ws.send(buf);
    } catch {
      this.leave(p.id);
    }
  }
}
