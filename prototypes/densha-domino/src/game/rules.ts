import { type Dir, GONE, type Level, type Move, type State, type TapEvent, type TapResult } from './types';

export interface RuleOptions {
  /**
   * After a bump on a train's side, does the bumping train try again once the way is
   * cleared (true), or stay where it stopped (false)? After a bump on a train's end it
   * always follows.
   */
  followAfterSide: boolean;
}

export const DEFAULT_RULES: RuleOptions = { followAfterSide: true };

/** Level state at the start. */
export function initialState(level: Level): State {
  return level.trains.map((t) => t.start);
}

export function isCleared(state: State): boolean {
  return state.every((p) => p === GONE);
}

export function trainsLeft(state: State): number {
  return state.filter((p) => p !== GONE).length;
}

/** Cell (col,row) a train occupies at index `i` along its length. */
function cellOf(level: Level, train: number, pos: number, i: number): [number, number] {
  const t = level.trains[train];
  return t.axis === 'h' ? [pos + i, t.line] : [t.line, pos + i];
}

/** Which train is on a cell, or -1. */
export function trainAt(level: Level, state: State, col: number, row: number): number {
  for (let k = 0; k < level.trains.length; k++) {
    const p = state[k];
    if (p === GONE) continue;
    const t = level.trains[k];
    if (t.axis === 'h') {
      if (row === t.line && col >= p && col < p + t.len) return k;
    } else if (col === t.line && row >= p && row < p + t.len) return k;
  }
  return -1;
}

const onBoard = (level: Level, col: number, row: number): boolean => col >= 0 && row >= 0 && col < level.cols && row < level.rows;

/** What lies just beyond the train's end in `dir`. */
export type Ahead = { kind: 'exit' } | { kind: 'free' } | { kind: 'obstacle' } | { kind: 'train'; train: number };

export function look(level: Level, state: State, train: number, dir: Dir): Ahead {
  const t = level.trains[train];
  const p = state[train];
  const next = dir > 0 ? p + t.len : p - 1;
  const [col, row] = t.axis === 'h' ? [next, t.line] : [t.line, next];
  if (!onBoard(level, col, row)) return { kind: 'exit' };
  if (level.obstacles.has(row * level.cols + col)) return { kind: 'obstacle' };
  const other = trainAt(level, state, col, row);
  return other >= 0 ? { kind: 'train', train: other } : { kind: 'free' };
}

/** The cell just beyond a train's end in `dir`, as [col, row]. */
export function aheadCell(level: Level, state: State, train: number, dir: Dir): [number, number] {
  const t = level.trains[train];
  const p = state[train];
  const next = dir > 0 ? p + t.len : p - 1;
  return t.axis === 'h' ? [next, t.line] : [t.line, next];
}

/** How many free cells (or the way off the board) lie ahead of a train in `dir`. */
function freeRun(level: Level, state: State, train: number, dir: Dir): number {
  const s = state.slice();
  let n = 0;
  for (;;) {
    const a = look(level, s, train, dir);
    if (a.kind === 'exit') return n + 1000;
    if (a.kind !== 'free') return n;
    s[train] += dir;
    n++;
  }
}

/**
 * Which way a train hit on its side runs. It runs away from the bump: a hit near
 * its low end sends it toward the high end and the other way round. If only one way
 * is open it takes that. A hit dead centre goes whichever way has more room (the
 * way off the board counts most), then the positive way.
 */
function sideBumpDir(level: Level, state: State, target: number, cell: [number, number]): Dir | null {
  const o = level.trains[target];
  const open = ([-1, 1] as Dir[]).filter((d) => canRun(level, state, target, d));
  if (open.length === 0) return null;
  if (open.length === 1) return open[0];
  const idx = (o.axis === 'h' ? cell[0] : cell[1]) - state[target];
  const centre = (o.len - 1) / 2;
  if (idx < centre) return 1;
  if (idx > centre) return -1;
  const a = freeRun(level, state, target, -1);
  const b = freeRun(level, state, target, 1);
  return a > b ? -1 : 1;
}

/** A train can run in `dir` if the cell beyond its end is free or is the way off the board. */
export function canRun(level: Level, state: State, train: number, dir: Dir): boolean {
  if (state[train] === GONE) return false;
  const a = look(level, state, train, dir);
  return a.kind === 'free' || a.kind === 'exit';
}

export function legalMoves(level: Level, state: State): Move[] {
  const out: Move[] = [];
  for (let k = 0; k < level.trains.length; k++)
    for (const dir of [-1, 1] as Dir[]) if (canRun(level, state, k, dir)) out.push({ train: k, dir });
  return out;
}

/**
 * Taps a train. It runs until it leaves the board or stops. If it stops against
 * another train, head to tail or against its side, that train takes off (chain
 * reaction). Once the one it hit has gone, the running train tries again and follows if
 * its way is now clear, so one tap can send a whole convoy out. For a bump on a train's
 * side that depends on `rules.followAfterSide`. Returns the new state and the events in order.
 */
export function applyTap(level: Level, state: State, move: Move, rules: RuleOptions = DEFAULT_RULES): TapResult {
  const next = state.slice();
  const events: TapEvent[] = [];
  const ran = new Set<number>();
  let exited = 0;

  /** Runs one train; returns true if it left the board. */
  const run = (train: number, dir: Dir, link: number, resume: boolean): boolean => {
    ran.add(train);
    const t = level.trains[train];
    let segStart = next[train];
    const flush = (exitedNow: boolean) => {
      const to = exitedNow ? (dir > 0 ? (t.axis === 'h' ? level.cols : level.rows) : -t.len) : next[train];
      if (to !== segStart || exitedNow) events.push({ type: 'run', train, from: segStart, to, exited: exitedNow, dir, link, resume: resume || segStart !== state[train] });
    };
    for (;;) {
      const a = look(level, next, train, dir);
      if (a.kind === 'exit') {
        flush(true);
        next[train] = GONE;
        exited++;
        return true;
      }
      if (a.kind === 'free') {
        next[train] += dir;
        continue;
      }
      if (a.kind === 'obstacle') {
        flush(false);
        return false;
      }
      // Stopped against another train.
      const target = a.train;
      const o = level.trains[target];
      const sameLine = o.axis === t.axis && o.line === t.line;
      // Head to tail the hit train runs on in the same direction. A bump on its side
      // sets it off along its own track, away from the bump.
      const targetDir = sameLine ? dir : sideBumpDir(level, next, target, aheadCell(level, next, train, dir));
      const spooked = targetDir !== null && canRun(level, next, target, targetDir) && !ran.has(target);
      flush(false);
      events.push({ type: 'hit', runner: train, target, dir, targetDir: targetDir ?? dir, spooked, sameLine, link });
      if (!spooked || targetDir === null) return false;
      run(target, targetDir, link + 1, false);
      // After a bump on the side the bumping train only tries again if the rules say so.
      if (!sameLine && !rules.followAfterSide) return false;
      segStart = next[train];
      // The hit train has gone: carry on behind it (head-to-tail hits only).
      resume = true;
    }
  };

  if (canRun(level, next, move.train, move.dir)) run(move.train, move.dir, 1, false);
  return { state: next, events, links: ran.size, exited };
}

export const stateKey = (s: State): string => s.join(',');
