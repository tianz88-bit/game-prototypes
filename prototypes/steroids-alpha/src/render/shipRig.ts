// Human Nomad ship rig: TypeScript port of the approved kit
// (tools/ship-rig/human-nomad-v1 at 38e7139: rig.mjs, depth-effects.mjs, flight-motion.mjs recoilPose).
// The math is kept identical; scripts/test-steroids-alpha-rig.mjs checks it against values produced
// by the original kit. Angles here are rig degrees: 0 Up, 90 Right, clockwise (source art faces up).
// Pure: no Phaser, so it can be tested in Node.

export const DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface RigModule {
  id: string;
  asset: string;
  x: number;
  y: number;
  /** Fixed draw band from the kit (also in the calibration's order). */
  band: number;
  side?: number;
  mirror?: boolean;
  parent?: string;
  motion?: 'engine';
  motionGroup?: string;
}

export const MODULES: readonly RigModule[] = [
  { id: 'chassis', asset: 'chassis', x: 0, y: 0, band: 20 },
  { id: 'wingL', asset: 'wing', x: -125, y: 45, band: 10, side: -1, parent: 'chassis' },
  { id: 'wingR', asset: 'wing', x: 125, y: 45, band: 10, side: 1, mirror: true, parent: 'chassis' },
  { id: 'armour', asset: 'armour', x: 0, y: -15, band: 30, parent: 'chassis' },
  { id: 'engineL', asset: 'booster-core', x: -78, y: 108, band: 42, side: -1, parent: 'chassis', motion: 'engine', motionGroup: 'engineL' },
  { id: 'engineR', asset: 'booster-core', x: 78, y: 108, band: 43, side: 1, parent: 'chassis', motion: 'engine', motionGroup: 'engineR' },
  { id: 'engineCapL', asset: 'booster-cowling', x: -78, y: 88, band: 44, side: -1, parent: 'engineL', motion: 'engine', motionGroup: 'engineL' },
  { id: 'engineCapR', asset: 'booster-cowling', x: 78, y: 88, band: 45, side: 1, parent: 'engineR', motion: 'engine', motionGroup: 'engineR' },
  { id: 'cockpit', asset: 'cockpit-base', x: 0, y: 40, band: 50, parent: 'armour' },
  { id: 'canopy', asset: 'cockpit-canopy', x: 0, y: 40, band: 51, parent: 'cockpit' },
  { id: 'gunL', asset: 'gun', x: -170, y: 0, band: 60, side: -1, parent: 'wingL' },
  { id: 'gunR', asset: 'gun', x: 170, y: 0, band: 60, side: 1, parent: 'wingR' },
];

export const ASSETS: readonly string[] = [...new Set(MODULES.map((m) => m.asset))];

export interface Vec {
  x: number;
  y: number;
}

export interface Calibration {
  version: number;
  hoverLift: number;
  shadow: { x: number; y: number; opacity: number };
  modules: Record<string, { width: number; order: Record<Direction, number>; offsets: Record<Direction, Vec> }>;
}

/** Accept only the approved schema (version 7) with every module present. */
export function checkCalibration(data: unknown): Calibration {
  const c = data as Calibration;
  if (!c || c.version !== 7 || !c.modules || !c.shadow) throw new Error('Unknown ship calibration format');
  for (const m of MODULES) {
    const e = c.modules[m.id];
    if (!e || !Number.isFinite(e.width)) throw new Error(`Ship calibration missing ${m.id}`);
    for (const d of DIRECTIONS) {
      if (!Number.isFinite(e.order[d]) || !Number.isFinite(e.offsets[d]?.x) || !Number.isFinite(e.offsets[d]?.y)) {
        throw new Error(`Ship calibration ${m.id} ${d} invalid`);
      }
    }
  }
  return c;
}

const byId = new Map(MODULES.map((m) => [m.id, m]));

