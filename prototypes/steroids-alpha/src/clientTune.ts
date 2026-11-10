// How the client looks and feels. Game rules are in ../tune.json (shared with the server).
import clientTuneJson from '../client.tune.json';

export type ClientTune = typeof clientTuneJson;
/** Live object: the debug panel edits it in place. */
export const clientTune: ClientTune = structuredClone(clientTuneJson);
