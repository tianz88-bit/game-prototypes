import type { Axis, Level, ObstacleKind, TrainDef } from './types';

// Liveries (index = train letter order). Generic colours, no real line branding.
export const LIVERIES = [0xff7a59, 0x4d9bff, 0x5ed957, 0xffd04a, 0xff6fb5, 0xb45cff, 0x2ed3c6, 0xe8434f, 0x8fa3d1, 0xffa23a];

const OBSTACLES: Record<string, ObstacleKind> = { '#': 'concrete', k: 'kiosk', s: 'signal', t: 'tree', m: 'machine', b: 'buffer' };

/**
 * Builds a level from text rows.
 *   .  empty        #  concrete      k kiosk     s signal     t tree     m vending machine     b buffer stop
 *   A-Z  one train: all cells with the same letter, in a straight line.
 * A one-cell train needs its direction in `axis` (h or v); longer trains are read from their cells.
 */
export function parseLevel(name: string, rows: string[], axis: Record<string, Axis> = {}): Level {
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
    trains.push({ id: trains.length, letter, color: LIVERIES[i % LIVERIES.length], axis: ax, line: ax === 'h' ? cs[0][1] : cs[0][0], start: idx[0], len: idx.length });
  });
  return { name, cols: w, rows: h, obstacles, trains };
}

export interface LevelSource {
  name: string;
  rows: string[];
  axis?: Record<string, Axis>;
}

/** Hand-authored levels. Each is checked by the solver in scripts/check-densha-levels. */
export const LEVEL_SOURCES: LevelSource[] = [
  // 1. One train, one way out: tap it.
  { name: 'First Departure', rows: ['.....', '.....', 'bAA..', '.....', '.....'] },
  // 2. Tap the back train: it bumps the front one, which takes off, and follows it out.
  { name: 'Follow the Leader', rows: ['.....', '.....', 'bA.B.', '.....', '.....'], axis: { A: 'h', B: 'h' } },
  // 3 to 10 were found by a search under the current rules (side bumps chain too) and
  // proved solvable by the solver; see scripts/check-densha-levels.mjs.
  { name: 'Shibuya Siding', rows: ['#.CAA', '..#..', '.B..#', '.B...', '.....'], axis: { C: 'h' } },
  { name: 'Ueno Yard', rows: ['k..C.', 's.BBB', 't....', '....D', 'mA..D'], axis: { A: 'h', C: 'v' } },
  { name: 'Kyoto Crossing', rows: ['.t....', '.D#...', '...m..', '..#B.E', '#..BAE', 'CCCB.E'], axis: { A: 'h', D: 'v' } },
  { name: 'Nagoya Junction', rows: ['b.bFFF', '......', '.B....', 'CCC#.A', '#..EEA', '...sD.'], axis: { B: 'v', D: 'v' } },
  { name: 'Sapporo Sidings', rows: ['.mDGC.', '#.DG..', 't.DGEE', '.BDs..', '.B#...', 'mB.AAA', '.FF...'], axis: { C: 'h' } },
  { name: 'Osaka Loop', rows: ['HbEb...', 'H.EDA#.', 'H.E.A..', '..E.G..', '.F.#GCC', '.F..Gk.', 'BBBm.#.'], axis: { D: 'h' } },
  { name: 'Hakata Depot', rows: ['..EDDm.', '.FEHHHH', '.FE#..t', '#FGBBBB', '.FG...b', '....t.#', 'm...CCA'], axis: { A: 'v' } },
  { name: 'Tokyo Terminal', rows: ['.B.FFFG', '.B#.k.E', '.BI.##E', 'DBI...E', 'DBIC.mE', 'D#I#..E', 'D.I...s', 'DHAAAAA'], axis: { C: 'h', G: 'h', H: 'v' } },
];

export const LEVELS: Level[] = LEVEL_SOURCES.map((s) => parseLevel(s.name, s.rows, s.axis));
