import type { Hex, MapConfig, MapShape } from './model';
export type { MapConfig, MapShape } from './model';

export const MAP_SHAPES: readonly MapShape[] = ['open', 'narrows', 'forks', 'ring'];
const DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
const distance = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

export function normalizeMapConfig(config: MapConfig): Required<MapConfig> {
  const { radius, hqQ, hqR } = config, shape = config.shape === undefined ? 'open' : config.shape, seed = config.seed === undefined ? 1 : config.seed;
  if (!Number.isInteger(radius) || radius < 2 || radius > 64 || !Number.isInteger(hqQ) || !Number.isInteger(hqR) ||
    distance(hqQ, hqR) > radius || hqQ === 0 && hqR === 0) throw new Error('Invalid map geometry');
  if (!MAP_SHAPES.includes(shape) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid map shape or uint32 seed');
  return { radius, hqQ, hqR, shape, seed };
}

/** Full bounding grid. Gaps remain addressable for rendering and flying rays.
 * Pair-based noise gives exact 180-degree symmetry without any global RNG. */
export function generateMap(config: MapConfig): Hex[] {
  const { radius, hqQ, hqR, shape, seed } = normalizeMapConfig(config);
  const noise = (q: number, r: number) => {
    if (q < 0 || q === 0 && r < 0) { q = -q; r = -r; }
    let n = Math.imul(q + 71, 0x45d9f3b) ^ Math.imul(r + 131, 0x119de1f3) ^ seed;
    n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return (n ^ n >>> 16) >>> 0;
  };
  const cells: Hex[] = [];
  for (let q = -radius; q <= radius; q++) for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
    const d = distance(q, r), n = noise(q, r);
    const protectedStart = Math.min(distance(q - hqQ, r - hqR), distance(q + hqQ, r + hqR)) <= 2;
    let gap = false;
    if (!protectedStart) {
      // Open/1 is the original uncut hexagon, including stable coordinate order.
      if (shape !== 'open' || seed !== 1) gap = d === radius && n % 4 === 0;
      if (shape === 'narrows') gap ||= Math.abs(q) <= 1 + seed % 2 && r !== 0 && (Math.abs(q) < 1 + seed % 2 || n % 3 !== 0);
      if (shape === 'forks') gap ||= Math.abs(q) <= 3 && Math.abs(r) < 2 + seed % 2;
      if (shape === 'ring') gap ||= d <= 2 + seed % 2;
    }
    cells.push({ id: `${q},${r}`, q, r, owner: null, burnt: false, lockedBy: null, capture: 0, capturePlayer: null, ...(gap ? { gap: true } : {}) });
  }
  const byId = new Map(cells.map(h => [h.id, h]));
  const from = `${-hqQ},${-hqR}`, to = `${hqQ},${hqR}`;
  const route = (landOnly: boolean) => {
    const queue = [from], previous = new Map<string, string | null>([[from, null]]);
    for (let i = 0; i < queue.length; i++) {
      const h = byId.get(queue[i])!; if (h.id === to) return previous;
      for (const [dq, dr] of DIRECTIONS) {
        const next = byId.get(`${h.q + dq},${h.r + dr}`);
        if (!next || previous.has(next.id) || landOnly && next.gap) continue;
        previous.set(next.id, h.id); queue.push(next.id);
      }
    }
    return null;
  };
  // Contour changes can never isolate either start; mirror any repair as well.
  if (!route(true)) {
    const previous = route(false)!;
    for (let id: string | null = to; id !== null; id = previous.get(id) ?? null) {
      const h = byId.get(id)!; delete h.gap; delete byId.get(`${-h.q},${-h.r}`)!.gap;
    }
  }
  return cells;
}
