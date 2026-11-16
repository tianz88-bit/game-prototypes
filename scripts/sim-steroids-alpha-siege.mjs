// Headless siege simulation for Steroids-Alpha (siege v0, owner 16 November 2026): bots attack and
// defend the Warzone base with the real shared sim, so siege numbers can be tuned without players.
// Attackers respawn at once at the gate; defenders after siege.defenderRespawnSeconds at a pad.
// Run: node scripts/sim-steroids-alpha-siege.mjs [rounds=40] [attackers=2] [defenders=2] [key=value ...]
//   key=value overrides tune.siege values, e.g. shieldHp=1500 treasuryHp=2000
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sim = path.join(root, 'prototypes/steroids-alpha/sim');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'steroids-siege-'));
const entry = `export * from ${JSON.stringify(path.join(sim, 'world.ts'))};
export * from ${JSON.stringify(path.join(sim, 'bots.ts'))};`;
await build({ stdin: { contents: entry, resolveDir: sim, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: path.join(tmp, 'sim.mjs'), logLevel: 'silent' });
const S = await import(pathToFileURL(path.join(tmp, 'sim.mjs')).href);
rmSync(tmp, { recursive: true, force: true });

const args = process.argv.slice(2);
const nums = args.filter((a) => !a.includes('='));
const rounds = Number(nums[0] ?? 40);
const attackers = Number(nums[1] ?? 2);
const defenders = Number(nums[2] ?? 2);
const tune = JSON.parse(readFileSync(path.join(root, 'prototypes/steroids-alpha/tune.json'), 'utf8'));
// attPower=N / defPower=N: starting power (hull) for that side, as if farmed before the siege;
// bots spend it on upgrades through their normal shop logic.
const power = { attPower: 0, defPower: 0 };
for (const a of args.filter((x) => x.includes('='))) {
  // key=value sets tune.siege[key]; group.key=value sets any other tune value (diagnostics).
  const [k, v] = a.split('=');
  if (k === 'attPower' || k === 'defPower') { power[k] = Number(v); continue; }
  const [group, key] = k.includes('.') ? k.split('.') : ['siege', k];
  if (!tune[group] || !(key in tune[group])) throw new Error(`unknown tune key ${k}`);
  tune[group][key] = Number(v);
}

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const hz = tune.net.tickHz;
const results = [];
for (let round = 0; round < rounds; round++) {
  const r = rng(1000 + round * 7919);
  const w = new S.World(tune, r);
  w.setPlanet('warzone');
  const L = w.layout;
  const defClan = L.clan, attClan = w.attackerClan;
  const brains = new Map();
  const respawnAt = new Map();
  const side = new Map();
  const firstLife = new Set();
  const spawn = (id) => {
    const def = side.get(id) === defClan;
    const at = def ? L.pads[id % L.pads.length] : L.gate;
    const ship = w.addShipNear(id, at.x, at.y, def ? 0 : 120);
    // Farmed power applies to the first life only: a destroyed pilot respawns fresh.
    const start = firstLife.has(id) ? 0 : def ? power.defPower : power.attPower;
    firstLife.add(id);
    if (start > ship.hullMax) { ship.hullMax = ship.hp = start; }
    w.clanOf.set(id, side.get(id));
    w.botIds.add(id);
    const b = S.newBrain(r);
    b.bornAt = w.tick;
    brains.set(id, b);
  };
  let id = 1;
  for (let i = 0; i < defenders; i++) { side.set(id, defClan); spawn(id++); }
  for (let i = 0; i < attackers; i++) { side.set(id, attClan); spawn(id++); }
  w.startWar();
  w.drain();
  const sg = w.siege;
  const firsts = { turrets: null, shield: null };
  let kills = { att: 0, def: 0 };
  const cap = (tune.siege.roundSeconds + 5) * hz;
  for (let k = 0; k < cap && sg.phase === 'war'; k++) {
    for (const [sid, at] of respawnAt) if (w.tick >= at) { respawnAt.delete(sid); spawn(sid); }
    const all = [...brains.values()];
    for (const [sid, s] of w.ships) {
      const { input, buy } = S.botThink(sid, s, w, brains.get(sid), tune, r, all);
      if (buy) w.buy(sid, buy.item, buy.tier);
      w.stepShip(sid, input);
    }
    w.step();
    const ev = w.drain();
    for (const d of ev.deaths) {
      const def = side.get(d.id) === defClan;
      if (def) kills.att++; else kills.def++;
      w.removeShip(d.id);
      brains.delete(d.id);
      respawnAt.set(d.id, w.tick + (def ? Math.round(tune.siege.defenderRespawnSeconds * hz) : 1));
    }
    if (firsts.turrets === null && sg.turretHp.every((v) => v <= 0)) firsts.turrets = w.tick / hz;
    if (firsts.shield === null && sg.shieldBroken) firsts.shield = w.tick / hz;
  }
  results.push({ winner: sg.winner === attClan ? 'attackers' : 'defenders', reason: sg.reason || 'cap', secs: w.tick / hz, turretsLeft: sg.turretHp.filter((v) => v > 0).length, shield: Math.round(sg.shield), treasury: Math.round(sg.treasury), tickets: sg.tickets, firsts, kills });
}

const pct = (n) => `${Math.round((100 * n) / results.length)}%`;
const avg = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(0) : '-');
const by = (f) => results.filter(f);
const attWins = by((x) => x.winner === 'attackers');
console.log(`Siege sim: ${rounds} rounds, ${attackers} attacker bots vs ${defenders} defender bots, start power att ${power.attPower || 'fresh'} / def ${power.defPower || 'fresh'}, siege ${JSON.stringify(tune.siege)}`);
console.log(`Attackers win ${pct(attWins.length)} (treasury destroyed). Defenders win ${pct(by((x) => x.reason === 'tickets').length)} on tickets, ${pct(by((x) => x.reason === 'time').length)} on time.`);
console.log(`Round length avg ${avg(results.map((x) => x.secs))} s (attacker wins avg ${avg(attWins.map((x) => x.secs))} s).`);
console.log(`All turrets down: ${pct(by((x) => x.firsts.turrets !== null).length)} of rounds, avg at ${avg(results.filter((x) => x.firsts.turrets !== null).map((x) => x.firsts.turrets))} s. Shield broken: ${pct(by((x) => x.firsts.shield !== null).length)}, avg at ${avg(results.filter((x) => x.firsts.shield !== null).map((x) => x.firsts.shield))} s.`);
console.log(`At the end: turrets left avg ${avg(results.map((x) => x.turretsLeft))}, treasury avg ${avg(results.map((x) => x.treasury))}, tickets left avg ${avg(results.map((x) => x.tickets))}. Kills per round: attackers ${avg(results.map((x) => x.kills.att))}, defenders + turrets ${avg(results.map((x) => x.kills.def))}.`);
