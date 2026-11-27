// Headless balance sim for chimera-reels. Runs the real combat and run code
// (no rendering) and prints win rates and fight stats per starter and floor.
// Launch with: node scripts/sim-chimera-balance.mjs [fightsPerCell]
import { burn, createCombat, execute, executeMatches, makeFighter, pocket, pocketGroups, pocketRoom, tick, type Combat } from '../prototypes/chimera-reels/src/sim/combat';
import { isMove, isTarget, STARTERS, type MonsterSpec } from '../prototypes/chimera-reels/src/sim/content';
import { makeRng } from '../prototypes/chimera-reels/src/sim/rng';
import { randomMonster } from '../prototypes/chimera-reels/src/sim/run';
import { tune } from '../prototypes/chimera-reels/src/tune';

type Policy = 'execute' | 'smart';

/** Player decision when the player's reels have landed. */
function decide(c: Combat, policy: Policy) {
  const f = c.fighters.player;
  if (policy === 'execute') return execute(c, 'player');
  const m = executeMatches(f);
  const free = pocketRoom(f);
  if (free < 3) {
    const stale = pocketGroups(f).find((g) => isMove(g.id) && g.id !== m.move && g.count >= 2);
    if (stale) burn(c, 'player', stale.id);
    if (!f.landed) return;
  }
  if (!isMove(m.move) || !isTarget(m.target)) return free >= 3 ? pocket(c, 'player') : execute(c, 'player');
  if (m.tier >= 1 || (m.mut === 'shield' && f.shield === 0)) return execute(c, 'player');
  if (free >= 6 && c.rng() < 0.25) return pocket(c, 'player');
  return execute(c, 'player');
}

interface Stats { wins: number; fights: number; secs: number; hpLeft: number; supers: number; breaks: number; shield: number; timeouts: number; dealt: number; taken: number; absorbed: number }

function fight(player: MonsterSpec, floor: number, seed: number, policy: Policy, s: Stats) {
  const rng = makeRng(seed);
  const r = tune.run;
  const enemySpec = randomMonster(rng, floor);
  const p = makeFighter('player', player);
  const e = makeFighter('enemy', enemySpec, { hp: 1 + (floor - 1) * r.enemyHpPerFloor, atk: 1 + (floor - 1) * r.enemyAtkPerFloor });
  const c = createCombat(p, e, rng);
  const dt = 1 / 30;
  let t = 0;
  while (!c.winner && t < 300) {
    tick(c, dt);
    t += dt;
    if (c.fighters.player.landed) {
      // Think time like a quick human player.
      decide(c, policy);
    }
    for (const ev of c.events.splice(0)) {
      if (ev.type === 'action' && ev.isSuper) s.supers++;
      if (ev.type === 'break') s.breaks++;
      if (ev.type === 'shield' && ev.side === 'player') s.shield += ev.amount;
      if (ev.type === 'hit' && ev.side === 'enemy') s.dealt += ev.amount;
      if (ev.type === 'hit' && ev.side === 'player') {
        s.taken += ev.amount;
        s.absorbed += ev.shielded;
      }
    }
  }
  s.fights++;
  s.secs += t;
  if (!c.winner) s.timeouts++;
  if (c.winner === 'player') {
    s.wins++;
    s.hpLeft += c.fighters.player.hp / c.fighters.player.maxHp;
  }
}

/** Deep-merge a JSON patch into the live tune (TUNE_PATCH env), to try values without editing tune.json. */
function patchTune(target: Record<string, unknown>, patch: Record<string, unknown>) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) patchTune(target[k] as Record<string, unknown>, v as Record<string, unknown>);
    else target[k] = v;
  }
}

export async function main(args: string[]) {
  const n = Number(args[0]) || 200;
  if (process.env.TUNE_PATCH) patchTune(tune as unknown as Record<string, unknown>, JSON.parse(process.env.TUNE_PATCH));
  const only = process.env.ONLY_SMART === '1';
  const floors = [1, 2, 3, 4, 6, 8];
  const starters: MonsterSpec[] = [...STARTERS];
  // A few random-roll starters, averaged as one row.
  const randoms = Array.from({ length: 10 }, (_, i) => randomMonster(makeRng(900 + i), 1, `Random${i}`));
  for (const policy of (only ? ['smart'] : ['smart', 'execute']) as Policy[]) {
    console.log(`\n== policy: ${policy}, ${n} fights per cell ==`);
    console.log(['starter'.padEnd(10), ...floors.map((f) => `F${f}`.padStart(15))].join(''));
    const rows: [string, MonsterSpec[]][] = [...starters.map((s) => [s.name, [s]] as [string, MonsterSpec[]]), ['Random', randoms]];
    for (const [name, specs] of rows) {
      const cells: string[] = [];
      for (const floor of floors) {
        const s: Stats = { wins: 0, fights: 0, secs: 0, hpLeft: 0, supers: 0, breaks: 0, shield: 0, timeouts: 0, dealt: 0, taken: 0, absorbed: 0 };
        for (let i = 0; i < n; i++) fight(specs[i % specs.length], floor, floor * 100000 + i, policy, s);
        cells.push(`${Math.round((100 * s.wins) / s.fights)}% ${Math.round(s.secs / s.fights)}s`.padStart(15));
        if (floor === 1 && policy === 'smart') {
          console.error(`  ${name} F1: avg ${(s.secs / s.fights).toFixed(1)}s, supers/fight ${(s.supers / s.fights).toFixed(2)}, breaks/fight ${(s.breaks / s.fights).toFixed(2)}, shield/fight ${(s.shield / s.fights).toFixed(0)}, hp left on win ${s.wins ? Math.round((100 * s.hpLeft) / s.wins) : 0}%, dps dealt ${(s.dealt / s.secs).toFixed(2)}, dps taken ${(s.taken / s.secs).toFixed(2)}, shield absorbed ${Math.round((100 * s.absorbed) / Math.max(1, s.taken))}%`);
        }
      }
      console.log([name.padEnd(10), ...cells].join(''));
    }
  }
}
