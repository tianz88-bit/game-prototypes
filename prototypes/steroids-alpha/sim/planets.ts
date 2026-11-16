// The planets in the menu. Names are placeholders until the owner names them.
// bots: AI pilots while real players are there. clan: the clan whose home this is (0: none).
// Owner, 15 November 2026 (Clan planets v0): Planet A is lawless (bots hunt you), Planet B is the
// farming satellite (players only), and each demo clan has a home planet.
export const PLANETS = [
  { id: 'alpha', label: 'Lawless A', colour: 0x2a3d66, bots: true, clan: 0 },
  { id: 'beta', label: 'Satellite B', colour: 0x4a2a55, bots: false, clan: 0 },
  { id: 'crimson', label: 'Crimson Home', colour: 0x7a2a34, bots: false, clan: 1 },
  { id: 'azure', label: 'Azure Home', colour: 0x24507a, bots: false, clan: 2 },
] as const;

/**
 * Siege v0 (owner, 16 November 2026): the Warzone planet. A clan base defended by Azure (clan 2) and
 * attacked by Crimson. Not in the menu until the playable phase; the headless siege sim uses it.
 */
export const WARZONE = { id: 'warzone', label: 'Warzone', colour: 0x6a3a1c, bots: false, clan: 2 } as const;
export const isWarPlanet = (planet: string): boolean => planet === WARZONE.id;

export type PlanetId = (typeof PLANETS)[number]['id'];

export function isPlanetId(v: string | null | undefined): v is PlanetId {
  return PLANETS.some((p) => p.id === v);
}

/** The two demo clans (owner: pick one in the menu; no creation or invites yet). */
export const CLANS = [
  { id: 1, name: 'Crimson', colour: 0xe0566a },
  { id: 2, name: 'Azure', colour: 0x5aa8ff },
] as const;

export const clanName = (id: number): string => CLANS.find((c) => c.id === id)?.name ?? '';
export const planetClan = (planet: string): number => (isWarPlanet(planet) ? WARZONE.clan : PLANETS.find((p) => p.id === planet)?.clan ?? 0);
export const isClanId = (n: number): boolean => CLANS.some((c) => c.id === n);
