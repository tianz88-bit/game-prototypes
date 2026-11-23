// Cascade level designer (owner, 23 November 2026): makes levels whose shortest solution contains a setup chain,
// one move that moves 3+ trains and clears none, before the payoff. Two modes:
//   A  stoppers are trains (strict: no single moves)
//   B  trains may also park against props and back out with a reverse swipe (up to 2 such moves)
// Pipeline per attempt: random dense board that already contains a raw cascade -> seekSetupChain (push the
// cascade into the shortest solution) -> polish (all quality rules, cascade kept) -> tighten (final check).
// Results accumulate in .cache/densha-cascade-levels.json. Usage: node scripts/build-densha-cascade-levels.mjs [minutes=60] [workers=4]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!isMainThread) {
  const R = await import(workerData.module);
  const mode = workerData.mode;
  // Cascade levels relax three thresholds: the cascade itself is the reason to reposition.
  const tight = { ...R.TIGHT_RULES, minSetupChains: 1, allowReverseSingles: mode === 'B' ? 2 : 0, minSingleExit: 0.2, minTraps: 3, minDensity: 0.33 };
  let seed = workerData.seed;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (n) => Math.floor(rnd() * n);
  const until = Date.now() + workerData.minutes * 60000;
  let attempt = 0;
  while (Date.now() < until) {
    const W = 7, H = rnd() < 0.5 ? 7 : 6, T = 10 + pick(2);
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const axis = {}, head = {};
    for (let o = 0; o < 5; o++) g[pick(H)][pick(W)] = '#';
    let placed = 0;
    for (let k = 0; k < 60 && placed < T; k++) {
      const L = String.fromCharCode(65 + placed), ax = rnd() < 0.5 ? 'h' : 'v', len = 1 + pick(3);
      const line = pick(ax === 'h' ? H : W), st = pick((ax === 'h' ? W : H) - len + 1);
      const cells = Array.from({ length: len }, (_, i) => (ax === 'h' ? [line, st + i] : [st + i, line]));
      if (cells.some(([y, x]) => g[y][x] !== '.')) continue;
      cells.forEach(([y, x]) => { g[y][x] = L; });
      axis[L] = ax; head[L] = rnd() < 0.5 ? -1 : 1; placed++;
    }
    const rows = g.map((r) => r.join(''));
    let level;
    try { level = R.parseLevel('c', rows, axis, head); } catch { continue; }
    const s0 = R.initialState(level);
    if (!R.legalMoves(level, s0).some((m) => { const r = R.applyTap(level, s0, m); return r.exited === 0 && r.links >= 3; })) continue;
    attempt++;
    const k = R.seekSetupChain({ rows, axis, head }, seed, 400);
    if (!k) continue;
    const p = R.polish(k, seed + 1, 4, 900, undefined, tight);
    if (!p) { parentPort.postMessage({ mode, attempt, stage: 'polish' }); continue; }
    const r = R.tighten(p, attempt, undefined, tight);
    if ('reject' in r) { parentPort.postMessage({ mode, attempt, stage: r.reject }); continue; }
    parentPort.postMessage({ mode, attempt, stage: 'pass', level: r });
  }
} else {
  const minutes = Number(process.argv[2] ?? 60), workers = Number(process.argv[3] ?? 4);
  const b = await build({
    stdin: { contents: "export {parseLevel} from './levels';export {applyTap,initialState,legalMoves} from './rules';export {seekSetupChain,polish,tighten,TIGHT_RULES} from './quality';", resolveDir: path.join(root, 'prototypes/densha-domino/src/game'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error',
  });
  const module = 'data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64');
  const cache = path.join(root, '.cache/densha-cascade-levels.json');
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  const found = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : [];
  const stages = {};
  console.log(`running ${minutes} min on ${workers} workers; ${found.length} cascade levels already saved`);
  await Promise.all(Array.from({ length: workers }, (_, w) => new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { module, minutes, mode: w % 2 ? 'B' : 'A', seed: 4242 + w * 7919 + Date.now() % 100000 } });
    worker.on('message', (m) => {
      stages[m.mode + ':' + m.stage] = (stages[m.mode + ':' + m.stage] || 0) + 1;
      if (m.stage === 'pass') {
        found.push({ mode: m.mode, ...m.level });
        fs.writeFileSync(cache, JSON.stringify(found));
        console.log(`PASS mode ${m.mode}: par ${m.level.par} setup chain moves ${m.level.maxSetupLinks} trains, traps ${m.level.traps}, finale ${m.level.finale}, reverse singles ${m.level.reverseSingles}`);
      }
    });
    worker.on('error', reject);
    worker.on('exit', resolve);
  })));
  console.log(`done: ${found.length} cascade levels saved; stages ${JSON.stringify(stages)}`);
}
