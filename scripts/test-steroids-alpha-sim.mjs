// Rules test for Steroids-Alpha's shared simulation (prototypes/steroids-alpha/sim): throttle,
// guns, splitting asteroids, contact damage, deaths, population and the wire format.
// Run: node scripts/test-steroids-alpha-sim.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sim = path.join(root, 'prototypes/steroids-alpha/sim');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'steroids-sim-'));
const entry = `export * from ${JSON.stringify(path.join(sim, 'world.ts'))};
export * from ${JSON.stringify(path.join(sim, 'ship.ts'))};
export * from ${JSON.stringify(path.join(sim, 'asteroids.ts'))};
export * from ${JSON.stringify(path.join(sim, 'protocol.ts'))};`;
await build({ stdin: { contents: entry, resolveDir: sim, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: path.join(tmp, 'sim.mjs'), logLevel: 'silent' });
const S = await import(pathToFileURL(path.join(tmp, 'sim.mjs')).href);
rmSync(tmp, { recursive: true, force: true });
const tune = JSON.parse(readFileSync(path.join(root, 'prototypes/steroids-alpha/tune.json'), 'utf8'));
const dt = 1 / tune.net.tickHz;

function rng(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const idle = { seq: 0, turn: 0, aim: NaN, thrust: 0, dash: false, fire: false };
const near = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// --- Throttle: accelerate to the maximum, brake to the minimum, never stop. ---
{
  const s = S.newShip(100, 100, 0, tune.ship.cruiseSpeed);
  for (let i = 0; i < 90; i++) S.stepShip(s, { ...idle, thrust: 1 }, dt, tune);
  assert.equal(s.speed, tune.ship.maxSpeed, 'accelerates to max speed');
  for (let i = 0; i < 90; i++) S.stepShip(s, { ...idle, thrust: -1 }, dt, tune);
  assert.equal(s.speed, tune.ship.minSpeed, 'brakes to min speed, not to a stop');
  const x0 = s.x;
  for (let i = 0; i < 30; i++) S.stepShip(s, idle, dt, tune);
  near(s.x - x0, tune.ship.minSpeed, 1e-6, 'holds speed with no thrust, moving where the nose points');
}

// --- Guns: fire rate in whole steps, alternating sides. ---
{
  const s = S.newShip(100, 100, 0, tune.ship.cruiseSpeed);
  const sides = [];
  for (let i = 0; i < tune.weapon.fireIntervalSteps * 4; i++) {
    const before = s.shots;
    S.stepShip(s, { ...idle, fire: true }, dt, tune);
    if (s.shots !== before) sides.push(S.muzzleShot(s, tune).side);
  }
  assert.deepEqual(sides, [1, -1, 1, -1], 'one shot per fire interval, alternating guns');
}

// A world with no random asteroids, for controlled cases.
function emptyWorld(seed = 7) {
  const w = new S.World({ ...tune, asteroid: { ...tune.asteroid, targetMass: 0 } }, rng(seed));
  w.drain();
  return w;
}
function rock(w, size, x, y, vx = 0, vy = 0, hp = tune.asteroid.hp[size]) {
  const a = { id: 500 + w.asteroids.size, size, x, y, vx, vy, t0: w.tick, hp };
  w.asteroids.set(a.id, a);
  return a;
}
function placeShip(w, id, x, y, heading) {
  const s = w.addShip(id);
  Object.assign(s, { x, y, heading });
  // Skip the drop-in immunity.
  for (let i = 0; i < 2 * tune.net.tickHz + 1; i++) w.step();
  w.drain();
  return s;
}

// --- Shooting a large asteroid: hp drops, then it splits into two mediums. ---
function shootDown(damage, parentV = { vx: 0, vy: 0 }) {
  const t = { ...tune, asteroid: { ...tune.asteroid, targetMass: 0, splitJitter: 0 }, weapon: { ...tune.weapon, damage }, ship: { ...tune.ship, minSpeed: 0 } };
  const w = new S.World(t, rng(3));
  w.drain();
  const s = placeShip(w, 1, 1000, 1000, 0);
  s.speed = 0; // hold still so only bullets reach the rock
  const a = rock(w, 0, 1300, 1000, parentV.vx, parentV.vy, 60);
  const seen = { upserts: [], gone: [] };
  for (let i = 0; i < 300 && w.asteroids.has(a.id); i++) {
    w.stepShip(1, { ...idle, fire: true, thrust: -1 });
    w.step();
    const e = w.drain();
    seen.upserts.push(...e.asteroids);
    seen.gone.push(...e.gone);
  }
  assert(!w.asteroids.has(a.id), 'asteroid destroyed by bullets');
  assert.equal(seen.gone.length, 1);
  const kids = [...w.asteroids.values()];
  assert.equal(kids.length, 2, 'splits into two');
  assert(kids.every((k) => k.size === 1 && k.hp === tune.asteroid.hp[1]), 'pieces are one size smaller with full hp');
  return { kids, seen, s };
}
{
  const { kids, seen } = shootDown(10);
  assert(seen.upserts.some((u) => u.size === 0 && u.hp < 60 && u.hp > 0), 'hp changes are reported before the kill');
  // Shot along +x: both pieces are pushed along +x and fly apart in y.
  const push = tune.asteroid.splitPushPerDamage * 10;
  const spread = tune.asteroid.splitSpreadBase + tune.asteroid.splitSpreadPerDamage * 10;
  // The guns converge, so the killing bullet arrives a few degrees off +x; allow for that tilt.
  const tilt = Math.atan2(tune.weapon.muzzleSide, tune.weapon.convergeDistance);
  const mean = { vx: (kids[0].vx + kids[1].vx) / 2, vy: (kids[0].vy + kids[1].vy) / 2 };
  near(Math.hypot(mean.vx, mean.vy), push, 1e-6, 'pushed along the shot in proportion to damage');
  near(Math.abs(Math.atan2(mean.vy, mean.vx)), tilt, 1e-6, 'push follows the direction of the killing shot');
  near(Math.hypot(kids[0].vx - mean.vx, kids[0].vy - mean.vy), spread, 1e-6, 'sideways spread');
  near(Math.hypot(kids[1].vx - mean.vx, kids[1].vy - mean.vy), spread, 1e-6, 'pieces fly apart symmetrically');

  // A harder killing hit throws the pieces faster and wider.
  const hard = shootDown(30).kids;
  const hardMean = { vx: (hard[0].vx + hard[1].vx) / 2, vy: (hard[0].vy + hard[1].vy) / 2 };
  near(Math.hypot(hardMean.vx, hardMean.vy), push * 3, 1e-6, 'harder hit: faster along the shot');
  assert(Math.hypot(hard[0].vx - hardMean.vx, hard[0].vy - hardMean.vy) > spread * 1.5, 'harder hit: wider spread');

  // Pieces keep the parent's motion.
  const moving = shootDown(10, { vx: 0, vy: 40 }).kids;
  near((moving[0].vy + moving[1].vy) / 2 - mean.vy, 40, 12, 'pieces inherit the parent velocity');
}

// --- The smallest size just breaks. ---
{
  const w = emptyWorld();
  const a = rock(w, 2, 500, 500);
  const kids = S.splitAsteroid(a, { x: 500, y: 500 }, 1, 0, 10, 0, () => 99, rng(), tune);
  assert.equal(kids.length, 0);
}

// --- Asteroids travel straight and wrap around the planet. ---
{
  const a = { id: 1, size: 0, x: tune.world.width - 10, y: 50, vx: 60, vy: 0, t0: 0, hp: 1 };
  const p = S.asteroidPos(a, tune.net.tickHz, tune); // one second later
  near(p.x, 50, 1e-9, 'wraps past the edge');
  near(S.asteroidPos(a, tune.net.tickHz / 10, tune).x, tune.world.width - 10 + 6, 1e-9, 'straight line');
}

// --- Flying into an asteroid: the ship is hurt and the asteroid is rammed apart. ---
{
  const w = emptyWorld();
  const s = placeShip(w, 1, 1000, 1000, 0);
  const a = rock(w, 0, 1000 + tune.asteroid.radius[0] + tune.ship.radius + 40, 1000);
  for (let i = 0; i < 60 && s.hp === tune.ship.maxHp; i++) {
    w.stepShip(1, idle);
    w.step();
  }
  assert.equal(s.hp, tune.ship.maxHp - tune.asteroid.contactDamage[0], 'contact damage applied once');
  assert.equal(w.asteroids.get(a.id).hp, tune.asteroid.hp[0] - tune.asteroid.ramDamage, 'asteroid takes ram damage');
}

// --- A ship at 0 hp is reported destroyed; bullets hurt other ships but not their owner. ---
{
  const w = emptyWorld();
  const a = placeShip(w, 1, 1000, 1000, 0);
  const b = placeShip(w, 2, 1200, 1000, Math.PI / 2);
  a.speed = b.speed = tune.ship.minSpeed;
  let deaths = [];
  for (let i = 0; i < 600 && !deaths.length; i++) {
    a.x = 1000; a.y = 1000; a.heading = 0; // hold the shooter in place, aimed at b
    b.x = 1200; b.y = 1000;
    w.stepShip(1, { ...idle, fire: true });
    w.step();
    deaths = w.drain().deaths;
  }
  assert.deepEqual(deaths, [2], 'the target is destroyed, the shooter is not');
  assert.equal(a.hp, tune.ship.maxHp);
}

// --- Population: stocked to the target mass, never on top of a ship or the drop zone. ---
{
  const w = new S.World(tune, rng(11));
  const mass = [...w.asteroids.values()].reduce((m, a) => m + S.asteroidMass(a.size), 0);
  assert.equal(mass, tune.asteroid.targetMass, 'initial population');
  for (const a of w.asteroids.values()) {
    const d = Math.hypot(a.x - tune.world.width / 2, a.y - tune.world.height / 2);
    assert(d >= tune.asteroid.spawnClearRadius, 'drop zone kept clear');
  }
}

// --- Wire format round trips. ---
{
  const input = { seq: 77, turn: -0.5, aim: NaN, thrust: 1, dash: true, fire: true };
  const back = S.decodeClient(S.encodeInput(input)).input;
  assert.deepEqual({ ...back, aim: 0 }, { ...input, aim: 0 });
  assert(Number.isNaN(back.aim));
  const ship = { id: 9, x: 12.5, y: 300.25, heading: 1.5, speed: 260, dashTime: 0, dashCd: 0.5, hp: 70, fireCd: 3, shots: 41 };
  assert.deepEqual(S.decodeServer(S.encodeSnapshot(1234, 55, [ship])), { type: S.MSG.SNAPSHOT, tick: 1234, ackSeq: 55, ships: [ship] });
  const rockRec = { id: 3, size: 1, x: 10.5, y: 20.25, vx: -30, vy: 12.5, t0: 900, hp: 30 };
  assert.deepEqual(S.decodeServer(S.encodeAsteroids([rockRec])).asteroids, [rockRec]);
  assert.deepEqual(S.decodeServer(S.encodeGone([{ id: 3, x: 1.5, y: 2.5 }])).gone, [{ id: 3, x: 1.5, y: 2.5 }]);
  const shot = { owner: 4, x: 5.5, y: 6.5, vx: 900, vy: -12.5, side: -1 };
  assert.deepEqual(S.decodeServer(S.encodeShots(88, [shot])), { type: S.MSG.SHOTS, tick: 88, shots: [shot] });
}

console.log('Steroids-Alpha sim rules: throttle, guns, asteroid splits, contact, deaths, population and wire format all pass.');
