// The public lab and authoritative server share this allowlisted, versioned data contract.
// No URLs, code, asset names, world topology or networking settings can be published here.
import tuneJson from '../tune.json';
import clientJson from '../client.tune.json';
import calibrationJson from '../art/human-nomad-v1/calibration-approved.json';
import { checkCalibration } from '../src/render/shipRig';

export const CONFIG_SCHEMA = 1;
export interface ConfigData {
  schema: 1;
  calibration: typeof calibrationJson;
  tune: typeof tuneJson;
  clientTune: typeof clientJson;
}
export interface ConfigRecord {
  version: string;
  publishedAt: string;
  actor: string;
  data: ConfigData;
}
export const defaultConfig = (): ConfigData => structuredClone({ schema: CONFIG_SCHEMA, calibration: calibrationJson, tune: tuneJson, clientTune: clientJson }) as ConfigData;
const fail = (message: string): never => { throw new Error(message); };

function sameShape(value: unknown, base: unknown, path = 'config'): void {
  if (typeof base === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100000) fail(`${path}: enter a finite value within range`);
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) !== Array.isArray(base)) fail(`${path}: invalid structure`);
  const keys = Object.keys(base as object), actual = Object.keys(value as object);
  if (keys.length !== actual.length || keys.some(k => !Object.prototype.hasOwnProperty.call(value, k))) fail(`${path}: unexpected or missing fields`);
  for (const key of keys) sameShape((value as Record<string, unknown>)[key], (base as Record<string, unknown>)[key], `${path}.${key}`);
}
/**
 * Settings published before a field existed get that field's bundled default, and fields the game
 * removed are dropped, so older published versions stay valid as the game's values change. One owner rule: before ships had a shield, the whole
 * hull pool was hull; it is now split in half between hull and shield (owner decision, 11 Nov 2026).
 */
export function upgradeConfig(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const value = structuredClone(input) as Record<string, any>;
  const ship = value.tune?.ship;
  if (ship && typeof ship === 'object' && ship.maxShield === undefined && typeof ship.maxHp === 'number') {
    ship.maxShield = ship.maxHp / 2;
    ship.maxHp = ship.maxHp / 2;
  }
  // Rebuild in the bundled shape and key order: fields the game added get their defaults, fields it
  // no longer has are dropped, and every value that exists is kept as published (so a changed
  // deployment-locked value is still rejected by validateConfig below).
  const rebuild = (target: unknown, base: unknown): unknown => {
    if (!base || typeof base !== 'object' || Array.isArray(base)) return target === undefined ? structuredClone(base) : target;
    if (!target || typeof target !== 'object' || Array.isArray(target)) return target;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(base)) out[k] = k in (target as object) ? rebuild((target as Record<string, unknown>)[k], v) : structuredClone(v);
    return out;
  };
  return rebuild(value, defaultConfig());
}

