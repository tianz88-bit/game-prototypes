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
}

export type CombatEvent =
  | { type: 'spin'; side: Side; tease: boolean }
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
}

export const other = (s: Side): Side => (s === 'player' ? 'enemy' : 'player');

type PartStats = { hp: number; speed: number; atk: number; def: number; weak: number; pocket?: number; shield?: number };
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
  hp = Math.round(hp * scale.hp);
  stats.atk *= scale.atk;
  const breakMult = tune.armour[armour].breakMult;
  const parts: PartState[] = SLOTS.map((slot) => {
    const id = spec.build[slot];
    const maxHp = Math.round(hp * tune.parts.breakPct * breakMult);
    return { id, slot, zone: SLOT_ZONE[slot], hp: maxHp, maxHp, broken: false, weak: statsOf(id).weak };
  });
  return {
    side, name: spec.name, spec, hp, maxHp: hp, shield: 0, shieldMult: Math.max(0.2, shieldMult),
    stats, armour, parts, strips: [[], [], []], reelPos: [0, 0, 0],
    cooldown: tune.timing.baseCooldownSec * (side === 'player' ? 0.35 : 0.55),
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
  const c: Combat = { fighters: { player, enemy }, winner: null, events: [], rng, time: 0, log: [] };
  buildStrips(c, player);
  buildStrips(c, enemy);
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
  return Math.round(f.maxHp * tune.shield.capPct);
}

export function partForZone(f: Fighter, zone: ZoneId): number {
  const i = f.parts.findIndex((p) => p.zone === zone && !p.broken);
  return i >= 0 ? i : SLOTS.indexOf('body');
}

export interface HitCalc { damage: number; toShield: number; toHp: number; part: number; weak: boolean; resist: number }

/** Exact damage of a move at a zone. Pure: used for both previews and resolution. */
export function computeHit(attacker: Fighter, defender: Fighter, move: MoveId, zone: ZoneId, mult: number): HitCalc {
  const resist = tune.armour[defender.armour][MOVES[move].dmg];
  const part = partForZone(defender, zone);
  const weak = part === weakspot(defender);
  const held = countIn(defender.pocket, targetTile(zone));
  const reduce = Math.min(tune.combat.holdReduceCap, held * tune.combat.holdReducePerTile);
  let dmg = (tune.moves[move] as { power: number }).power * mult * attacker.stats.atk * resist;
  if (weak) dmg *= tune.parts.weakspotMult;
  dmg *= (1 + fragility(defender)) * (1 - reduce) / Math.max(0.3, defender.stats.def);
  const damage = Math.max(1, Math.round(dmg));
  const toShield = Math.min(defender.shield, damage);
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
  return { move: m.move, zone, tier: m.tier, hit: computeHit(f, c.fighters[other(side)], m.move, zone, lineMult(m)) };
}

/** Damage of burning `n` target tiles at a zone: flat, soaked by shields like any hit. */
function targetBurnHit(foe: Fighter, zone: ZoneId, n: number): HitCalc {
  const damage = tune.combat.targetBurnDamage[n];
  const toShield = Math.min(foe.shield, damage);
  return { damage, toShield, toHp: damage - toShield, part: partForZone(foe, zone), weak: false, resist: 1 };
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

/** What burning a pocketed group would deal: moves at the line target, targets at their own part. */
export function previewBurn(c: Combat, side: Side, id: TileId): HitCalc | null {
  const f = c.fighters[side];
  if (isTarget(id)) {
    const n = Math.min(3, countIn(f.pocket, id));
    return targetBurnHit(c.fighters[other(side)], zoneOf(id), n);
  }
  const target = lineTiles(f).target;
  if (!isMove(id) || !isTarget(target)) return null;
  const n = Math.min(3, countIn(f.pocket, id));
  return computeHit(f, c.fighters[other(side)], id, zoneOf(target), tune.combat.burnMult[n]);
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
    damage: 0, shielded: 0, weak: false, resist: 1, broke: null, knockedOut: false, shieldGain: 0, miss: null,
  };
  c.log.push(e);
  return e;
}

