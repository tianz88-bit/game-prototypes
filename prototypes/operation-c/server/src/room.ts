import { BASE_CARDS, DEFAULT_LOADOUT, DEFAULT_TUNE, OperationSim } from '../../src/sim';
import type { OperationCheckpoint } from '../../src/sim';
import type { CardKind, Tune } from '../../src/model';
import { ONLINE_COLLECTIONS, ONLINE_PROTOCOL_VERSION, emptyOnlineEntities, emptyOnlineRemoved, parseOnlineClientMessage } from '../../src/online-protocol';
import type { OnlineClientMessage, OnlineCommand, OnlineLobby, OnlineServerMessage, OnlineState, RequestId, Seat } from '../../src/online-protocol';

export const ONLINE_STEP_MS = 100;
export const ONLINE_BROADCAST_MS = 200;
export const ONLINE_COUNTDOWN_MS = 3000;
const MAX_CATCHUP_MS = 10000;
const LOBBY_RETENTION_MS = 30 * 60 * 1000;
const ENDED_RETENTION_MS = 60 * 60 * 1000;
interface AckRecord { key: string; fingerprint: string; message: Extract<OnlineServerMessage, { t: 'ack' }> }
interface RoomSeat { token: string; loadout: CardKind[]; ready: boolean; connectionId: string | null; acks: AckRecord[] }
export interface RoomEnvironment {
  now(): number; token(): string;
  send(connectionId: string, message: OnlineServerMessage): void;
  close(connectionId: string, code: number, reason: string): void;
}
export interface RoomCheckpoint {
  version: 6; roomCode: string; tune: Tune; seats: (RoomSeat | null)[]; phase: OnlineLobby['phase'];
  countdownEndsAtMs: number | null; lastTickWallMs: number; lastBroadcastWallMs: number;
  lastActivityMs: number; endedAtMs: number | null; revision: number; lastStates: (OnlineState | null)[];
  sim: OperationCheckpoint | null;
}

/** Transport-independent two-human room. Seat tokens and checkpoints stay server-side.
 * With no connected humans, work is deferred, not paused: elapsed fixed steps are
 * caught up on reconnect, just as the existing Firestorm room does when unwatched. */
export class OnlineRoom {
  readonly roomCode: string;
  readonly tune: Tune;
  sim: OperationSim | null = null;
  phase: OnlineLobby['phase'] = 'lobby';
  revision = 0;
  private seats: (RoomSeat | null)[] = [null, null];
  private countdownEndsAtMs: number | null = null;
  private lastTickWallMs: number;
  private lastBroadcastWallMs: number;
  private lastActivityMs: number;
  private endedAtMs: number | null = null;
  private lastStates: (OnlineState | null)[] = [null, null];
  private rate = new Map<string, { tokens: number; at: number }>();

  constructor(roomCode: string, private readonly env: RoomEnvironment, tune: Tune = DEFAULT_TUNE) {
    this.roomCode = roomCode; this.tune = structuredClone(tune); this.tune.stepMs = ONLINE_STEP_MS;
    this.lastTickWallMs = this.lastBroadcastWallMs = this.lastActivityMs = env.now();
  }

  connect(connectionId: string, token?: string): { ok: boolean; seat?: Seat; reason?: string } {
    let index = token ? this.seats.findIndex(s => s?.token === token) : this.seats.findIndex(s => s === null);
    if (token && index < 0) return { ok: false, reason: 'invalidToken' };
    if (index < 0 || (!token && this.phase !== 'lobby')) return { ok: false, reason: 'roomFull' };
    if (!this.seats[index]) this.seats[index] = { token: this.env.token(), loadout: [...DEFAULT_LOADOUT], ready: false, connectionId: null, acks: [] };
    const seat = this.seats[index]!;
    if (seat.connectionId && seat.connectionId !== connectionId) {
      this.env.close(seat.connectionId, 4001, 'Seat reconnected elsewhere'); this.rate.delete(seat.connectionId);
    }
    seat.connectionId = connectionId; this.lastActivityMs = this.env.now();
    this.rate.set(connectionId, { tokens: 40, at: this.env.now() });
    this.env.send(connectionId, { t: 'welcome', v: ONLINE_PROTOCOL_VERSION, seat: index as Seat,
      token: seat.token, roomCode: this.roomCode, lobby: this.lobby(), tune: structuredClone(this.tune) });
    this.sendFull(connectionId); this.broadcastLobby();
    return { ok: true, seat: index as Seat };
  }

