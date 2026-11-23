import { parseLevel } from './levels';
import { DEFAULT_RULES, type RuleOptions, applyTap, canRun, initialState, isCleared, legalMoves } from './rules';
import { solve } from './solver';
import { tune } from '../tune';
import type { Axis, Dir, Level, Move, ObstacleKind, State } from './types';

/**
 * Tightness rules for generated levels (owner request, 20 November 2026):
 *  1. One clever line: at most `maxFirstOptimal` different optimal first moves.
 *  2. No dead pieces: every train is part of a bump (as runner or target) in the solution,
 *     and every obstacle is load-bearing (removing it lowers par or changes the solution).
 *  3. A trap: greedy play (always take the move that sends the most trains off now)
 *     needs at least `trapMargin` more moves than par, or gets stuck.
 *  4. Denser boards: train cells fill at least `minDensity` of the board, and at most one
 *     row or column is unused.
 *  5. Bigger finale: the last move of the solution is its biggest chain and sends off at
 *     least `finaleShare` of all trains (minimum 3).
 *  6. Smooth ramp: `difficulty` scores each board; the pack builder orders boards by it.
 *  7. Two chains (owner, 20 November 2026): the solution has at least `minChains` moves that send two or
 *     more trains off, and there are more trains than the move limit (par + tune.rules.limitSlack), so
 *     clearing trains one at a time always runs out of moves.
 * Decor taste: obstacles that are not load-bearing are removed, the rest never touch
 * (not even diagonally) and use a small, consistent set of props per board.
 */
export interface TightRules {
  maxFirstOptimal: number;
  trapMargin: number;
  minDensity: number;
  finaleShare: number;
  maxStates: number;
  minChains: number;
  /** Owner, 22 November 2026: setup and payoff. Minimum tempting wrong chains along the solution. */
  minTraps: number;
  /** Share of trains with one end of their track permanently blocked (a single exit). */
  minSingleExit: number;
  /** Owner, 23 November 2026: setup chains (3+ trains moved, none cleared) required before the payoff. */
  minSetupChains: number;
}

export const TIGHT_RULES: TightRules = { maxFirstOptimal: 2, trapMargin: 2, minDensity: 0.36, finaleShare: 0.4, maxStates: 160000, minChains: 2, minTraps: 4, minSingleExit: 0.3, minSetupChains: 0 };

/**
 * Move labels for a solution: singles (one train off, no bump: boring), setups (nothing off: repositioning),
 * reverses (setups driving a train away from its face), payoffs (3+ off right after a setup), chains, biggest.
 */
export function planLabels(level: Level, plan: Move[], rules: RuleOptions = DEFAULT_RULES) {
  let state = initialState(level);
  let singles = 0, setups = 0, reverses = 0, payoffs = 0, chains = 0, biggest = 0, setupChains = 0, prevSetup = false;
  for (const m of plan) {
    const r = applyTap(level, state, m, rules);
    const bumps = r.events.filter((e) => e.type === 'hit').length;
    if (r.exited === 0) { setups++; if (m.dir !== level.trains[m.train].headDir) reverses++; if (r.links >= 3) setupChains++; }
    else if (r.exited === 1 && bumps === 0) singles++;
    if (r.exited >= 2) chains++;
    if (r.exited >= 3 && prevSetup) payoffs++;
    prevSetup = r.exited === 0;
    biggest = Math.max(biggest, r.exited);
    state = r.state;
  }
  return { singles, setups, reverses, payoffs, chains, biggest, setupChains };
}

/** Share of trains whose track is permanently blocked by an obstacle on exactly one side (a single exit). */
export function singleExitShare(level: Level): number {
  let single = 0;
  for (const t of level.trains) {
    const blocked = ([-1, 1] as Dir[]).filter((side) => {
      const along = t.axis === 'h' ? level.cols : level.rows;
      for (let i = side < 0 ? t.start - 1 : t.start + t.len; i >= 0 && i < along; i += side) {
        const cell = t.axis === 'h' ? t.line * level.cols + i : i * level.cols + t.line;
        if (level.obstacles.has(cell)) return true;
      }
      return false;
    }).length;
    if (blocked === 1) single++;
  }
  return single / Math.max(1, level.trains.length);
}

