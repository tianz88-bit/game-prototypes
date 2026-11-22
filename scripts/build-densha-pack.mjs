// Generates the Kaiten Express level pack (levels 7 to 101, all generated) with the backwards generator plus the
// tightness rules in prototypes/densha-domino/src/game/quality.ts, then writes:
//   prototypes/densha-domino/src/game/pack.ts            (boards, heads, optimal-plan proofs)
//   prototypes/densha-domino/src/game/puzzle-contracts.ts (contracts for levels 12 to 101; 1 to 11 kept)
// Levels are ordered by difficulty so the ramp never drops back.
// Usage: node scripts/build-densha-pack.mjs [workers=4]   (progress: .cache/densha-pack.log)
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = path.join(root, 'prototypes/densha-domino/src/game');
const SLOTS = 95;

/** Board size, trains and minimum par for each generated slot (total = slots to generate). */
function specFor(i, total) {
  const t = i / Math.max(1, total - 1);
  if (t < 0.4) return { cols: 6, rows: 7, trains: 9 + Math.round(t * 2.5), minPar: 4 };
  return { cols: 7, rows: 7, trains: 10 + Math.round((t - 0.4) / 0.6 * 1.4), minPar: 4 };
}

async function bundle() {
  const b = await build({
    stdin: { contents: "export {generate} from './generator';export {tighten,polish,analyze,planLabels,complexity} from './quality';export {PACK} from './pack';export {PUZZLE_CONTRACTS} from './puzzle-contracts';export {LEVEL_SOURCES,parseLevel} from './levels';export {applyTap} from './rules';export {LEVEL_REPAIRS} from './level-repairs';export {HEAD_DIRECTIONS} from './head-directions';", resolveDir: game, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error',
  });
  return 'data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64');
}

