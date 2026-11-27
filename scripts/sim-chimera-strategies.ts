// Strategy bots for chimera-reels. Runs the real combat code headless with a
// bot per playstyle and prints:
//   1. starter x strategy win rates against floor-1 enemies (built-in AI)
//   2. strategy vs strategy win rates in mirror matches (same monster both
//      sides, random common builds), to check the counter triangle
// Launch: node scripts/sim-chimera-strategies.mjs [fightsPerCell]
// Optional TUNE_PATCH='{"parts":{...}}' tries values without editing tune.json.
import {
  burn, createCombat, execute, executeMatches, isFlying, makeFighter, partForZone, pocket, pocketGroups, pocketRoom,
  previewBurn, previewExecute, shieldCap, tick, tilesFromPart, type Combat, type Side,
} from '../prototypes/chimera-reels/src/sim/combat';
import { isMove, isTarget, STARTERS, zoneOf, type MonsterSpec } from '../prototypes/chimera-reels/src/sim/content';
import { makeRng } from '../prototypes/chimera-reels/src/sim/rng';
import { randomMonster } from '../prototypes/chimera-reels/src/sim/run';
import { tune } from '../prototypes/chimera-reels/src/tune';

export type Strategy = 'rush' | 'charge' | 'utility';
const STRATEGIES: Strategy[] = ['rush', 'charge', 'utility'];
const other = (s: Side): Side => (s === 'player' ? 'enemy' : 'player');

/** Execute now if this line would finish the foe. */
function lethal(c: Combat, side: Side): boolean {
  const pv = previewExecute(c, side);
  return !!pv && pv.hit.toHp >= c.fighters[other(side)].hp;
}

/**
 * Rush: act every spin. Burn Quick stacks for tempo, Execute any live line,
 * Pocket only a dead line (to bank Quicks and duplicates for later).
 */
function rush(c: Combat, side: Side) {
  const f = c.fighters[side];
  const q = pocketGroups(f).find((g) => g.id === 'quick');
  const m = executeMatches(f);
  if (q && m.mut !== 'quick') burn(c, side, 'quick');
  if (!f.landed) return;
  const live = isMove(m.move) && isTarget(m.target);
  if (!live && pocketRoom(f) >= 2) pocket(c, side);
  else execute(c, side);
}

/**
 * Charge: hoard duplicates for supers. Execute on 2+ move duplicates, a lethal
 * line, or when the pocket is nearly full; otherwise Pocket. Makes room by
 * burning stacks that do not match the build-up.
 */
function charge(c: Combat, side: Side) {
  const f = c.fighters[side];
  const m = executeMatches(f);
  if (lethal(c, side) || m.tier >= 2) return execute(c, side);
  if (pocketRoom(f) < 4) {
    // Free space: burn the smallest move stack that is not the line move.
    const stale = pocketGroups(f).filter((g) => isMove(g.id) && g.id !== m.move).sort((a, b) => a.count - b.count)[0];
    if (stale) burn(c, side, stale.id);
    if (!f.landed) return;
  }
  if (m.tier >= 1 && pocketRoom(f) < 4) return execute(c, side);
  if (pocketRoom(f) >= 3) return pocket(c, side);
  execute(c, side);
}

/**
 * Utility: keep a shield up, strip the foe's charge with target burns, and
 * outlast. Burns Shield when exposed, burns target tiles at enemy parts that
 * hold charge tiles, executes shield lines, pockets weak lines.
 */
function utility(c: Combat, side: Side) {
  const f = c.fighters[side];
  const foe = c.fighters[other(side)];
  const cap = shieldCap(f);
  // Emergency shield.
  if (f.shield === 0 && pocketGroups(f).some((g) => g.id === 'shield')) burn(c, side, 'shield');
  if (!f.landed) return;
  // Disrupt: burn a target stack aimed at a part that holds enemy charge tiles.
  for (const g of pocketGroups(f)) {
    if (!isTarget(g.id) || !f.landed) continue;
    const part = partForZone(foe, zoneOf(g.id));
    const atRisk = tilesFromPart(foe, part).filter((t) => isMove(t.id)).length;
    const hit = previewBurn(c, side, g.id);
    if (atRisk >= 2 && hit && hit.toHp > 0) burn(c, side, g.id);
  }
  if (!f.landed) return;
  const m = executeMatches(f);
  if (lethal(c, side)) return execute(c, side);
  if (m.mut === 'shield' && f.shield < cap * 0.6) return execute(c, side);
  const live = isMove(m.move) && isTarget(m.target);
  if (live && (m.tier >= 1 || m.targetMatches >= 1)) return execute(c, side);
  if (pocketRoom(f) >= 3 && (!live || c.rng() < 0.5)) return pocket(c, side);
  execute(c, side);
}

