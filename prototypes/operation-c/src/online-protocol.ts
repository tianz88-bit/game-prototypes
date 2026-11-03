import type { Building, BuildKind, CardKind, Hex, NuclearImpact, NukeFlight, PendingRelease, Player, Reinforcement, Retirement, Shot, Tune, Unit } from './model';

export const ONLINE_PROTOCOL_VERSION = 6;
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
export const MAX_ONLINE_MESSAGE_BYTES = 4096;
export type Seat = 0 | 1;
export type RequestId = string | number;
export type OnlineCommand =
  | { kind: 'place'; hexId: string; card: BuildKind }
  | { kind: 'target'; targetId: Seat }
  | { kind: 'defend' | 'attackBuilding'; entityId: string }
  | { kind: 'launchNuke'; buildingId: string; hexId: string }
  | { kind: 'research'; hqId?: string }
  | { kind: 'cancelResearch' }
  | { kind: 'upgrade' | 'cancelUpgrade' | 'sell' | 'cancelConstruction'; buildingId: string };
export type OnlineClientMessage =
  | { t: 'loadout'; requestId: RequestId; cards: CardKind[] }
  | { t: 'ready'; requestId: RequestId; ready: boolean }
  | { t: 'command'; requestId: RequestId; command: OnlineCommand }
  | { t: 'resync' }
  | { t: 'ping'; clientMs: number };
export interface OnlineLobbyPlayer { seat: Seat; connected: boolean; ready: boolean; loadout: CardKind[] }
export interface OnlineLobby {
  phase: 'lobby' | 'countdown' | 'playing' | 'ended'; players: OnlineLobbyPlayer[];
  countdownEndsAtMs: number | null; serverNow: number;
}
export interface OnlineEntities {
  hexes: Hex[]; buildings: Building[]; units: Unit[]; shots: Shot[];
  reinforcements: Reinforcement[]; retirements: Retirement[];
  nukeFlights: NukeFlight[]; nuclearImpacts: NuclearImpact[];
}
export interface OnlineRemoved {
  hexes: string[]; buildings: string[]; units: string[]; shots: number[];
  reinforcements: string[]; retirements: number[];
  nukeFlights: string[]; nuclearImpacts: number[];
}
export interface OnlineState {
  t: 'state'; full: boolean; baseRevision: number | null; revision: number;
  serverNow: number; timeMs: number; winner: number | null; players: Player[];
  resources: { committed: number; capacity: number; stranded: number }[];
  loadouts: CardKind[][]; pendingReleases: PendingRelease[];
  entities: OnlineEntities; removed: OnlineRemoved;
}
export type OnlineServerMessage =
  | { t: 'welcome'; v: number; seat: Seat; token: string; roomCode: string; lobby: OnlineLobby; tune: Tune }
  | ({ t: 'lobby' } & OnlineLobby)
  | { t: 'ack'; requestId: RequestId; ok: boolean; reason?: string }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong'; clientMs: number; serverNow: number }
  | OnlineState;
// Aliases keep client imports short without coupling presentation to the server.
export type ClientMessage = OnlineClientMessage;
export type ServerMessage = OnlineServerMessage;

export function generateRoomCode(random: (array: Uint8Array) => Uint8Array = a => crypto.getRandomValues(a)): string {
  return [...random(new Uint8Array(5))].map(n => ROOM_ALPHABET[n % ROOM_ALPHABET.length]).join('');
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: string[]) => Object.keys(v).length === expected.length && Object.keys(v).every(k => expected.includes(k));
const id = (v: unknown) => typeof v === 'string' ? /^[A-Za-z0-9_.:-]{1,64}$/.test(v) : Number.isSafeInteger(v) && Number(v) >= 0;
const ref = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_,:-]{1,64}$/.test(v);
export function parseOnlineClientMessage(raw: string): OnlineClientMessage | null {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_ONLINE_MESSAGE_BYTES) return null;
  let m: unknown; try { m = JSON.parse(raw); } catch { return null; }
  if (!record(m)) return null;
  if (m.t === 'resync' && keys(m, ['t'])) return m as OnlineClientMessage;
  if (m.t === 'ping' && keys(m, ['t', 'clientMs']) && typeof m.clientMs === 'number' && Number.isFinite(m.clientMs)) return m as OnlineClientMessage;
  if (!id(m.requestId)) return null;
  if (m.t === 'loadout' && keys(m, ['t', 'requestId', 'cards']) && Array.isArray(m.cards) && m.cards.length <= 7 && m.cards.every(c => typeof c === 'string' && c.length < 24)) return m as OnlineClientMessage;
  if (m.t === 'ready' && keys(m, ['t', 'requestId', 'ready']) && typeof m.ready === 'boolean') return m as OnlineClientMessage;
  if (m.t !== 'command' || !keys(m, ['t', 'requestId', 'command']) || !record(m.command)) return null;
  const c = m.command;
  if (c.kind === 'place' && keys(c, ['kind', 'hexId', 'card']) && ref(c.hexId) && typeof c.card === 'string' && c.card.length < 24) return m as OnlineClientMessage;
  if (c.kind === 'target' && keys(c, ['kind', 'targetId']) && (c.targetId === 0 || c.targetId === 1)) return m as OnlineClientMessage;
  if ((c.kind === 'defend' || c.kind === 'attackBuilding') && keys(c, ['kind', 'entityId']) && ref(c.entityId)) return m as OnlineClientMessage;
  if (c.kind === 'launchNuke' && keys(c, ['kind', 'buildingId', 'hexId']) && ref(c.buildingId) && ref(c.hexId)) return m as OnlineClientMessage;
  if (c.kind === 'research' && (keys(c, ['kind']) || keys(c, ['kind', 'hqId']) && ref(c.hqId))) return m as OnlineClientMessage;
  if (c.kind === 'cancelResearch' && keys(c, ['kind'])) return m as OnlineClientMessage;
  if (['upgrade', 'cancelUpgrade', 'sell', 'cancelConstruction'].includes(String(c.kind)) && keys(c, ['kind', 'buildingId']) && ref(c.buildingId)) return m as OnlineClientMessage;
  return null;
}

export const ONLINE_COLLECTIONS = ['hexes', 'buildings', 'units', 'shots', 'reinforcements', 'retirements', 'nukeFlights', 'nuclearImpacts'] as const;
export function emptyOnlineEntities(): OnlineEntities { return { hexes: [], buildings: [], units: [], shots: [], reinforcements: [], retirements: [], nukeFlights: [], nuclearImpacts: [] }; }
export function emptyOnlineRemoved(): OnlineRemoved { return { hexes: [], buildings: [], units: [], shots: [], reinforcements: [], retirements: [], nukeFlights: [], nuclearImpacts: [] }; }

/** Returns null on a revision gap; request resync instead of applying a broken delta.
 * Full states replace every collection, including after reconnect or server recovery. */
export function applyOnlineState(previous: OnlineState | null, message: OnlineState): OnlineState | null {
  if (message.full) return structuredClone(message);
  if (!previous || message.baseRevision !== previous.revision || message.revision <= previous.revision) return null;
  const entities = emptyOnlineEntities();
  for (const name of ONLINE_COLLECTIONS) {
    const items = new Map<string | number, { id: string | number }>((previous.entities[name] as { id: string | number }[]).map(v => [v.id, v]));
    for (const removed of message.removed[name]) items.delete(removed);
    for (const changed of message.entities[name]) items.set(changed.id, changed);
    (entities[name] as { id: string | number }[]) = [...items.values()];
  }
  return structuredClone({ ...message, full: true, baseRevision: null, entities, removed: emptyOnlineRemoved() });
}
