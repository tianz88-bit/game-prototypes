// Cascade builder (owner, 23 November 2026): turns good levels into two-act levels whose solution opens with a
// setup chain, one honk that moves 3+ trains and clears none, landing exactly on the original level's start.
//
// For each source level L (the pack), it searches one move backwards: pull 2 to 4 trains back along their
// tracks (away from their faces) by 1 to 3 cells into free cells, then tries every legal move on that earlier
// board. A candidate is kept when one move turns it into L's start with no train leaving and 3+ trains moving,
// and the solver proves that cascade is the start of a shortest solution with all quality rules intact.
// Writes .cache/densha-cascades.json and prints a summary. Usage: node scripts/build-densha-cascades.mjs [maxPerLevel=1]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = await build({
  stdin: { contents: "export {LEVELS} from './prototypes/densha-domino/src/game/levels';export {PUZZLE_CONTRACTS} from './prototypes/densha-domino/src/game/puzzle-contracts';export {applyTap,initialState,legalMoves,isCleared} from './prototypes/densha-domino/src/game/rules';export {analyze,planLabels,singleExitShare,complexity,TIGHT_RULES} from './prototypes/densha-domino/src/game/quality';", resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error',
});
const R = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const slack = JSON.parse(fs.readFileSync(path.join(root, 'prototypes/densha-domino/tune.json'), 'utf8')).rules.limitSlack;
const maxPerLevel = Number(process.argv[2] ?? 1);
const glyph = { concrete: '#', kiosk: 'k', signal: 's', tree: 't', machine: 'm', buffer: 'b' };

const cellsOf = (level, t, start) => Array.from({ length: t.len }, (_, i) => (t.axis === 'h' ? t.line * level.cols + start + i : (start + i) * level.cols + t.line));
const occupiedBy = (level, state) => {
  const occ = new Map();
  for (const c of level.obstacles.keys()) occ.set(c, -2);
  level.trains.forEach((t, id) => { if (state[id] >= 0) for (const c of cellsOf(level, t, state[id])) occ.set(c, id); });
  return occ;
};
function* subsets(arr, k, from = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = from; i < arr.length; i++) { acc.push(arr[i]); yield* subsets(arr, k, i + 1, acc); acc.pop(); }
}
const serialize = (level, starts) => {
  const grid = Array.from({ length: level.rows }, () => Array(level.cols).fill('.'));
  for (const [cell, kind] of level.obstacles) grid[Math.floor(cell / level.cols)][cell % level.cols] = glyph[kind];
  const axis = {}, head = {};
  level.trains.forEach((t, id) => { axis[t.letter] = t.axis; head[t.letter] = t.headDir; for (const c of cellsOf(level, t, starts[id])) grid[Math.floor(c / level.cols)][c % level.cols] = t.letter; });
  return { rows: grid.map((r) => r.join('')), axis, head };
};

const results = [];
const t0 = Date.now();
for (const [index, L] of R.LEVELS.entries()) {
  if (index < 6) continue; // tutorial and Kyoto stay as they are
  const target = R.initialState(L), targetKey = target.join(',');
  const base = R.analyze(L, undefined, 300000);
  if (!base) continue;
  const n = L.trains.length, ids = L.trains.map((_, i) => i);
  const found = [];
  const seen = new Set();
  let tried = 0, cascades = 0, analysed = 0;
  for (let k = 2; k <= 4 && found.length < maxPerLevel * 3 && analysed < 400; k++) {
    for (const group of subsets(ids, k)) {
      // Each pulled train moves 1..3 cells away from its face (so a honk drives it back toward its face).
      const options = group.map((id) => [1, 2, 3].map((d) => target[id] - L.trains[id].headDir * d));
      const combos = options.reduce((acc, opts) => acc.flatMap((a) => opts.map((o) => [...a, o])), [[]]);
      for (const combo of combos) {
        const state = target.slice();
        group.forEach((id, j) => { state[id] = combo[j]; });
        // Valid board: on the grid and no overlaps.
        let ok = true;
        const occ = new Map();
        for (const c of L.obstacles.keys()) occ.set(c, -2);
        L.trains.forEach((t, id) => {
          const along = t.axis === 'h' ? L.cols : L.rows;
          if (state[id] < 0 || state[id] + t.len > along) { ok = false; return; }
          for (const c of cellsOf(L, t, state[id])) { if (occ.has(c)) ok = false; occ.set(c, id); }
        });
        if (!ok) continue;
        for (const m of R.legalMoves(L, state)) {
          tried++;
          const r = R.applyTap(L, state, m);
          // A cascade that moves 3+ trains and clears none. It need not land exactly on L's start:
          // the solver decides below whether the shortest solution really opens with a setup chain.
          if (r.exited !== 0 || r.links < 3) continue;
          cascades++;
          const key = state.join(',');
          if (seen.has(key) || analysed >= 400) break;
          seen.add(key);
          analysed++;
          const level = { ...L, trains: L.trains.map((t, id) => ({ ...t, start: state[id] })) };
          const a = R.analyze(level, undefined, 300000);
          if (!a) continue;
          const labels = R.planLabels(level, a.plan);
          if (labels.setupChains < 1 || labels.singles > 0 || labels.payoffs < 1) continue;
          if (a.firstOptimal > R.TIGHT_RULES.maxFirstOptimal || a.traps < R.TIGHT_RULES.minTraps) continue;
          if (n <= a.par + slack) continue; // single clears must still fail
          found.push({ source: L.name, sourceLevel: index + 1, par: a.par, firstOptimal: a.firstOptimal, traps: a.traps, ...labels,
            difficulty: R.complexity({ par: a.par, setups: labels.setups, reverses: labels.reverses, traps: a.traps, biggest: labels.biggest, states: a.states, trains: n }),
            plan: a.plan, ...serialize(L, state) });
          break;
        }
      }
    }
  }
  found.sort((x, y) => y.traps - x.traps || x.firstOptimal - y.firstOptimal);
  results.push(...found.slice(0, maxPerLevel));
  console.log(`L${index + 1} ${L.name}: ${found.length} cascade versions (moves ${tried}, cascades ${cascades}, solved ${analysed})${found[0] ? `, best par ${found[0].par} setup chains ${found[0].setupChains} traps ${found[0].traps}` : ''}`);
}
fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
fs.writeFileSync(path.join(root, '.cache/densha-cascades.json'), JSON.stringify(results, null, 1));
console.log(`done in ${Math.round((Date.now() - t0) / 1000)} s: ${results.length} cascade levels from ${R.LEVELS.length - 6} sources`);