const BOTS: Record<Strategy, (c: Combat, side: Side) => void> = { rush, charge, utility };

/**
 * Seconds a player of each style spends deciding after the reels land
 * (assumption about real play). The game slows the next cooldown while a
 * result waits, so planning has a real tempo cost. THINK=0 turns it off.
 */
const THINK: Record<Strategy, number> = process.env.THINK === '0'
  ? { rush: 0, charge: 0, utility: 0 }
  : { rush: 0.25, charge: 1.0, utility: 1.2 };

interface Tally { wins: number; fights: number; secs: number; supers: number; burns: number; knock: number }
const tally = (): Tally => ({ wins: 0, fights: 0, secs: 0, supers: 0, burns: 0, knock: 0 });

/** One fight. `enemyBot` null = the game's built-in enemy AI. */
function fight(p: MonsterSpec, e: MonsterSpec, seed: number, playerBot: Strategy, enemyBot: Strategy | null, floor: number, t: Tally) {
  const rng = makeRng(seed);
  const r = tune.run;
  const c = createCombat(
    makeFighter('player', p),
    makeFighter('enemy', e, { hp: 1 + (floor - 1) * r.enemyHpPerFloor, atk: 1 + (floor - 1) * r.enemyAtkPerFloor }),
    rng,
  );
  c.enemyAi = enemyBot === null;
  const dt = 1 / 30;
  const waited: Record<Side, number> = { player: 0, enemy: 0 };
  const drive = (side: Side, bot: Strategy) => {
    if (!c.fighters[side].landed || c.winner) {
      waited[side] = 0;
      return;
    }
    waited[side] += dt;
    if (waited[side] >= THINK[bot]) {
      BOTS[bot](c, side);
      waited[side] = 0;
    }
  };
  while (!c.winner && c.time < 300) {
    tick(c, dt);
    drive('player', playerBot);
    if (enemyBot) drive('enemy', enemyBot);
    c.events.length = 0;
  }
  t.fights++;
  t.secs += c.time;
  if (c.winner === 'player') t.wins++;
  for (const l of c.log) {
    if (l.side !== 'player') continue;
    if (l.kind === 'execute' && l.tier >= 3) t.supers++;
    if (l.kind === 'burn') t.burns++;
    if (l.knockedOut) t.knock++;
  }
}

function patchTune(target: Record<string, unknown>, patch: Record<string, unknown>) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) patchTune(target[k] as Record<string, unknown>, v as Record<string, unknown>);
    else target[k] = v;
  }
}

const pct = (t: Tally) => `${Math.round((100 * t.wins) / t.fights)}%`;

export async function main(args: string[]) {
  const n = Number(args[0]) || 300;
  if (process.env.TUNE_PATCH) patchTune(tune as unknown as Record<string, unknown>, JSON.parse(process.env.TUNE_PATCH));
  const randoms = Array.from({ length: 12 }, (_, i) => ({ ...randomMonster(makeRng(700 + i), 1, `R${i}`), soul: 'adaptive' as const }));
  const rows: [string, MonsterSpec[]][] = [...STARTERS.map((s) => [s.name, [s]] as [string, MonsterSpec[]]), ['Random', randoms]];

  console.log(`\n1) Starter x strategy vs floor-1 enemies (built-in AI), ${n} fights per cell`);
  console.log('   win%  avg-secs  supers/fight  burns/fight  knockouts/fight');
  console.log(['starter'.padEnd(10), ...STRATEGIES.map((s) => s.padStart(26))].join(''));
  for (const [name, specs] of rows) {
    const cells = STRATEGIES.map((strat) => {
      const t = tally();
      for (let i = 0; i < n; i++) {
        const seed = 50000 + i;
        fight(specs[i % specs.length], randomMonster(makeRng(seed * 7 + 1), 1), seed, strat, null, 1, t);
      }
      return `${pct(t)} ${Math.round(t.secs / t.fights)}s ${(t.supers / t.fights).toFixed(2)} ${(t.burns / t.fights).toFixed(1)} ${(t.knock / t.fights).toFixed(1)}`.padStart(26);
    });
    console.log([name.padEnd(10), ...cells].join(''));
  }

  console.log(`\n2) Strategy vs strategy, mirror matches (same random common monster both sides), ${n} fights per cell`);
  console.log('   row strategy win% against column strategy');
  console.log(['vs'.padEnd(10), ...STRATEGIES.map((s) => s.padStart(10))].join(''));
  for (const a of STRATEGIES) {
    const cells = STRATEGIES.map((b) => {
      const t = tally();
      for (let i = 0; i < n; i++) {
        const spec = randomMonster(makeRng(90000 + i), 1);
        fight(spec, spec, 90000 + i, a, b, 1, t);
      }
      return pct(t).padStart(10);
    });
    console.log([a.padEnd(10), ...cells].join(''));
  }
}