  /** Rebind a socket retained by the platform's hibernation API. */
  rebind(connectionId: string, seat: Seat): boolean {
    if (!this.seats[seat]) return false;
    return this.connect(connectionId, this.seats[seat]!.token).ok;
  }

  disconnect(connectionId: string): void {
    const seat = this.seats.find(s => s?.connectionId === connectionId);
    if (!seat) return; seat.connectionId = null; this.rate.delete(connectionId);
    if (this.phase === 'lobby' || this.phase === 'countdown') {
      seat.ready = false; this.phase = 'lobby'; this.countdownEndsAtMs = null;
    }
    this.lastActivityMs = this.env.now(); this.broadcastLobby();
  }

  lobby(): OnlineLobby {
    return { phase: this.phase, serverNow: this.env.now(), countdownEndsAtMs: this.countdownEndsAtMs,
      players: this.seats.map((s, i) => ({ seat: i as Seat, connected: !!s?.connectionId, ready: s?.ready ?? false, loadout: [...(s?.loadout ?? [])] })) };
  }

  receive(connectionId: string, raw: string): boolean {
    const index = this.seats.findIndex(s => s?.connectionId === connectionId);
    if (index < 0) return false;
    const seat = this.seats[index]!, now = this.env.now();
    const limit = this.rate.get(connectionId) ?? { tokens: 40, at: now };
    limit.tokens = Math.min(40, limit.tokens + Math.max(0, now - limit.at) * 20 / 1000); limit.at = now;
    this.rate.set(connectionId, limit);
    if (limit.tokens < 1) { this.error(connectionId, 'rateLimited', 'Too many messages'); return false; } limit.tokens--;
    const m = parseOnlineClientMessage(raw);
    if (!m) { this.error(connectionId, 'badMessage', 'Malformed or oversized message'); return false; }
    this.advance(); this.lastActivityMs = now;
    if (m.t === 'ping') { this.env.send(connectionId, { t: 'pong', clientMs: m.clientMs, serverNow: now }); return false; }
    if (m.t === 'resync') { this.sendFull(connectionId); return false; }
    const key = `${typeof m.requestId}:${m.requestId}`, fingerprint = JSON.stringify(m);
    const previous = seat.acks.find(a => a.key === key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) this.error(connectionId, 'requestIdReuse', 'Use a new request ID for each action');
      else this.env.send(connectionId, previous.message);
      return false;
    }
    let result: { ok: boolean; reason?: string };
    if (m.t === 'loadout') result = this.setLoadout(index as Seat, m.cards);
    else if (m.t === 'ready') result = this.setReady(index as Seat, m.ready);
    else result = this.command(index as Seat, m.command);
    const ack: Extract<OnlineServerMessage, { t: 'ack' }> = { t: 'ack', requestId: m.requestId, ...result };
    seat.acks.push({ key, fingerprint, message: ack }); if (seat.acks.length > 128) seat.acks.shift();
    this.env.send(connectionId, ack);
    return true;
  }

  private setLoadout(index: Seat, cards: CardKind[]): { ok: boolean; reason?: string } {
    if (this.phase !== 'lobby') return { ok: false, reason: 'Loadouts are locked after ready countdown starts' };
    if (!cards.length || cards.length > 7 || new Set(cards).size !== cards.length || cards.some(c => !BASE_CARDS.includes(c)) ||
      !cards.some(c => this.tune.cards[c].tier === 1 && this.tune.cards[c].domain === 'ground' && !this.tune.cards[c].utility)) return { ok: false, reason: 'Choose up to seven unique base cards including a T1 ground producer' };
    this.seats[index]!.loadout = [...cards]; this.seats[index]!.ready = false; this.broadcastLobby(); return { ok: true };
  }

  private setReady(index: Seat, ready: boolean): { ok: boolean; reason?: string } {
    if (this.phase !== 'lobby' && this.phase !== 'countdown') return { ok: false, reason: 'Round already started' };
    this.seats[index]!.ready = ready;
    if (!ready) { this.phase = 'lobby'; this.countdownEndsAtMs = null; }
    else if (this.phase !== 'countdown' && this.seats.every(s => s?.ready && s.connectionId)) { this.phase = 'countdown'; this.countdownEndsAtMs = this.env.now() + ONLINE_COUNTDOWN_MS; }
    this.broadcastLobby(); return { ok: true };
  }

  private command(seat: Seat, c: OnlineCommand): { ok: boolean; reason?: string } {
    const sim = this.sim;
    if (this.phase !== 'playing' || !sim) return { ok: false, reason: 'Round is not playing' };
    if (this.env.now() - this.lastTickWallMs >= ONLINE_STEP_MS) return { ok: false, reason: 'Match is catching up; retry shortly' };
    if (!sim.players[seat].alive) return { ok: false, reason: 'Player eliminated' };
    switch (c.kind) {
      case 'place': return sim.place(seat, c.hexId, c.card);
      case 'target':
        if (!sim.players[c.targetId]?.alive) return { ok: false, reason: 'Target eliminated' };
        sim.setTarget(seat, c.targetId); return { ok: true };
      case 'research': return sim.startResearch(seat, c.hqId);
      case 'cancelResearch': return sim.cancelResearch(seat);
      case 'upgrade': return sim.upgrade(seat, c.buildingId);
      case 'cancelUpgrade': return sim.cancelUpgrade(seat, c.buildingId);
      case 'sell': return sim.sell(seat, c.buildingId);
      case 'cancelConstruction': return sim.cancelConstruction(seat, c.buildingId);
      case 'attackBuilding': return sim.setAttackTarget(seat, c.entityId);
      case 'defend': return sim.setDefendTarget(seat, c.entityId);
      case 'launchNuke': return sim.launchNuke(seat, c.buildingId, c.hexId);
    }
  }

  advance(): void {
    const now = this.env.now();
    if (this.phase === 'countdown' && this.countdownEndsAtMs !== null && now >= this.countdownEndsAtMs) {
      if (!this.seats.every(s => s?.ready && s.connectionId)) { this.phase = 'lobby'; this.countdownEndsAtMs = null; this.broadcastLobby(); return; }
      this.sim = new OperationSim({ bot: false, tune: this.tune, loadouts: this.seats.map(s => [...s!.loadout]) });
      this.sim.players[0].name = 'Player 1'; this.sim.players[1].name = 'Player 2';
      this.lastTickWallMs = this.countdownEndsAtMs; this.phase = 'playing'; this.countdownEndsAtMs = null;
      this.broadcastState(true); this.broadcastLobby();
    }
    if (this.phase !== 'playing' || !this.sim) return;
    const elapsed = Math.max(0, Math.min(MAX_CATCHUP_MS, now - this.lastTickWallMs));
    if (elapsed > 0) { this.sim.tick(elapsed); this.lastTickWallMs += elapsed; }
    const ended = this.sim.winner !== null;
    if (ended || now - this.lastBroadcastWallMs >= ONLINE_BROADCAST_MS) this.broadcastState(false);
    if (ended) { this.phase = 'ended'; this.endedAtMs = now; this.broadcastLobby(); }
  }

  nextWakeAt(): number | null {
    if (this.phase === 'countdown') return this.countdownEndsAtMs;
    // Two deterministic 100ms steps per wake; state transport stays at 5Hz.
    if (this.phase === 'playing') return this.seats.some(s => s?.connectionId) ? this.env.now() + ONLINE_BROADCAST_MS : null;
    if (this.phase === 'ended') return (this.endedAtMs ?? this.env.now()) + ENDED_RETENTION_MS;
    return this.lastActivityMs + LOBBY_RETENTION_MS;
  }

  expired(): boolean {
    return this.phase === 'lobby' ? this.env.now() >= this.lastActivityMs + LOBBY_RETENTION_MS :
      this.phase === 'ended' && this.env.now() >= (this.endedAtMs ?? this.env.now()) + ENDED_RETENTION_MS;
  }

  private snapshot(seat: Seat): OnlineState {
    const s = this.sim!;
    return structuredClone({ t: 'state', full: true, baseRevision: null, revision: this.revision, serverNow: this.env.now(),
      timeMs: s.timeMs, winner: s.winner, players: s.players, resources: s.players.map(p => s.resources(p.id)),
      loadouts: s.loadouts, pendingReleases: s.pendingReleases,
      entities: { hexes: s.hexes, buildings: s.buildings.map(b => {
        const publicBuilding = { ...b };
        if (b.owner !== seat) {
          delete publicBuilding.nukeReadyAtMs;
          if (b.kind !== 'hq' && this.tune.cards[b.kind].utility === 'silo') {
            publicBuilding.readyAtMs = 0; delete publicBuilding.productionStartedAtMs; delete publicBuilding.cooldownActive;
          }
        }
        return publicBuilding;
      }), units: s.units, shots: s.shots, reinforcements: s.reinforcements, retirements: s.retirements,
      nukeFlights: s.nukeFlights.filter(f => f.owner === seat), nuclearImpacts: s.nuclearImpacts },
      removed: emptyOnlineRemoved() });
  }

  private broadcastState(forceFull: boolean): void {
    if (!this.sim) return;
    this.revision++;
    for (let seat = 0; seat < this.seats.length; seat++) {
    const current = this.snapshot(seat as Seat), previous = this.lastStates[seat];
    let outgoing = current;
    if (!forceFull && previous) {
      outgoing = { ...current, full: false, baseRevision: previous.revision, entities: emptyOnlineEntities(), removed: emptyOnlineRemoved() };
      for (const name of ONLINE_COLLECTIONS) {
        const old = new Map<string | number, string>((previous.entities[name] as { id: string | number }[]).map(v => [v.id, JSON.stringify(v)]));
        const next = new Set<string | number>();
        for (const item of current.entities[name]) { next.add(item.id); if (old.get(item.id) !== JSON.stringify(item)) (outgoing.entities[name] as { id: string | number }[]).push(item); }
        for (const id of old.keys()) if (!next.has(id)) (outgoing.removed[name] as (string | number)[]).push(id);
      }
    }
    this.lastStates[seat] = current;
    const connectionId = this.seats[seat]?.connectionId; if (connectionId) this.env.send(connectionId, outgoing);
    }
    this.lastBroadcastWallMs = this.env.now();
  }

  private sendFull(connectionId: string): void {
    // Use the broadcast baseline, not an unrevisioned intermediate tick. Otherwise
    // a reconnect between 200ms pulses could miss a change that later reverses.
    const seat = this.seats.findIndex(s => s?.connectionId === connectionId), state = this.lastStates[seat];
    if (state) this.env.send(connectionId, { ...structuredClone(state), full: true, baseRevision: null });
  }
  private broadcast(message: OnlineServerMessage): void { for (const s of this.seats) if (s?.connectionId) this.env.send(s.connectionId, message); }
  private broadcastLobby(): void { this.broadcast({ t: 'lobby', ...this.lobby() }); }
  private error(connectionId: string, code: string, message: string): void { this.env.send(connectionId, { t: 'error', code, message }); }

  checkpoint(): RoomCheckpoint {
    return structuredClone({ version: 6, roomCode: this.roomCode, tune: this.tune, seats: this.seats, phase: this.phase,
      countdownEndsAtMs: this.countdownEndsAtMs, lastTickWallMs: this.lastTickWallMs, lastBroadcastWallMs: this.lastBroadcastWallMs,
      lastActivityMs: this.lastActivityMs, endedAtMs: this.endedAtMs, revision: this.revision, lastStates: this.lastStates, sim: this.sim?.checkpoint() ?? null });
  }
  static restore(checkpoint: RoomCheckpoint, env: RoomEnvironment): OnlineRoom {
    if (checkpoint.version !== 6) throw new Error('Unsupported room checkpoint');
    const data = structuredClone(checkpoint), room = new OnlineRoom(data.roomCode, env, data.tune);
    room.seats = data.seats; for (const s of room.seats) if (s) s.connectionId = null;
    room.phase = data.phase; room.countdownEndsAtMs = data.countdownEndsAtMs;
    room.lastTickWallMs = data.lastTickWallMs; room.lastBroadcastWallMs = data.lastBroadcastWallMs;
    room.lastActivityMs = data.lastActivityMs; room.endedAtMs = data.endedAtMs; room.revision = data.revision; room.lastStates = data.lastStates;
    room.sim = data.sim ? OperationSim.restore(data.sim) : null;
    return room;
  }
}