if (!isMainThread) {
  const { generate, tighten, polish } = await import(workerData.module);
  for (const slot of workerData.slots) {
    const spec = specFor(slot, workerData.total);
    let result = null;
    for (let attempt = 0; attempt < 400 && !result; attempt++) {
      const seed = 50000 + slot * 1000 + attempt;
      const g = generate({ ...spec, maxLen: 3, obstacles: 5, climax: Math.max(3, Math.ceil(spec.trains * 0.4)), seed }, undefined, 20);
      if (!g) continue;
      const p = polish({ rows: g.rows, axis: g.axis, head: g.head }, seed, spec.minPar, 400);
      if (!p) continue;
      const r = tighten(p, seed);
      if (!('reject' in r) && r.par >= spec.minPar) result = { ...r, slot, attempt };
    }
    parentPort.postMessage(result ?? { slot, failed: true });
  }
} else {
  const workers = Number(process.argv[2] ?? Math.max(1, os.cpus().length));
  const module = await bundle();
  const { LEVEL_SOURCES, parseLevel, HEAD_DIRECTIONS, analyze, applyTap, PACK, planLabels, complexity } = await import(module);
  // Owner, 22 November 2026: keep current pack levels with setup and payoff (no singles, a setup, a 3+ chain
  // right after a setup); generate the rest under the stricter rules in quality.ts.
  const kept = PACK.map((entry) => {
    const level = parseLevel(entry.name, entry.rows, entry.axis, entry.head);
    const labels = planLabels(level, entry.quality.plan);
    if (labels.singles > 0 || labels.setups < 1 || labels.payoffs < 1) return null;
    const a = analyze(level, undefined, 400000);
    if (!a) return null;
    return { ...entry, slot: -1, difficulty: complexity({ par: a.par, setups: labels.setups, reverses: labels.reverses, traps: a.traps, biggest: labels.biggest, states: a.states, trains: level.trains.length }) };
  }).filter(Boolean);
  const GEN = SLOTS - kept.length;
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const logFile = path.join(root, '.cache/densha-pack.log');
  const cacheFile = path.join(root, '.cache/densha-pack-setup-payoff.json');
  fs.appendFileSync(logFile, `start ${new Date().toISOString()} with ${workers} workers\n`);
  const log = (line) => { fs.appendFileSync(logFile, line + '\n'); console.log(line); };
  // Resume: finished slots are kept in .cache, so an interrupted build continues where it stopped.
  const slack = JSON.parse(fs.readFileSync(path.join(root, 'prototypes/densha-domino/tune.json'), 'utf8')).rules.limitSlack;
  const meetsRules = (r) => r.linksPerTap.filter((e) => e >= 2).length >= 2 && Object.keys(r.axis).length > r.par + slack;
  const results = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')).filter((r) => !r.failed && meetsRules(r)) : [];
  const done = new Set(results.map((r) => r.slot));
  log(`keeping ${kept.length} existing levels; generating ${GEN}; resuming with ${results.length} finished slots`);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, (_, w) => new Promise((resolve, reject) => {
    const slots = Array.from({ length: GEN }, (_, i) => i).filter((i) => i % workers === w && !done.has(i));
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { module, slots, total: GEN } });
    worker.on('message', (r) => {
      results.push(r);
      if (!r.failed) fs.writeFileSync(cacheFile, JSON.stringify(results));
      log(r.failed ? `slot ${r.slot} FAILED` : `slot ${r.slot} ok (${results.length}/${GEN}, ${Math.round((Date.now() - t0) / 1000)} s) par ${r.par} setups ${r.setups} reverses ${r.reverses} traps ${r.traps} finale ${r.finale}/${Object.keys(r.axis).length} first-optimal ${r.firstOptimal} greedy ${r.greedyStuck ? 'stuck' : '+' + (r.greedySteps - r.par)} props ${r.obstacles} density ${r.density.toFixed(2)} attempt ${r.attempt}`);
    });
    worker.on('error', reject);
    worker.on('exit', resolve);
  })));
  const failed = results.filter((r) => r.failed);
  if (failed.length) throw new Error(`${failed.length} slots failed: ${failed.map((r) => r.slot).join(', ')}`);

  // Proofs for the six fixed levels (tutorial and Kyoto Crossing): the best optimal plan from the full search.
  const fixed = LEVEL_SOURCES.slice(0, 6).map((src, k) => {
    const level = parseLevel(src.name, src.rows, src.axis, src.head ?? HEAD_DIRECTIONS[src.name]);
    const a = analyze(level, undefined, 400000);
    if (!a) throw new Error(`fixed level ${src.name} has no solution`);
    let state = level.trains.map((t) => t.start), max = 0, final = 0;
    for (const m of a.plan) { const r = applyTap(level, state, m); state = r.state; max = Math.max(max, r.exited); final = r.exited; }
    log(`fixed level ${k + 1} ${src.name}: par ${a.par} best chain ${max} finale ${final}`);
    return { level: k + 1, name: src.name, par: a.par, minChain: max, minFinal: final, plan: a.plan };
  });
  // Smooth ramp: order by difficulty (ties keep the earlier slot first).
  const ordered = [...kept, ...results.map((r) => ({ ...r, quality: { par: r.par, minChain: r.maxChain, minFinal: r.finale, plan: r.plan } }))]
    .sort((a, b) => a.difficulty - b.difficulty || a.slot - b.slot);
  const sushi = ['Salmon', 'Tuna', 'Tamago', 'Ebi', 'Ikura', 'Uni', 'Unagi', 'Maki', 'Nigiri', 'Wasabi', 'Ginger', 'Nori', 'Toro', 'Hamachi', 'Saba', 'Kani', 'Inari', 'Temaki', 'Gunkan', 'Futomaki'];
  const rail = ['Siding', 'Junction', 'Loop', 'Express', 'Terminal', 'Crossing', 'Depot', 'Yard', 'Platform', 'Shuttle', 'Local', 'Transfer', 'Spur', 'Viaduct', 'Limited', 'Relay'];
  // New names skip the kept levels' names, so their best-move records stay with the same puzzle.
  const taken = new Set(kept.map((k) => k.name));
  const names = [];
  for (let k = 0; names.length < GEN && k < 2000; k++) { const n = `${sushi[k % sushi.length]} ${rail[(k * 7 + Math.floor(k / sushi.length)) % rail.length]}`; if (!taken.has(n) && !names.includes(n)) names.push(n); }
  if (names.length < GEN) throw new Error('not enough level names');
  let next = 0;

  const items = ordered.map((r) => ({ name: r.slot === -1 ? r.name : names[next++], rows: r.rows, axis: r.axis, head: r.head, quality: r.quality }));
  const body = items.map((it) => `  { name: ${JSON.stringify(it.name)}, rows: ${JSON.stringify(it.rows)}, axis: ${JSON.stringify(it.axis)}, head: ${JSON.stringify(it.head)}, quality: ${JSON.stringify(it.quality)} },`).join('\n');
  fs.writeFileSync(path.join(game, 'pack.ts'), `import type { LevelSource } from './levels';\n\n// Generated by scripts/build-densha-pack.mjs (backwards generator + tightness rules in quality.ts).\n// Ordered by difficulty. Do not edit by hand.\nexport const PACK: LevelSource[] = [\n${body}\n];\n`);

  const contracts = [...fixed, ...items.map((it, i) => ({ level: 7 + i, name: it.name, par: it.quality.par, minChain: it.quality.minChain, minFinal: it.quality.minFinal, plan: it.quality.plan }))];
  fs.writeFileSync(path.join(game, 'puzzle-contracts.ts'), `// Optimal setup/chain proofs. Regeneration must preserve these quality targets.\n// All 101 are written by scripts/build-densha-pack.mjs: levels 1 to 6 from levels.ts, 7 to 101 generated.\nexport const PUZZLE_CONTRACTS = [\n${contracts.map((c) => '  ' + JSON.stringify(c)).join(',\n')}\n];\n`);
  log(`done in ${Math.round((Date.now() - t0) / 1000)} s; ${items.length} pack levels, difficulty ${ordered[0].difficulty.toFixed(1)} to ${ordered[ordered.length - 1].difficulty.toFixed(1)}`);
}
