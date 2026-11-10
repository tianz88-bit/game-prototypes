// The planet is a wrapping map: leaving one edge enters the opposite edge.
// Every distance and difference in the game goes through these helpers.

/** Position folded into [0, size). */
export function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}

/** Shortest signed difference a - b on a wrapping axis, in [-size/2, size/2). */
export function wrapDelta(a: number, b: number, size: number): number {
  return wrap(a - b + size / 2, size) - size / 2;
}

/** Shortest signed angle from b to a, in [-PI, PI). */
export function angleDelta(a: number, b: number): number {
  return wrap(a - b + Math.PI, Math.PI * 2) - Math.PI;
}

/** Squared wrapped distance between two points. */
export function wrapDist2(ax: number, ay: number, bx: number, by: number, w: number, h: number): number {
  const dx = wrapDelta(ax, bx, w);
  const dy = wrapDelta(ay, by, h);
  return dx * dx + dy * dy;
}
