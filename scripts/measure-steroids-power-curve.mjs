// Power curve for Steroids-Alpha level perks and evolutions (owner, 21 November 2026): sustained DPS
// (guns over 60 s with heat, drones or CIWS, missiles and mines at their reload rate) times hull + shield.
// Run from repo root: node scripts/measure-steroids-power-curve.mjs [key.path=value ...]
// Not a win-rate model: it ignores aim, range, regen and dodging. Mines assume every mine hits.
import { build } from 'esbuild';
const r = await build({ stdin: { contents: "export * from './prototypes/steroids-alpha/sim/ship';export * from './prototypes/steroids-alpha/sim/chassis';export * from './prototypes/steroids-alpha/sim/turrets';export * from './prototypes/steroids-alpha/sim/levels';export {TUNE} from './prototypes/steroids-alpha/sim/tune';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const S = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const t = structuredClone(S.TUNE);
for (const a of process.argv.slice(2)) { const [path, v] = a.split('='), k = path.split('.'); let o = t; for (const x of k.slice(0, -1)) o = o[x]; o[k.at(-1)] = Number(v); }
const hz = t.net.tickHz, dt = 1 / hz;
const fire = { seq: 0, turn: 0, aim: NaN, thrust: 0, dash: false, fire: true, missile: false, mine: false, warp: false };
function ship(chassis, tiers, level) {
  const s = S.newShip(1000, 1000, 0, 260);
  Object.assign(s, { chassis, hp: t.ship.maxHp, hullMax: t.ship.maxHp, turrets: tiers.turret ?? 0, damageTier: tiers.damage ?? 0, missileTier: tiers.missile ?? 0, mineTier: tiers.mine ?? 0, xp: S.xpForLevel(level, t), picks: level });
  s.shield = S.maxShield(s, t);
  return s;
}
function power(name, s) {
  let shots = 0;
  const g = S.newShip(0, 0, 0, 260); Object.assign(g, s, { heat: 0, overheated: false, fireCd: 0, shots: 0 });
  for (let i = 0; i < 60 * hz; i++) { const n = g.shots; S.stepShip(g, fire, dt, t); shots += g.shots !== n ? 1 : 0; }
  const guns = shots * t.weapon.damage * S.damageScale(s, t) / 60;
  const count = S.turretCount(s, t), cap = S.isCapital(s.chassis), c = t.ciws;
  const turret = count * (cap ? (c.shots * c.damage) / (c.shots * c.intervalSeconds + c.pauseSeconds) : t.turret.damage * hz / t.turret.fireIntervalSteps);
  const mc = s.chassis === S.MISSILE_CRUISER;
  const missiles = (mc || s.missileTier > 0) ? (t.missile.damage * (mc ? t.missileCruiser.missileDamageFactor : 1)) / S.missileRefillSeconds(s, t) : 0;
  const mines = s.mineTier > 0 ? t.mine.damage / S.mineRefillSeconds(s, t) : 0;
  const dps = guns + turret + missiles + mines, ehp = S.hullCapacity(s, t) + S.maxShield(s, t);
  return { name, dps: +dps.toFixed(1), guns: +guns.toFixed(1), turret: +turret.toFixed(1), missiles: +missiles.toFixed(1), mines: +mines.toFixed(1), ehp: Math.round(ehp), index: dps * ehp };
}
const full = { turret: 4, damage: 4, missile: 4, mine: 4 };
const rows = [
  power('Fresh Sparrow (Lv0)', ship(S.SPARROW, {}, 0)),
  power('Sparrow guns 4 + drones 2 (Lv6, BC ready)', ship(S.SPARROW, { turret: 2, damage: 4 }, 6)),
  power('Battlecruiser just evolved (Lv7)', ship(S.BATTLECRUISER, { turret: 2, damage: 4 }, 7)),
  power('Sparrow missiles 4 + mines 2 (Lv6, MC ready)', ship(S.SPARROW, { missile: 4, mine: 2 }, 6)),
  power('Missile Cruiser just evolved (Lv7)', ship(S.MISSILE_CRUISER, { missile: 4, mine: 2 }, 7)),
  power('Sparrow full build (Lv16)', ship(S.SPARROW, full, 16)),
  power('Battlecruiser full build (Lv17)', ship(S.BATTLECRUISER, full, 17)),
  power('Missile Cruiser full build (Lv17)', ship(S.MISSILE_CRUISER, full, 17)),
];
const base = rows[0].index;
console.log('ship | DPS (guns/drones/missiles/mines) | hull+shield | power vs fresh');
for (const x of rows) console.log(`${x.name} | ${x.dps} (${x.guns}/${x.turret}/${x.missiles}/${x.mines}) | ${x.ehp} | ${(x.index / base).toFixed(2)}x`);
console.log(`Evolution spike: BC ${(rows[2].index / rows[1].index).toFixed(2)}x, MC ${(rows[4].index / rows[3].index).toFixed(2)}x over the same-level fighter.`);