/** Periodic monotone cubic Hermite through the four authored facing values (kit blendOffsets). */
export function blendOffsets(angle: number, offsets: Record<Direction, Vec>): Vec {
  const phase = (((angle % 360) + 360) % 360) / 90;
  const i = Math.floor(phase);
  const t = phase - i;
  const tangent = (a: number, b: number): number => (a * b <= 0 ? 0 : (2 * a * b) / (a + b));
  const axis = (k: 'x' | 'y'): number => {
    const p = [-1, 0, 1, 2].map((n) => offsets[DIRECTIONS[(i + n + 4) % 4]][k]);
    const d = p[2] - p[1];
    const m0 = tangent(p[1] - p[0], d);
    const m1 = tangent(d, p[3] - p[2]);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p[1] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p[2] + (t3 - t2) * m1;
  };
  return { x: axis('x'), y: axis('y') };
}

/** Fixed Z: the 'up' order for every heading, index as a stable tie-break. */
export function depth(m: RigModule, cal: Calibration): number {
  return cal.modules[m.id].order.up + MODULES.indexOf(m) * 0.001;
}

/** Corrections accumulated through the parent chain (each applied once). */
export function stackOffset(m: RigModule, angle: number, cal: Calibration): Vec {
  const own = blendOffsets(angle, cal.modules[m.id].offsets);
  const parent = m.parent ? stackOffset(byId.get(m.parent) as RigModule, angle, cal) : { x: 0, y: 0 };
  return { x: parent.x + own.x, y: parent.y + own.y };
}

export interface Pose {
  x: number;
  y: number;
  rotation: number;
}

/**
 * Where one module draws, in rig pixels relative to the ship centre (before hover lift).
 * time is milliseconds; motion 0..1 enables engine rattle and wing flex; turn is -1..1;
 * recoil is the gun kick divided by 7, as in the kit.
 */
export function pose(m: RigModule, angle: number, cal: Calibration, time = 0, motion = 0, turn = 0, recoil = 0): Pose {
  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const acc = stackOffset(m, angle, cal);
  const phase = MODULES.findIndex((p) => p.id === (m.motionGroup || m.id)) * 2.17;
  const engine = m.motion === 'engine';
  const gun = m.asset === 'gun';
  const wing = m.asset === 'wing';
  const strength = m.asset === 'booster-core' ? 1 : 0.12;
  const vibration = engine ? (Math.sin(time * 0.067 + phase) * 0.65 + Math.sin(time * 0.113 + phase * 1.7) * 0.25) * strength * motion : 0;
  const axial = engine ? (Math.sin(time * 0.049 + phase) * 1.6 + Math.sin(time * 0.097 + phase * 0.8) * 0.6) * strength * motion : 0;
  const flex = wing ? Math.sin(time * 0.003 + phase) * 0.45 * motion : 0;
  const slide = gun ? recoil * 7 : 0;
  const lean = m.id === 'canopy' ? 0.022 : m.id === 'cockpit' ? 0.012 : engine ? 0.012 : 0;
  return {
    x: c * m.x - s * (m.y + slide) + acc.x + c * vibration - s * axial,
    y: s * m.x + c * (m.y + slide) + acc.y + s * vibration + c * axial,
    rotation: a + (engine ? Math.sin(time * 0.061 + phase) * 0.006 * strength * motion : wing ? flex * 0.006 : 0) - turn * lean * motion,
  };
}

/** Top object unshaded; each object below gets another 3% black (kit layerBrightness). */
export function layerBrightness(m: RigModule, cal: Calibration): number {
  const z = depth(m, cal);
  return 0.97 ** MODULES.filter((n) => depth(n, cal) > z).length;
}

/** Gun kick: sharp rearward kick, wider/shorter squash, stretched recovery, 600 ms (kit recoilPose). */
export function recoilPose(age: number): { kick: number; scaleX: number; scaleY: number } {
  if (age < 0 || age >= 600) return { kick: 0, scaleX: 1, scaleY: 1 };
  const kick = (1 - Math.exp(-age / 9)) * Math.exp(-age / 110);
  const rebound = age > 65 ? Math.sin((age - 65) / 70) * Math.exp(-(age - 65) / 125) : 0;
  return { kick: 28 * kick - 5 * rebound, scaleX: 1 + 0.28 * kick - 0.08 * rebound, scaleY: 1 - 0.34 * kick + 0.22 * rebound };
}

/** Game heading (radians, 0 = +x, y down) to rig degrees (0 = up, clockwise). */
export function rigAngle(headingRad: number): number {
  return (((headingRad * 180) / Math.PI + 90) % 360 + 360) % 360;
}
