// Clan home planet layout (owner, 15 November 2026, Clan planets v0). The treasury sits at the map
// centre; landing pads ring it; the base turrets ring those; a shield dome covers the treasury and
// the pads; the gate (where non-members arrive) is on the opposite side of the planet, which on the
// wrapping map is the corner (0, 0). Shared by the server simulation and the client's prediction,
// so docking predicts exactly.
import type { Tune } from './tune';
import type { ShipState } from './ship';
import { planetClan } from './planets';
import { wrap, wrapDelta } from './wrap';

export interface BaseLayout {
  clan: number;
  treasury: { x: number; y: number };
  pads: { x: number; y: number }[];
  turrets: { x: number; y: number }[];
  gate: { x: number; y: number };
}

/** Shot `side` values for base turrets (main guns use 0/1, ship turrets TURRET_SIDE + i). */
export const BASE_TURRET_SIDE = 40;
/** Bullets from base turrets have no ship as owner. */
export const BASE_OWNER = 0;

export function baseLayout(planet: string, tune: Tune): BaseLayout | null {
  const clan = planetClan(planet);
  if (!clan) return null;
  const b = tune.base;
  const W = tune.world.width;
  const H = tune.world.height;
  const cx = W / 2;
  const cy = H / 2;
  const ring = (n: number, r: number, turn: number): { x: number; y: number }[] =>
    Array.from({ length: n }, (_, i) => {
      const a = turn + (i / n) * Math.PI * 2;
      return { x: wrap(cx + Math.cos(a) * r, W), y: wrap(cy + Math.sin(a) * r, H) };
    });
  return {
    clan,
    treasury: { x: cx, y: cy },
    pads: ring(b.pads, b.padRing, -Math.PI / 2),
    turrets: ring(b.turrets, b.turretRing, -Math.PI / 2 + Math.PI / b.turrets),
    gate: { x: 0, y: 0 },
  };
}

const dist = (ax: number, ay: number, bx: number, by: number, tune: Tune): number =>
  Math.hypot(wrapDelta(ax, bx, tune.world.width), wrapDelta(ay, by, tune.world.height));

/** The pad a ship's centre is over, or -1. */
export function padUnder(layout: BaseLayout, s: { x: number; y: number }, tune: Tune): number {
  return layout.pads.findIndex((p) => dist(s.x, s.y, p.x, p.y, tune) <= tune.base.padRadius);
}

/**
 * The lowest speed a ship may slow to this step: 0 over one of its own clan's pads (landing),
 * otherwise the normal minimum (ships never stop anywhere else).
 */
export function speedFloor(layout: BaseLayout | null, clan: number, s: ShipState, tune: Tune): number {
  return layout && clan === layout.clan && padUnder(layout, s, tune) >= 0 ? 0 : tune.ship.minSpeed;
}

/** Docked: a member stopped (or nearly) over one of its clan's pads. Safe, repairing, unloading. */
export function isDocked(layout: BaseLayout | null, clan: number, s: ShipState, tune: Tune): boolean {
  return !!layout && clan === layout.clan && s.speed <= tune.base.dockSpeed && padUnder(layout, s, tune) >= 0;
}

/** Inside the shield dome over the treasury and the pads. */
export function insideDome(layout: BaseLayout, x: number, y: number, tune: Tune): boolean {
  return dist(x, y, layout.treasury.x, layout.treasury.y, tune) < tune.base.domeRadius;
}
