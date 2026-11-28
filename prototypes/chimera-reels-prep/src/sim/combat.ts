// Pure combat simulation (3 reels: move, target, mutator). No rendering and
// no input devices: the game loop feeds it player decisions (from intents)
// and elapsed time, and reads back state plus events for the renderer.
import { tune } from '../tune';
import {
  isMove,
  isTarget,
  MOVES,
  MUTATORS,
  PARTS,
  SLOT_ZONE,
  SLOTS,
  targetTile,
  ZONES,
  zoneOf,
  type ArmourId,
  type MonsterSpec,
  type MoveId,
  type PartId,
  type SoulId,
  type ReelIndex,
  type Slot,
  type TileId,
  type ZoneId,
} from './content';
import { pickIndex, type Rng } from './rng';

export type Side = 'player' | 'enemy';
export const REELS: ReelIndex[] = [0, 1, 2];

/** One position on a reel strip. `part` is the index of the part that supplied it. */
export interface StripTile {
  id: TileId;
  part?: number;
  broken?: boolean;
}

export interface PocketTile {
  id: TileId;
  part?: number;
}

export interface PartState {
  id: PartId;
  slot: Slot;
  zone: ZoneId | null;
  hp: number;
  maxHp: number;
  broken: boolean;
  weak: number;
}

export interface Fighter {
  side: Side;
  name: string;
  spec: MonsterSpec;
  soul: SoulId;
  hp: number;
  maxHp: number;
  shield: number;
  shieldMult: number;
  stats: { speed: number; atk: number; def: number };
  armour: ArmourId;
  parts: PartState[];
  strips: [StripTile[], StripTile[], StripTile[]];
  reelPos: [number, number, number];
  cooldown: number;
  /** Cooldown already paid off by Quick beyond 100%, applied after the next landing. */
  quickBank: number;
  spinLeft: number;
  spinTotal: number;
  /** This spin lands a super (the move reel lands last, slowly). */
  tease: boolean;
  /** A landed result is waiting for Execute or Pocket. */
  landed: boolean;
  pocket: PocketTile[];
  /** Number of tile types the pocket can hold; each type stacks up to the stack cap. */
  pocketSize: number;
  aiWait: number;
  /** Prep state for the current round. Queued rows, in the order chosen. */
  queued: number[];
  /** Paid re-spins used this round (prices rise with each). */
  paidSpins: number;
  /** Nudges this round that cost no gold (speed past the slot cap). */
  freeNudges: number;
  /** Head start this round, in action gaps (speed past the slot cap, Quick burns). */
  initiative: number;
  /** Power+ burn bonus for this round's first action (0 = none). */
  boost: number;
  /** Actions locked in for the clash. */
  plan: PlannedAction[];
  /** Seconds the side's clash timeline has been pulled forward by Quick. */
  quickShift: number;
}

/** One queued row, frozen when the player presses Fight. */
export interface PlannedAction {
  side: Side;
  row: number;
  move: MoveId;
  target: TileId;
  mut: TileId;
  /** Part index that supplied the move tile (the action fizzles if it breaks). */
  part: number | undefined;
  /** Seconds into the clash it is due (before Quick pulls it forward). */
  at: number;
  done: boolean;
}

export type CombatEvent =
  | { type: 'spin'; side: Side; tease: boolean }
  | { type: 'nudge'; side: Side; reel: ReelIndex; dir: 1 | -1 }
  | { type: 'reelLand'; side: Side; reel: ReelIndex }
  | { type: 'land'; side: Side }
  | { type: 'lost'; side: Side }
  | { type: 'action'; side: Side; move: MoveId; tier: number; isSuper: boolean; burn: boolean; zone: ZoneId; consumed: { id: TileId; from: number }[] }
  | { type: 'hit'; side: Side; amount: number; shielded: number; part: number; weak: boolean; resist: number }
  | { type: 'miss'; side: Side; reason: string }
  | { type: 'shield'; side: Side; amount: number }
  | { type: 'drop'; side: Side; count: number; part: number; from: number }
  | { type: 'break'; side: Side; part: number; cancelled: boolean }
  | { type: 'pocket'; side: Side; stored: { id: TileId; from: number; to: number; tile: PocketTile }[]; discarded: number[] }
  | { type: 'burn'; side: Side; id: TileId; count: number; from: number[] }
  | { type: 'sabotage'; side: Side; part: number; amount: number; shielded: number }
  | { type: 'fizzle'; side: Side; move: MoveId; part: string }
  | { type: 'clash'; round: number }
  | { type: 'prep'; round: number }
  | { type: 'end'; winner: Side };

/** One Execute or Burn and what came of it, for the post-battle log. */
export interface LogEntry {
  t: number;
  side: Side;
  kind: 'execute' | 'burn';
  /** Move, or the burned tile. */
  tile: TileId;
  count: number;
  tier: number;
  zone: ZoneId | null;
  mut: TileId;
  mutStack: number;
  damage: number;
  shielded: number;
  weak: boolean;
  resist: number;
  broke: string | null;
  knockedOut: boolean;
  shieldGain: number;
  /** Sabotage burn: the damage went to a part only, not to HP. */
  partOnly: boolean;
  /** Power+ burn bonus applied to this action (0 = none). */
  boost: number;
  miss: string | null;
}

export interface Combat {
  fighters: Record<Side, Fighter>;
  winner: Side | null;
  events: CombatEvent[];
  rng: Rng;
  /** Seconds of fight time so far. */
  time: number;
  log: LogEntry[];
  /** When false the built-in enemy AI is off (headless sims drive both sides). */
  enemyAi: boolean;
  phase: 'prep' | 'clash';
  round: number;
  /** Seconds into the current clash. */
  clashT: number;
  /** Seconds since the last action fired (actions are spaced for readability). */
  sinceFire: number;
}

