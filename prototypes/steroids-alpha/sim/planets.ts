// The two v1 planets. Names are placeholders until the owner names them.
// bots: Planet A has AI pilots while real players are there; Planet B is players-only PvP (owner).
export const PLANETS = [
  { id: 'alpha', label: 'Planet A', colour: 0x2a3d66, bots: true },
  { id: 'beta', label: 'Planet B', colour: 0x4a2a55, bots: false },
] as const;

export type PlanetId = (typeof PLANETS)[number]['id'];

export function isPlanetId(v: string | null | undefined): v is PlanetId {
  return PLANETS.some((p) => p.id === v);
}
