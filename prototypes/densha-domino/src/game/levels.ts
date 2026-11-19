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

/** Hand-authored levels. Each is checked by the solver in scripts/check-densha-levels. */
export const LEVEL_SOURCES: LevelSource[] = [
  // 1. One train, one way out: tap it.
  { name: 'First Departure', rows: ['.....', '.....', 'bAA..', '.....', '.....'] },
  // 2. Tap the back train: it bumps the front one, which takes off, and follows it out.
  { name: 'Follow the Leader', rows: ['.....', '.....', 'bA.B.', '.....', '.....'], axis: { A: 'h', B: 'h' } },
  // One swipe starts a three-train relay around a corner.
  { name: 'Round the Corner', rows: ['.....','...CC','.....','bA.B.','.....'], axis: { A:'h', B:'v' }, head: { A:1, B:-1, C:1 } },
  // 4 to 11 were found by a search under the current rules (any bump sets the other train off and the
  // bumper follows once its way is clear) and proved solvable by the solver; see
  // scripts/check-densha-levels.mjs. They are tuned for `rules.followAfterSide` = 1.
  { name: 'Shibuya Siding', rows: ['.A..b', '.A...', '.....', 'DDs..', 's.BBC'], axis: { C: 'h' } },
  { name: 'Ueno Yard', rows: ['m.DD.', 'BEA.b', '.E..m', '...C.', '...C.', 'k..C.'], axis: { A: 'h', B: 'h' } },
  { name: 'Kyoto Crossing', rows: ['##D...', '..D..C', '..D..t', '.A..Fb', 'sAEEFB', '....F.'], axis: { B: 'h', C: 'h' } },
  { name: 'Nagoya Junction', rows: ['....F.', '...bD.', '.Bt...', 'stb...', '....G.', 'EAA..s', '....CC'], axis: { B: 'v', D: 'v', E: 'h', F: 'v', G: 'h' } },
  { name: 'Sapporo Sidings', rows: ['.b...#.', '.b.b.A.', '...EFA.', '.DDE.AB', '.CCE...', '#.H.m..', '.GH...k'], axis: { B: 'h', F: 'v', G: 'v' } },
  { name: 'Osaka Loop', rows: ['b.E..H.', '.bE.bDG', 'C.EmsDG', 'C....D.', 'CIII.D#', 'CABB#..', '.k.FFFF'], axis: { A: 'h', H: 'v' } },
  { name: 'Hakata Depot', rows: ['.FFF.B.', 'H.b.mB.', 'HDDD.Bs', 'H#A..Bm', '.#ACCCG', '..A..sG', '..AbI.G', '.E.JJJJ'], axis: { E: 'h', I: 'v' } },
  { name: 'Tokyo Terminal', rows: ['HCCCCJJ', '..bs.tK', '......K', 'BBBB#.K', 'A..##Dk', 'A..k.Ds', 'AGFFFFF', 'A.EIII.'], axis: { E: 'v', G: 'h', H: 'v' } },
];

export const LEVELS: Level[] = [...LEVEL_SOURCES, ...PACK].map((s) => {
  const repair=s.quality?undefined:LEVEL_REPAIRS[s.name];
  return parseLevel(s.name, repair?.rows??s.rows, repair?.axis??s.axis, repair?.head??s.head);
});