export const other = (s: Side): Side => (s === 'player' ? 'enemy' : 'player');

type PartStats = { hp: number; speed: number; atk: number; def: number; weak: number; pocket?: number; shield?: number };
type SoulStats = { hp: number; atk: number; def: number; speed: number; shield: number; pocket: number } & Record<string, number>;
export const soulStats = (id: SoulId) => tune.souls[id] as SoulStats;
const statsOf = (id: PartId) => tune.parts.stats[id] as PartStats;

// ---------------------------------------------------------------- building

function shuffle<T>(rng: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = pickIndex(rng, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export interface FighterScale { hp: number; atk: number }

export function makeFighter(side: Side, spec: MonsterSpec, scale: FighterScale = { hp: 1, atk: 1 }): Fighter {
  let hp = 0;
  let shieldMult = 0;
  const stats = { speed: 0, atk: 0, def: 0 };
  let pocketSize = tune.pocket.defaultSize;
  let armour: ArmourId = 'hide';
  const pocket: PocketTile[] = [];
  SLOTS.forEach((slot, index) => {
    const id = spec.build[slot];
    const st = statsOf(id);
    hp += st.hp;
    stats.speed += st.speed;
    stats.atk += st.atk;
    stats.def += st.def;
    shieldMult += st.shield ?? 0;
    pocketSize += st.pocket ?? 0;
    if (PARTS[id].armour) armour = PARTS[id].armour!;
    for (const t of PARTS[id].startPocket ?? []) pocket.push({ id: t, part: index });
  });
  pocket.sort(pocketOrder);
  // The Soul: species stats on top of the parts.
  const soul = soulStats(spec.soul);
  hp += soul.hp;
  stats.speed += soul.speed;
  stats.atk += soul.atk;
  stats.def += soul.def;
  shieldMult += soul.shield;
  pocketSize += soul.pocket;
  hp = Math.round(hp * scale.hp);
  stats.atk *= scale.atk;
  const breakMult = tune.armour[armour].breakMult;
  const parts: PartState[] = SLOTS.map((slot) => {
    const id = spec.build[slot];
    const maxHp = Math.round(hp * tune.parts.breakPct * breakMult);
    return { id, slot, zone: SLOT_ZONE[slot], hp: maxHp, maxHp, broken: false, weak: statsOf(id).weak };
  });
  return {
    side, name: spec.name, spec, soul: spec.soul, hp, maxHp: hp,
    // Stoneheart: starts each fight shielded.
    shield: Math.round(hp * (soul.startShieldPct ?? 0)), shieldMult: Math.max(0.2, shieldMult),
    stats, armour, parts, strips: [[], [], []], reelPos: [0, 0, 0],
    cooldown: tune.timing.baseCooldownSec * (side === 'player' ? 0.35 : 0.55),
    queued: [], paidSpins: 0, freeNudges: 0, initiative: 0, boost: 0, plan: [], quickShift: 0,
    quickBank: 0, spinLeft: 0, spinTotal: 0, tease: false, landed: false, pocket, pocketSize, aiWait: 0,
  };
}

const brokenCount = (f: Fighter) => f.parts.filter((p) => p.broken).length;

/** Rebuild a fighter's three strips from the current state of both monsters. */
function buildStrips(c: Combat, f: Fighter) {
  const r = tune.reels;
  const foe = c.fighters[other(f.side)];
  const moves: StripTile[] = [];
  const muts: StripTile[] = [];
  f.parts.forEach((p, i) => {
    if (p.broken) return;
    for (const m of PARTS[p.id].moves) moves.push({ id: m, part: i });
    for (const m of PARTS[p.id].mutators) muts.push({ id: m, part: i });
  });
  for (const t of f.spec.extra) (isMove(t) ? moves : muts).push({ id: t });
  // Move reel never runs dry: repeat your own moves to fill it.
  const base = moves.length;
  for (let i = 0; base > 0 && moves.length < r.minLength; i++) moves.push({ ...moves[i % base] });
  while (moves.length < r.minLength) moves.push({ id: 'blank' });
  for (let i = 0; i < Math.floor(brokenCount(f) / r.partsBrokenPerBlank); i++) moves.push({ id: 'blank' });
  while (muts.length < r.minLength) muts.push({ id: 'blank' });

  // Target reel: the enemy's remaining parts, padded with Body.
  const targets: StripTile[] = [];
  const foeFlying = isFlying(foe);
  for (const p of foe.parts) {
    if (p.broken || !p.zone || p.zone === 'body') continue;
    if (p.zone === 'legs' && foeFlying) continue;
    const n = (r.targetTiles as Record<ZoneId, number>)[p.zone];
    for (let i = 0; i < n; i++) targets.push({ id: targetTile(p.zone) });
  }
  for (let i = 0; i < r.targetTiles.body; i++) targets.push({ id: 't_body' });
  while (targets.length < r.minLength) targets.push({ id: 't_body' });
  for (let i = 0; i < Math.floor(brokenCount(foe) / r.partsBrokenPerBlank); i++) targets.push({ id: 'blank' });

  f.strips = [shuffle(c.rng, moves), shuffle(c.rng, targets), shuffle(c.rng, muts)];
  f.reelPos = [pickIndex(c.rng, moves.length), pickIndex(c.rng, targets.length), pickIndex(c.rng, muts.length)];
}

export function createCombat(player: Fighter, enemy: Fighter, rng: Rng): Combat {
  const c: Combat = {
    fighters: { player, enemy }, winner: null, events: [], rng, time: 0, log: [], enemyAi: true,
    phase: 'prep', round: 0, clashT: 0, sinceFire: 0,
  };
  buildStrips(c, player);
  buildStrips(c, enemy);
  startRound(c);
  return c;
}

// ---------------------------------------------------------------- reading

/** The 3 visible tiles of one reel: [above, line, below]. */
export function reelWindow(f: Fighter, reel: ReelIndex): [StripTile, StripTile, StripTile] {
  const strip = f.strips[reel];
  const n = strip.length;
  const p = f.reelPos[reel];
  return [strip[(p - 1 + n) % n], strip[p], strip[(p + 1) % n]];
}

/** All 9 visible tiles. `slot` is reel * 3 + row; row 1 is the line. */
export function visibleTiles(f: Fighter) {
  const out: { id: TileId; part?: number; broken?: boolean; line: boolean; slot: number; reel: ReelIndex }[] = [];
  for (const reel of REELS) reelWindow(f, reel).forEach((t, row) => out.push({ ...t, line: row === 1, slot: reel * 3 + row, reel }));
  return out;
}

const countIn = (list: PocketTile[], id: TileId) => list.reduce((n, t) => n + (t.id === id ? 1 : 0), 0);

/** Groups of identical pocketed tiles, in first-seen order (burn targets). */
export function pocketGroups(f: Fighter): { id: TileId; count: number }[] {
  const groups: { id: TileId; count: number }[] = [];
  for (const t of f.pocket) {
    const g = groups.find((x) => x.id === t.id);
    if (g) g.count++;
    else groups.push({ id: t.id, count: 1 });
  }
  return groups;
}

/** The line's tile ids; a tile gone dark from a part break counts as blank. */
export function lineTiles(f: Fighter) {
  const id = (r: ReelIndex): TileId => {
    const t = reelWindow(f, r)[1];
    return t.broken ? 'blank' : t.id;
  };
  return { move: id(0), target: id(1), mut: id(2) };
}

/** Pocketed duplicates Execute would consume right now. */
export function executeMatches(f: Fighter) {
  const { move, target, mut } = lineTiles(f);
  const cb = tune.combat;
  return {
    move, target, mut,
    tier: isMove(move) ? Math.min(3, countIn(f.pocket, move)) : 0,
    targetMatches: isTarget(target) ? Math.min(cb.targetMatchCap, countIn(f.pocket, target)) : 0,
    mutMatches: mut !== 'blank' ? Math.min(cb.mutatorMatchCap, countIn(f.pocket, mut)) : 0,
  };
}

export function isFlying(f: Fighter): boolean {
  return f.parts.some((p) => !p.broken && PARTS[p.id].flight);
}

/** Index of the designated weakspot: the unbroken hittable part with the highest weak value. */
export function weakspot(f: Fighter): number {
  let best = -1;
  f.parts.forEach((p, i) => {
    if (p.broken || !p.zone) return;
    if (best < 0 || p.weak > f.parts[best].weak) best = i;
  });
  return best;
}

export function fragility(f: Fighter): number {
  return f.parts.reduce((s, p) => s + (p.broken ? 0 : p.weak), 0) * tune.parts.fragilityPerWeak;
}

export function shieldCap(f: Fighter): number {
  return Math.round(f.maxHp * (tune.shield.capPct + (soulStats(f.soul).capBonus ?? 0)));
}

export function partForZone(f: Fighter, zone: ZoneId): number {
  const i = f.parts.findIndex((p) => p.zone === zone && !p.broken);
  return i >= 0 ? i : SLOTS.indexOf('body');
}

export interface HitCalc { damage: number; toShield: number; toHp: number; part: number; weak: boolean; resist: number }

/** Exact damage of a move at a zone. Pure: used for both previews and resolution. */
/** `pierce` (0..1) is the share of the defender's shield a hit ignores (supers). */
export function computeHit(attacker: Fighter, defender: Fighter, move: MoveId, zone: ZoneId, mult: number, pierce = 0, isSuper = false): HitCalc {
  const resist = tune.armour[defender.armour][MOVES[move].dmg];
  const part = partForZone(defender, zone);
  const weak = part === weakspot(defender);
  const held = countIn(defender.pocket, targetTile(zone));
  const reduce = Math.min(tune.combat.holdReduceCap, held * tune.combat.holdReducePerTile);
  let dmg = (tune.moves[move] as { power: number }).power * mult * attacker.stats.atk * resist;
  if (weak) dmg *= tune.parts.weakspotMult;
  // Hoarder: supers on a weak spot hit harder.
  if (weak && isSuper) dmg *= 1 + (soulStats(attacker.soul).superWeakBonus ?? 0);
  dmg *= (1 + fragility(defender)) * (1 - reduce) / Math.max(0.3, defender.stats.def);
  const damage = Math.max(1, Math.round(dmg));
  const toShield = Math.min(Math.round(defender.shield * (1 - pierce)), damage);
  return { damage, toShield, toHp: damage - toShield, part, weak, resist };
}

/** Multiplier from tier, target matches and a Power+ mutator. */
function lineMult(m: ReturnType<typeof executeMatches>): number {
  const cb = tune.combat;
  let mult = cb.tierMult[m.tier] * (1 + m.targetMatches * cb.targetMatchBonus);
  if (m.mut === 'power') mult *= 1 + (tune.mutators.power.mult - 1) * (1 + m.mutMatches * cb.mutatorMatchBonus);
  return mult;
}

export interface Preview { move: MoveId; zone: ZoneId; hit: HitCalc; tier: number }

/** What Execute would deal right now, or null when the line has no attack or no target. */
export function previewExecute(c: Combat, side: Side): Preview | null {
  const f = c.fighters[side];
  const m = executeMatches(f);
  if (!isMove(m.move) || !isTarget(m.target)) return null;
  const zone = zoneOf(m.target);
  return { move: m.move, zone, tier: m.tier, hit: computeHit(f, c.fighters[other(side)], m.move, zone, lineMult(m), superPierce(m.tier), m.tier >= 3) };
}

/** Damage of burning `n` Body target tiles: flat, soaked by shields like any hit. */
function targetBurnHit(foe: Fighter, zone: ZoneId, n: number): HitCalc {
  const damage = tune.combat.targetBurnDamage[n];
  const toShield = Math.min(foe.shield, damage);
  return { damage, toShield, toHp: damage - toShield, part: partForZone(foe, zone), weak: false, resist: 1 };
}

export interface Sabotage {
  /** Index of the enemy part hit. */
  part: number;
  /** Damage before shields (a share of the part's max HP). */
  amount: number;
  toShield: number;
  /** Damage the part takes after the shield. */
  toPart: number;
  breaks: boolean;
}

/**
 * Sabotage: burning `n` target tiles of a breakable part deals a share of that
 * part's max HP (`combat.sabotagePct`) to the part only, never to the monster's
 * HP. Shields soak it first. Null for Body (it cannot break; Body burns chip HP).
 */
export function sabotageHit(foe: Fighter, zone: ZoneId, n: number): Sabotage | null {
  const part = partForZone(foe, zone);
  const p = foe.parts[part];
  if (!p || p.slot === 'body' || p.broken) return null;
  const amount = Math.max(1, Math.round(p.maxHp * tune.combat.sabotagePct[Math.min(3, n)]));
  const toShield = Math.min(foe.shield, amount);
  const toPart = amount - toShield;
  return { part, amount, toShield, toPart, breaks: toPart >= p.hp };
}

/** Index of the stack (tile type) holding `id` in the sorted pocket, or -1. */
export function stackIndex(f: Fighter, id: TileId): number {
  return pocketGroups(f).findIndex((g) => g.id === id);
}

/** What Pocket would store and discard right now, without changing anything. */
export function planPocket(f: Fighter) {
  const cap = tune.pocket.stackCap;
  const tiles = visibleTiles(f).filter((t) => !t.line && t.id !== 'blank' && !t.broken);
  const counts = new Map(pocketGroups(f).map((g) => [g.id, g.count] as [TileId, number]));
  // Duplicates of held tiles first, then move, target and mutator tiles.
  const ordered = [...tiles].sort((a, b) => (counts.has(b.id) ? 1 : 0) - (counts.has(a.id) ? 1 : 0) || a.slot - b.slot);
  const store: typeof tiles = [];
  const discard: typeof tiles = [];
  for (const t of ordered) {
    const n = counts.get(t.id) ?? 0;
    if (n >= cap || (n === 0 && counts.size >= f.pocketSize)) discard.push(t);
    else {
      counts.set(t.id, n + 1);
      store.push(t);
    }
  }
  return { store, discard };
}

/** How many more tiles the pocket could take (free stack space plus empty type slots). */
export function pocketRoom(f: Fighter): number {
  const cap = tune.pocket.stackCap;
  const groups = pocketGroups(f);
  return groups.reduce((s, g) => s + Math.max(0, cap - g.count), 0) + Math.max(0, f.pocketSize - groups.length) * cap;
}

/** Pocketed tiles that came from one part: move tiles can be knocked out, all drop on a break. */
export function tilesFromPart(f: Fighter, part: number): PocketTile[] {
  return f.pocket.filter((t) => t.part === part);
}

/** What burning a stashed target stack would do: sabotage a part, or (Body) chip HP. */
export function previewBurn(c: Combat, side: Side, id: TileId): { sabotage: Sabotage | null; chip: HitCalc | null } | null {
  if (!isTarget(id)) return null;
  const f = c.fighters[side];
  const foe = c.fighters[other(side)];
  const n = Math.min(3, countIn(f.pocket, id));
  const sab = sabotageHit(foe, zoneOf(id), n);
  return sab ? { sabotage: sab, chip: null } : { sabotage: null, chip: targetBurnHit(foe, zoneOf(id), n) };
}

// ---------------------------------------------------------------- acting

const ORDER: TileId[] = [...(Object.keys(MOVES) as TileId[]), ...ZONES.map(targetTile), ...(Object.keys(MUTATORS) as TileId[])];

/** Pocket order: moves, then targets, then mutators; identical tiles side by side. */
export function pocketOrder(a: PocketTile, b: PocketTile): number {
  return ORDER.indexOf(a.id) - ORDER.indexOf(b.id);
}

/** Removes up to `max` tiles with this id; returns the slot indices they occupied. */
function removeFromPocket(f: Fighter, id: TileId, max: number): number[] {
  const from: number[] = [];
  for (let i = f.pocket.length - 1; i >= 0 && from.length < max; i--) {
    if (f.pocket[i].id === id) {
      f.pocket.splice(i, 1);
      from.push(i);
    }
  }
  return from;
}

function breakPart(c: Combat, f: Fighter, index: number) {
  const part = f.parts[index];
  part.broken = true;
  // Its tiles go dark now; reels are rebuilt without them on the next spin.
  for (const reel of [0, 2] as const) for (const t of f.strips[reel]) if (t.part === index) t.broken = true;
  const foe = c.fighters[other(f.side)];
  if (part.zone) for (const t of foe.strips[1]) if (t.id === targetTile(part.zone)) t.broken = true;
  f.pocket = f.pocket.filter((t) => t.part !== index);
  const cancelled = f.landed;
  f.landed = false;
  c.events.push({ type: 'break', side: f.side, part: index, cancelled });
}

function newEntry(c: Combat, side: Side, kind: LogEntry['kind'], tile: TileId): LogEntry {
  const e: LogEntry = {
    t: c.time, side, kind, tile, count: 1, tier: 0, zone: null, mut: 'blank', mutStack: 0,
    damage: 0, shielded: 0, weak: false, resist: 1, broke: null, knockedOut: false, shieldGain: 0, miss: null, partOnly: false, boost: 0,
  };
  c.log.push(e);
  return e;
}

/** Share of shield a super ignores (`combat.superShieldPierce`, 0 = none). */
const superPierce = (tier: number) => (tier >= 3 ? tune.combat.superShieldPierce : 0);

function applyHit(c: Combat, attacker: Fighter, move: MoveId, zone: ZoneId, mult: number, log: LogEntry, pierce = 0, isSuper = false) {
  const target = c.fighters[other(attacker.side)];
  landHit(c, target, computeHit(attacker, target, move, zone, mult, pierce, isSuper), zone, log);
}

/** Damage after shields, then knock-out and part break. Shared by attacks and target burns. */
function landHit(c: Combat, target: Fighter, h: HitCalc, zone: ZoneId, log: LogEntry) {
  target.shield -= h.toShield;
  target.hp = Math.max(0, target.hp - h.toHp);
  c.events.push({ type: 'hit', side: target.side, amount: h.damage, shielded: h.toShield, part: h.part, weak: h.weak, resist: h.resist });
  Object.assign(log, { zone, damage: h.damage, shielded: h.toShield, weak: h.weak, resist: h.resist });
  if (target.hp <= 0) return;
  // Shield up = pocket safe. Damage through to HP knocks out a move tile from that part.
  if (h.toHp > 0) {
    const idx = target.pocket.findIndex((t) => t.part === h.part && isMove(t.id));
    if (idx >= 0) {
      const from = stackIndex(target, target.pocket[idx].id);
      target.pocket.splice(idx, 1);
      log.knockedOut = true;
      c.events.push({ type: 'drop', side: target.side, count: 1, part: h.part, from });
    }
  }
  const p = target.parts[h.part];
  if (p.slot !== 'body' && !p.broken) {
    // Shields protect parts too: only damage that got past the shield counts.
    p.hp -= h.toHp;
    if (p.hp <= 0) {
      log.broke = PARTS[p.id].name;
      breakPart(c, target, h.part);
    }
  }
}

/**
 * Quick cuts the next cooldown by a share set per stack size (1, 2 or 3
 * Quicks). Anything past 100% carries into the cooldown after that, so a
 * 200% cut gives two instant spins in a row.
 */
function applyQuick(f: Fighter, stack: number) {
  const cuts = tune.mutators.quick.cooldownCut;
  cutCooldown(f, cuts[Math.min(cuts.length, Math.max(1, stack)) - 1]);
}

/** Cut the next cooldown by a share of the base; anything past zero carries over. */
function cutCooldown(f: Fighter, share: number) {
  f.cooldown -= tune.timing.baseCooldownSec * share;
  if (f.cooldown < 0) {
    f.quickBank += -f.cooldown;
    f.cooldown = 0;
  }
}

function gainShield(c: Combat, f: Fighter, amount: number): number {
  const gained = Math.min(shieldCap(f) - f.shield, Math.round(amount));
  if (gained <= 0) return 0;
  f.shield += gained;
  c.events.push({ type: 'shield', side: f.side, amount: gained });
  return gained;
}

// ================================================================ rounds
// A fight is a series of rounds: prep (spin, hold, pick rows, burn; no
// timer) then an automatic clash where both plans play out in speed order.

/** The tiles of one row (0 top, 1 middle, 2 bottom), dark tiles read as blank. */
export function rowTiles(f: Fighter, row: number) {
  const tile = (r: ReelIndex) => {
    const t = reelWindow(f, r)[row];
    return t.broken ? { id: 'blank' as TileId, part: undefined } : { id: t.id, part: t.part };
  };
  const m = tile(0);
  return { move: m.id, part: m.part, target: tile(1).id, mut: tile(2).id };
}

export function rowValid(f: Fighter, row: number): boolean {
  const r = rowTiles(f, row);
  return isMove(r.move) && isTarget(r.target);
}

/** Slots before the cap: base, +1 for fast monsters, +Soul. */
function rawSlots(f: Fighter): number {
  const cl = tune.clash;
  const soul = soulStats(f.soul).actionSlots ?? 0;
  const fast = f.stats.speed >= cl.fastSpeed ? 1 : 0;
  return cl.baseSlots + fast + soul;
}

/** Action slots this round, capped at the 3 rows of the grid. */
export function actionSlots(f: Fighter): number {
  return Math.min(tune.clash.maxSlots, rawSlots(f));
}

/** Slots past the cap; each becomes initiative and a free nudge every round. */
export function overflowSlots(f: Fighter): number {
  return Math.max(0, rawSlots(f) - tune.clash.maxSlots);
}

/** Gold price of the next nudge (0 while free nudges remain). */
export function nudgeCost(f: Fighter): number {
  return f.freeNudges > 0 ? 0 : tune.prep.nudgeCost;
}

/** Gold price of the next re-spin this round. */
export function spinCost(f: Fighter): number {
  return tune.prep.spinBaseCost + f.paidSpins * tune.prep.spinStepCost;
}

/** Spin all three reels (animation timing reuses spinLeft). */
function spinReels(c: Combat, f: Fighter) {
  buildStrips(c, f);
  f.queued = [];
  f.tease = false;
  f.spinTotal = tune.timing.spinSec + 2 * tune.timing.reelStaggerSec;
  f.spinLeft = f.spinTotal;
  c.events.push({ type: 'spin', side: f.side, tease: false });
}

/** Seconds after spin start at which a reel lands. */
export function reelLandTime(_f: Fighter, reel: ReelIndex): number {
  return tune.timing.spinSec + reel * tune.timing.reelStaggerSec;
}

/** Player re-spin (the caller has paid `spinCost`). */
export function respin(c: Combat, side: Side): boolean {
  const f = c.fighters[side];
  if (c.phase !== 'prep' || f.spinLeft > 0 || c.winner) return false;
  f.paidSpins++;
  spinReels(c, f);
  return true;
}

/**
 * Nudge one reel by one row. `dir` 1 moves the tiles down (the tile above
 * slides into view), -1 moves them up. The caller pays `nudgeCost` first;
 * a free nudge is used up here. Queued rows stay queued while still valid.
 */
export function nudge(c: Combat, side: Side, reel: ReelIndex, dir: 1 | -1): boolean {
  const f = c.fighters[side];
  if (c.phase !== 'prep' || f.spinLeft > 0 || c.winner) return false;
  if (f.freeNudges > 0) f.freeNudges--;
  const n = f.strips[reel].length;
  f.reelPos[reel] = (((f.reelPos[reel] - dir) % n) + n) % n;
  f.queued = f.queued.filter((row) => rowValid(f, row));
  c.events.push({ type: 'nudge', side, reel, dir });
  return true;
}

export function toggleRow(c: Combat, side: Side, row: number) {
  const f = c.fighters[side];
  if (c.phase !== 'prep' || f.spinLeft > 0) return;
  const i = f.queued.indexOf(row);
  if (i >= 0) f.queued.splice(i, 1);
  else if (rowValid(f, row) && f.queued.length < actionSlots(f)) f.queued.push(row);
}

function gainShieldNow(c: Combat, f: Fighter, amount: number): number {
  const gained = Math.min(shieldCap(f) - f.shield, Math.round(amount));
  if (gained <= 0) return 0;
  f.shield += gained;
  c.events.push({ type: 'shield', side: f.side, amount: gained });
  return gained;
}

/**
 * Burn a stash stack during prep. Target tiles sabotage the named enemy part
 * (a share of its max HP, part only; Body tiles chip HP instead), Shield
 * tiles shield now, Quick tiles give initiative, Power+ boosts this round's
 * first action, move tiles are discarded to free space.
 */
export function burn(c: Combat, side: Side, id: TileId): boolean {
  const f = c.fighters[side];
  if (c.phase !== 'prep' || c.winner) return false;
  const stack = stackIndex(f, id);
  const n = removeFromPocket(f, id, 3).length;
  if (!n) return false;
  c.events.push({ type: 'burn', side, id, count: n, from: Array(n).fill(stack) });
  const log = newEntry(c, side, 'burn', id);
  log.count = n;
  if (isTarget(id)) {
    const foe = c.fighters[other(side)];
    const zone = zoneOf(id);
    log.zone = zone;
    const sab = sabotageHit(foe, zone, n);
    if (sab) {
      foe.shield -= sab.toShield;
      const p = foe.parts[sab.part];
      p.hp -= sab.toPart;
      Object.assign(log, { damage: sab.amount, shielded: sab.toShield, partOnly: true });
      c.events.push({ type: 'sabotage', side: foe.side, part: sab.part, amount: sab.amount, shielded: sab.toShield });
      if (p.hp <= 0) {
        log.broke = PARTS[p.id].name;
        breakPart(c, foe, sab.part);
      }
      // The break darkens this side's matching target tiles; drop rows it spoiled.
      f.queued = f.queued.filter((row) => rowValid(f, row));
    } else landHit(c, foe, targetBurnHit(foe, zone, n), zone, log);
  } else if (id === 'shield') log.shieldGain = gainShieldNow(c, f, tune.shield.perTile * f.shieldMult * n);
  else if (id === 'quick') f.initiative += quickCut(n);
  else if (id === 'power') f.boost = tune.combat.powerBurnBonus[Math.min(3, n)];
  checkEnd(c);
  return true;
}

/** Store tiles into the stash (stacks capped, type slots limited), duplicates first. */
function stash(c: Combat, f: Fighter, tiles: { id: TileId; part?: number; slot: number }[]) {
  const cap = tune.pocket.stackCap;
  const counts = new Map(pocketGroups(f).map((g) => [g.id, g.count] as [TileId, number]));
  const ordered = [...tiles].sort((a, b) => (counts.has(b.id) ? 1 : 0) - (counts.has(a.id) ? 1 : 0) || a.slot - b.slot);
  const added: { tile: PocketTile; from: number }[] = [];
  const discarded: number[] = [];
  for (const t of ordered) {
    const n = counts.get(t.id) ?? 0;
    if (n >= cap || (n === 0 && counts.size >= f.pocketSize)) {
      discarded.push(t.slot);
      continue;
    }
    counts.set(t.id, n + 1);
    const tile = { id: t.id, part: t.part };
    f.pocket.push(tile);
    added.push({ tile, from: t.slot });
  }
  f.pocket.sort(pocketOrder);
  const stored = added.map((a) => ({ id: a.tile.id, from: a.from, to: stackIndex(f, a.tile.id), tile: a.tile }));
  if (stored.length || discarded.length) c.events.push({ type: 'pocket', side: f.side, stored, discarded });
}

/** Quick head start for `n` stacked tiles, in action gaps (0.5, 1, 2). */
function quickCut(n: number): number {
  const cuts = tune.mutators.quick.cooldownCut;
  return cuts[Math.min(cuts.length, Math.max(1, n)) - 1];
}

/** One action gap for this fighter, in seconds. */
const actionGap = (f: Fighter) => tune.clash.actionGap / Math.max(0.3, f.stats.speed);

/** A row's tiles as they are on the reels, dark tiles included (plans keep their source part). */
function rawRow(f: Fighter, row: number) {
  const m = reelWindow(f, 0)[row];
  return { move: m.id, part: m.part, target: reelWindow(f, 1)[row].id, mut: reelWindow(f, 2)[row].id };
}

/**
 * Projected clash order for both sides' current queues: base timeline,
 * initiative, and Quick mutators pulling later actions forward. Used for the
 * order badges in prep; the clash itself fires by the same rules.
 */
export function projectedOrder(c: Combat): { side: Side; row: number; index: number; t: number }[] {
  const out: { side: Side; row: number; index: number; t: number }[] = [];
  for (const side of ['player', 'enemy'] as const) {
    const f = c.fighters[side];
    const gap = actionGap(f);
    const lead = leadFor(c, f);
    let shift = f.initiative * gap;
    f.queued.forEach((row, i) => {
      out.push({ side, row, index: i, t: Math.max(0, gap * (i + 0.5) + lead - shift) });
      const mut = rawRow(f, row).mut;
      if (mut === 'quick') shift += gap * quickCut(1 + Math.min(tune.combat.mutatorMatchCap, countIn(f.pocket, 'quick')));
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Ties go to the side with more initiative, then the faster side. */
function leadFor(c: Combat, f: Fighter): number {
  const foe = c.fighters[other(f.side)];
  if (f.initiative !== foe.initiative) return f.initiative > foe.initiative ? 0 : 0.01;
  return f.stats.speed >= foe.stats.speed ? 0 : 0.01;
}

/** Tiles of the rows that were not queued (what Fight would stash). */
export function unqueuedTiles(f: Fighter) {
  const out: { id: TileId; part?: number; slot: number }[] = [];
  for (let row = 0; row < 3; row++) {
    if (f.queued.includes(row)) continue;
    for (const reel of REELS) {
      const t = reelWindow(f, reel)[row];
      if (t.id !== 'blank' && !t.broken) out.push({ id: t.id, part: t.part, slot: reel * 3 + row });
    }
  }
  return out;
}

/** Freeze the queued rows into a timed plan. */
function lockPlan(c: Combat, f: Fighter) {
  const gap = actionGap(f);
  const lead = leadFor(c, f);
  // Raw tiles: an action whose part already broke keeps its move and fizzles.
  f.plan = f.queued
    .map((row, i) => ({ row, i, r: rawRow(f, row) }))
    .filter(({ r }) => isMove(r.move) && isTarget(r.target))
    .map(({ row, i, r }) => ({ side: f.side, row, move: r.move as MoveId, target: r.target, mut: r.mut, part: r.part, at: gap * (i + 0.5) + lead, done: false }));
  stash(c, f, unqueuedTiles(f));
  f.quickShift = f.initiative * gap;
}

/** Player presses Fight: both plans lock and the clash starts. */
export function fight(c: Combat): boolean {
  const p = c.fighters.player;
  if (c.phase !== 'prep' || p.spinLeft > 0 || c.winner) return false;
  if (c.enemyAi) enemyPrep(c);
  lockPlan(c, p);
  lockPlan(c, c.fighters.enemy);
  c.phase = 'clash';
  c.clashT = 0;
  c.sinceFire = 99;
  c.events.push({ type: 'clash', round: c.round });
  return true;
}

function startRound(c: Combat) {
  c.round++;
  c.phase = 'prep';
  for (const side of ['player', 'enemy'] as const) {
    const f = c.fighters[side];
    f.paidSpins = 0;
    const over = overflowSlots(f);
    f.freeNudges = over * tune.clash.overflowNudges;
    f.initiative = over * tune.clash.overflowInitiative;
    f.boost = 0;
    f.plan = [];
    spinReels(c, f); // the free spin
  }
  if (c.enemyAi) enemyPlanPreview(c);
  c.events.push({ type: 'prep', round: c.round });
}

/** Matches an action would consume from the stash. */
function actionMatches(f: Fighter, a: { move: TileId; target: TileId; mut: TileId }) {
  const cb = tune.combat;
  return {
    move: a.move, target: a.target, mut: a.mut,
    tier: isMove(a.move) ? Math.min(3, countIn(f.pocket, a.move)) : 0,
    targetMatches: isTarget(a.target) ? Math.min(cb.targetMatchCap, countIn(f.pocket, a.target)) : 0,
    mutMatches: a.mut !== 'blank' ? Math.min(cb.mutatorMatchCap, countIn(f.pocket, a.mut)) : 0,
  };
}

/** Damage preview of a row against the other monster right now. */
export function previewRow(c: Combat, side: Side, row: number): Preview | null {
  const f = c.fighters[side];
  const r = rowTiles(f, row);
  if (!isMove(r.move) || !isTarget(r.target)) return null;
  const m = actionMatches(f, r);
  const zone = zoneOf(r.target);
  // A Power+ burn boosts the first queued action (or this row if none is queued yet).
  const boost = f.boost && (f.queued[0] ?? row) === row ? 1 + f.boost : 1;
  return { move: r.move, zone, tier: m.tier, hit: computeHit(f, c.fighters[other(side)], r.move, zone, lineMult(m) * boost, superPierce(m.tier), m.tier >= 3) };
}

/** Fire one planned action. */
function fireAction(c: Combat, a: PlannedAction) {
  a.done = true;
  const f = c.fighters[a.side];
  const log = newEntry(c, a.side, 'execute', a.move);
  if (a.part !== undefined && f.parts[a.part]?.broken) {
    log.miss = 'fizzled';
    c.events.push({ type: 'fizzle', side: a.side, move: a.move, part: PARTS[f.parts[a.part].id].name });
    return;
  }
  const m = actionMatches(f, a);
  const stacksBefore = pocketGroups(f).map((g) => g.id);
  const consumed: { id: TileId; from: number }[] = [];
  for (const [id, n] of [[m.move, m.tier], [m.target, m.targetMatches], [m.mut, m.mutMatches]] as [TileId, number][]) {
    const from = stacksBefore.indexOf(id);
    for (let k = removeFromPocket(f, id, n).length; k > 0; k--) consumed.push({ id, from });
  }
  Object.assign(log, { tier: m.tier, mut: m.mut, mutStack: m.mut === 'blank' ? 0 : 1 + m.mutMatches });
  const mutStack = 1 + m.mutMatches * tune.combat.mutatorMatchBonus;
  if (m.mut === 'shield') log.shieldGain = gainShieldNow(c, f, tune.shield.perTile * f.shieldMult * mutStack);
  if (m.mut === 'quick') f.quickShift += actionGap(f) * quickCut(1 + m.mutMatches);
  const boost = f.boost;
  f.boost = 0;
  log.boost = boost;
  const zone = zoneOf(a.target as `t_${ZoneId}`);
  c.events.push({ type: 'action', side: a.side, move: a.move, tier: m.tier, isSuper: m.tier >= 3, burn: false, zone, consumed });
  applyHit(c, f, a.move, zone, lineMult(m) * (1 + boost), log, superPierce(m.tier), m.tier >= 3);
}

/** Advance the clash (or the prep spin animation). */
export function tick(c: Combat, dt: number) {
  if (c.winner) return;
  for (const side of ['player', 'enemy'] as const) {
    const f = c.fighters[side];
    if (f.spinLeft <= 0) continue;
    const before = f.spinTotal - f.spinLeft;
    f.spinLeft = Math.max(0, f.spinLeft - dt);
    const after = f.spinTotal - f.spinLeft;
    for (const reel of REELS) {
      const at = reelLandTime(f, reel);
      if (at > 0 && before < at && after >= at) c.events.push({ type: 'reelLand', side, reel });
    }
    if (f.spinLeft === 0) {
      c.events.push({ type: 'land', side });
      if (side === 'enemy' && c.enemyAi) enemyPlanPreview(c);
    }
  }
  if (c.phase !== 'clash') return;
  c.time += dt;
  c.clashT += dt;
  c.sinceFire += dt;
  const pending = [c.fighters.player, c.fighters.enemy]
    .flatMap((f) => f.plan.filter((a) => !a.done).map((a) => ({ a, t: a.at - f.quickShift })))
    .sort((x, y) => x.t - y.t);
  const next = pending[0];
  if (next && next.t <= c.clashT && c.sinceFire >= tune.clash.minSpacing) {
    c.sinceFire = 0;
    fireAction(c, next.a);
    checkEnd(c);
  } else if (!next && c.sinceFire >= tune.clash.endPause) {
    startRound(c);
  }
}

/** Give up the fight. Counts as a loss, but the monster survives. */
export function yieldFight(c: Combat, side: Side) {
  if (c.winner) return;
  c.winner = other(side);
  c.events.push({ type: 'end', winner: c.winner });
}

function checkEnd(c: Combat) {
  if (c.winner) return;
  for (const side of ['player', 'enemy'] as const) {
    if (c.fighters[side].hp <= 0) {
      c.winner = other(side);
      c.events.push({ type: 'end', winner: c.winner });
      return;
    }
  }
}

// ---------------------------------------------------------------- enemy AI

/** Enemy picks its rows as soon as its reels land, so the plan is visible in prep. */
function enemyPlanPreview(c: Combat) {
  const f = c.fighters.enemy;
  if (f.spinLeft > 0) return;
  const valid = [0, 1, 2].filter((r) => rowValid(f, r));
  // One free re-roll when the board is poor (enemies do not pay gold).
  if (valid.length < Math.min(2, actionSlots(f)) && f.paidSpins === 0) {
    f.paidSpins++;
    spinReels(c, f);
    return;
  }
  const scored = valid
    .map((r) => ({ r, d: previewRow(c, 'enemy', r)?.hit.damage ?? 0, mut: rowTiles(f, r).mut }))
    .sort((a, b) => b.d - a.d);
  f.queued = scored.slice(0, actionSlots(f)).map((s) => s.r);
}

/** Last-moment enemy burns when the player commits. */
function enemyPrep(c: Combat) {
  const f = c.fighters.enemy;
  if (f.shield === 0 && f.hp < f.maxHp * 0.5 && pocketGroups(f).some((g) => g.id === 'shield')) burn(c, 'enemy', 'shield');
}