export function validateConfig(input: unknown): ConfigData {
  const base = defaultConfig();
  input = upgradeConfig(input);
  sameShape(input, base);
  const value = structuredClone(input) as ConfigData;
  if (value.schema !== 1 || value.calibration.version !== 7) fail('Unsupported configuration version');
  const c = value.calibration;
  checkCalibration(c);
  if (c.hoverLift < 0 || c.hoverLift > 100 || c.shadow.opacity < 0 || c.shadow.opacity > 1 || Math.abs(c.shadow.x) > 100 || Math.abs(c.shadow.y) > 100) fail('Invalid hover/shadow');
  for (const [id, m] of Object.entries(c.modules)) {
    if (m.width < 12 || m.width > 300) fail(`${id}: width must be 12–300`);
    for (const dir of ['up','right','down','left'] as const) {
      if (m.order[dir] !== m.order.up || Math.abs(m.order[dir]) > 100) fail(`${id}: draw order must stay fixed throughout rotation`);
      if (Math.abs(m.offsets[dir].x) > 100 || Math.abs(m.offsets[dir].y) > 100) fail(`${id}: offsets must be within ±100`);
    }
  }
  if (c.modules.cockpit.order.up <= Math.max(c.modules.engineCapL.order.up,c.modules.engineCapR.order.up) || c.modules.canopy.order.up <= c.modules.cockpit.order.up) fail('Cockpit and canopy must stay above both cowlings');
  for (const group of ['world','net'] as const) if (JSON.stringify(value.tune[group]) !== JSON.stringify(base.tune[group])) fail(`${group} settings require a code deployment`);
  for (const group of ['net','dpr','touch'] as const) if (JSON.stringify(value.clientTune[group]) !== JSON.stringify(base.clientTune[group])) fail(`Client ${group} settings require a code deployment`);
  if (value.clientTune.render.partTextureMax !== base.clientTune.render.partTextureMax) fail('Texture resolution requires a code deployment');
  for (const group of ['ship','weapon','turret','shop','bots','asteroid'] as const) for (const [key, n] of Object.entries(value.tune[group])) for (const v of Array.isArray(n) ? n : [n]) {
    if (v < 0 || v > 10000) fail(`${group}.${key}: value must be 0–10000`);
  }
  const s = value.tune.ship, w = value.tune.weapon;
  if (!(s.minSpeed <= s.cruiseSpeed && s.cruiseSpeed <= s.maxSpeed && s.maxSpeed > 0)) fail('Keep minimum ≤ cruise ≤ maximum speed');
  if (!(s.dashSpeedFactor >= 1 && s.dashSpeedFactor <= 4) || !(s.dashChargeSeconds >= 0 && s.dashChargeSeconds <= 2) || !(s.dashDuration > 0 && s.dashDuration <= 8) || !(s.dashCooldown >= s.dashChargeSeconds + s.dashDuration)) fail('Dash: speed 1-4x top speed, charge 0-2 s, boost up to 8 s, cooldown at least charge + boost');
  if (s.acceleration <= 0 || s.braking <= 0 || s.radius <= 0 || s.maxHp <= 0) fail('Acceleration, braking, radius and hull must be positive');
  if (!(s.powerCap >= s.maxHp) || s.speedPenaltyAtCap < 0 || s.speedPenaltyAtCap >= 1 || s.radiusBonusAtCap < 0 || s.hullSpillFraction < 0 || s.hullSpillFraction > 1 || s.deathSpillFraction < 0 || s.deathSpillFraction > 1 || s.spillLockSeconds < 0) fail('Power: cap at least the starting hull, bonuses and penalties in range, spill fractions 0..1');
  { const t = value.tune.turret; if (!(t.range > 0) || !(t.turnRate > 0) || t.aimTolerance <= 0 || !Number.isInteger(t.fireIntervalSteps) || t.fireIntervalSteps < 1 || t.damage < 0 || !(t.bulletSpeed > 0)) fail('Turret stats out of range'); }
  { const sh = value.tune.shop; for (const item of ['turret', 'shield', 'damage'] as const) { const f = sh[`${item}Floors`], c = sh[`${item}Costs`]; if (f.length !== 4 || c.length !== 4 || [0, 1, 2, 3].some((i) => !(c[i] > 0) || !(f[i] - c[i] >= 1) || (i > 0 && f[i] < f[i - 1]))) fail(`Shop ${item}: 4 tiers, each floor above its cost and not below the last`); } if (sh.shieldPerTier < 0 || sh.damagePerTier < 0 || sh.gunHeatPerTier < 0) fail('Shop upgrades must not be negative'); }
  { const b = value.tune.bots; if (!Number.isInteger(b.count) || b.count < 0 || b.count > 8 || !(b.respawnSeconds >= 0) || !(b.fleeHullFraction >= 0 && b.fleeHullFraction <= 1) || !(b.burstHeat > b.resumeHeat && b.burstHeat <= 1)) fail('Bots: 0-8 bots, flee fraction 0..1, burst heat above resume heat'); }
  if (!(w.assistConeDeg >= 0 && w.assistConeDeg <= 45) || w.assistRange < 0 || !(w.assistMaxDeg >= 0 && w.assistMaxDeg <= 30)) fail('Aim assist out of range');
  if (!(w.heatPerShot > 0 && w.heatPerShot <= 1) || !(w.coolPerSecond > 0) || w.unlockHeat < 0 || w.unlockHeat >= 1 || s.dashRamDamage < 0 || s.dashRamSelfDamage < 0) fail('Overheat and dash ram settings out of range');
  { const a = value.tune.asteroid; if (!(a.mineralChunkValue > 0) || !Number.isInteger(a.mineralChunksMax) || a.mineralChunksMax < 1 || !Number.isInteger(a.pickupsMax) || a.pickupsMax < 1) fail('Mineral chunks and pickup limits must be positive whole numbers'); }
  if (s.shieldRegenPerSecond > 1 || value.tune.asteroid.healthDropChance > 1 || value.tune.asteroid.healthHealFraction > 1) fail('Shield regeneration, drop chance and heal fraction are fractions (0–1)');
  if (!Number.isInteger(w.fireIntervalSteps) || w.fireIntervalSteps < 1 || w.fireIntervalSteps > 255 || !Number.isInteger(w.bulletLifeSteps) || w.bulletLifeSteps < 1 || w.bulletLifeSteps > 900) fail('Weapon step counts must be positive integers (interval ≤255; life ≤900)');
  if (w.bulletRadius <= 0 || w.bulletSpeed <= 0 || w.convergeDistance <= 0 || value.tune.asteroid.radius.some(n=>n<=0) || value.tune.asteroid.hp.some(n=>n<=0) || value.tune.asteroid.targetMass > 256) fail('Invalid weapon/asteroid size or population');
  const p = value.tune.planet, r = value.clientTune.render;
  if (Math.abs(p.rotationDegPerSec)>12 || Math.abs(p.sunElevationDeg)>90 || Math.abs(p.sunAzimuthDeg)>360) fail('Planet lighting values out of range');
  if (r.shipScale<.05 || r.shipScale>1 || r.planetRadius<450 || r.planetRadius>3000 || r.referenceHeight<300 || r.referenceHeight>1600 || r.haloWidth<0 || r.haloWidth>200 || r.shadowReach<0 || r.shadowReach>120 || r.nightObjectDim<0 || r.nightObjectDim>1 || r.nightShipDim<0 || r.nightShipDim>1 || r.thrusterTopSpeedStretch<0 || r.thrusterTopSpeedStretch>4) fail('Visual settings out of range');
  for (const n of Object.values(r)) if(n<0 || n>10000) fail('Visual setting out of range');
  return value;
}
export function parseRecord(input: unknown): ConfigRecord {
  const r = input as ConfigRecord;
  if (!r || !/^(bundled|[a-f0-9]{64})$/.test(r.version) || typeof r.publishedAt!=='string' || typeof r.actor!=='string') fail('Invalid published configuration');
  return {version:r.version,publishedAt:r.publishedAt,actor:r.actor,data:validateConfig(r.data)};
}
export const bundledRecord = (): ConfigRecord => ({version:'bundled',publishedAt:'',actor:'Bundled defaults',data:defaultConfig()});
