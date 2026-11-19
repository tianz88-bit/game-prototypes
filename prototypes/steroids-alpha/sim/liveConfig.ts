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
    const colour = /^config\.clientTune\.render\.ui(Panel|Border|Accent|Gold|Danger|Text)$/.test(path);
    if (typeof value !== 'number' || !Number.isFinite(value) ||
      (colour ? !Number.isInteger(value) || value < 0 || value > 0xffffff : Math.abs(value) > 100000)) fail(`${path}: enter a finite value within range`);
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
  const oldBalance = value.tune?.shop?.balanceVersion;
  if ([undefined, 2, 3].includes(oldBalance) && value.tune?.interceptor) {
    value.tune.interceptor.damageFactor = defaultConfig().tune.interceptor.damageFactor;
  }
  // Owner-approved progression epoch: upgrade legacy published balance once; preserve later edits.
  if(value.tune&&(value.tune.shop===undefined||value.tune.shop&&typeof value.tune.shop==='object'&&value.tune.shop.balanceVersion===undefined)){
    value.tune.shop??={};
    const defaults=defaultConfig().tune;
    Object.assign(value.tune.shop,defaults.shop);
    if(value.tune.turret)value.tune.turret.damage=defaults.turret.damage;
    for(const key of ['missile','mine'])if(value.tune[key])value.tune[key].damagePerTier=defaults[key as 'missile'|'mine'].damagePerTier;
    for(const key of ['battlecruiser','missileCruiser'])if(value.tune[key]){value.tune[key].cost=defaults[key as 'battlecruiser'|'missileCruiser'].cost;value.tune[key].powerFloor=defaults[key as 'battlecruiser'|'missileCruiser'].powerFloor;}
  }
  // Run economy epoch 5 (owner, 19 November 2026): minerals are the only run currency, banked on
  // warp-out. Older records take the whole approved economy once; later owner edits survive.
  if (value.tune && [undefined, 2, 3, 4].includes(oldBalance)) {
    const d = defaultConfig().tune, v = value.tune;
    const take = (group: string, keys: string[]) => { if (v[group]) for (const k of keys) v[group][k] = structuredClone((d as any)[group][k]); };
    take('shop', ['turretCosts','turretFloors','shieldCosts','shieldFloors','damageCosts','damageFloors','missileCosts','missileFloors','mineCosts','mineFloors','holdBase','holdPerUpgrade','levelUp','levelXpBase','levelXpGrowth','levelEvolutionWeight','balanceVersion']);
    take('asteroid', ['miningMineralFactor']);
    take('ship', ['powerCap','hullSpillFraction','deathSpillFraction']);
    take('salvage', ['killPowerShare','botDropFactor','bankRate','homeBankRate']);
    take('warp', ['lockdownSeconds']);
    take('bots', ['loadedPreference','warpPower']);
    take('battlecruiser', ['cost','powerFloor']);
    take('missileCruiser', ['cost','powerFloor']);
    if (v.hotZone) v.hotZone.mineralMultiplier = v.hotZone.salvageMultiplier ?? d.hotZone.mineralMultiplier;
  }
  if ([2, 3].includes(value.tune?.shop?.balanceVersion)) {
    const defaults = defaultConfig().tune;
    const shop = value.tune.shop;
    for (const item of ['turret', 'shield', 'damage', 'missile', 'mine'] as const) {
      shop[`${item}Costs`] = defaults.shop[`${item}Costs`];
      shop[`${item}Floors`] = defaults.shop[`${item}Floors`];
    }
    shop.balanceVersion = defaults.shop.balanceVersion;
    if (value.tune.asteroid) value.tune.asteroid.miningMineralFactor = defaults.asteroid.miningMineralFactor;
    if (value.tune.ship) value.tune.ship.hullSpillFraction = defaults.ship.hullSpillFraction;
    for (const key of ['battlecruiser', 'missileCruiser'] as const) {
      if (value.tune[key]) {
        value.tune[key].cost = defaults[key].cost;
        value.tune[key].powerFloor = defaults[key].powerFloor;
      }
    }
  }
  // Evolution shop quotes are deployment-owned (Room/client do not apply published unlockPrices).
  if(value.tune?.unlockPrices)value.tune.unlockPrices.evolution=defaultConfig().tune.unlockPrices.evolution;
  // Upgrade the bot policy epoch once, preserving later owner edits and all shop prices.
  if(value.tune?.bots&&value.tune.bots.behaviourVersion===undefined){const b=defaultConfig().tune.bots;Object.assign(value.tune.bots,{behaviourVersion:b.behaviourVersion,aimErrorDeg:b.aimErrorDeg,perceptionSeconds:b.perceptionSeconds,reactionSeconds:b.reactionSeconds});}
  // Physical cargo doubles the default pool once; keep later owner settings and reward amounts.
  if(value.tune?.asteroid&&value.tune.asteroid.pickupVersion===undefined){const a=value.tune.asteroid,b=defaultConfig().tune.asteroid;Object.assign(a,{pickupVersion:1,pickupMagnetReach:b.pickupMagnetReach,pickupMagnetSpeed:b.pickupMagnetSpeed,pickupsMax:typeof a.pickupsMax==='number'?a.pickupsMax*2:b.pickupsMax});}
  // Apply the artillery handling update once to existing live records.
  const artillery = value.tune?.missileCruiser;
  if (artillery && typeof artillery === 'object' && artillery.missileRefillFactor === undefined) {
    const defaults = defaultConfig().tune.missileCruiser;
    Object.assign(artillery, {
      reverseSeconds: defaults.reverseSeconds,
      turnRateMissile: defaults.turnRateMissile,
      missileRefillFactor: defaults.missileRefillFactor,
    });
  }
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
  for (const group of ['net','dpr','touch','mouse'] as const) if (JSON.stringify(value.clientTune[group]) !== JSON.stringify(base.clientTune[group])) fail(`Client ${group} settings require a code deployment`);
  if (value.clientTune.render.partTextureMax !== base.clientTune.render.partTextureMax) fail('Texture resolution requires a code deployment');
  for (const group of ['grip','ship','weapon','turret','shop','missile','mine','bots','warp','salvage','hotZone','sparrow','interceptor','battlecruiser','missileCruiser','ciws','heavyTower','asteroid','base','siege'] as const) for (const [key, n] of Object.entries(value.tune[group])) for (const v of Array.isArray(n) ? n : [n]) {
    if (v < 0 || v > 10000) fail(`${group}.${key}: value must be 0–10000`);
  }
  {const m=value.tune.missileCruiser,c=value.tune.ciws,h=value.tune.heavyTower;if(m.capacity!==8||m.missileRefillFactor<1||m.missileRefillFactor>5||[m.minMissiles,m.minMines].some(v=>!Number.isInteger(v)||v<0||v>4)||m.damageFactor<1||m.damageFactor>3||m.rangeFactor<1||m.rangeFactor>3||m.radiusFactor<1||m.radiusFactor>3||m.repeatSeconds<.1||m.repeatSeconds>2||m.reverseSeconds<.1||m.reverseSeconds>2||m.turnRateMissile<=0||m.turnRateMissile>10||m.lifeSeconds<1||m.lifeSeconds>20||m.cost<0||m.powerFloor<m.cost||m.launchSpeed<=0)fail('Missile Cruiser settings out of range');for(const b of [c,h])if(!Number.isInteger(b.shots)||b.shots<1||b.shots>12||b.intervalSeconds<.03||b.intervalSeconds>1||b.pauseSeconds<.1||b.pauseSeconds>5||b.range<1||b.range>3000||b.speed<1||b.speed>3000||b.damage<=0||b.damage>500||b.turnRate<=0||b.turnRate>30)fail('Burst cannon settings out of range');if(h.telegraphSeconds<.1||h.telegraphSeconds>2)fail('Tower warning out of range');}
  if(value.tune.asteroid.pickupVersion!==1||value.tune.asteroid.pickupMagnetReach>160||value.tune.asteroid.pickupMagnetSpeed>800)fail('Pickup policy/range/speed requires bounded settings');
  if(value.tune.bots.behaviourVersion!==1)fail('Bot policy requires a code deployment');
  if (value.tune.shop.balanceVersion !== 4) fail('Progression epoch requires a code deployment');
  if (value.tune.asteroid.miningMineralFactor <= 0 || value.tune.asteroid.miningMineralFactor > 1 ||
      value.tune.ship.fighterShieldBonus > 100) fail('Mining yield or fighter shield bonus is out of range');
  const s = value.tune.ship, w = value.tune.weapon;
  { const g=value.tune.grip;
    if(![0,1].includes(g.enabled)||[g.slowTau,g.cruiseTau,g.fastTau,g.dashTau,g.brakeTau].some(v=>!(v>0&&v<=1))||g.maxSlipDeg>45||g.decelerationEpsilon>5)fail('Grip: enabled 0/1, response times above 0 up to 1s, slip 0–45 degrees, deceleration epsilon 0–5');
  }
  if(!(s.shieldRegenCapPerSecond>0&&s.shieldRegenCapPerSecond<=1000))fail('Shield regen cap must be above 0 up to 1000 per second');
  { const p=value.tune.sparrow;
    if (!Number.isInteger(p.fireIntervalSteps) || p.fireIntervalSteps <= w.fireIntervalSteps || p.fireIntervalSteps >= w.fireIntervalSteps * 2 || p.fireIntervalSteps > 255 || w.coolPerSecond * p.fireIntervalSteps / value.tune.net.tickHz >= 1 || !(p.ammoRatio > 0 && p.ammoRatio <= 1) || p.driftDeg > 8 || p.muzzleForward < 1 || p.muzzleForward > 80) fail('Sparrow: cadence between one Falcon gun and both, ammo ratio 0..1, drift 0..8 degrees, muzzle 1..80');
  }
  if (!(s.turnAtMinSpeed > 0 && s.turnAtMinSpeed <= 1) || !(s.turnAtMaxSpeed > 0 && s.turnAtMaxSpeed <= 1) || !(s.dashSteerFactor >= 0 && s.dashSteerFactor <= 1) || !(s.dashRamHullFraction >= 0 && s.dashRamHullFraction <= 1)) fail('Corner speed, dash steering and ram share must be 0–1');
  const warp = value.tune.warp;
  if (warp.arrivalSeconds < 2 || warp.arrivalSeconds > 8 || warp.departureSeconds < .5 || warp.departureSeconds > 8 || warp.remoteArrivalSeconds < .2 || warp.remoteArrivalSeconds > warp.arrivalSeconds) fail('Warp presentation timing out of range');
  if (!(s.minSpeed <= s.cruiseSpeed && s.cruiseSpeed <= s.maxSpeed && s.maxSpeed > 0)) fail('Keep minimum ≤ cruise ≤ maximum speed');
  if (!(s.dashSpeedFactor >= 1 && s.dashSpeedFactor <= 4) || !(s.dashChargeSeconds >= 0 && s.dashChargeSeconds <= 2) || !(s.dashDuration > 0 && s.dashDuration <= 8) || !(s.dashCooldown >= s.dashChargeSeconds + s.dashDuration)) fail('Dash: speed 1-4x top speed, charge 0-2 s, boost up to 8 s, cooldown at least charge + boost');
  if (s.acceleration <= 0 || s.braking <= 0 || s.radius <= 0 || s.maxHp <= 0) fail('Acceleration, braking, radius and hull must be positive');
  if (!(s.powerCap >= s.maxHp) || s.speedPenaltyAtCap < 0 || s.speedPenaltyAtCap >= 1 || s.radiusBonusAtCap < 0 || s.hullSpillFraction < 0 || s.hullSpillFraction > 1 || s.deathSpillFraction < 0 || s.deathSpillFraction > 1 || s.spillLockSeconds < 0) fail('Power: cap at least the starting hull, bonuses and penalties in range, spill fractions 0..1');
  { const t = value.tune.turret; if (!(t.range > 0) || !(t.turnRate > 0) || t.aimTolerance <= 0 || !Number.isInteger(t.fireIntervalSteps) || t.fireIntervalSteps < 1 || t.damage < 0 || !(t.bulletSpeed > 0)) fail('Turret stats out of range'); }
  { const sh = value.tune.shop; for (const item of ['turret', 'shield', 'damage', 'missile', 'mine'] as const) { const f = sh[`${item}Floors`], c = sh[`${item}Costs`]; if (f.length !== 4 || c.length !== 4 || [0, 1, 2, 3].some((i) => !Number.isInteger(c[i]) || !Number.isInteger(f[i]) || !(c[i] > 0) || !(f[i] >= c[i]) || (i > 0 && f[i] < f[i - 1]))) fail(`Shop ${item}: 4 whole-mineral tiers, each floor at least its cost and not below the last`); } if (sh.shieldPerTier < 0 || sh.damagePerTier < 0 || sh.gunHeatPerTier < 0) fail('Shop upgrades must not be negative'); }
  { const m = value.tune.missile, n = value.tune.mine; if (!(m.hp > 0) || !(m.launchSpeed > 0) || !(m.maxSpeed >= m.launchSpeed) || !(m.lifeSeconds > 0) || !(m.refillSeconds > 0) || !(m.lockConeDeg > 0 && m.lockConeDeg <= 90) || !(n.hp > 0) || !(n.blastRadius > 0) || !(n.lifeSeconds > 0) || !(n.refillSeconds > 0) || !Number.isInteger(n.maxActive) || n.maxActive < 1) fail('Missile and mine settings out of range'); }
  for (const c of [value.tune.interceptor, value.tune.battlecruiser,value.tune.missileCruiser]) if (!(c.radius >= 8 && c.radius <= 200) || !(c.minSpeed > 0 && c.minSpeed <= c.cruiseSpeed && c.cruiseSpeed <= c.maxSpeed) || !(c.acceleration > 0) || !(c.braking > 0) || !(c.turnRate > 0) || !(c.shieldFactor > 0 && c.shieldFactor <= 10) || !(c.damageFactor > 0 && c.damageFactor <= 10) || !Number.isInteger(c.fireIntervalSteps) || c.fireIntervalSteps < 1 || !Number.isInteger(c.baseTurrets) || c.baseTurrets < 0 || c.baseTurrets > 4) fail('Ships: radius 8-200, minimum ≤ cruise ≤ top speed, positive acceleration, braking and turn rate, factors above 0 (up to 3, shield/damage up to 10), whole fire interval 1+, 0-4 base turrets');
  { const b = value.tune.battlecruiser; if (!Number.isInteger(b.minUpgrades) || b.minUpgrades < 0 || b.minUpgrades > 20 || [b.minTurrets,b.minGuns].some(v=>!Number.isInteger(v)||v<0||v>4) || !(b.powerFloor >= 0) || !(b.cost >= 0)) fail('Battlecruiser: 0-20 total upgrades, turret/gun requirements 0-4, floor and cost 0 or more'); }
  { const v = value.tune.salvage; if (!(v.perMineral >= 0) || !(v.killPowerShare >= 0 && v.killPowerShare <= 2) || !(v.repeatKillWindowSeconds >= 0) || !(v.botDropFactor >= 0 && v.botDropFactor <= 1) || !(v.goldChunkValue > 0) || !Number.isInteger(v.goldChunksMax) || v.goldChunksMax < 1 || !(v.goldLifeSeconds > 0) || !(v.cargoMax >= 1) || !(v.bankRate >= 0 && v.bankRate <= 10) || !(v.homeBankRate >= 0 && v.homeBankRate <= 10)) fail('Salvage: cargo hold at least 1, bank rates 0-10, rates 0 or more, kill share 0-2, bot factor 0..1, gold chunk value above 0, 1+ chunks, gold life above 0'); }
  { const b = value.tune.base; if (!Number.isInteger(b.pads) || b.pads < 1 || b.pads > 12 || !Number.isInteger(b.turrets) || b.turrets < 0 || b.turrets > 12 || !Number.isInteger(b.turretFireIntervalSteps) || b.turretFireIntervalSteps < 1 || !(b.padRadius > 0) || !(b.domeRadius > b.padRing) || !(b.turretBulletSpeed > 0) || !(b.dockRepairPerSecond >= 0 && b.dockRepairPerSecond <= 1)) fail('Clan base: 1-12 pads, 0-12 turrets, whole fire interval 1+, dome wider than the pad ring, repair 0..1 per second'); }
  { const a = value.tune.asteroid; if (!Number.isInteger(a.richMax) || a.richMax < 0 || a.richMax > 10 || !(a.richMineralFactor >= 1 && a.richMineralFactor <= 10) || !(a.richHpFactor >= 0.5 && a.richHpFactor <= 10) || !(a.richRespawnSeconds >= 1)) fail('Rich asteroids: 0-10 alive, minerals 1-10x, health 0.5-10x, respawn 1 s or more'); }
  { const z = value.tune.hotZone; if (!(z.radius >= 0) || !(z.moveSeconds > 0) || !(z.mineralMultiplier >= 1) || !(z.spawnShare >= 0 && z.spawnShare <= 1)) fail('Hot zone: radius 0 or more, move time above 0, multiplier 1 or more, spawn share 0..1'); }
  { const v = value.tune.warp; if (!(v.lockdownSeconds >= 0 && v.lockdownSeconds <= 1800) || !(v.acceleration > 0) || !(v.topSpeedFactor >= 1 && v.topSpeedFactor <= 3) || !(v.distance > 0) || !(v.steerFactor >= 0 && v.steerFactor <= 1)) fail('Warp: lockdown 0-1800 s, acceleration and distance above 0, top speed x1-3, steering 0..1'); }
  { const b = value.tune.bots; if (!Number.isInteger(b.count) || b.count < 0 || b.count > 8 || !(b.respawnSeconds >= 0) || !(b.lingerSeconds >= 0 && b.lingerSeconds <= 600) || !(b.fleeHullFraction >= 0 && b.fleeHullFraction <= 1) || !(b.burstHeat > b.resumeHeat && b.burstHeat <= 1)) fail('Bots: 0-8 bots, flee fraction 0..1, burst heat above resume heat'); }
  if (!(w.assistConvergeMaxDeg >= 0 && w.assistConvergeMaxDeg <= 45) || !(w.assistConeDeg >= 0 && w.assistConeDeg <= 45) || w.assistRange < 0 || !(w.assistMaxDeg >= 0 && w.assistMaxDeg <= 30)) fail('Aim assist out of range');
  if (!(w.heatPerShot > 0 && w.heatPerShot <= 1) || !(w.coolPerSecond > 0) || w.unlockHeat < 0 || w.unlockHeat >= 1 || s.dashRamDamage < 0) fail('Overheat and dash ram settings out of range');
  { const a = value.tune.asteroid; if (!(a.mineralChunkValue > 0) || !Number.isInteger(a.mineralChunksMax) || a.mineralChunksMax < 1 || !Number.isInteger(a.pickupsMax) || a.pickupsMax < 1) fail('Mineral chunks and pickup limits must be positive whole numbers'); }
  if (s.shieldRegenPerSecond > 1 || value.tune.asteroid.healthDropChance > 1 || value.tune.asteroid.healthHealFraction > 1) fail('Shield regeneration, drop chance and heal fraction are fractions (0–1)');
  if (!Number.isInteger(w.fireIntervalSteps) || w.fireIntervalSteps < 1 || w.fireIntervalSteps > 255 || !Number.isInteger(w.bulletLifeSteps) || w.bulletLifeSteps < 1 || w.bulletLifeSteps > 900) fail('Weapon step counts must be positive integers (interval ≤255; life ≤900)');
  if (w.bulletRadius <= 0 || w.bulletSpeed <= 0 || w.convergeDistance <= 0 || value.tune.asteroid.radius.some(n=>n<=0) || value.tune.asteroid.hp.some(n=>n<=0) || value.tune.asteroid.targetMass > 256) fail('Invalid weapon/asteroid size or population');
  const p = value.tune.planet, r = value.clientTune.render;
  if (Math.abs(p.rotationDegPerSec)>12 || Math.abs(p.sunElevationDeg)>90 || Math.abs(p.sunAzimuthDeg)>360) fail('Planet lighting values out of range');
  if (r.shipScale<.05 || r.shipScale>1 || r.planetRadius<450 || r.planetRadius>3000 || r.referenceHeight<300 || r.referenceHeight>1600 || r.haloWidth<0 || r.haloWidth>200 || r.shadowReach<0 || r.shadowReach>120 || r.nightObjectDim<0 || r.nightObjectDim>1 || r.nightShipDim<0 || r.nightShipDim>1 || r.thrusterTopSpeedStretch<0 || r.thrusterTopSpeedStretch>8 || r.thrusterDashStretch<0 || r.thrusterDashStretch>12 || r.bulletScale<.5 || r.bulletScale>4 || r.hitSparkScale<.5 || r.hitSparkScale>4 || !(r.healDropScale>=.2 && r.healDropScale<=2) || r.exhaustSpeedScale<.25 || r.exhaustSpeedScale>6 || r.exhaustLifeScale<.1 || r.exhaustLifeScale>2 || !Number.isInteger(r.heavyShotGunTier) || r.heavyShotGunTier<0 || r.heavyShotGunTier>5) fail('Visual settings out of range');
  for (const [key,n] of Object.entries(r)) {
    if (/^ui(Panel|Border|Accent|Gold|Danger|Text)$/.test(key)) continue; // RGB is bounded in sameShape.
    if(n<0 || n>10000) fail('Visual setting out of range');
  }
  if (r.uiRadius > 16) fail('UI corners must stay within 0–16 pixels');
  if (!(r.shadowScale>=.2 && r.shadowScale<=1.5)) fail('Shadow scale must be 0.2-1.5');
  if (r.hoverLightX>100 || r.hoverLightY>200 || r.hoverLightWidth<=0 || r.hoverLightWidth>512 || r.hoverLightHeight<=0 || r.hoverLightHeight>256 || r.hoverLightOpacity>1) fail('Hover light settings out of range');
  if (![0,1].includes(r.ffdEnabled) || r.ffdAccelPitch>30 || r.ffdBrakePitch>30 || r.ffdYawBank>30 || r.ffdResponse<=0 || r.ffdResponse>30 || r.ffdAccelThreshold>200 || r.ffdYawFullDegPerSec<=0 || r.ffdYawFullDegPerSec>720 || r.ffdMinScale>1 || r.ffdSlowFrameMs<16 || r.ffdSlowFrameMs>250 || r.ffdSlowSeconds<=0 || r.ffdSlowSeconds>10 || r.ffdRecoverySeconds<=0 || r.ffdRecoverySeconds>30) fail('Ship deformation settings out of range');
  return value;
}
export function parseRecord(input: unknown): ConfigRecord {
  const r = input as ConfigRecord;
  if (!r || !/^(bundled|[a-f0-9]{64})$/.test(r.version) || typeof r.publishedAt!=='string' || typeof r.actor!=='string') fail('Invalid published configuration');
  return {version:r.version,publishedAt:r.publishedAt,actor:r.actor,data:validateConfig(r.data)};
}
export const bundledRecord = (): ConfigRecord => ({version:'bundled',publishedAt:'',actor:'Bundled defaults',data:defaultConfig()});