/** Complexity used to order levels (easiest first). */
export function complexity(m: { par: number; setups: number; reverses: number; traps: number; biggest: number; states: number; trains: number }): number {
  return m.par + 0.8 * m.setups + 0.5 * m.reverses + 0.12 * m.traps + 0.25 * m.biggest + 0.15 * Math.log2(Math.max(2, m.states)) + 0.05 * m.trains;
}

export interface Board {
  rows: string[];
  axis: Record<string, Axis>;
  head: Record<string, Dir>;
}

export interface TightResult extends Board {
  setups: number; reverses: number; payoffs: number; singles: number; chains: number; biggest: number; traps: number;
  par: number;
  plan: Move[];
  linksPerTap: number[];
  finale: number;
  maxChain: number;
  firstOptimal: number;
  greedySteps: number;
  greedyStuck: boolean;
  states: number;
  density: number;
  obstacles: number;
  difficulty: number;
}

const toLevel = (b: Board): Level => parseLevel('quality', b.rows, b.axis, b.head);

/** Replays the plan; returns exits per tap and which trains took part in a bump. */
function replayPlan(level: Level, plan: Move[], rules: RuleOptions): { cleared: boolean; exits: number[]; bumped: Set<number> } | null {
  let state = initialState(level);
  const exits: number[] = [];
  const bumped = new Set<number>();
  for (const m of plan) {
    if (!canRun(level, state, m.train, m.dir)) return null;
    const r = applyTap(level, state, m, rules);
    for (const e of r.events) if (e.type === 'hit') { bumped.add(e.runner); bumped.add(e.target); }
    exits.push(r.exited);
    state = r.state;
  }
  return { cleared: isCleared(state), exits, bumped };
}

