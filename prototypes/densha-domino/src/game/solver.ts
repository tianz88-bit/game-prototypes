import { DEFAULT_RULES, type RuleOptions, applyTap, initialState, isCleared, legalMoves, stateKey } from './rules';
import type { Level, Move, State } from './types';

export interface Solution {
  /** Minimum number of taps, or -1 if no solution was found within the limit. */
  par: number;
  moves: Move[];
  /** Number of distinct states explored. */
  explored: number;
  /** True when the search ran out of nodes before finishing. */
  truncated: boolean;
  /** How many different optimal first taps there are (a rough sense of branching). */
  optimalFirstMoves: number;
}

/** Breadth-first search for the fewest taps that clear the level from `from`. */
export function solve(level: Level, from: State = initialState(level), maxNodes = 400000, rules: RuleOptions = DEFAULT_RULES): Solution {
  if (isCleared(from)) return { par: 0, moves: [], explored: 1, truncated: false, optimalFirstMoves: 0 };
  const start = stateKey(from);
  const parent = new Map<string, { prev: string; move: Move }>();
  const dist = new Map<string, number>([[start, 0]]);
  let frontier: State[] = [from];
  let explored = 1;
  let goal: State | null = null;
  const firstWins = new Set<string>();
  let bestDepth = -1;
  const winPaths: string[] = [];
  while (frontier.length && !goal) {
    const nextFrontier: State[] = [];
    for (const s of frontier) {
      const sk = stateKey(s);
      for (const m of legalMoves(level, s)) {
        const r = applyTap(level, s, m, rules);
        const k = stateKey(r.state);
        if (dist.has(k)) continue;
        dist.set(k, dist.get(sk)! + 1);
        parent.set(k, { prev: sk, move: m });
        explored++;
        if (isCleared(r.state)) {
          if (!goal) goal = r.state;
          bestDepth = dist.get(k)!;
          winPaths.push(k);
        } else nextFrontier.push(r.state);
        if (explored >= maxNodes) return { par: -1, moves: [], explored, truncated: true, optimalFirstMoves: 0 };
      }
    }
    frontier = nextFrontier;
  }
  if (!goal) return { par: -1, moves: [], explored, truncated: false, optimalFirstMoves: 0 };
  const moves: Move[] = [];
  for (let k = stateKey(goal); k !== start; ) {
    const p = parent.get(k)!;
    moves.unshift(p.move);
    k = p.prev;
  }
  // Count distinct first taps among all optimal paths found at the winning depth.
  for (const w of winPaths) {
    let k = w;
    let first = '';
    while (k !== start) {
      const p = parent.get(k)!;
      first = `${p.move.train}:${p.move.dir}`;
      k = p.prev;
    }
    firstWins.add(first);
  }
  void bestDepth;
  return { par: moves.length, moves, explored, truncated: false, optimalFirstMoves: firstWins.size };
}