function applyHit(c: Combat, attacker: Fighter, move: MoveId, zone: ZoneId, mult: number, log: LogEntry) {
  const target = c.fighters[other(attacker.side)];
  landHit(c, target, computeHit(attacker, target, move, zone, mult), zone, log);
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
  const cut = cuts[Math.min(cuts.length, Math.max(1, stack)) - 1];
  f.cooldown -= tune.timing.baseCooldownSec * cut;
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

export function execute(c: Combat, side: Side): boolean {
  const f = c.fighters[side];
  if (!f.landed || c.winner) return false;
  const m = executeMatches(f);
  // `from` is the stack each consumed tile came out of.
  const stacksBefore = pocketGroups(f).map((g) => g.id);
  const consumed: { id: TileId; from: number }[] = [];
  const take = [[m.move, m.tier], [m.target, m.targetMatches], [m.mut, m.mutMatches]] as [TileId, number][];
  const slots = take.flatMap(([id, n]) => {
    const idx: number[] = [];
    f.pocket.forEach((t, i) => t.id === id && idx.length < n && idx.push(i));
    return idx.map((i) => ({ id, from: i }));
  }).sort((a, b) => b.from - a.from);
  for (const s of slots) {
    f.pocket.splice(s.from, 1);
    consumed.push({ id: s.id, from: stacksBefore.indexOf(s.id) });
  }
  f.landed = false;
  const log = newEntry(c, side, 'execute', m.move);
  Object.assign(log, { tier: m.tier, mut: m.mut, mutStack: m.mut === 'blank' ? 0 : 1 + m.mutMatches });
  const mutStack = 1 + m.mutMatches * tune.combat.mutatorMatchBonus;
  if (m.mut === 'shield') log.shieldGain = gainShield(c, f, tune.shield.perTile * f.shieldMult * mutStack);
  if (m.mut === 'quick') applyQuick(f, 1 + m.mutMatches);
  if (isMove(m.move)) {
    if (!isTarget(m.target)) {
      log.miss = 'no target';
      c.events.push({ type: 'miss', side: other(side), reason: 'NO TARGET' });
    } else {
      const zone = zoneOf(m.target);
      c.events.push({ type: 'action', side, move: m.move, tier: m.tier, isSuper: m.tier >= 3, burn: false, zone, consumed });
      applyHit(c, f, m.move, zone, lineMult(m), log);
    }
  } else {
    log.miss = 'whiff';
    c.events.push({ type: 'miss', side: other(side), reason: 'WHIFF' });
  }
  checkEnd(c);
  return true;
}

export function pocket(c: Combat, side: Side): boolean {
  const f = c.fighters[side];
  if (!f.landed || c.winner) return false;
  const plan = planPocket(f);
  const added: { tile: PocketTile; from: number }[] = [];
  for (const t of plan.store) {
    const tile = { id: t.id, part: t.part };
    f.pocket.push(tile);
    added.push({ tile, from: t.slot });
  }
  f.pocket.sort(pocketOrder);
  const discarded = plan.discard.map((t) => t.slot);
  const stored = added.map((a) => ({ id: a.tile.id, from: a.from, to: stackIndex(f, a.tile.id), tile: a.tile }));
  c.events.push({ type: 'pocket', side, stored, discarded });
  f.landed = false;
  return true;
}

export function burn(c: Combat, side: Side, id: TileId): boolean {
  const f = c.fighters[side];
  if (!f.landed || c.winner) return false;
  const stack = stackIndex(f, id);
  const n = removeFromPocket(f, id, 3).length;
  if (!n) return false;
  c.events.push({ type: 'burn', side, id, count: n, from: Array(n).fill(stack) });
  const log = newEntry(c, side, 'burn', id);
  log.count = n;
  if (isMove(id)) {
    const target = lineTiles(f).target;
    if (!isTarget(target)) {
      log.miss = 'no target';
      c.events.push({ type: 'miss', side: other(side), reason: 'NO TARGET' });
    } else {
      const zone = zoneOf(target);
      c.events.push({ type: 'action', side, move: id, tier: n, isSuper: false, burn: true, zone, consumed: [] });
      applyHit(c, f, id, zone, tune.combat.burnMult[n], log);
    }
  } else if (isTarget(id)) {
    // Burned target tiles chip the named enemy part, to break up its charge.
    const foe = c.fighters[other(side)];
    const zone = zoneOf(id);
    log.zone = zone;
    landHit(c, foe, targetBurnHit(foe, zone, n), zone, log);
  } else if (id === 'shield') log.shieldGain = gainShield(c, f, tune.shield.perTile * f.shieldMult * n);
  else if (id === 'quick') applyQuick(f, n);
  checkEnd(c);
  return true;
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

// ---------------------------------------------------------------- time

function startSpin(c: Combat, f: Fighter) {
  if (f.landed) c.events.push({ type: 'lost', side: f.side });
  f.landed = false;
  buildStrips(c, f);
  const m = executeMatches(f);
  f.tease = m.tier >= 3 && isTarget(m.target);
  const t = tune.timing;
  f.spinTotal = t.spinSec + 2 * t.reelStaggerSec + (f.tease ? t.superTeaseSec : 0);
  f.spinLeft = f.spinTotal;
  c.events.push({ type: 'spin', side: f.side, tease: f.tease });
}

/** Seconds after spin start at which a reel lands. On a tease the move reel lands last. */
export function reelLandTime(f: Fighter, reel: ReelIndex): number {
  const t = tune.timing;
  if (f.tease) return reel === 0 ? t.spinSec + 2 * t.reelStaggerSec + t.superTeaseSec : t.spinSec + (reel - 1) * t.reelStaggerSec;
  return t.spinSec + reel * t.reelStaggerSec;
}

export function tick(c: Combat, dt: number) {
  if (c.winner) return;
  c.time += dt;
  for (const side of ['player', 'enemy'] as const) {
    const f = c.fighters[side];
    if (f.spinLeft > 0) {
      const before = f.spinTotal - f.spinLeft;
      f.spinLeft -= dt;
      const after = f.spinTotal - f.spinLeft;
      for (const reel of REELS) {
        const at = reelLandTime(f, reel);
        if (before < at && after >= at && f.spinLeft > 0) c.events.push({ type: 'reelLand', side, reel });
      }
      if (f.spinLeft <= 0) {
        f.spinLeft = 0;
        f.landed = true;
        f.aiWait = 0;
        f.cooldown = Math.max(0, tune.timing.baseCooldownSec - f.quickBank);
        f.quickBank = Math.max(0, f.quickBank - tune.timing.baseCooldownSec);
        c.events.push({ type: 'land', side });
      }
      continue;
    }
    f.cooldown -= dt * f.stats.speed * (f.landed ? tune.timing.decideCooldownRate : 1);
    if (f.cooldown <= 0) startSpin(c, f);
  }
  enemyThink(c, dt);
}

// ---------------------------------------------------------------- enemy AI

function enemyThink(c: Combat, dt: number) {
  const f = c.fighters.enemy;
  if (!f.landed || c.winner) return;
  f.aiWait += dt;
  if (f.aiWait < tune.timing.aiThinkSec) return;
  const m = executeMatches(f);
  const free = pocketRoom(f);
  if (free < 3) {
    const stale = pocketGroups(f).find((g) => isMove(g.id) && g.id !== m.move && g.count >= 2);
    if (stale) burn(c, 'enemy', stale.id);
    if (!f.landed) return;
  }
  const dead = !isMove(m.move) || !isTarget(m.target);
  if (dead) {
    if (free >= 3) pocket(c, 'enemy');
    else execute(c, 'enemy');
    return;
  }
  if (m.tier >= 1 || (m.mut === 'shield' && f.shield === 0)) execute(c, 'enemy');
  else if (free >= 6 && c.rng() < 0.25) pocket(c, 'enemy');
  else execute(c, 'enemy');
}