/** Explores every reachable state; distances to the cleared board give exact par, optimal first moves and the greedy trap. */
export function analyze(level: Level, rules: RuleOptions = DEFAULT_RULES, maxStates = TIGHT_RULES.maxStates):
  { par: number; firstOptimal: number; greedySteps: number; greedyStuck: boolean; states: number; plan: Move[]; traps: number } | null {
  const ids = new Map<string, number>();
  const states: State[] = [];
  const edges: { to: number; move: Move; exited: number; links: number }[][] = [];
  // Compact key: one character per train position (positions are small integers, -1 for gone).
  const key = (s: State): string => String.fromCharCode(...s.map((p) => p + 2));
  const add = (s: State): number => {
    const k = key(s);
    let id = ids.get(k);
    if (id === undefined) { id = states.length; ids.set(k, id); states.push(s); edges.push([]); }
    return id;
  };
  add(initialState(level));
  for (let i = 0; i < states.length; i++) {
    if (states.length > maxStates) return null;
    const s = states[i];
    if (isCleared(s)) continue;
    for (const m of legalMoves(level, s)) {
      const r = applyTap(level, s, m, rules);
      edges[i].push({ to: add(r.state), move: m, exited: r.exited, links: r.links });
    }
  }
  const goal = ids.get(key(level.trains.map(() => -1)));
  if (goal === undefined) return null;
  const preds: number[][] = states.map(() => []);
  edges.forEach((list, from) => list.forEach((e) => preds[e.to].push(from)));
  const dist = new Int32Array(states.length).fill(-1);
  dist[goal] = 0;
  const queue = [goal];
  for (let q = 0; q < queue.length; q++) for (const p of preds[queue[q]]) if (dist[p] < 0) { dist[p] = dist[queue[q]] + 1; queue.push(p); }
  const par = dist[0];
  if (par <= 0) return null;
  const firstOptimal = new Set(edges[0].filter((e) => dist[e.to] === par - 1).map((e) => e.move.train + ':' + e.move.dir)).size;
  // Greedy player: always the move that sends the most trains off now, then the one that runs the most trains.
  let at = 0, greedySteps = 0, greedyStuck = false;
  while (at !== goal) {
    const options = edges[at];
    if (!options.length || dist[at] < 0 || greedySteps > par + 12) { greedyStuck = true; break; }
    const best = options.reduce((a, b) => (b.exited > a.exited || (b.exited === a.exited && b.links > a.links) ? b : a));
    at = best.to;
    greedySteps++;
  }
  if (dist[at] < 0) greedyStuck = true;
  // Best optimal solution: among all shortest solutions, the one whose last move sends the most trains off.
  const onPath = new Uint8Array(states.length);
  onPath[0] = 1;
  const order = [0];
  for (let q = 0; q < order.length; q++) for (const e of edges[order[q]]) if (dist[e.to] === dist[order[q]] - 1 && !onPath[e.to]) { onPath[e.to] = 1; order.push(e.to); }
  let lastFrom = -1, lastEdge: (typeof edges)[number][number] | null = null;
  for (const i of order) if (dist[i] === 1) for (const e of edges[i]) if (e.to === goal && (!lastEdge || e.exited > lastEdge.exited || (e.exited === lastEdge.exited && e.links > lastEdge.links))) { lastEdge = e; lastFrom = i; }
  if (!lastEdge) return null;
  const plan: Move[] = [lastEdge.move];
  const path = [lastFrom];
  for (let cur = lastFrom; cur !== 0; ) {
    const p = preds[cur].find((from) => onPath[from] && dist[from] === dist[cur] + 1)!;
    plan.unshift(edges[p].find((e) => e.to === cur)!.move);
    path.unshift(p);
    cur = p;
  }
  // Traps: at every step of that solution, moves that send 2+ trains off now but are not on a shortest path.
  let traps = 0;
  for (const id of path) for (const e of edges[id]) if (e.exited >= 2 && dist[e.to] !== dist[id] - 1) traps++;
  return { par, firstOptimal, greedySteps, greedyStuck, states: states.length, plan, traps };
}

const OBSTACLE_GLYPHS = new Set(['#', 'k', 's', 't', 'm', 'b']);
const ACCENTS: { kind: ObstacleKind; glyph: string }[] = [
  { kind: 'buffer', glyph: 'b' }, { kind: 'tree', glyph: 't' }, { kind: 'kiosk', glyph: 'k' }, { kind: 'machine', glyph: 'm' },
];

/** Board cells, rows and columns that trains actually use. */
function usage(level: Level): { density: number; unusedLines: number } {
  let cells = 0;
  const rowsUsed = new Set<number>(), colsUsed = new Set<number>();
  for (const t of level.trains) {
    cells += t.len;
    if (t.axis === 'h') { rowsUsed.add(t.line); for (let i = 0; i < t.len; i++) colsUsed.add(t.start + i); }
    else { colsUsed.add(t.line); for (let i = 0; i < t.len; i++) rowsUsed.add(t.start + i); }
  }
  return { density: cells / (level.cols * level.rows), unusedLines: level.rows - rowsUsed.size + level.cols - colsUsed.size };
}

/**
 * Checks a generated board and its intended solution against the tightness rules.
 * Returns the tidied board (dead obstacles removed, props chosen) with its metrics, or the reason it failed.
 */
