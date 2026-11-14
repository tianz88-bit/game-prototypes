// Auto turrets, bought in the shop (sim/shop.ts), up to 4. Each turret turns toward the nearest
// enemy ship or asteroid inside turret.range at no more than turret.turnRate, and fires small, weak
// shots once it is lined up. Bought turrets stay until the ship is destroyed. Pure rules: the server
// runs them; clients only draw what the server reports.
import type { Tune } from './tune';
import { powerGrowth } from './ship';
import { TURRET_MOUNTS_BY_CHASSIS, chassisStats } from './chassis';
import type { ShipState } from './ship';
import { wrap } from './wrap';

/**
 * Where the turrets sit on the ship, in the ship's own frame at its base size (forward, right),
 * in the order they are earned: rear pair first, then the front pair.
 */
export const TURRET_MOUNTS: readonly { forward: number; right: number }[] = [
  { forward: -14, right: -24 },
  { forward: -14, right: 24 },
  { forward: 10, right: -32 },
  { forward: 10, right: 32 },
];

/** Turret shots travel with side = TURRET_SIDE + turret index (main guns use -1 and 1). */
export const TURRET_SIDE = 10;

/** World position of turret i on ship s. Mounts move out as the ship grows. */
export function turretPosition(s: ShipState, i: number, tune: Tune): { x: number; y: number } {
  const m = (TURRET_MOUNTS_BY_CHASSIS[s.chassis] ?? TURRET_MOUNTS)[i];
  const grow = powerGrowth(s.hullMax, tune);
  const c = Math.cos(s.heading);
  const sn = Math.sin(s.heading);
  return {
    x: wrap(s.x + (c * m.forward - sn * m.right) * grow, tune.world.width),
    y: wrap(s.y + (sn * m.forward + c * m.right) * grow, tune.world.height),
  };
}

/** Turrets a ship fires with: those bought, or the ship's own escorts if it has more (Battlecruiser). */
export function turretCount(s: ShipState, tune: Tune): number {
  return Math.min(4, Math.max(s.turrets, chassisStats(s.chassis, tune).baseTurrets));
}
