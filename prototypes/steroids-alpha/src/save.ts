import type { Look } from '../sim/unlocks';
// The one saved blob for this prototype (repo rule: one versioned localStorage key). Every write
// merges, so the steering choice and the pilot name never overwrite each other.
const SAVE_KEY = 'steroids-alpha:save:v1';

export interface Save {
  steer?: 'marker' | 'craft';
  mobileSteer?: 'marker' | 'craft';
  name?: string;
  /**
   * Bank account (BRIEF.md Bank and unlocks): the secret the server checks and the recovery code to
   * show the player. Losing both this storage and the code loses the account.
   */
  account?: { secret: string; recovery: string };
  /** Cosmetics equipped (unlock id per slot); the server only shows what the account owns. */
  look?: Look;
  /** Recent runs, newest first (at most 10), for the Run history unlock. Always recorded. */
  runs?: RunRecord[];
}

export interface RunRecord {
  /** When the run ended (ms since 1970). */
  at: number;
  planet: string;
  outcome: 'extracted' | 'destroyed';
  salvage: number;
  kills: number;
  seconds: number;
}

/** Add a finished run to the history (kept to the newest 10). */
export function recordRun(run: RunRecord): void {
  writeSave({ runs: [run, ...(loadSave().runs ?? [])].slice(0, 10) });
}

export function loadSave(): Save {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') as Save;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function writeSave(patch: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...loadSave(), ...patch }));
  } catch {
    // Private mode or blocked storage: it just lasts for this visit.
  }
}
