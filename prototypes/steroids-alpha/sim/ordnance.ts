// Missile lock (owner design: missiles lock ships only). Shared by the server (which launches) and the
// client (which shows the lock marker before you fire).
import type { Tune } from './tune';
import type { ShipState } from './ship';
import { angleDelta, wrapDelta } from './wrap';

/** The ship a missile from s would lock onto: inside lockConeDeg of the nose and lockRange, the one
 * nearest the nose direction. Returns its id, or 0 for none. */
export function missileLock(id: number, s: ShipState, ships: Iterable<[number, ShipState]>, tune: Tune): number {
  const m = tune.missile;
  const cone = (m.lockConeDeg * Math.PI) / 180;
  let best = 0;
  let bestOff = Infinity;
  for (const [oid, o] of ships) {
    if (oid === id || o.hp <= 0) continue;
    const dx = wrapDelta(o.x, s.x, tune.world.width);
    const dy = wrapDelta(o.y, s.y, tune.world.height);
    if (dx * dx + dy * dy > m.lockRange * m.lockRange) continue;
    const off = Math.abs(angleDelta(Math.atan2(dy, dx), s.heading));
    if (off <= cone && off < bestOff) {
      best = oid;
      bestOff = off;
    }
  }
  return best;
}
