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
