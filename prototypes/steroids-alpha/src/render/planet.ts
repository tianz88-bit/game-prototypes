// The planet as seen from above your ship: composition "C" from the owner's environment handoff v09
// (tools/steroids-alpha-art-v09/environment-lab: projection.mjs, lighting.mjs). Gameplay stays a flat
// wrapping map; this only decides where things are drawn and how they are lit. Pure maths, no Phaser.
//
// Projection: a point at ground distance r from the ship is drawn at R * sin(r / R) from the centre,
// so the map bulges like a ball seen from above. Anything a quarter of the way round (r >= R * PI/2)
// is over the horizon and hidden.
//
// Light: one sun, fixed in space. The planet turns beneath it and the ship travels over it, and both
// move the same "where am I on the ball" position, which drives terrain scroll and sunlight together.
// Turning the ship in place never changes the light.

export interface Projected {
  x: number;
  y: number;
  /** Size multiplier for something drawn at this point. */
  scale: number;
  visible: boolean;
}

/** Offset (dx, dy) from the ship, in world units, to an offset from the screen centre in world units. */
export function projectOffset(dx: number, dy: number, radius: number): Projected {
  const r = Math.hypot(dx, dy);
  const theta = r / radius;
  if (theta >= Math.PI / 2) return { x: 0, y: 0, scale: 0, visible: false };
  const f = r < 1e-8 ? 1 : Math.sin(theta) / theta;
  return { x: dx * f, y: dy * f, scale: Math.sqrt(f * Math.cos(theta)), visible: true };
}

/** How far over the ground the horizon is. */
export function horizonDistance(radius: number): number {
  return (radius * Math.PI) / 2;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Direction to the sun in space: azimuth and elevation in degrees. */
export function sunState(azimuthDeg: number, elevationDeg: number): Vec3 {
  const a = (azimuthDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  return { x: Math.cos(a) * Math.cos(e), y: Math.sin(a) * Math.cos(e), z: Math.sin(e) };
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface PlanetFrame {
  /** Where the terrain is sampled for the centre of the view: travel plus the planet's turn. */
  camera: { x: number; y: number };
  /** Sun direction in the local frame: x right, y down the screen, z up out of the ground. */
  sun: Vec3;
  /** 0 at night, 1 in full day: scales direct shadows. */
  daylight: number;
  /** 0.3 at night to 1 in full sun: overall brightness of things on the planet. */
  brightness: number;
}

/**
 * The lighting radius is the map width / 2 PI, so one lap of the wrapping map is exactly one turn of
 * the ball and the light has no jump at the map seam. (The handoff's art lab used the drawn radius;
 * it was not a wrapping map.)
 */
export function lightingRadius(worldWidth: number): number {
  return worldWidth / (2 * Math.PI);
}

export function planetFrame(travelX: number, travelY: number, rotationDeg: number, radius: number, sunFixed: Vec3): PlanetFrame {
  const rotation = (rotationDeg * Math.PI) / 180;
  const camera = { x: travelX + rotation * radius, y: travelY };
  const lon = camera.x / radius;
  const lat = camera.y / radius;
  const c = Math.cos(lon);
  const s = Math.sin(lon);
  const cb = Math.cos(lat);
  const sb = Math.sin(lat);
  const z = s * sunFixed.x + c * sunFixed.z;
  const sun = { x: c * sunFixed.x - s * sunFixed.z, y: cb * sunFixed.y - sb * z, z: sb * sunFixed.y + cb * z };
  return { camera, sun, daylight: smooth(-0.04, 0.22, sun.z), brightness: 0.3 + 0.7 * smooth(-0.12, 0.65, sun.z) };
}

/** Ground offset of a hovering ship's hard shadow: away from the sun, longer when the sun is low, bounded. */
export function shipShadow(sun: Vec3, reach: number): { x: number; y: number } {
  const slope = Math.max(0.16, sun.z);
  const x = (-sun.x / slope) * reach;
  const y = (-sun.y / slope) * reach;
  const length = Math.hypot(x, y);
  const limit = reach * 2.5;
  const k = length > limit ? limit / length : 1;
  return { x: x * k, y: y * k };
}
