// Pure combat simulation. No rendering, no input devices: the game loop
// feeds it player decisions (from intents) and elapsed time, and reads back
// state plus a list of events for the renderer to animate.
import { tune } from '../tune';
import {
  directionOf,
  isMove,
  MOVES,
  PARTS,
  SLOTS,
  type ArmourId,
  type Direction,
  type MonsterSpec,
  type MoveId,
  type MoveKind,
  type PartId,
  type Slot,
  type TileId,
  type Zone,
} from './content';
import { pickIndex, type Rng } from './rng';

export type Side = 'player' | 'enemy';
export type Stance = 'none' | 'defend' | 'brains';

/** One position on a reel strip. `part` is the index of the part that supplied it. */
export interface StripTile {
  id: TileId;
  part?: number;
  jam?: { spinsLeft: number; original: TileId };
  broken?: boolean;
}

export interface PocketTile {
  id: TileId;
  part?: number;
}

export interface PartState {
  id: PartId;
  slot: Slot;
  zone: Zone;
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
  stats: { speed: number; atk: number; def: number };
  armour: ArmourId;
  parts: PartState[];
  strips: [StripTile[], StripTile[]];
  /** Index of the tile sitting on the line, per reel. */
  reelPos: [number, number];
  /** Seconds of cooldown left before the next automatic spin. */
  cooldown: number;
  /** >0 while the reels are spinning (seconds left). */
  spinLeft: number;
  spinTotal: number;
  /** This spin is a super tease (line lands on a triple match). */
  tease: boolean;
  /** A landed result is waiting for Execute or Pocket. */
  landed: boolean;
  pocket: PocketTile[];
  pocketSize: number;
  stance: Stance;
  aiWait: number;
}

export type CombatEvent =
  | { type: 'spin'; side: Side; tease: boolean }
  | { type: 'reelLand'; side: Side; reel: 0 | 1 }
  | { type: 'land'; side: Side }
  | { type: 'lost'; side: Side }
  | { type: 'action'; side: Side; move: MoveId; tier: number; isSuper: boolean; burn: boolean; dir: Direction; consumed: TileId[] }
  | { type: 'hit'; side: Side; amount: number; blocked: boolean; interrupted: boolean; chip: boolean; part: number; weak: boolean; resist: number }
  | { type: 'miss'; side: Side; reason: string }
  | { type: 'heal'; side: Side; amount: number }
  | { type: 'drop'; side: Side; count: number }
  | { type: 'jam'; side: Side; count: number }
  | { type: 'break'; side: Side; part: number; cancelled: boolean }
  | { type: 'pocket'; side: Side; stored: { id: TileId; from: number }[]; discarded: number[] }
  | { type: 'burn'; side: Side; id: TileId; count: number }
  | { type: 'end'; winner: Side };

export interface Combat {
  fighters: Record<Side, Fighter>;
  winner: Side | null;
  events: CombatEvent[];
  rng: Rng;
}

export const other = (s: Side): Side => (s === 'player' ? 'enemy' : 'player');

// ---------------------------------------------------------------- building

