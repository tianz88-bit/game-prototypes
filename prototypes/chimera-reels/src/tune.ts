import raw from '../tune.json';

export type Tune = typeof raw;

// Live, mutable copy. The debug panel edits this object in place and the
// game reads from it every frame, so changes apply immediately.
export const tune: Tune = JSON.parse(JSON.stringify(raw));