export function tighten(board: Board, seed: number, rules: RuleOptions = DEFAULT_RULES, tight: TightRules = TIGHT_RULES): TightResult | { reject: string } {
  let level = toLevel(board);
  const n = level.trains.length;
  const use = usage(level);
  if (use.density < tight.minDensity) return { reject: 'density' };
  if (use.unusedLines > 1) return { reject: 'unused-lines' };
  const first = analyze(level, rules, tight.maxStates);
  if (!first) return { reject: 'state-cap' };
  const plan = first.plan;
  const run = replayPlan(level, plan, rules);
  if (!run || !run.cleared) return { reject: 'plan' };
  const finale = run.exits[run.exits.length - 1];
  if (finale < Math.max(...run.exits) || finale < Math.max(3, Math.ceil(tight.finaleShare * n))) return { reject: 'finale' };
  if (run.bumped.size < n) return { reject: 'dead-train' };
  if (run.exits.filter((e) => e >= 2).length < tight.minChains) return { reject: 'one-chain' };
  if (n <= first.par + tune.rules.limitSlack) return { reject: 'singles-pass' };
  if (first.firstOptimal > tight.maxFirstOptimal) return { reject: 'many-solutions' };
  if (!first.greedyStuck && first.greedySteps < first.par + tight.trapMargin) return { reject: 'no-trap' };

  // Prune obstacles that do not matter: same par, same plan, same chain pattern without them.
  let rows = board.rows.slice();
  const cells: [number, number][] = [];
  rows.forEach((line, r) => [...line].forEach((ch, c) => { if (OBSTACLE_GLYPHS.has(ch)) cells.push([r, c]); }));
  for (const [r, c] of cells) {
    const trial = rows.slice();
    trial[r] = trial[r].slice(0, c) + '.' + trial[r].slice(c + 1);
    const lv = toLevel({ ...board, rows: trial });
    const again = replayPlan(lv, plan, rules);
    const same = again && again.cleared && again.exits.join() === run.exits.join();
    if (!same) continue;
    // Load-bearing means removing it makes the puzzle worse on any measure: par, unique opening, traps or
    // single exits. Only props that change nothing are removed.
    const now = toLevel({ ...board, rows });
    const before = analyze(now, rules, tight.maxStates), after = analyze(lv, rules, tight.maxStates);
    if (!before || !after) continue;
    const worse = after.par < before.par || after.firstOptimal > before.firstOptimal || after.traps < before.traps || singleExitShare(lv) < singleExitShare(now);
    if (!worse) rows = trial;
  }
  level = toLevel({ ...board, rows });
  const kept: [number, number][] = [];
  rows.forEach((line, r) => [...line].forEach((ch, c) => { if (OBSTACLE_GLYPHS.has(ch)) kept.push([r, c]); }));
  if (kept.length > Math.max(1, Math.ceil(n / 2))) return { reject: 'too-many-obstacles' };
  for (const [r, c] of kept) for (const [r2, c2] of kept) if ((r !== r2 || c !== c2) && Math.abs(r - r2) <= 1 && Math.abs(c - c2) <= 1) return { reject: 'clumped-obstacles' };

  const a = analyze(level, rules, tight.maxStates);
  if (!a) return { reject: 'state-cap' };
  if (a.par !== plan.length) return { reject: 'par' };
  if (a.firstOptimal > tight.maxFirstOptimal) return { reject: 'many-solutions' };
  if (!a.greedyStuck && a.greedySteps < a.par + tight.trapMargin) return { reject: 'no-trap' };
  const labels = planLabels(level, a.plan, rules);
  if (labels.singles > 0) return { reject: 'single-move' };
  if (labels.setups < 1) return { reject: 'no-setup' };
  if (labels.payoffs < 1) return { reject: 'no-payoff' };
  if (a.traps < tight.minTraps) return { reject: 'few-traps' };
  if (singleExitShare(level) < tight.minSingleExit) return { reject: 'two-exits' };
  if (labels.setupChains < tight.minSetupChains) return { reject: 'no-setup-chain' };
  const final = replayPlan(level, a.plan, rules)!;
  if (!final.cleared || final.bumped.size < n || final.exits[final.exits.length - 1] < Math.max(...final.exits)) return { reject: 'final-plan' };

  // Props with taste: blocks inside the board, one accent prop at the edges.
  const accent = ACCENTS[seed % ACCENTS.length];
  const height = rows.length, width = rows[0].length;
  rows = rows.map((line, r) => [...line].map((ch, c) => {
    if (!OBSTACLE_GLYPHS.has(ch)) return ch;
    const edge = r === 0 || c === 0 || r === height - 1 || c === width - 1;
    return edge ? accent.glyph : '#';
  }).join(''));

  const difficulty = complexity({ par: a.par, setups: labels.setups, reverses: labels.reverses, traps: a.traps, biggest: labels.biggest, states: a.states, trains: n });
  void finale;
  return {
    ...board, rows, par: a.par, plan: a.plan, linksPerTap: final.exits, finale: final.exits[final.exits.length - 1], maxChain: Math.max(...final.exits), firstOptimal: a.firstOptimal,
    greedySteps: a.greedySteps, greedyStuck: a.greedyStuck, states: a.states, density: use.density, obstacles: kept.length, difficulty,
    ...labels, traps: a.traps,
  };
}

