// Asteroids float over the planet in straight lines and wrap around it. Because the path is a
// straight line, a position is computed from the record, never integrated: the server sends an
// asteroid once (and again only when its hp changes) and every client works out where it is.
import type { Tune } from './tune';
import { wrap } from './wrap';

export interface Asteroid {
  id: number;
  /** 0 large, 1 medium, 2 small. */
  size: number;
  /** Position at tick t0. */
  x: number;
  y: number;
  /** Pixels per second. */
  vx: number;
  vy: number;
  t0: number;
  hp: number;
}

export const SMALLEST = 2;

/** Mass used for the planet's population target: large 4, medium 2, small 1. */
export function asteroidMass(size: number): number {
  return 4 >> size;
}

/** Where an asteroid is at a (possibly fractional) tick. */
export function asteroidPos(a: Asteroid, tick: number, tune: Tune): { x: number; y: number } {
  const t = (tick - a.t0) / tune.net.tickHz;
  return { x: wrap(a.x + a.vx * t, tune.world.width), y: wrap(a.y + a.vy * t, tune.world.height) };
}

/**
 * The two pieces of a destroyed asteroid. The split depends on the killing hit:
 * both pieces keep the parent's motion, are pushed along the hit direction in proportion to its
 * damage, and fly apart sideways, wider for a harder hit. rng adds a little variety.
 * Returns [] for the smallest size, which just breaks.
 */
export function splitAsteroid(
  a: Asteroid,
  at: { x: number; y: number },
  hitDirX: number,
  hitDirY: number,
  damage: number,
  tick: number,
  nextId: () => number,
  rng: () => number,
  tune: Tune,
): Asteroid[] {
  if (a.size >= SMALLEST) return [];
  const t = tune.asteroid;
  const len = Math.hypot(hitDirX, hitDirY) || 1;
  const dx = hitDirX / len;
  const dy = hitDirY / len;
  const push = t.splitPushPerDamage * damage;
  const spread = t.splitSpreadBase + t.splitSpreadPerDamage * damage;
  const size = a.size + 1;
  const offset = t.radius[size] * 0.7;
  const out: Asteroid[] = [];
  for (const side of [-1, 1]) {
    const j = 1 + (rng() * 2 - 1) * t.splitJitter;
    // Perpendicular to the hit: (-dy, dx).
    out.push({
      id: nextId(),
      size,
      x: wrap(at.x - dy * side * offset, tune.world.width),
      y: wrap(at.y + dx * side * offset, tune.world.height),
      vx: a.vx + dx * push - dy * side * spread * j,
      vy: a.vy + dy * push + dx * side * spread * j,
      t0: tick,
      hp: t.hp[size],
    });
  }
  return out;
}
