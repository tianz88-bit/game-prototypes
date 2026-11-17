// Checks every Densha Domino level with the solver: each must be solvable, and the
// script prints par, trains and solve time. Exits 1 if any level has no solution.
// Usage: node scripts/check-densha-levels.mjs
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'prototypes/densha-domino/src/game/check-entry.ts');
fs.writeFileSync(entry, "export { LEVELS } from './levels';\nexport { solve } from './solver';\nexport { initialState, applyTap } from './rules';\n");
const out = path.join(os.tmpdir(), `densha-check-${process.pid}.mjs`);
try {
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
} finally {
  fs.rmSync(entry, { force: true });
}
const { LEVELS, solve, initialState, applyTap } = await import(pathToFileURL(out).href);
let bad = 0;
LEVELS.forEach((level, i) => {
  const t0 = performance.now();
  const sol = solve(level, initialState(level), 400000);
  const ms = Math.round(performance.now() - t0);
  let st = initialState(level);
  let best = 1;
  for (const m of sol.moves) {
    const r = applyTap(level, st, m);
    best = Math.max(best, r.links);
    st = r.state;
  }
  const ok = sol.par >= 0 && st.every((p) => p === -1);
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} L${i + 1} ${level.name.padEnd(18)} ${level.cols}x${level.rows} trains ${level.trains.length} par ${sol.par} longest chain ${best} solved in ${ms} ms (${sol.explored} states)`);
});
fs.rmSync(out, { force: true });
process.exit(bad ? 1 : 0);
