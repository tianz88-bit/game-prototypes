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
export * from ${JSON.stringify(path.join(sim, 'turrets.ts'))};
export * from ${JSON.stringify(path.join(sim, 'asteroids.ts'))};
export * from ${JSON.stringify(path.join(sim, 'protocol.ts'))};
export * as thrusters from ${JSON.stringify(path.join(root, 'prototypes/steroids-alpha/src/render/thrusters.ts'))};
export * as liveConfig from ${JSON.stringify(path.join(sim, 'liveConfig.ts'))};
export * as planet from ${JSON.stringify(path.join(root, 'prototypes/steroids-alpha/src/render/planet.ts'))};`;
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

// --- Flying into an asteroid: the ship is hurt and bounced back; the asteroid is smashed and its
// pieces fly on the other way. ---
{
  const w = emptyWorld();
  const s = placeShip(w, 1, 1000, 1000, 0);
  const a = rock(w, 0, 1000 + tune.asteroid.radius[0] + tune.ship.radius + 40, 1000);
  let ev = { gone: [], asteroids: [] };
  for (let i = 0; i < 60 && w.asteroids.has(a.id); i++) {
    w.stepShip(1, idle);
    w.step();
    ev = w.drain();
  }
  assert(!w.asteroids.has(a.id), 'ramming destroys the asteroid outright');
  assert.equal(ev.gone.length, 1);
  const kids = ev.asteroids.filter((k) => k.size === 1);
  assert.equal(kids.length, 2, 'and it splits');
  assert(kids.every((k) => k.vx > 0), 'the pieces are pushed away from the ship (+x)');
  assert(s.kx < 0 && Math.abs(s.ky) < 1e-9, 'the ship is pushed back the other way (-x)');
  near(s.kx, -tune.ship.knockbackSpeed, 1e-9, 'knockback speed');
  // Contact damage goes to the shield first.
  assert.equal(s.shield, tune.ship.maxShield - tune.asteroid.contactDamage[0], 'shield takes the contact damage');
  assert.equal(s.hp, tune.ship.maxHp, 'hull untouched while the shield holds');
  // The knockback fades and the ship flies on.
  for (let i = 0; i < tune.net.tickHz * 2; i++) w.stepShip(1, idle);
  assert.equal(s.kx, 0, 'knockback decays to nothing');
}

// --- Shield: absorbs first, overflow reaches the hull, regenerates after a quiet spell. ---
{
  const w = emptyWorld();
  const a = placeShip(w, 1, 1000, 1000, 0);
  const b = placeShip(w, 2, 1200, 1000, Math.PI / 2);
  a.speed = b.speed = tune.ship.minSpeed;
  // Shoot b until the shield is gone and the hull has taken some.
  const hits = [];
  for (let i = 0; i < 600 && b.hp === tune.ship.maxHp; i++) {
    a.x = 1000; a.y = 1000; a.heading = 0;
    b.x = 1200; b.y = 1000;
    w.stepShip(1, { ...idle, fire: true });
    w.step();
    hits.push(...w.drain().hits);
  }
  // Every hit is reported with where it landed; the shield effect shows only while the shield holds.
  assert(hits.length > 1 && hits.every((h) => h.id === 2));
  assert(hits.slice(0, -1).every((h) => h.shielded), 'hits while the shield holds are shielded');
  // The breaking hit is shielded only if some shield was left to soak part of it.
  assert.equal(hits[hits.length - 1].shielded, tune.ship.maxShield % tune.weapon.damage !== 0, 'the hit that reaches the hull');
  near(tune.ship.maxHp - b.hp, hits.length * tune.weapon.damage - tune.ship.maxShield, 1e-9, 'overflow goes to the hull');
  assert(hits.every((h) => h.x < 1200 && Math.abs(h.y - 1000) < 40), 'impacts land on the side facing the shooter');
  assert.equal(b.shield, 0, 'shield emptied before the hull is touched');
  assert(b.hp < tune.ship.maxHp && b.hp > 0);
  const hpAfter = b.hp;
  // Move b away so no more bullets land. No regeneration before the delay...
  b.x = 3000; b.y = 3000;
  const quiet = Math.round(tune.ship.shieldRegenDelaySeconds * tune.net.tickHz);
  for (let i = 0; i < quiet - 2; i++) w.step();
  assert.equal(b.shield, 0, 'no regeneration within 5 s of the last hit');
  // ...then 5% of the shield pool per second.
  for (let i = 0; i < 2 + tune.net.tickHz; i++) w.step();
  near(b.shield, tune.ship.maxShield * tune.ship.shieldRegenPerSecond, tune.ship.maxShield * 0.01, 'about 5% per second after the delay');
  assert.equal(b.hp, hpAfter, 'the hull does not regenerate');
}

// --- A ship at 0 hull is destroyed; the killing shot's owner is credited; bullets spare their owner. ---
{
  const w = emptyWorld();
  const a = placeShip(w, 1, 1000, 1000, 0);
  const b = placeShip(w, 2, 1200, 1000, Math.PI / 2);
  a.speed = b.speed = tune.ship.minSpeed;
  let deaths = [];
  for (let i = 0; i < 900 && !deaths.length; i++) {
    a.x = 1000; a.y = 1000; a.heading = 0; // hold the shooter in place, aimed at b
    b.x = 1200; b.y = 1000;
    w.stepShip(1, { ...idle, fire: true });
    w.step();
    deaths = w.drain().deaths;
  }
  assert.equal(deaths.length, 1);
  assert.equal(deaths[0].id, 2, 'the target is destroyed');
  assert.equal(deaths[0].killer, 1, 'and the shooter gets the kill');
  assert(Math.abs(deaths[0].x - 1200) < 1e-6, 'death is reported where it happened');
  assert.equal(a.hp, tune.ship.maxHp);
}

// --- Pickups: destroyed asteroids drop minerals (by size) and sometimes a health boost. ---
{
  const t = { ...tune, asteroid: { ...tune.asteroid, targetMass: 0, healthDropChance: 1 } };
  const w = new S.World(t, rng(5));
  w.drain();
  const s = placeShip(w, 1, 1000, 1000, 0);
  s.speed = 0;
  w.tune.ship.minSpeed = 0;
  const r = rock(w, 2, 1300, 1000, 0, 0, 2);
  let pickups = [];
  for (let i = 0; i < 120 && w.asteroids.has(r.id); i++) {
    w.stepShip(1, { ...idle, fire: true, thrust: -1 });
    w.step();
    pickups.push(...w.drain().pickups);
  }
  const heals = pickups.filter((k) => k.kind === 'heal');
  const minerals = pickups.filter((k) => k.kind === 'mineral');
  assert.equal(heals.length, 1, 'a destroyed asteroid dropped a health boost');
  near(minerals.reduce((m, k) => m + k.value, 0), tune.asteroid.mineralYield[2], 0.2, 'and its size of minerals');
  // A health boost heals 25% of the starting hull.
  s.hp = 10;
  s.x = heals[0].x; s.y = heals[0].y;
  for (const k of minerals) w.pickups.delete(k.id);
  w.step();
  const ev = w.drain();
  near(s.hp, 10 + tune.ship.maxHp * tune.asteroid.healthHealFraction, 1e-9, 'heals 25% of the starting hull');
  assert.deepEqual(ev.pickupsGone, [{ id: heals[0].id, by: 1 }]);
  // Unclaimed pickups expire.
  const w2 = new S.World(t, rng(6));
  w2.drain();
  w2.pickups.set(10, { id: 10, x: 3500, y: 3500, kind: 'heal', value: 0, from: 0, lockedUntil: 0, expires: w2.tick + 3 });
  for (let i = 0; i < 4; i++) w2.step();
  assert(!w2.pickups.has(10), 'expires when nobody takes it');
}

// --- Power: minerals are hull; each also raises the shield maximum; capped. ---
{
  const sh = tune.ship;
  const w = emptyWorld();
  const s = placeShip(w, 1, 1000, 1000, 0);
  w.pickups.set(1, { id: 1, x: s.x, y: s.y, kind: 'mineral', value: 40, from: 0, lockedUntil: 0, expires: w.tick + 100 });
  w.step();
  assert.equal(s.hp, sh.maxHp + 40, 'minerals add hull');
  assert.equal(S.maxShield(s.hp, tune), sh.maxShield + 40, 'and raise the shield maximum');
  assert.equal(s.shield, sh.maxShield + 40, 'and fill that much shield');
  w.pickups.set(2, { id: 2, x: s.x, y: s.y, kind: 'mineral', value: 100000, from: 0, lockedUntil: 0, expires: w.tick + 100 });
  w.step();
  assert.equal(s.hp, sh.powerCap, 'hull stops at the power cap');
  assert.equal(S.maxShield(s.hp, tune), sh.maxShield + sh.powerCap - sh.maxHp);
  // Scaling: nothing at the start, full effect at the cap, square-root growth in between.
  assert.equal(S.powerLevel(sh.maxHp, tune), 0);
  assert.equal(S.powerLevel(sh.powerCap, tune), 1);
  near(S.powerLevel(sh.maxHp + (sh.powerCap - sh.maxHp) / 4, tune), 0.5, 1e-9, 'diminishing returns');
  near(S.topSpeed(sh.powerCap, tune), sh.maxSpeed * (1 - sh.speedPenaltyAtCap), 1e-9, 'capped ship is slower');
  near(S.shipRadius(sh.powerCap, tune), sh.radius * (1 + sh.radiusBonusAtCap), 1e-9, 'and bigger');
  near(S.damageScale(sh.powerCap, tune), 1 + sh.damageBonusAtCap, 1e-9, 'and hits harder');
  // A capped ship cannot reach the old top speed.
  const fast = S.newShip(0, 0, 0, sh.maxSpeed);
  fast.hp = sh.powerCap;
  // Over the cap it slows at the braking rate (no snap), then holds the cap.
  S.stepShip(fast, { ...idle, thrust: 1 }, 1 / tune.net.tickHz, tune);
  near(fast.speed, sh.maxSpeed - sh.braking / tune.net.tickHz, 1e-9, 'excess speed bleeds off at the braking rate');
  for (let i = 0; i < tune.net.tickHz; i++) S.stepShip(fast, { ...idle, thrust: 1 }, 1 / tune.net.tickHz, tune);
  near(fast.speed, S.topSpeed(sh.powerCap, tune), 1e-9, 'speed capped by power');
  // Regen is a share of the (bigger) maximum: one quiet second refills shieldRegenPerSecond of it.
  s.shield = 0;
  for (let i = 0; i < tune.net.tickHz; i++) w.step();
  near(s.shield, S.maxShield(s.hp, tune) * sh.shieldRegenPerSecond, S.maxShield(s.hp, tune) * 0.05, 'regen is a % of max shield');
}

// --- Spills: hull damage spills minerals the victim cannot take straight back; death spills a share of all. ---
{
  const sh = tune.ship;
  const w = emptyWorld();
  const a = placeShip(w, 1, 1000, 1000, 0);
  const b = placeShip(w, 2, 1200, 1000, Math.PI / 2);
  a.speed = b.speed = sh.minSpeed;
  b.shield = 0;
  b.hp = 200;
  const added = [];
  let killed = null;
  for (let i = 0; i < 900 && !killed; i++) {
    a.x = 1000; a.y = 1000; a.heading = 0;
    b.x = 1200; b.y = 1000; b.shield = 0;
    w.stepShip(1, { ...idle, fire: true });
    w.step();
    const ev = w.drain();
    added.push(...ev.pickups);
    if (ev.deaths.length) killed = ev.deaths[0];
  }
  assert(killed && killed.id === 2, 'b destroyed');
  const spilled = added.reduce((m, k) => m + k.value, 0);
  // Hull spills while alive (half of the 200 lost) plus half of what was left at the killing blow.
  assert(spilled >= 200 * sh.hullSpillFraction * 0.8 && spilled <= 200, `spilled minerals (${spilled.toFixed(1)})`);
  assert(added.every((k) => k.kind === 'mineral'));
  // b was locked out of its own spill (it never grew back while being shot).
  assert(w.pickups.size > 0);
  // Bullets of a bigger ship hit harder.
  const w2 = emptyWorld();
  const big = placeShip(w2, 1, 1000, 1000, 0);
  const tgt = placeShip(w2, 2, 1200, 1000, Math.PI / 2);
  big.hp = sh.powerCap;
  tgt.hp = sh.powerCap;
  const full = S.maxShield(tgt.hp, tune);
  tgt.shield = full;
  for (let i = 0; i < 60 && tgt.shield === full; i++) {
    big.x = 1000; big.y = 1000; big.heading = 0; tgt.x = 1200; tgt.y = 1000;
    w2.stepShip(1, { ...idle, fire: true });
    w2.step();
  }
  near(full - tgt.shield, tune.weapon.damage * (1 + sh.damageBonusAtCap), 1e-6, 'capped damage per hit');
}

// --- Turrets: one per massPerTurret above the start, max 4; capped turning; range; weak shots. ---
{
  const tt = tune.turret;
  const base = tune.ship.maxHp;
  assert.equal(S.turretCount(base, tune), 0, 'a fresh ship has no turrets');
  assert.equal(S.turretCount(base + tt.massPerTurret - 1, tune), 0);
  assert.equal(S.turretCount(base + tt.massPerTurret, tune), 1, 'first turret at massPerTurret');
  assert.equal(S.turretCount(base + 3 * tt.massPerTurret, tune), 3);
  assert.equal(S.turretCount(100000, tune), 4, 'caps at 4');
  // One turret, a rock just inside range behind the ship: the turret turns at its capped rate, then fires.
  const w = emptyWorld();
  const s = placeShip(w, 1, 1000, 1000, 0);
  s.speed = 0;
  w.tune.ship.minSpeed = 0;
  s.hp = base + tt.massPerTurret;
  s.shield = S.maxShield(s.hp, tune);
  const mount = S.turretPosition(s, 0, tune);
  const target = rock(w, 0, mount.x - (tt.range + tune.asteroid.radius[0] - 20), mount.y, 0, 0, 1000);
  const shots = [];
  let firstShot = -1;
  for (let i = 0; i < 60; i++) {
    w.stepShip(1, { ...idle, thrust: -1 });
    w.step();
    const ev = w.drain();
    const mine = ev.shots.filter((x) => x.side >= S.TURRET_SIDE);
    if (mine.length && firstShot < 0) firstShot = i;
    shots.push(...mine);
  }
  // Turning half a circle at turnRate takes at least PI / turnRate seconds.
  assert(firstShot >= Math.floor((Math.PI - tt.aimTolerance) / tt.turnRate * tune.net.tickHz) - 1, `turret turned at its capped rate (${firstShot} steps)`);
  assert(shots.length >= 2 && shots.every((x) => x.side === S.TURRET_SIDE && x.vx < 0), 'it fires at the rock behind');
  // Out of range: nothing to shoot.
  const w2 = emptyWorld();
  const s2 = placeShip(w2, 1, 1000, 1000, 0);
  s2.speed = 0;
  w2.tune.ship.minSpeed = 0;
  s2.hp = base + tt.massPerTurret;
  rock(w2, 2, 1000, 1000 + tt.range + tune.asteroid.radius[2] + 60, 0, 0, 1000);
  let fired = 0;
  for (let i = 0; i < 90; i++) {
    w2.stepShip(1, { ...idle, thrust: -1 });
    w2.step();
    fired += w2.drain().shots.length;
  }
  assert.equal(fired, 0, 'nothing in range, no shots');
  // Ships first, and the shots are weak: the enemy shield loses turret.damage per hit.
  const w3 = emptyWorld();
  const a = placeShip(w3, 1, 1000, 1000, 0);
  const b = placeShip(w3, 2, 1000, 1250, 0);
  a.speed = b.speed = 0;
  w3.tune.ship.minSpeed = 0;
  a.hp = base + tt.massPerTurret;
  rock(w3, 0, 1000, 760, 0, 0, 1000);
  const full = b.shield;
  const shots3 = [];
  for (let i = 0; i < 90 && b.shield === full; i++) {
    a.x = 1000; a.y = 1000; b.x = 1000; b.y = 1250;
    w3.stepShip(1, { ...idle, thrust: -1 });
    w3.stepShip(2, { ...idle, thrust: -1 });
    w3.step();
    shots3.push(...w3.drain().shots);
  }
  assert(shots3.length && shots3.every((x) => x.vy > 0), 'turret prefers the enemy ship over a rock');
  near(full - b.shield, tt.damage, 1e-9, 'turret shots do turret.damage');
}

// --- Older published live settings upgrade: missing fields filled; the hull pool split into hull + shield. ---
{
  const L = S.liveConfig;
  const base = L.defaultConfig();
  const old = structuredClone(base);
  old.tune.ship.maxHp = 100;
  for (const k of ['maxShield', 'shieldRegenDelaySeconds', 'shieldRegenPerSecond', 'knockbackSpeed', 'knockbackDecayPerSecond']) delete old.tune.ship[k];
  for (const k of ['healthDropChance', 'healthHealFraction', 'pickupLifeSeconds', 'pickupRadius']) delete old.tune.asteroid[k];
  delete old.clientTune.touch.markerThrustCurve;
  old.clientTune.touch.speedBand = 40; // a field the game has since removed
  // Settings published while the dash was removed (12 Nov): no dash fields, an extra fire margin.
  for (const k of ['dashSpeed', 'dashDuration', 'dashCooldown']) delete old.tune.ship[k];
  for (const k of ['dashButtonRadius', 'dashButtonMargin']) delete old.clientTune.touch[k];
  old.clientTune.touch.fireButtonMargin = 34;
  delete old.clientTune.render.thrusterTopSpeedStretch;
  delete old.tune.turret; // published before turrets existed
  const up = L.validateConfig(old);
  assert.equal(up.tune.ship.maxHp, 50, 'old hull pool halved');
  assert.equal(up.tune.ship.maxShield, 50, 'the other half becomes shield');
  assert.equal(up.tune.asteroid.healthHealFraction, base.tune.asteroid.healthHealFraction, 'new fields get defaults');
  assert(!('speedBand' in up.clientTune.touch), 'removed fields are dropped');
  assert.equal(up.tune.ship.dashSpeed, base.tune.ship.dashSpeed, 'dash settings come back from the defaults');
  assert(!('fireButtonMargin' in up.clientTune.touch), 'the removed fire margin is dropped');
  assert.equal(up.clientTune.render.thrusterTopSpeedStretch, base.clientTune.render.thrusterTopSpeedStretch);
  assert.deepEqual(up.tune.turret, base.tune.turret, 'turret settings come from the defaults');
  assert.deepEqual(L.validateConfig(base), base, 'current settings pass unchanged');
}

// --- Player names. ---
assert.equal(S.cleanName('  Ace\u0007  Pilot  '), 'Ace Pilot');
assert.equal(S.cleanName('a'.repeat(40)).length, 16);
assert.equal(S.cleanName(null), '');

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
  const ship = { id: 9, x: 12.5, y: 300.25, heading: 1.5, speed: 260, dashTime: 0, dashCd: 0.5, hp: 40, shield: 12.5, kx: -80, ky: 30.5, fireCd: 3, shots: 41 };
  assert.deepEqual(S.decodeServer(S.encodeSnapshot(1234, 55, [ship])), { type: S.MSG.SNAPSHOT, tick: 1234, ackSeq: 55, ships: [ship] });
  const rockRec = { id: 3, size: 1, x: 10.5, y: 20.25, vx: -30, vy: 12.5, t0: 900, hp: 30 };
  assert.deepEqual(S.decodeServer(S.encodeAsteroids([rockRec])).asteroids, [rockRec]);
  assert.deepEqual(S.decodeServer(S.encodeGone([{ id: 3, x: 1.5, y: 2.5 }])).gone, [{ id: 3, x: 1.5, y: 2.5 }]);
  const shot = { owner: 4, x: 5.5, y: 6.5, vx: 900, vy: -12.5, side: -1 };
  assert.deepEqual(S.decodeServer(S.encodeShots(88, [shot])), { type: S.MSG.SHOTS, tick: 88, shots: [shot] });
}

// --- Planet view and fixed-sun lighting (render/planet.ts, from the environment handoff v09). ---
{
  const P = S.planet;
  const R = 608.25;
  // Projection: centre unchanged, compressed toward the rim, hidden past a quarter turn.
  assert.deepEqual(P.projectOffset(0, 0, R), { x: 0, y: 0, scale: 1, visible: true });
  const mid = P.projectOffset(600, 0, R);
  near(mid.x, R * Math.sin(600 / R), 1e-9, 'projection is R sin(r/R)');
  assert(mid.scale < 1 && mid.scale > 0, 'things shrink toward the horizon');
  assert.equal(P.projectOffset(P.horizonDistance(R) + 1, 0, R).visible, false, 'hidden over the horizon');
  assert.equal(P.projectOffset(0, -(P.horizonDistance(R) - 1), R).visible, true);

  const sun = P.sunState(tune.planet.sunAzimuthDeg, tune.planet.sunElevationDeg);
  const RL = P.lightingRadius(tune.world.width);
  const f0 = P.planetFrame(0, 0, 0, RL, sun);
  // Reference daylight shadow from the handoff: about 17 px right and 27 px down at reach 56.
  const sh = P.shipShadow(f0.sun, 56);
  near(sh.x, 17.1, 0.2, 'reference shadow x');
  near(sh.y, 27.4, 0.2, 'reference shadow y');
  assert.equal(f0.daylight, 1);

  // Planet rotation and travel move the same position: turning the planet by an angle lights the
  // view exactly like travelling that far, and the terrain scrolls with it.
  const byTravel = P.planetFrame(RL * 0.7, 0, 0, RL, sun);
  const byRotation = P.planetFrame(0, 0, (0.7 * 180) / Math.PI, RL, sun);
  for (const k of ['x', 'y', 'z']) near(byTravel.sun[k], byRotation.sun[k], 1e-12, 'rotation equals travel');
  near(byTravel.camera.x, byRotation.camera.x, 1e-9, 'terrain scroll follows the same position');
  // Stopping both freezes the light; heading is not an input at all.
  assert.deepEqual(P.planetFrame(123, 45, 10, RL, sun), P.planetFrame(123, 45, 10, RL, sun));
  // One lap of the wrapping map, or one full turn, brings the same light back: no jump at the seam.
  const lap = P.planetFrame(123 + tune.world.width, 45 + tune.world.height, 10, RL, sun);
  const turn = P.planetFrame(123, 45, 370, RL, sun);
  const here = P.planetFrame(123, 45, 10, RL, sun);
  for (const k of ['x', 'y', 'z']) {
    near(lap.sun[k], here.sun[k], 1e-9, 'light repeats across the map seam');
    near(turn.sun[k], here.sun[k], 1e-9, 'light repeats after a full turn');
  }
  // Night: the far side has no direct light, so no shadow; brightness never drops below 0.3.
  const night = P.planetFrame(0, 0, 180, RL, sun);
  assert.equal(night.daylight, 0, 'night removes the direct shadow');
  near(night.brightness, 0.3, 1e-9, 'night keeps a floor of brightness');
  // Low sun: the shadow lengthens but is bounded.
  const low = P.shipShadow({ x: 1, y: 0, z: 0.01 }, 56);
  near(Math.hypot(low.x, low.y), 56 * 2.5, 1e-9, 'shadow length is bounded');
}

// --- Thruster exhaust (render/thrusters.ts): the handoff lab's own acceptance cases. ---
{
  const { ThrusterVFX } = S.thrusters;
  const idleIn = { throttle: false, left: false, right: false };
  const origins = [{ x: -20, y: 30, width: 12, angle: 0 }, { x: 20, y: 30, width: 12, angle: 0 }];
  const v = new ThrusterVFX(() => 0.5);
  for (let i = 0; i < 60; i++) v.update(1 / 60, idleIn, origins);
  assert(v.particles.length > 0, 'steady idle exhaust');
  assert.deepEqual(v.bursts, [0, 0]);
  v.update(1 / 60, { ...idleIn, left: true }, origins);
  assert.deepEqual(v.strong, [false, true], 'left turn drives the right (outside) engine');
  assert.deepEqual(v.bursts, [0, 1]);
  for (let i = 0; i < 120; i++) v.update(1 / 60, { ...idleIn, left: true }, origins);
  assert.deepEqual(v.bursts, [0, 1], 'a held turn never bursts again');
  v.update(1 / 60, idleIn, origins);
  v.update(1 / 60, { ...idleIn, throttle: true }, origins);
  assert.deepEqual(v.strong, [true, true], 'throttle drives both engines');
  assert.deepEqual(v.bursts, [1, 2]);
  for (let i = 0; i < 120; i++) v.update(1 / 60, { ...idleIn, throttle: true }, origins);
  assert.deepEqual(v.bursts, [1, 2], 'held throttle never bursts again');
  v.update(1 / 60, idleIn, origins);
  v.update(1 / 60, { ...idleIn, right: true }, origins);
  assert.deepEqual(v.strong, [true, false], 'right turn drives the left engine');
  assert(v.particles.length <= 900 && v.particles.every((p) => Number.isFinite(p.x) && p.w > 0 && p.h > 0), 'bounded, valid particles');
  const burst = new ThrusterVFX(() => 0.5);
  burst.update(1 / 60, { ...idleIn, throttle: true }, origins);
  assert(burst.particles.length >= 172, 'burst emits at least 86 per engine');
  const big = new ThrusterVFX(() => 0.5);
  const small = new ThrusterVFX(() => 0.5);
  big.spawn(origins[0], true);
  small.spawn({ ...origins[0], particleScale: 0.375 }, true);
  near(small.particles[0].w / big.particles[0].w, 0.375, 1e-12, 'particles scale with the craft');
  near(small.particles[0].vy / big.particles[0].vy, 0.375, 1e-12, 'particle speed scales with the craft');
  // At top speed both engines run strong and the plume is longer (taller, longer-lived particles).
  const slow = new ThrusterVFX(() => 0.5);
  const fast = new ThrusterVFX(() => 0.5);
  for (let i = 0; i < 30; i++) {
    slow.update(1 / 60, idleIn, origins, 1);
    fast.update(1 / 60, { ...idleIn, speedTrail: 1 }, origins, 1);
  }
  assert.deepEqual(fast.strong, [true, true], 'top speed keeps both engines strong');
  const longest = (v) => Math.max(...v.particles.map((p) => p.life));
  assert(longest(fast) > longest(slow) * 1.5, 'top-speed plume lasts longer');
}

// --- Dash: holds dashSpeed for dashDuration even with the brake held (a released marker stick), then
// the extra speed bleeds off at the braking rate down to top speed, not to the minimum. ---
{
  const dt = 1 / tune.net.tickHz;
  const sh = S.newShip(0, 0, 0, tune.ship.minSpeed);
  sh.hp = tune.ship.maxHp;
  let x0 = sh.x;
  S.stepShip(sh, { ...idle, thrust: -1, dash: true }, dt, tune);
  near((sh.x - x0) / dt, tune.ship.dashSpeed, 1e-6, 'dash moves at dashSpeed from minimum speed');
  let n = 1;
  while (sh.dashTime > 0) {
    x0 = sh.x;
    S.stepShip(sh, { ...idle, thrust: -1 }, dt, tune);
    near((sh.x - x0) / dt, tune.ship.dashSpeed, 1e-6, 'braking does not cut a dash short');
    n++;
  }
  assert(Math.abs(n - Math.round(tune.ship.dashDuration / dt)) <= 1, `dash lasts dashDuration (${n} steps)`);
  // Released stick (brake) after the dash: excess bleeds at braking; the brake then takes it on down.
  S.stepShip(sh, { ...idle, thrust: 0 }, dt, tune);
  near(sh.speed, tune.ship.dashSpeed - tune.ship.braking * dt, 1e-6, 'eases out of the dash');
  for (let i = 0; i < tune.net.tickHz; i++) S.stepShip(sh, { ...idle, thrust: 0 }, dt, tune);
  near(sh.speed, tune.ship.maxSpeed, 1e-6, 'settles at top speed when coasting');
  assert(sh.dashCd > 0, 'dash on cooldown');
}

console.log('Steroids-Alpha sim rules: throttle, guns, asteroid splits, contact, deaths, population, wire format, planet lighting, thrusters, dash, shield, power, minerals, spills, turrets, ramming, health boosts, kill credit and settings upgrade all pass.');