// ---------------------------------------------------------------------------------------------
// Polishing: instead of rejecting near-misses, repair them with small edits until every rule holds.

interface Piece { axis: Axis; line: number; start: number; len: number; head: Dir }
interface Draft { cols: number; rows: number; trains: Piece[]; obstacles: Set<number> }

function draftOf(board: Board): Draft {
  const level = toLevel(board);
  return {
    cols: level.cols, rows: level.rows, obstacles: new Set(level.obstacles.keys()),
    trains: level.trains.map((t) => ({ axis: t.axis, line: t.line, start: t.start, len: t.len, head: t.headDir })),
  };
}

function boardOf(d: Draft): Board {
  const grid = Array.from({ length: d.rows }, () => Array<string>(d.cols).fill('.'));
  for (const cell of d.obstacles) grid[Math.floor(cell / d.cols)][cell % d.cols] = '#';
  const axis: Record<string, Axis> = {}, head: Record<string, Dir> = {};
  d.trains.forEach((t, i) => {
    const letter = String.fromCharCode(65 + i);
    axis[letter] = t.axis;
    head[letter] = t.head;
    for (let k = 0; k < t.len; k++) {
      if (t.axis === 'h') grid[t.line][t.start + k] = letter;
      else grid[t.start + k][t.line] = letter;
    }
  });
  return { rows: grid.map((r) => r.join('')), axis, head };
}

const cellsOf = (d: Draft, t: Piece): number[] => Array.from({ length: t.len }, (_, k) => (t.axis === 'h' ? t.line * d.cols + t.start + k : (t.start + k) * d.cols + t.line));

function valid(d: Draft): boolean {
  const used = new Set<number>(d.obstacles);
  for (const t of d.trains) {
    const along = t.axis === 'h' ? d.cols : d.rows, across = t.axis === 'h' ? d.rows : d.cols;
    if (t.len < 1 || t.len > 3 || t.start < 0 || t.start + t.len > along || t.line < 0 || t.line >= across) return false;
    for (const c of cellsOf(d, t)) { if (used.has(c)) return false; used.add(c); }
  }
  const obs = [...d.obstacles];
  for (const a of obs) {
    const ac = a % d.cols, ar = Math.floor(a / d.cols);
    if ((ac === 0 || ac === d.cols - 1) && (ar === 0 || ar === d.rows - 1)) return false;
    for (const b of obs) if (a !== b && Math.abs(ac - (b % d.cols)) <= 1 && Math.abs(ar - Math.floor(b / d.cols)) <= 1) return false;
  }
  return true;
}

