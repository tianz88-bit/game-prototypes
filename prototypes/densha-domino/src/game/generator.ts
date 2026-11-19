import { DEFAULT_RULES, type RuleOptions, applyTap, canRun, initialState, isCleared, legalMoves } from './rules';
import { solve } from './solver';
import type { Axis, Dir, Level, Move, ObstacleKind, State, TrainDef } from './types';

/**
 * Backwards level generator.
 *
 * Instead of guessing boards and testing them, it builds them from the finish:
 *  1. Obstacles are scattered.
 *  2. The CLIMAX is built first: trains are added one at a time while a single tap still
 *     sends every one of them off, so the last tap of the solution is a long chain.
 *  3. Blockers are added one at a time. Each is only kept if some tap on it, played
 *     before the existing plan, still clears the board. So every board is solvable by
 *     construction and the plan is a known solution (an upper bound on par).
 * The plan is replayed with the real rules, so rule changes cannot make it lie.
 */

export interface GenSpec {
  cols: number;
  rows: number;
  /** Total trains on the board. */
  trains: number;
  maxLen: number;
  obstacles: number;
  /** Trains cleared by the final tap (the climax chain). */
  climax: number;
  /** Smallest acceptable par. */
  minPar: number;
  seed: number;
}

export interface GenResult {
  rows: string[];
  axis: Record<string, Axis>;
  /** Fixed head directions, serialized with the puzzle and used by the solver. */
  head: Record<string, Dir>;
  /** Taps in the intended solution (an upper bound on par). */
  planLength: number;
  /** Exact par if the solver finished, otherwise the plan length. */
  par: number;
  exact: boolean;
  /** Trains sent off by the last tap of the plan. */
  climaxLinks: number;
  /** Trains sent off by each tap of the plan, in order. */
  linksPerTap: number[];
  plan: Move[];
  attempts: number;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OBSTACLE_KINDS: ObstacleKind[] = ['concrete', 'kiosk', 'signal', 'tree', 'machine'];

function makeLevel(cols: number, rows: number, obstacles: Map<number, ObstacleKind>, trains: TrainDef[]): Level {
  return { name: 'gen', cols, rows, obstacles, trains };
}

function occupied(level: Level): Set<number> {
  const s = new Set<number>(level.obstacles.keys());
  for (const t of level.trains)
    for (let i = 0; i < t.len; i++) s.add(t.axis === 'h' ? t.line * level.cols + t.start + i : (t.start + i) * level.cols + t.line);
  return s;
}

/** Replays a plan with the real rules. Returns the moves that did something and their link counts. */
function replay(level: Level, plan: Move[], rules: RuleOptions): { state: State; moves: Move[]; links: number[] } {
  let state = initialState(level);
  const moves: Move[] = [];
  const links: number[] = [];
  for (const m of plan) {
    if (!canRun(level, state, m.train, m.dir)) continue;
    const r = applyTap(level, state, m, rules);
    state = r.state;
    moves.push(m);
    links.push(r.exited);
  }
  return { state, moves, links };
}

export function generate(spec: GenSpec, rules: RuleOptions = DEFAULT_RULES, maxAttempts = 60): GenResult | null {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = tryGenerate({ ...spec, seed: spec.seed * 1000 + attempt }, rules);
    if (res) return { ...res, attempts: attempt };
  }
  return null;
}

