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
export function validateConfig(input: unknown): ConfigData {
  const base = defaultConfig();
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
  for (const group of ['ship','weapon','asteroid'] as const) for (const [key, n] of Object.entries(value.tune[group])) for (const v of Array.isArray(n) ? n : [n]) {
    if (v < 0 || v > 10000) fail(`${group}.${key}: value must be 0–10000`);
  }
  const s = value.tune.ship, w = value.tune.weapon;
  if (!(s.minSpeed <= s.cruiseSpeed && s.cruiseSpeed <= s.maxSpeed && s.maxSpeed > 0 && s.dashSpeed >= s.minSpeed)) fail('Keep minimum ≤ cruise ≤ maximum speed');
  if (s.acceleration <= 0 || s.braking <= 0 || s.radius <= 0 || s.maxHp <= 0) fail('Acceleration, braking, radius and hull must be positive');
  if (!Number.isInteger(w.fireIntervalSteps) || w.fireIntervalSteps < 1 || w.fireIntervalSteps > 255 || !Number.isInteger(w.bulletLifeSteps) || w.bulletLifeSteps < 1 || w.bulletLifeSteps > 900) fail('Weapon step counts must be positive integers (interval ≤255; life ≤900)');
  if (w.bulletRadius <= 0 || w.bulletSpeed <= 0 || w.convergeDistance <= 0 || value.tune.asteroid.radius.some(n=>n<=0) || value.tune.asteroid.hp.some(n=>n<=0) || value.tune.asteroid.targetMass > 256) fail('Invalid weapon/asteroid size or population');
  const p = value.tune.planet, r = value.clientTune.render;
  if (Math.abs(p.rotationDegPerSec)>12 || Math.abs(p.sunElevationDeg)>90 || Math.abs(p.sunAzimuthDeg)>360) fail('Planet lighting values out of range');
  if (r.shipScale<.05 || r.shipScale>1 || r.planetRadius<450 || r.planetRadius>3000 || r.referenceHeight<300 || r.referenceHeight>1600 || r.haloWidth<0 || r.haloWidth>200 || r.shadowReach<0 || r.shadowReach>120 || r.nightObjectDim<0 || r.nightObjectDim>1) fail('Visual settings out of range');
  for (const n of Object.values(r)) if(n<0 || n>10000) fail('Visual setting out of range');
  return value;
}
export function parseRecord(input: unknown): ConfigRecord {
  const r = input as ConfigRecord;
  if (!r || !/^(bundled|[a-f0-9]{64})$/.test(r.version) || typeof r.publishedAt!=='string' || typeof r.actor!=='string') fail('Invalid published configuration');
  return {version:r.version,publishedAt:r.publishedAt,actor:r.actor,data:validateConfig(r.data)};
}
export const bundledRecord = (): ConfigRecord => ({version:'bundled',publishedAt:'',actor:'Bundled defaults',data:defaultConfig()});
