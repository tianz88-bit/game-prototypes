// Pure combat simulation. No rendering, no input devices: the game loop
// feeds it player decisions (from intents) and elapsed time, and reads back
// state plus a list of events for the renderer to animate.
import { tune } from '../tune';
import {
  isMove,
  MOVES,
  type MonsterDef,
  type MoveId,
  type MoveKind,
  type TileId,
} from './content';
import { pickIndex, type Rng } from './rng';

export type Side = 'player' | 'enemy';
export type Stance = 'none' | 'defend' | 'brains';

/** One position on a reel strip. A jammed tile shows as blank until it expires. */
export interface StripTile {
  id: TileId;
  jam?: { spinsLeft: number; original: TileId };
}

export interface Fighter {
  side: Side;
  name: string;
  hp: number;
  maxHp: number;
  stats: { speed: number; atk: number; def: number };
  strips: [StripTile[], StripTile[]];
  /** Index of the tile sitting on the line, per reel. */
  reelPos: [number, number];
  /** Seconds of cooldown left before the next automatic spin. */
  cooldown: number;
  /** >0 while the reels are spinning (seconds left). */
  spinLeft: number;
  /** A landed result is waiting for Execute or Pocket. */
  landed: boolean;
  pocket: TileId[];
  pocketSize: number;
  stance: Stance;
  /** Seconds the AI has been looking at the current result. */
  aiWait: number;
}

export type CombatEvent =
  | { type: 'spin'; side: Side }
  | { type: 'land'; side: Side }
  | { type: 'lost'; side: Side }
  | { type: 'action'; side: Side; move: MoveId; tier: number; isSuper: boolean; burn: boolean }
  | { type: 'hit'; side: Side; amount: number; blocked: boolean; interrupted: boolean; chip: boolean }
  | { type: 'heal'; side: Side; amount: number }
  | { type: 'drop'; side: Side; count: number }
  | { type: 'jam'; side: Side; count: number }
  | { type: 'pocket'; side: Side; stored: number; discarded: number }
  | { type: 'end'; winner: Side };

export interface Combat {
  fighters: Record<Side, Fighter>;
  winner: Side | null;
  events: CombatEvent[];
  rng: Rng;
}

const other = (s: Side): Side => (s === 'player' ? 'enemy' : 'player');

function makeFighter(side: Side, def: MonsterDef, rng: Rng): Fighter {
  const st = tune.monsters[side];
  return {
    side,
    name: def.name,
    hp: st.hp,
    maxHp: st.hp,
    stats: { speed: st.speed, atk: st.atk, def: st.def },
    strips: [def.strips[0].map((id) => ({ id })), def.strips[1].map((id) => ({ id }))],
    reelPos: [pickIndex(rng, def.strips[0].length), pickIndex(rng, def.strips[1].length)],
    // Stagger the opening spins a little so both sides do not start in sync.
    cooldown: tune.timing.baseCooldownSec * (side === 'player' ? 0.35 : 0.55),
    spinLeft: 0,
    landed: false,
    pocket: [],
    pocketSize: tune.pocket.defaultSize,
    stance: 'none',
    aiWait: 0,
  };
}

export function createCombat(player: MonsterDef, enemy: MonsterDef, rng: Rng): Combat {
  return {
    fighters: { player: makeFighter('player', player, rng), enemy: makeFighter('enemy', enemy, rng) },
    winner: null,
    events: [],
    rng,
  };
}

// ---------------------------------------------------------------- reading

/** The 3 visible tiles of one reel: [above, line, below]. */
export function reelWindow(f: Fighter, reel: 0 | 1): [StripTile, StripTile, StripTile] {
  const strip = f.strips[reel];
  const n = strip.length;
  const p = f.reelPos[reel];
  return [strip[(p - 1 + n) % n], strip[p], strip[(p + 1) % n]];
}

/** All 6 visible tiles, line tiles flagged. */
export function visibleTiles(f: Fighter): { id: TileId; line: boolean; reel: 0 | 1 }[] {
  const out: { id: TileId; line: boolean; reel: 0 | 1 }[] = [];
  for (const reel of [0, 1] as const) {
    reelWindow(f, reel).forEach((t, row) => out.push({ id: t.id, line: row === 1, reel }));
  }
  return out;
}

function countIn(list: TileId[], id: TileId): number {
  return list.reduce((n, t) => n + (t === id ? 1 : 0), 0);
}

