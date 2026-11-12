// Auto turrets: a ship earns one for every turret.massPerTurret of minerals above its starting hull,
// up to turret.max. Each turret turns toward the nearest enemy ship or asteroid inside turret.range
// at no more than turret.turnRate, and fires small, weak shots once it is lined up. Losing minerals
// loses turrets. Pure rules: the server runs them; clients only draw what the server reports.
import type { Tune } from './tune';
import { shipRadius } from './ship';
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

export function turretCount(hp: number, tune: Tune): number {
  const t = tune.turret;
  if (t.massPerTurret <= 0) return 0;
  return Math.max(0, Math.min(t.max, TURRET_MOUNTS.length, Math.floor((hp - tune.ship.maxHp) / t.massPerTurret)));
}

/** World position of turret i on ship s. Mounts move out as the ship grows. */
export function turretPosition(s: ShipState, i: number, tune: Tune): { x: number; y: number } {
  const m = TURRET_MOUNTS[i];
  const grow = shipRadius(s.hp, tune) / tune.ship.radius;
  const c = Math.cos(s.heading);
  const sn = Math.sin(s.heading);
  return {
    x: wrap(s.x + (c * m.forward - sn * m.right) * grow, tune.world.width),
    y: wrap(s.y + (sn * m.forward + c * m.right) * grow, tune.world.height),
  };
}
