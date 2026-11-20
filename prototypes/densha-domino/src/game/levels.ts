import { PACK } from './pack';
import type { Axis, Dir, Level, Move, ObstacleKind, TrainDef } from './types';
import { HEAD_DIRECTIONS } from './head-directions';
import {LEVEL_REPAIRS} from './level-repairs';

// Liveries (index = train letter order). Generic colours, no real line branding.
export const LIVERIES = [0xff7a59, 0x4d9bff, 0x5ed957, 0xffd04a, 0xff6fb5, 0xb45cff, 0x2ed3c6, 0xe8434f, 0x8fa3d1, 0xffa23a];

const OBSTACLES: Record<string, ObstacleKind> = { '#': 'concrete', k: 'kiosk', s: 'signal', t: 'tree', m: 'machine', b: 'buffer' };

/**
 * Builds a level from text rows.
 *   .  empty        #  concrete      k kiosk     s signal     t tree     m vending machine     b buffer stop
 *   A-Z  one train: all cells with the same letter, in a straight line.
 * A one-cell train needs its direction in `axis` (h or v); longer trains are read from their cells.
 */
export function parseLevel(name: string, rows: string[], axis: Record<string, Axis> = {}, head: Record<string, Dir> = HEAD_DIRECTIONS[name] ?? {}): Level {
  const h = rows.length;
  const w = rows[0].length;
  const obstacles = new Map<number, ObstacleKind>();
  const cells = new Map<string, [number, number][]>();
  rows.forEach((line, r) => {
    if (line.length !== w) throw new Error(`${name}: row ${r} has the wrong length`);
    [...line].forEach((ch, c) => {
      if (ch === '.') return;
      if (OBSTACLES[ch]) obstacles.set(r * w + c, OBSTACLES[ch]);
      else if (/[A-Z]/.test(ch)) cells.set(ch, [...(cells.get(ch) ?? []), [c, r]]);
      else throw new Error(`${name}: unknown character ${ch}`);
    });
  });
  const trains: TrainDef[] = [];
  [...cells.keys()].sort().forEach((letter, i) => {
    const cs = cells.get(letter)!;
    const sameRow = cs.every(([, r]) => r === cs[0][1]);
    const sameCol = cs.every(([c]) => c === cs[0][0]);
    if (!sameRow && !sameCol) throw new Error(`${name}: train ${letter} is not in a straight line`);
    const ax: Axis = cs.length === 1 ? axis[letter] ?? (() => { throw new Error(`${name}: train ${letter} needs an axis`); })() : sameRow ? 'h' : 'v';
    const idx = cs.map(([c, r]) => (ax === 'h' ? c : r)).sort((a, b) => a - b);
    if (idx[idx.length - 1] - idx[0] !== idx.length - 1) throw new Error(`${name}: train ${letter} has a gap`);
    trains.push({ id: trains.length, letter, color: LIVERIES[i % LIVERIES.length], axis: ax, line: ax === 'h' ? cs[0][1] : cs[0][0], start: idx[0], len: idx.length, headDir: head[letter] ?? 1 });
  });
  return { name, cols: w, rows: h, obstacles, trains };
}

export interface LevelSource {
  name: string;
  rows: string[];
  axis?: Record<string, Axis>;
  head?: Record<string, Dir>;
  quality?: {par:number;minChain:number;minFinal:number;plan:Move[]};
}

/** Hand-authored levels 1 to 6. Each has a proof in puzzle-contracts.ts, checked by scripts/check-densha-quality.mjs. */
export const LEVEL_SOURCES: LevelSource[] = [
  // 1. One train, one way out: tap it.
  { name: 'First Departure', rows: ['.....', '.....', 'bAA..', '.....', '.....'] },
  // 2. Tap the back train: it bumps the front one, which takes off, and follows it out.
  { name: 'Follow the Leader', rows: ['.....', '.....', 'bA.B.', '.....', '.....'], axis: { A: 'h', B: 'h' } },
  // One swipe starts a three-train relay around a corner.
  { name: 'Round the Corner', rows: ['.....','...CC','.....','bA.B.','.....'], axis: { A:'h', B:'v' }, head: { A:1, B:-1, C:1 } },
  // 4. Mind the Gap: a honked train needs room in front of its face. Train B faces up into C, so swiping A
  // first stalls (and A then shows "No room!"). Move C out to open a gap, then A's honk sends B off.
  { name: 'Mind the Gap', rows: ['.....', '.CC..', '.B...', '.B.AA', '.b...'], head: { A: -1, B: -1, C: -1 } },
  // 5. Double Departure: two chains. A's chain clears B, which opens a gap in front of C's face for D's chain.
  { name: 'Double Departure', rows: ['......', '.AA.B.', '....C.', 'DD..C.', '......'], axis: { B: 'h' }, head: { A: 1, B: 1, C: -1, D: 1 } },
  // 6. Kyoto Crossing, rebuilt (owner request, 20 November 2026) to meet the level 6+ rules: two setup moves,
  // a 3-train chain, then the original six-train finale. 9 trains, so clearing them one by one runs out of moves.
  { name: 'Kyoto Crossing', rows: ['II..G..', '..#DG..', '...DG.C', '...D...', '..A..F.', 'HsAEEFB', 'H....F.'],
    axis: { B: 'h', C: 'h', G: 'v', H: 'v', I: 'h' }, head: { A: 1, B: 1, C: 1, D: -1, E: 1, F: -1, G: -1, H: -1, I: 1 } },
];

/** Levels 1 to 5 teach one concept each (swipe, honk, head facing, gap needed, two chains); level 6 is Kyoto
 * Crossing. Levels 7 to 101 come from the generated pack (scripts/build-densha-pack.mjs), ordered by difficulty. */
export const FIXED_LEVELS = 6;
export const ALL_SOURCES: LevelSource[] = [...LEVEL_SOURCES.slice(0, FIXED_LEVELS), ...PACK];

export const LEVELS: Level[] = ALL_SOURCES.map((s) => {
  const repair=s.quality?undefined:LEVEL_REPAIRS[s.name];
  return parseLevel(s.name, repair?.rows??s.rows, repair?.axis??s.axis, repair?.head??s.head);
});
