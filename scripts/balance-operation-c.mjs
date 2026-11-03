// Actual-rule balance scenarios. Never modify source rules or worker durability here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url), ts = require('typescript');
const tune = JSON.parse(fs.readFileSync(path.join(root, 'prototypes/operation-c/tune.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'prototypes/operation-c/src/sim.ts'), 'utf8').replace("import tuneJson from '../tune.json';", 'const tuneJson=' + JSON.stringify(tune) + ';');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { OperationSim, distance } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const by = (s, id) => s.hexes.find(h => h.id === id);
function play(a, b, seconds = 300) {
    const t = structuredClone(tune);
    const s = new OperationSim({ tune: t, bot: false, loadouts: [['infantry', 'scout', 'tank', 'artillery', 'bunker', 'gunner', 'flak'], ['infantry', 'scout', 'tank', 'artillery', 'bunker', 'gunner', 'flak']] });
    const pol = [a, b], logs = [[], []], deaths = [0, 0], firstLoss = [null, null], samples = [];
    let prevWorkers = new Map();
    function build(p, k) { const own = s.buildings.filter(x => x.owner === p), home = by(s, own.find(x => x.kind === 'hq').hexId), enemy = by(s, s.buildings.find(x => x.owner !== p && x.kind === 'hq').hexId); const sites = s.hexes.filter(h => s.placement(p, h.id, k).ok); sites.sort((x, y) => { const score = h => k === 'hq' ? distance(h, home) * 2 - distance(h, enemy) * .15 : k === 'bunker' ? distance(h, enemy) : distance(h, home) + distance(h, enemy) * .1; return score(x) - score(y); }); if (sites[0] && s.place(p, sites[0].id, k).ok) {
        logs[p].push({ t: s.timeMs / 1000, kind: k, hex: sites[0].id });
        return true;
    } return false; }
    function decide(p) {
        if (!s.players[p].alive)
            return;
        const own = s.buildings.filter(x => x.owner === p), count = k => own.filter(x => x.kind === k).length, army = s.units.filter(u => u.owner === p && u.kind !== 'worker'), policy = pol[p];
        if (policy === 'econ' || policy === 'greedy') {
            if (count('hq') < (policy === 'greedy' ? 3 : 2)) {
                build(p, 'hq');
                return;
            }
            const seq = ['infantry', 'tank', 'artillery', 'scout'];
            build(p, seq[(own.length - count('hq')) % seq.length]);
        }
        else if (policy === 'recon') {
            build(p, 'scout');
        }
        else if (policy === 'infantry') {
            build(p, 'infantry');
        }
        else if (policy === 'guard') {
            if (count('bunker') < 1) {
                if (build(p, 'bunker'))
                    return;
            }
            else if (count('tank') < 1) {
                if (build(p, 'tank'))
                    return;
            }
            else if (count('hq') < 2 && build(p, 'hq'))
                return;
            const seq = ['infantry', 'tank', 'artillery'];
            build(p, seq[(own.length - count('hq') - 1) % seq.length]);
        }
        else if (policy === 'escort') {
            if (!count('gunner')) {
                build(p, 'gunner');
                return;
            }
            if (count('hq') < 2) {
                build(p, 'hq');
                return;
            }
            const seq = ['gunner', 'tank', 'artillery'];
            build(p, seq[(own.length - count('hq')) % seq.length]);
        }
        else {
            const seq = ['infantry', 'tank', 'artillery'];
            build(p, seq[(own.length - count('hq')) % seq.length]);
        }
        const attackAt = policy === 'recon' ? 5 : policy === 'infantry' ? 20 : (policy === 'econ' || policy === 'greedy') ? 100 : 65;
        if (s.timeMs >= attackAt * 1000 && army.length)
            s.setTarget(p, 1 - p);
    }
    for (let i = 0; i < seconds * 10 && s.winner === null; i++) {
        if (i % 10 === 0) {
            decide(i % 20 === 0 ? 0 : 1);
            decide(i % 20 === 0 ? 1 : 0);
        }
        s.tick(100);
        const current = new Map(s.units.filter(u => u.kind === 'worker').map(u => [u.id, u.owner]));
        for (const [id, p] of prevWorkers)
            if (!current.has(id) && s.players[p].alive) {
                deaths[p]++;
                firstLoss[p] ??= s.timeMs / 1000;
            }
        prevWorkers = current;
        if (i % 300 === 299 || s.winner !== null)
            samples.push({ t: s.timeMs / 1000, p: s.players.map(p => ({ land: s.resources(p.id).capacity, free: s.resources(p.id).capacity - s.resources(p.id).committed, workers: s.units.filter(u => u.owner === p.id && u.kind === 'worker').length, hqs: s.buildings.filter(x => x.owner === p.id && x.kind === 'hq').length, army: s.units.filter(u => u.owner === p.id && u.kind !== 'worker').length, hp: s.buildings.filter(x => x.owner === p.id && x.kind === 'hq').reduce((n, x) => n + x.hp, 0) })) });
    }
    return { pol, winner: s.winner, time: s.timeMs / 1000, deaths, firstLoss, samples, builds: logs };
}
const out = path.resolve(process.argv[2] ?? 'outputs/operation-c-balance'), seconds = Number(process.argv[3] ?? 300);
fs.mkdirSync(out, { recursive: true });
const results = [];
for (const pair of [['econ', 'mixed'], ['recon', 'guard'], ['econ', 'recon']])
    for (const reverse of [false, true]) {
        const policies = reverse ? [...pair].reverse() : pair, result = play(...policies, seconds);
        results.push(result);
        console.log(JSON.stringify({ policies, winner: result.winner === null ? 'unfinished' : policies[result.winner], time: result.time, deaths: result.deaths, at60: result.samples.find(s => s.t >= 60)?.p, final: result.samples.at(-1)?.p }));
    }
fs.writeFileSync(path.join(out, 'actual-rules.json'), JSON.stringify({ tune, results }, null, 2));
