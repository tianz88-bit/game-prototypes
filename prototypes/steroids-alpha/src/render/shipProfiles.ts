import sparrowCalibration from '../../art/sparrow-v1/calibration.json';
import sparrowModules from '../../art/sparrow-v1/modules.json';
// The Human Nomad ships as rig profiles: parts (from each kit's ship-profile.mjs), the
// calibration and the texture set. Falcon is the approved original (shipRig.ts MODULES); the
// Interceptor and Battlecruiser come from tools/ship-rig/human-nomad-ships-v2 (Codex, owner art,
// 14 November 2026). Part coordinates are rig pixels at the same art scale as the starter.
import { MODULES, checkCalibration } from './shipRig';
import type { Calibration, RigModule } from './shipRig';
import starterCalibration from '../../art/human-nomad-v1/calibration-approved.json';
import interceptorCalibration from '../../art/interceptor-v2/calibration.json';
import battlecruiserCalibration from '../../art/battlecruiser-v2/calibration.json';

export const INTERCEPTOR_MODULES: readonly RigModule[] = [
  { id: 'chassis', asset: 'chassis', x: 0, y: -10, band: 20 },
  { id: 'wingL', asset: 'wing', x: -105, y: 25, band: 10, side: -1, parent: 'chassis' },
  { id: 'wingR', asset: 'wing', x: 105, y: 25, band: 10, side: 1, mirror: true, parent: 'chassis' },
  { id: 'armour', asset: 'armour', x: 0, y: -20, band: 30, parent: 'chassis' },
  { id: 'engineL', asset: 'booster-core', x: -145, y: 30, band: 42, side: -1, parent: 'chassis', motion: 'engine', motionGroup: 'engineL' },
  { id: 'engineR', asset: 'booster-core', x: 145, y: 30, band: 43, side: 1, parent: 'chassis', motion: 'engine', motionGroup: 'engineR' },
  { id: 'engineCapL', asset: 'booster-cowling', x: -145, y: 8, band: 44, side: -1, parent: 'engineL', motion: 'engine', motionGroup: 'engineL' },
  { id: 'engineCapR', asset: 'booster-cowling', x: 145, y: 8, band: 45, side: 1, parent: 'engineR', motion: 'engine', motionGroup: 'engineR' },
  { id: 'cockpit', asset: 'cockpit-base', x: 0, y: 5, band: 50, parent: 'armour' },
  { id: 'canopy', asset: 'cockpit-canopy', x: 0, y: 5, band: 51, parent: 'cockpit' },
  { id: 'gunL', asset: 'gun', x: -91, y: -14, band: 60, side: -1, parent: 'wingL' },
  { id: 'gunR', asset: 'gun', x: 91, y: -14, band: 60, side: 1, parent: 'wingR' },
];

export const BATTLECRUISER_MODULES: readonly RigModule[] = [
  { id: 'chassis', asset: 'chassis', x: 0, y: 0, band: 20 },
  { id: 'wingL', asset: 'wing', x: -280, y: -70, band: 10, side: -1, parent: 'chassis' },
  { id: 'wingR', asset: 'wing', x: 280, y: -70, band: 11, side: 1, mirror: true, parent: 'chassis' },
  { id: 'armour', asset: 'armour', x: 0, y: 0, band: 30, parent: 'chassis' },
  { id: 'engineL', asset: 'booster-core', x: -230, y: 280, band: 42, side: -1, parent: 'chassis', motion: 'engine', motionGroup: 'engineL' },
  { id: 'engineR', asset: 'booster-core', x: 230, y: 280, band: 43, side: 1, parent: 'chassis', motion: 'engine', motionGroup: 'engineR' },
  { id: 'engineCapL', asset: 'booster-cowling', x: -230, y: 220, band: 44, side: -1, parent: 'engineL', motion: 'engine', motionGroup: 'engineL' },
  { id: 'engineCapR', asset: 'booster-cowling', x: 230, y: 220, band: 45, side: 1, parent: 'engineR', motion: 'engine', motionGroup: 'engineR' },
  { id: 'shieldL', asset: 'shield-emitter', x: -95, y: -50, band: 48, side: -1, parent: 'armour' },
  { id: 'shieldR', asset: 'shield-emitter', x: 95, y: -50, band: 49, side: 1, parent: 'armour' },
  { id: 'cockpit', asset: 'cockpit-base', x: 0, y: 180, band: 50, parent: 'armour' },
  { id: 'canopy', asset: 'cockpit-canopy', x: 0, y: 180, band: 51, parent: 'cockpit' },
  {"id":"turretPlatform0","asset":"turret-platform","x":-200,"y":50,"band":46,"parent":"armour"},
  {"id":"turretHead0","asset":"turret-head","x":-200,"y":50,"band":49,"parent":"turretPlatform0","side":10},
  {"id":"turretPlatform1","asset":"turret-platform","x":200,"y":50,"band":46.1,"parent":"armour"},
  {"id":"turretHead1","asset":"turret-head","x":200,"y":50,"band":49.1,"parent":"turretPlatform1","side":11},
  {"id":"turretPlatform2","asset":"turret-platform","x":-200,"y":-140,"band":46.2,"parent":"armour"},
  {"id":"turretHead2","asset":"turret-head","x":-200,"y":-140,"band":49.2,"parent":"turretPlatform2","side":12},
  {"id":"turretPlatform3","asset":"turret-platform","x":200,"y":-140,"band":46.3,"parent":"armour"},
  {"id":"turretHead3","asset":"turret-head","x":200,"y":-140,"band":49.3,"parent":"turretPlatform3","side":13},
  // Cannons: side -1/1 inner pair, -2/2 outer pair (matches sim/chassis.ts GUNS sides).
  { id: 'gunL', asset: 'gun', x: -115, y: -350, band: 60, side: -1, parent: 'armour', recoilScale: 2.6 },
  { id: 'gunR', asset: 'gun', x: 115, y: -350, band: 61, side: 1, parent: 'armour', recoilScale: 2.6 },
  { id: 'gunOuterL', asset: 'gun', x: -310, y: -280, band: 62, side: -2, parent: 'wingL', recoilScale: 2.6 },
  { id: 'gunOuterR', asset: 'gun', x: 310, y: -280, band: 63, side: 2, parent: 'wingR', recoilScale: 2.6 },
];

export interface ShipProfile {
  /** Texture id prefix (matches the staged loose/<shipId>-<asset>.png files). */
  shipId: string;
  modules: readonly RigModule[];
  assets: readonly string[];
  calibration: Calibration;
  /** Capital hull panels occupy more screen pixels than fighter parts. */
  textureScale?: number;
}

const profile = (shipId: string, modules: readonly RigModule[], cal: unknown): ShipProfile => ({
  shipId,
  modules,
  assets: [...new Set(modules.map((m) => m.asset))],
  calibration: checkCalibration(cal, modules),
});

/** By chassis (sim/chassis.ts): 0 Falcon, 1 Bat, 2 Battlecruiser, 3 Sparrow. */
export const SHIP_PROFILES: readonly ShipProfile[] = [
  profile('human-nomad-v1', MODULES, starterCalibration),
  profile('human-nomad-bat-v3', INTERCEPTOR_MODULES, interceptorCalibration),
  { ...profile('human-nomad-battlecruiser-v2', BATTLECRUISER_MODULES, battlecruiserCalibration), textureScale: 2 },
  profile('human-nomad-sparrow-v1', sparrowModules as readonly RigModule[], sparrowCalibration),
];