function shuffle<T>(rng: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = pickIndex(rng, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export interface FighterScale {
  hp: number;
  atk: number;
}

export function makeFighter(side: Side, spec: MonsterSpec, rng: Rng, scale: FighterScale = { hp: 1, atk: 1 }): Fighter {
  const pt = tune.parts;
  let hp = 0;
  const stats = { speed: 0, atk: 0, def: 0 };
  let pocketSize = tune.pocket.defaultSize;
  let armour: ArmourId = 'hide';
  const reel1: StripTile[] = [];
  const reel2: StripTile[] = [];
  const pocket: PocketTile[] = [];
  SLOTS.forEach((slot, index) => {
    const id = spec.build[slot];
    const def = PARTS[id];
    const st = pt.stats[id] as { hp: number; speed: number; atk: number; def: number; weak: number; pocket?: number };
    hp += st.hp;
    stats.speed += st.speed;
    stats.atk += st.atk;
    stats.def += st.def;
    pocketSize += st.pocket ?? 0;
    if (def.armour) armour = def.armour;
    for (const m of def.moves) reel1.push({ id: m, part: index });
    for (const m of def.mutators) reel2.push({ id: m, part: index });
    for (const t of def.startPocket ?? []) pocket.push({ id: t, part: index });
  });
  for (const t of spec.extra) (isMove(t) ? reel1 : reel2).push({ id: t });
  while (reel1.length < tune.combat.minStripLength) reel1.push({ id: 'blank' });
  while (reel2.length < tune.combat.minStripLength) reel2.push({ id: 'blank' });
  hp = Math.round(hp * scale.hp);
  stats.atk *= scale.atk;
  const breakMult = tune.armour[armour].breakMult;
  const parts: PartState[] = SLOTS.map((slot) => {
    const id = spec.build[slot];
    const maxHp = Math.round(hp * pt.breakPct * breakMult);
    return { id, slot, zone: PARTS[id].zone, hp: maxHp, maxHp, broken: false, weak: (pt.stats[id] as { weak: number }).weak };
  });
  return {
    side,
    name: spec.name,
    spec,
    hp,
    maxHp: hp,
    stats,
    armour,
    parts,
    strips: [shuffle(rng, reel1), shuffle(rng, reel2)],
    reelPos: [pickIndex(rng, reel1.length), pickIndex(rng, reel2.length)],
    // Stagger the opening spins a little so both sides do not start in sync.
    cooldown: tune.timing.baseCooldownSec * (side === 'player' ? 0.35 : 0.55),
    spinLeft: 0,
    spinTotal: 0,
    tease: false,
    landed: false,
    pocket,
    pocketSize,
    stance: 'none',
    aiWait: 0,
  };
}

export function createCombat(player: Fighter, enemy: Fighter, rng: Rng): Combat {
  return { fighters: { player, enemy }, winner: null, events: [], rng };
}

// ---------------------------------------------------------------- reading

/** The 3 visible tiles of one reel: [above, line, below]. */
export function reelWindow(f: Fighter, reel: 0 | 1): [StripTile, StripTile, StripTile] {
  const strip = f.strips[reel];
  const n = strip.length;
  const p = f.reelPos[reel];
  return [strip[(p - 1 + n) % n], strip[p], strip[(p + 1) % n]];
}

/** All 6 visible tiles, line tiles flagged. `slot` is reel * 3 + row. */
export function visibleTiles(f: Fighter): { id: TileId; part?: number; line: boolean; slot: number }[] {
  const out: { id: TileId; part?: number; line: boolean; slot: number }[] = [];
  for (const reel of [0, 1] as const) {
    reelWindow(f, reel).forEach((t, row) => out.push({ id: t.id, part: t.part, line: row === 1, slot: reel * 3 + row }));
  }
  return out;
}

function countIn(list: PocketTile[], id: TileId): number {
  return list.reduce((n, t) => n + (t.id === id ? 1 : 0), 0);
}

function kindCount(list: PocketTile[], kind: MoveKind): number {
  return list.reduce((n, t) => n + (isMove(t.id) && MOVES[t.id].kind === kind ? 1 : 0), 0);
}

export function pocketBuffs(f: Fighter) {
  const p = tune.pocket;
  return {
    attack: kindCount(f.pocket, 'attack') * p.attackBuffPerTile + countIn(f.pocket, 'power') * p.powerBuffPerTile,
    defend: kindCount(f.pocket, 'defend') * p.defendBuffPerTile,
    speed: kindCount(f.pocket, 'brains') * p.brainsSpeedPerTile + countIn(f.pocket, 'quick') * p.quickSpeedPerTile,
  };
}

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

/** What Execute would do right now: power-up tier and mutator matches. */
export function executePreview(f: Fighter) {
  const move = reelWindow(f, 0)[1].id;
  const mut = reelWindow(f, 1)[1].id;
  const tier = isMove(move) ? Math.min(3, countIn(f.pocket, move)) : 0;
  const mutMatches = mut !== 'blank' ? Math.min(3, countIn(f.pocket, mut)) : 0;
  return { move, mut, tier, mutMatches };
}

export function isFlying(f: Fighter): boolean {
  return f.parts.some((p) => !p.broken && PARTS[p.id].flight);
}

/** Index of the designated weakspot: the unbroken part with the highest weak value. */
export function weakspot(f: Fighter): number {
  let best = -1;
  f.parts.forEach((p, i) => {
    if (p.broken || p.zone === 'none') return;
    if (best < 0 || p.weak > f.parts[best].weak) best = i;
  });
  return best;
}

export function fragility(f: Fighter): number {
  return f.parts.reduce((s, p) => s + (p.broken ? 0 : p.weak), 0) * tune.parts.fragilityPerWeak;
}

// ---------------------------------------------------------------- acting

function removeFromPocket(f: Fighter, id: TileId, max: number): number {
  let removed = 0;
  for (let i = f.pocket.length - 1; i >= 0 && removed < max; i--) {
    if (f.pocket[i].id === id) {
      f.pocket.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

/** The part an attack from `dir` lands on: an unbroken part facing that way, else the body. */
function hitPart(c: Combat, target: Fighter, dir: Direction): number {
  const facing = target.parts.map((p, i) => ({ p, i })).filter(({ p }) => !p.broken && p.zone === dir);
  if (facing.length) return facing[pickIndex(c.rng, facing.length)].i;
  return SLOTS.indexOf('body');
}

function breakPart(c: Combat, f: Fighter, index: number) {
  const part = f.parts[index];
  part.broken = true;
  for (const strip of f.strips) {
    for (const t of strip) {
      if (t.part === index) {
        t.id = 'blank';
        t.broken = true;
        delete t.jam;
      }
    }
  }
  f.pocket = f.pocket.filter((t) => t.part !== index);
  // A break on the turn the target is deciding cancels its pending result.
  const cancelled = f.landed;
  f.landed = false;
  c.events.push({ type: 'break', side: f.side, part: index, cancelled });
}

interface AttackOpts {
  chip: boolean;
  dir: Direction;
  dmg?: keyof typeof tune.armour.hide;
}

function damage(c: Combat, attacker: Fighter, target: Fighter, base: number, o: AttackOpts) {
  const cb = tune.combat;
  const dr = tune.directions;
  let amount = base * attacker.stats.atk * (1 + pocketBuffs(attacker).attack);
  let blocked = false;
  let interrupted = false;
  const flying = isFlying(target);
  if (!o.chip) {
    if (o.dir === 'low' && flying) {
      c.events.push({ type: 'miss', side: target.side, reason: 'FLYING' });
      return;
    }
    if (o.dir === 'low') amount *= dr.lowMult;
    if (o.dir === 'high') amount *= flying ? dr.highVsFlyingMult : dr.highMult;
    if (target.stance === 'defend') {
      amount *= 1 - cb.defendBlock;
      blocked = true;
    } else if (target.stance === 'brains') {
      amount *= cb.interruptMult;
      target.stance = 'none';
      interrupted = true;
    }
  }
  const resist = o.dmg ? tune.armour[target.armour][o.dmg] : 1;
  amount *= resist;
  const part = o.chip ? SLOTS.indexOf('body') : hitPart(c, target, o.dir);
  const weak = !o.chip && part === weakspot(target);
  if (weak) amount *= tune.parts.weakspotMult;
  amount *= 1 + fragility(target);
  amount *= Math.max(0.1, 1 - pocketBuffs(target).defend) / Math.max(0.2, target.stats.def);
  const dealt = Math.max(1, Math.round(amount));
  target.hp = Math.max(0, target.hp - dealt);
  c.events.push({ type: 'hit', side: target.side, amount: dealt, blocked, interrupted, chip: o.chip, part, weak, resist });
  const p = target.parts[part];
  if (!o.chip && p.slot !== 'body' && !p.broken && target.hp > 0) {
    p.hp -= dealt;
    if (p.hp <= 0) breakPart(c, target, part);
  }
}

function heal(c: Combat, f: Fighter, amount: number) {
  const healed = Math.min(f.maxHp - f.hp, Math.round(amount));
  if (healed <= 0) return;
  f.hp += healed;
  c.events.push({ type: 'heal', side: f.side, amount: healed });
}

function jamTiles(c: Combat, target: Fighter, count: number) {
  let jammed = 0;
  for (let tries = 0; tries < 30 && jammed < count; tries++) {
    const reel = pickIndex(c.rng, 2) as 0 | 1;
    const strip = target.strips[reel];
    const t = strip[pickIndex(c.rng, strip.length)];
    if (t.jam || t.id === 'blank') continue;
    t.jam = { spinsLeft: tune.combat.jamSpins, original: t.id };
    t.id = 'blank';
    jammed++;
  }
  if (jammed) c.events.push({ type: 'jam', side: target.side, count: jammed });
}

function dropTiles(c: Combat, target: Fighter, count: number) {
  let dropped = 0;
  while (dropped < count && target.pocket.length) {
    target.pocket.splice(pickIndex(c.rng, target.pocket.length), 1);
    dropped++;
  }
  if (dropped) c.events.push({ type: 'drop', side: target.side, count: dropped });
}

/** Resolve one move. `mult` already includes tier or burn scaling. */
function resolveMove(c: Combat, f: Fighter, move: MoveId, mult: number, dir: Direction) {
  const target = c.fighters[other(f.side)];
  const cb = tune.combat;
  const def = MOVES[move];
  if (def.kind === 'attack') {
    const power = (tune.moves[move] as { power: number }).power;
    damage(c, f, target, power * mult, { chip: false, dir, dmg: def.dmg });
  } else if (def.kind === 'defend') {
    heal(c, f, tune.moves.guard.heal * mult);
  } else {
    // Brains beats Defend: feints past the guard with doubled effect.
    const vsDefend = target.stance === 'defend';
    const boost = vsDefend ? cb.brainsVsDefendMult : 1;
    if (vsDefend) target.stance = 'none';
    const power = (tune.moves[move] as { power: number }).power;
    damage(c, f, target, power * mult * boost, { chip: true, dir: 'front' });
    if (move === 'snatch') dropTiles(c, target, Math.max(1, Math.round(tune.moves.snatch.drop * mult * boost)));
    else jamTiles(c, target, Math.max(1, Math.round(mult * boost)));
  }
}

/** Small automatic effect of one off-line tile (also used by mutator burns). */
function offlineEffect(c: Combat, f: Fighter, id: TileId) {
  const o = tune.offline;
  const target = c.fighters[other(f.side)];
  if (id === 'blank' || id === 'high' || id === 'low') return;
  if (id === 'power') damage(c, f, target, o.powerChip, { chip: true, dir: 'front' });
  else if (id === 'quick') f.cooldown -= tune.timing.baseCooldownSec * o.quickCooldownCut;
  else {
    const kind = MOVES[id].kind;
    if (kind === 'attack') damage(c, f, target, o.attackChip, { chip: true, dir: 'front' });
    else if (kind === 'defend') heal(c, f, o.defendHeal);
    else f.cooldown -= tune.timing.baseCooldownSec * o.brainsCooldownCut;
  }
}

export function execute(c: Combat, side: Side): boolean {
  const f = c.fighters[side];
  if (!f.landed || c.winner) return false;
  const cb = tune.combat;
  const { move, mut, tier, mutMatches } = executePreview(f);
  removeFromPocket(f, move, tier);
  removeFromPocket(f, mut, mutMatches);
  const consumed: TileId[] = [...Array(tier).fill(move), ...Array(mutMatches).fill(mut)];
  const schemed = f.stance === 'brains';
  let mult = cb.tierMult[tier] * (schemed ? cb.schemeMult : 1);
  const mutStack = 1 + mutMatches * cb.mutatorMatchBonus;
  if (mut === 'power') mult *= 1 + (tune.mutators.power.mult - 1) * mutStack;
  else if (mut === 'high' || mut === 'low') mult *= mutStack;
  const dir = directionOf(mut);
  f.landed = false;
  if (isMove(move)) {
    c.events.push({ type: 'action', side, move, tier, isSuper: tier >= 3, burn: false, dir, consumed });
    resolveMove(c, f, move, mult, dir);
  }
  if (mut === 'quick') f.cooldown -= tune.timing.baseCooldownSec * tune.mutators.quick.cooldownCut * mutStack;
  for (const reel of [0, 1] as const) {
    const w = reelWindow(f, reel);
    offlineEffect(c, f, w[0].id);
    offlineEffect(c, f, w[2].id);
  }
  f.stance = isMove(move) ? (MOVES[move].kind === 'attack' ? 'none' : (MOVES[move].kind as Stance)) : 'none';
  checkEnd(c);
  return true;
}

export function pocket(c: Combat, side: Side): boolean {
  const f = c.fighters[side];
  if (!f.landed || c.winner) return false;
  const tiles = visibleTiles(f).filter((t) => t.id !== 'blank');
  const held = new Set(f.pocket.map((t) => t.id));
  // Priority: matches with held tiles, then line tiles, then off-line tiles.
  const rank = (t: { id: TileId; line: boolean }) => (held.has(t.id) ? 0 : t.line ? 1 : 2);
  const ordered = [...tiles].sort((a, b) => rank(a) - rank(b) || a.slot - b.slot);
  const stored: { id: TileId; from: number }[] = [];
  const discarded: number[] = [];
  for (const t of ordered) {
    if (f.pocket.length >= f.pocketSize) {
      discarded.push(t.slot);
      continue;
    }
    f.pocket.push({ id: t.id, part: t.part });
    stored.push({ id: t.id, from: t.slot });
  }
  c.events.push({ type: 'pocket', side, stored, discarded });
  f.stance = 'none';
  f.landed = false;
  return true;
}

export function burn(c: Combat, side: Side, id: TileId): boolean {
  const f = c.fighters[side];
  if (!f.landed || c.winner) return false;
  const n = removeFromPocket(f, id, 3);
  if (!n) return false;
  c.events.push({ type: 'burn', side, id, count: n });
  if (isMove(id)) {
    c.events.push({ type: 'action', side, move: id, tier: n, isSuper: false, burn: true, dir: 'front', consumed: [] });
    resolveMove(c, f, id, tune.combat.burnMult[n], 'front');
  } else {
    for (let i = 0; i < n; i++) offlineEffect(c, f, id);
  }
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
  for (const reel of [0, 1] as const) {
    const strip = f.strips[reel];
    f.reelPos[reel] = pickIndex(c.rng, strip.length);
    for (const t of strip) {
      if (t.jam && --t.jam.spinsLeft <= 0) {
        t.id = t.jam.original;
        delete t.jam;
      }
    }
  }
  f.tease = executePreview(f).tier >= 3;
  f.spinTotal = tune.timing.spinSec + tune.timing.reelStaggerSec + (f.tease ? tune.timing.superTeaseSec : 0);
  f.spinLeft = f.spinTotal;
  c.events.push({ type: 'spin', side: f.side, tease: f.tease });
}

/** Seconds after spin start at which a reel lands. The move reel lands last on a tease. */
export function reelLandTime(f: Fighter, reel: 0 | 1): number {
  const t = tune.timing;
  if (f.tease) return reel === 1 ? t.spinSec : t.spinSec + t.reelStaggerSec + t.superTeaseSec;
  return reel === 0 ? t.spinSec : t.spinSec + t.reelStaggerSec;
}

export function tick(c: Combat, dt: number) {
  if (c.winner) return;
  for (const side of ['player', 'enemy'] as const) {
    const f = c.fighters[side];
    if (f.spinLeft > 0) {
      const before = f.spinTotal - f.spinLeft;
      f.spinLeft -= dt;
      const after = f.spinTotal - f.spinLeft;
      for (const reel of [0, 1] as const) {
        const at = reelLandTime(f, reel);
        if (before < at && after >= at && f.spinLeft > 0) c.events.push({ type: 'reelLand', side, reel });
      }
      if (f.spinLeft <= 0) {
        f.spinLeft = 0;
        f.landed = true;
        f.aiWait = 0;
        f.cooldown = tune.timing.baseCooldownSec;
        c.events.push({ type: 'land', side });
      }
      continue;
    }
    const rate = f.stats.speed * (1 + pocketBuffs(f).speed) * (f.landed ? tune.timing.decideCooldownRate : 1);
    f.cooldown -= dt * rate;
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
  const { tier, move } = executePreview(f);
  const free = f.pocketSize - f.pocket.length;
  // Full pocket with a stale pair: burn it to make room.
  if (free === 0) {
    const stale = pocketGroups(f).find((g) => g.id !== move && g.count >= 2);
    if (stale) burn(c, 'enemy', stale.id);
    if (!f.landed) return;
  }
  if (tier >= 1 || move === 'blank') {
    if (move === 'blank' && free >= 3) pocket(c, 'enemy');
    else execute(c, 'enemy');
    return;
  }
  const weakLine = move === 'guard' && f.hp > f.maxHp * 0.6;
  if (free >= 3 && (weakLine || c.rng() < 0.3)) pocket(c, 'enemy');
  else execute(c, 'enemy');
}
