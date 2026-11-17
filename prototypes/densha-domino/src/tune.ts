import raw from '../tune.json';

// A live, mutable copy of tune.json. The ?debug=1 Tweakpane panel edits this
// object in place, so feel changes apply immediately without a reload.
export type Tune = typeof raw;
export const tune: Tune = structuredClone(raw);
export const tuneDefaults: Tune = raw;
