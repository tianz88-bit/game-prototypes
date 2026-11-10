// Game rules shared by the client (prediction) and the server (authority).
// The values live in ../tune.json; both sides bundle the same file.
import tuneJson from '../tune.json';

export type Tune = typeof tuneJson;
export const TUNE: Tune = tuneJson;

/** Fixed simulation step in seconds. */
export function stepSeconds(tune: Tune): number {
  return 1 / tune.net.tickHz;
}
