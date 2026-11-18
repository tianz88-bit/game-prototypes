// Human Nomad: Sparrow starter, Falcon/Bat unlockable sidegrades, in-run Battlecruiser.
// Each chassis has explicit movement values; Sparrow shares Falcon's tune.ship reference values.
// Shield/damage/fire are from the existing chassis groups. Gun positions come from the art kit
// footprint-proposals.json, game-local world units at the base size); collision radius and every
// stat are tuned values, never derived from the art size.
import type { Tune } from './tune';

export const CHASSIS = ['scrappy', 'interceptor', 'battlecruiser', 'sparrow', 'missileCruiser'] as const;
export type ChassisId = (typeof CHASSIS)[number];
export const SCRAPPY = 0;
export const INTERCEPTOR = 1;
export const BATTLECRUISER = 2;
// Keep the original numeric/ownership IDs stable through the Falcon and Bat display renames.
export const FALCON = SCRAPPY;
export const BAT = INTERCEPTOR;
export const SPARROW = 3;
export const MISSILE_CRUISER = 4;
export const isCapital = (c:number):boolean => c===BATTLECRUISER||c===MISSILE_CRUISER;

export interface ChassisStats {
  /** Hit radius before power growth. */
  radius: number;
  shield: number;
  damage: number;
  fireIntervalSteps: number;
  /** Turret drones the ship has without buying any (the Battlecruiser's escorts). */
  baseTurrets: number;
}

export function chassisStats(chassis: number, tune: Tune): ChassisStats {
  if (chassis === INTERCEPTOR || isCapital(chassis)) {
    const c = chassis === INTERCEPTOR ? tune.interceptor : chassis===MISSILE_CRUISER?tune.missileCruiser:tune.battlecruiser;
    return { radius: c.radius, shield: c.shieldFactor, damage: c.damageFactor, fireIntervalSteps: c.fireIntervalSteps, baseTurrets: c.baseTurrets };
  }
  return { radius: tune.ship.radius, shield: 1, damage: 1, fireIntervalSteps: chassis === SPARROW ? tune.sparrow.fireIntervalSteps : tune.weapon.fireIntervalSteps, baseTurrets: 0 };
}

/** How a ship moves (px/s, px/s², rad/s): its own values per ship type. */
export interface ShipMotion {
  minSpeed: number;
  cruiseSpeed: number;
  maxSpeed: number;
  acceleration: number;
  braking: number;
  turnRate: number;
}

export function shipMotion(chassis: number, tune: Tune): ShipMotion {
  const c = chassis === INTERCEPTOR ? tune.interceptor : chassis === BATTLECRUISER ? tune.battlecruiser : chassis===MISSILE_CRUISER?tune.missileCruiser:tune.ship;
  return { minSpeed: c.minSpeed, cruiseSpeed: c.cruiseSpeed, maxSpeed: c.maxSpeed, acceleration: c.acceleration, braking: c.braking, turnRate: c.turnRate };
}

export interface Mount {
  forward: number;
  right: number;
}

/**
 * Gun muzzles for the Interceptor and Battlecruiser (Scrappy keeps tune.weapon.muzzleForward/Side).
 * side: which gun, for recoil and bullet look: -1/1 inner pair, -2/2 the Battlecruiser's outer pair.
 * Guns fire in this order, one per shot.
 */
export const GUNS: Record<number, readonly (Mount & { side: number })[]> = {
  [INTERCEPTOR]: [
    { forward: 10.93, right: -16.38, side: -1 },
    { forward: 10.93, right: 16.38, side: 1 },
  ],
  [BATTLECRUISER]: [
    { forward: 81.07, right: -38.7, side: -1 },
    { forward: 81.07, right: 38.7, side: 1 },
    { forward: 81.07, right: -55.8, side: -2 },
    { forward: 81.07, right: 55.8, side: 2 },
  ],
};

/** Turret drone mounts (base size), up to four per ship. */
export const TURRET_MOUNTS_BY_CHASSIS: Record<number, readonly Mount[]> = {
  [MISSILE_CRUISER]: [{forward:-33.6,right:-33.6},{forward:-33.6,right:33.6},{forward:43.5,right:-33.6},{forward:43.5,right:33.6}],
  [SCRAPPY]: [
    { forward: -14, right: -24 },
    { forward: -14, right: 24 },
    { forward: 10, right: -32 },
    { forward: 10, right: 32 },
  ],
  [INTERCEPTOR]: [
    { forward: -14, right: -24 },
    { forward: -14, right: 24 },
    { forward: 10, right: -32 },
    { forward: 10, right: 32 },
  ],
  [BATTLECRUISER]: [
    { forward: -9, right: -36 },
    { forward: -9, right: 36 },
    { forward: 25.2, right: -36 },
    { forward: 25.2, right: 36 },
  ],
};

/** Shop upgrades bought so far (turret, shield, gun, missile and mine tiers). */
export function upgradeTotal(s: { turrets: number; shieldTier: number; damageTier: number; missileTier: number; mineTier: number }): number {
  return s.turrets + s.shieldTier + s.damageTier + s.missileTier + s.mineTier;
}
