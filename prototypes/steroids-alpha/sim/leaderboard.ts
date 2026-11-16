import type { RosterEntry } from './protocol';

/** The wire retains `power`: hull maximum is the run's mineral balance, spent by the shop. */
export const mineralCount = (entry: RosterEntry): number => entry.power;

/** One ordering for the desktop board, phone drawer and compact rank button. */
export function rankPilots(entries: Iterable<RosterEntry>): RosterEntry[] {
  return [...entries].sort((a, b) => (b.level ?? 0) - (a.level ?? 0)
    || b.kills - a.kills || mineralCount(b) - mineralCount(a) || a.id - b.id);
}