function kindCount(list: TileId[], kind: MoveKind): number {
  return list.reduce((n, t) => n + (isMove(t) && MOVES[t].kind === kind ? 1 : 0), 0);
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
  for (const id of f.pocket) {
    const g = groups.find((x) => x.id === id);
    if (g) g.count++;
    else groups.push({ id, count: 1 });
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

// ---------------------------------------------------------------- acting

function removeFromPocket(f: Fighter, id: TileId, max: number): number {
  let removed = 0;
  for (let i = f.pocket.length - 1; i >= 0 && removed < max; i--) {
    if (f.pocket[i] === id) {
      f.pocket.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

function damage(c: Combat, attacker: Fighter, target: Fighter, base: number, chip: boolean) {
  const cb = tune.combat;
  let amount = base * attacker.stats.atk * (1 + pocketBuffs(attacker).attack);
  let blocked = false;
  let interrupted = false;
  if (!chip) {
    if (target.stance === 'defend') {
      amount *= 1 - cb.defendBlock;
      blocked = true;
    } else if (target.stance === 'brains') {
      amount *= cb.interruptMult;
      target.stance = 'none';
      interrupted = true;
    }
  }
  amount *= Math.max(0.1, 1 - pocketBuffs(target).defend) / target.stats.def;
  const dealt = Math.max(1, Math.round(amount));
  target.hp = Math.max(0, target.hp - dealt);
  c.events.push({ type: 'hit', side: target.side, amount: dealt, blocked, interrupted, chip });
}

function heal(c: Combat, f: Fighter, amount: number) {
  const healed = Math.min(f.maxHp - f.hp, Math.round(amount));
  if (healed <= 0) return;
  f.hp += healed;
  c.events.push({ type: 'heal', side: f.side, amount: healed });
}

function jamTiles(c: Combat, target: Fighter, count: number) {
  let jammed = 0;
  for (let tries = 0; tries < 20 && jammed < count; tries++) {
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
function resolveMove(c: Combat, f: Fighter, move: MoveId, mult: number) {
  const target = c.fighters[other(f.side)];
  const cb = tune.combat;
  const kind = MOVES[move].kind;
  if (kind === 'attack') {
    damage(c, f, target, tune.moves[move as 'claw' | 'bite' | 'slam'].power * mult, false);
  } else if (kind === 'defend') {
    heal(c, f, tune.moves.guard.heal * mult);
  } else {
    // Brains beats Defend: feints past the guard with doubled effect.
    const vsDefend = target.stance === 'defend';
    const boost = vsDefend ? cb.brainsVsDefendMult : 1;
    if (vsDefend) target.stance = 'none';
    const def = tune.moves[move as 'snatch' | 'jam'];
    damage(c, f, target, def.power * mult * boost, true);
    if (move === 'snatch') dropTiles(c, target, Math.max(1, Math.round(tune.moves.snatch.drop * mult * boost)));
    else jamTiles(c, target, Math.max(1, Math.round(mult * boost)));
  }
}

/** Small automatic effect of one off-line tile (also used by mutator burns). */
function offlineEffect(c: Combat, f: Fighter, id: TileId) {
  const o = tune.offline;
  const target = c.fighters[other(f.side)];
  if (id === 'blank') return;
  if (id === 'power') damage(c, f, target, o.powerChip, true);
  else if (id === 'quick') f.cooldown -= tune.timing.baseCooldownSec * o.quickCooldownCut;
  else {
    const kind = MOVES[id as MoveId].kind;
    if (kind === 'attack') damage(c, f, target, o.attackChip, true);
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
  const schemed = f.stance === 'brains';
  let mult = cb.tierMult[tier] * (schemed ? cb.schemeMult : 1);
  const mutStack = 1 + mutMatches * cb.mutatorMatchBonus;
  if (mut === 'power') mult *= 1 + (tune.mutators.power.mult - 1) * mutStack;
  if (isMove(move)) {
    c.events.push({ type: 'action', side, move, tier, isSuper: tier >= 3, burn: false });
    resolveMove(c, f, move, mult);
  }
  if (mut === 'quick') f.cooldown -= tune.timing.baseCooldownSec * tune.mutators.quick.cooldownCut * mutStack;
  for (const reel of [0, 1] as const) {
    const w = reelWindow(f, reel);
    offlineEffect(c, f, w[0].id);
    offlineEffect(c, f, w[2].id);
  }
  f.stance = isMove(move) ? (MOVES[move].kind === 'attack' ? 'none' : MOVES[move].kind as Stance) : 'none';
  f.landed = false;
  checkEnd(c);
  return true;
}

export function pocket(c: Combat, side: Side): boolean {
  const f = c.fighters[side];
  if (!f.landed || c.winner) return false;
  const tiles = visibleTiles(f).filter((t) => t.id !== 'blank');
  const held = new Set(f.pocket);
  // Priority: matches with held tiles, then line tiles, then off-line tiles.
  const rank = (t: { id: TileId; line: boolean }) => (held.has(t.id) ? 0 : t.line ? 1 : 2);
  const ordered = tiles.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i);
  let stored = 0;
  for (const { t } of ordered) {
    if (f.pocket.length >= f.pocketSize) break;
    f.pocket.push(t.id);
    stored++;
  }
  c.events.push({ type: 'pocket', side, stored, discarded: tiles.length - stored });
  f.stance = 'none';
  f.landed = false;
  return true;
}

export function burn(c: Combat, side: Side, id: TileId): boolean {
  const f = c.fighters[side];
  if (!f.landed || c.winner) return false;
  const n = removeFromPocket(f, id, 3);
  if (!n) return false;
  if (isMove(id)) {
    c.events.push({ type: 'action', side, move: id, tier: n, isSuper: false, burn: true });
    resolveMove(c, f, id, tune.combat.burnMult[n]);
  } else {
    for (let i = 0; i < n; i++) offlineEffect(c, f, id);
  }
  checkEnd(c);
  return true;
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
  f.spinLeft = tune.timing.spinSec + tune.timing.reelStaggerSec;
  c.events.push({ type: 'spin', side: f.side });
}

export function tick(c: Combat, dt: number) {
  if (c.winner) return;
  for (const side of ['player', 'enemy'] as const) {
    const f = c.fighters[side];
    if (f.spinLeft > 0) {
      f.spinLeft -= dt;
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
  }
  if (tier >= 1) {
    execute(c, 'enemy');
    return;
  }
  const weakLine = move === 'guard' && f.hp > f.maxHp * 0.6;
  if (free >= 3 && (weakLine || c.rng() < 0.3)) pocket(c, 'enemy');
  else execute(c, 'enemy');
}