/** How far a board is from passing every rule (0 = passes). */
export function violations(board: Board, minPar: number, rules: RuleOptions = DEFAULT_RULES, tight: TightRules = { ...TIGHT_RULES, maxStates: 60000 }): number {
  const level = toLevel(board);
  const n = level.trains.length;
  const use = usage(level);
  let v = Math.max(0, tight.minDensity - use.density) * 40 + Math.max(0, use.unusedLines - 1) * 1.5;
  const a = analyze(level, rules, tight.maxStates);
  if (!a) return 1000 + v;
  const run = replayPlan(level, a.plan, rules)!;
  const finale = run.exits[run.exits.length - 1];
  v += Math.max(0, Math.max(3, Math.ceil(tight.finaleShare * n)) - finale) * 2 + (finale < Math.max(...run.exits) ? 2 : 0);
  v += (n - run.bumped.size) * 1.5;
  v += Math.max(0, tight.minChains - run.exits.filter((e) => e >= 2).length) * 2;
  v += Math.max(0, a.par + tune.rules.limitSlack + 1 - n) * 1.5;
  v += Math.max(0, a.firstOptimal - tight.maxFirstOptimal);
  v += a.greedyStuck ? 0 : Math.max(0, a.par + tight.trapMargin - a.greedySteps);
  v += Math.max(0, minPar - a.par);
  const labels = planLabels(level, a.plan, rules);
  v += labels.singles * 1.5 + (labels.setups < 1 ? 2 : 0) + (labels.payoffs < 1 ? 2 : 0);
  v += Math.max(0, tight.minTraps - a.traps) * 0.3;
  v += Math.max(0, tight.minSingleExit - singleExitShare(level)) * n;
  v += Math.max(0, tight.minSetupChains - labels.setupChains) * 2.5;
  return v;
}

/** Repairs a generated board with small random edits (hill climbing on `violations`). */
export function polish(board: Board, seed: number, minPar: number, budget = 120, rules: RuleOptions = DEFAULT_RULES, tight: TightRules = TIGHT_RULES): Board | null {
  const repairTight = { ...tight, maxStates: 60000 };
  let rand = seed >>> 0;
  const r = () => { rand = (rand + 0x6d2b79f5) >>> 0; let t = rand; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (n: number) => Math.floor(r() * n);
  let best = draftOf(board), bestScore = violations(board, minPar, rules, repairTight);
  const targetTrains = best.trains.length;
  for (let step = 0; step < budget && bestScore > 0; step++) {
    const d: Draft = { ...best, trains: best.trains.map((t) => ({ ...t })), obstacles: new Set(best.obstacles) };
    const t = d.trains[pick(d.trains.length)];
    switch (pick(8)) {
      case 6: {
        // A stop at the end of a train's track: one exit only, so it needs room made elsewhere.
        const side = r() < 0.5 ? -1 : 1, along = t.axis === 'h' ? d.cols : d.rows;
        const i = side < 0 ? (r() < 0.6 ? 0 : t.start - 1) : (r() < 0.6 ? along - 1 : t.start + t.len);
        if (i >= 0 && i < along) d.obstacles.add(t.axis === 'h' ? t.line * d.cols + i : i * d.cols + t.line);
        break;
      }
      case 0: t.head = (t.head === 1 ? -1 : 1) as Dir; break;
      case 1: t.start += r() < 0.5 ? -1 : 1; break;
      case 2: if (r() < 0.5) { t.len += 1; if (r() < 0.5) t.start -= 1; } else t.len -= 1; break;
      case 3: { const cell = pick(d.cols * d.rows); if (d.obstacles.has(cell)) d.obstacles.delete(cell); else d.obstacles.add(cell); break; }
      case 4: if (d.obstacles.size) d.obstacles.delete([...d.obstacles][pick(d.obstacles.size)]); break;
      case 5: if (d.trains.length <= targetTrains) { const axis: Axis = r() < 0.5 ? 'h' : 'v', len = 1 + pick(3); d.trains.push({ axis, len, head: r() < 0.5 ? -1 : 1, line: pick(axis === 'h' ? d.rows : d.cols), start: pick((axis === 'h' ? d.cols : d.rows) - len + 1) }); } break;
      default: if (d.trains.length >= targetTrains && d.trains.length > 3) d.trains.splice(pick(d.trains.length), 1);
    }
    if (!valid(d)) continue;
    const b = boardOf(d), score = violations(b, minPar, rules, repairTight);
    if (score <= bestScore) { best = d; bestScore = score; }
  }
  return bestScore === 0 ? boardOf(best) : null;
}