function tryGenerate(spec: GenSpec, rules: RuleOptions): GenResult | null {
  const rand = rng(spec.seed);
  const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];
  const obstacles = new Map<number, ObstacleKind>();
  for (let i = 0; i < spec.obstacles; i++) {
    const cell = Math.floor(rand() * spec.cols * spec.rows);
    obstacles.set(cell, pick(OBSTACLE_KINDS));
  }
  let trains: TrainDef[] = [];

  const randomTrain = (id: number, lengthBias: number): TrainDef | null => {
    const axis: Axis = rand() < 0.5 ? 'h' : 'v';
    const len = rand() < lengthBias ? 1 + Math.floor(rand() * spec.maxLen) : 1 + Math.floor(rand() * Math.min(2, spec.maxLen));
    const along = axis === 'h' ? spec.cols : spec.rows;
    const across = axis === 'h' ? spec.rows : spec.cols;
    if (len > along) return null;
    return { id, letter: String.fromCharCode(65 + id), color: 0, axis, line: Math.floor(rand() * across), start: Math.floor(rand() * (along - len + 1)), len, headDir: rand() < .5 ? -1 : 1 };
  };
  const fits = (t: TrainDef, level: Level): boolean => {
    const occ = occupied(level);
    for (let i = 0; i < t.len; i++) {
      const cell = t.axis === 'h' ? t.line * spec.cols + t.start + i : (t.start + i) * spec.cols + t.line;
      if (occ.has(cell)) return false;
    }
    return true;
  };

  // 1. Climax chain: every addition must keep "one tap clears everything".
  let plan: Move[] = [];
  let guard = 0;
  while (trains.length < spec.climax && guard++ < 400) {
    const t = randomTrain(trains.length, 0.6);
    if (!t) continue;
    const cur = makeLevel(spec.cols, spec.rows, obstacles, trains);
    if (!fits(t, cur)) continue;
    const next = [...trains, t];
    const lv = makeLevel(spec.cols, spec.rows, obstacles, next);
    const winner = legalMoves(lv, initialState(lv)).find((m) => isCleared(applyTap(lv, initialState(lv), m, rules).state));
    if (!winner) continue;
    // Prefer genuine chains: when there is more than one train the tap must run them all.
    trains = next;
    plan = [winner];
  }
  if (trains.length < spec.climax) return null;

  // 2. Blockers, built backwards. Each must make the plan one tap longer.
  guard = 0;
  while (trains.length < spec.trains && guard++ < 1500) {
    const t = randomTrain(trains.length, 0.4);
    if (!t) continue;
    const cur = makeLevel(spec.cols, spec.rows, obstacles, trains);
    if (!fits(t, cur)) continue;
    const next = [...trains, t];
    const lv = makeLevel(spec.cols, spec.rows, obstacles, next);
    const before = replay(lv, plan, rules);
    if (isCleared(before.state)) continue; // the new train changed nothing
    const first = legalMoves(lv, initialState(lv));
    for (let i = first.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [first[i], first[j]] = [first[j], first[i]];
    }
    for (const m of first) {
      const r = replay(lv, [m, ...plan], rules);
      if (isCleared(r.state) && r.moves.length > plan.length) {
        trains = next;
        plan = r.moves;
        break;
      }
    }
  }
  if (trains.length < spec.trains) return null;

  const level = makeLevel(spec.cols, spec.rows, obstacles, trains);
  const final = replay(level, plan, rules);
  if (!isCleared(final.state)) return null;
  const linksPerTap = final.links;
  const climaxLinks = linksPerTap[linksPerTap.length - 1];
  if (climaxLinks < spec.climax || climaxLinks < Math.max(...linksPerTap)) return null;

  // Exact par when the solver can finish quickly; the plan is an upper bound otherwise.
  const sol = solve(level, initialState(level), 120000, rules);
  const exact = !sol.truncated && sol.par > 0;
  const par = exact ? sol.par : final.moves.length;
  if (par < spec.minPar) return null;

  const grid: string[][] = Array.from({ length: spec.rows }, () => Array<string>(spec.cols).fill('.'));
  const glyph: Record<ObstacleKind, string> = { concrete: '#', kiosk: 'k', signal: 's', tree: 't', machine: 'm', buffer: 'b' };
  for (const [cell, kind] of obstacles) grid[Math.floor(cell / spec.cols)][cell % spec.cols] = glyph[kind];
  const axis: Record<string, Axis> = {};
  const head: Record<string, Dir> = {};
  for (const t of trains) {
    axis[t.letter] = t.axis;
    head[t.letter] = t.headDir;
    for (let i = 0; i < t.len; i++) {
      if (t.axis === 'h') grid[t.line][t.start + i] = t.letter;
      else grid[t.start + i][t.line] = t.letter;
    }
  }
  return { rows: grid.map((r) => r.join('')), axis, head, planLength: final.moves.length, par, exact, climaxLinks, linksPerTap, plan: final.moves, attempts: 0 };
}

export type { Dir };
