// Runs the Densha Domino backwards generator over several board sizes and prints stats.
// Usage: node scripts/gen-densha-levels.mjs [countPerSize=20]
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(os.tmpdir(), `densha-gen-${process.pid}.mjs`);
await build({ entryPoints: [path.join(root, 'prototypes/densha-domino/src/game/generator.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
const { generate } = await import(pathToFileURL(out).href);
const n = Number(process.argv[2] ?? 20);
const sizes = [
  { cols: 5, rows: 5, trains: 5, maxLen: 2, obstacles: 3, climax: 3, minPar: 3 },
  { cols: 6, rows: 7, trains: 8, maxLen: 3, obstacles: 4, climax: 4, minPar: 4 },
  { cols: 7, rows: 8, trains: 11, maxLen: 3, obstacles: 5, climax: 5, minPar: 5 },
  { cols: 8, rows: 9, trains: 14, maxLen: 3, obstacles: 6, climax: 5, minPar: 6 },
  { cols: 8, rows: 10, trains: 18, maxLen: 3, obstacles: 7, climax: 6, minPar: 7 },
];
for (const sz of sizes) {
  let ok = 0, exact = 0, ms = 0, par = 0, climax = 0, plan = 0, last = 0;
  const t0 = performance.now();
  for (let i = 1; i <= n; i++) {
    const r = generate({ ...sz, seed: i });
    if (!r) continue;
    ok++; if (r.exact) exact++; par += r.par; plan += r.planLength; climax += r.climaxLinks;
    if (r.linksPerTap[r.linksPerTap.length - 1] === Math.max(...r.linksPerTap)) last++;
  }
  ms = performance.now() - t0;
  console.log(`${sz.cols}x${sz.rows} trains ${sz.trains}: ${ok}/${n} ok, exact par ${exact}, avg par ${(par / Math.max(ok, 1)).toFixed(1)}, avg plan ${(plan / Math.max(ok, 1)).toFixed(1)}, avg climax ${(climax / Math.max(ok, 1)).toFixed(1)}, climax is biggest tap ${last}, ${(ms / n).toFixed(0)} ms/level`);
}
