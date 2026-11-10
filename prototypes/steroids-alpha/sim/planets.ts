// The two v1 planets. Names are placeholders until the owner names them.
export const PLANETS = [
  { id: 'alpha', label: 'Planet A', colour: 0x2a3d66 },
  { id: 'beta', label: 'Planet B', colour: 0x4a2a55 },
] as const;

export type PlanetId = (typeof PLANETS)[number]['id'];

export function isPlanetId(v: string | null | undefined): v is PlanetId {
  return PLANETS.some((p) => p.id === v);
}
