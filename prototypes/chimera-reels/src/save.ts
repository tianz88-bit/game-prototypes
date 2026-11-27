// Run persistence (repo rule: one versioned localStorage key holding one
// JSON blob, saved on every state change). Saved at safe points only: the
// prefight, loot and level-up screens. Leaving mid-fight resumes at that
// floor's prefight with the gold from before the entry bet.
import type { MonsterSpec, PartId, TileId } from './sim/content';
import { newRun, type Run, type Screen } from './sim/run';
import type { Rng } from './sim/rng';

const KEY = 'chimera-reels:save:v1';
const SAFE: Screen[] = ['prefight', 'loot', 'levelup'];

interface SavedRun {
  screen: Screen;
  monster: MonsterSpec;
  gold: number;
  floor: number;
  level: number;
  streak: number;
  enemy: MonsterSpec | null;
  offers: TileId[];
  drop: PartId | null;
}

interface SaveBlob {
  best: number;
  run: SavedRun | null;
}

function read(): SaveBlob {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { best: 0, run: null };
    const b = JSON.parse(raw) as SaveBlob;
    return { best: Number(b.best) || 0, run: b.run && b.run.monster && SAFE.includes(b.run.screen) ? b.run : null };
  } catch {
    return { best: 0, run: null };
  }
}

function write(b: SaveBlob) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // Storage blocked (private mode): play continues without saving.
  }
}

export function hasSavedRun(): boolean {
  return read().run !== null;
}

export function savedBest(): number {
  return read().best;
}

/** Save the run if it is at a safe point; always keep the best streak. */
export function saveRun(run: Run) {
  const prev = read();
  const best = Math.max(prev.best, run.bestStreak);
  if (run.screen === 'gameover') return write({ best, run: null });
  if (!SAFE.includes(run.screen) || !run.monster) return write({ best, run: prev.run });
  write({
    best,
    run: {
      screen: run.screen, monster: run.monster, gold: run.gold, floor: run.floor, level: run.level,
      streak: run.streak, enemy: run.enemy, offers: run.offers, drop: run.drop,
    },
  });
}

export function clearRun() {
  write({ best: read().best, run: null });
}

/** Rebuild a Run from the save, or a fresh one if there is nothing to continue. */
export function loadRun(rng: Rng): Run {
  const b = read();
  const run = newRun(rng);
  run.bestStreak = b.best;
  if (!b.run) return run;
  Object.assign(run, {
    screen: b.run.screen, monster: b.run.monster, gold: b.run.gold, floor: b.run.floor, level: b.run.level,
    streak: b.run.streak, enemy: b.run.enemy, offers: b.run.offers ?? [], drop: b.run.drop ?? null,
  });
  return run;
}
