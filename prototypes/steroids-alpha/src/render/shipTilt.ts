// Approved lab relief/projection, shared by each independently moving ship part.
import type { RigModule } from './shipRig';

export interface Tilt { pitch: number; bank: number }
export interface TiltBasis { cp: number; sp: number; cb: number; sb: number; ch: number; sh: number }
export interface FFDControl { thrust: number; turn: number; aim: number }
export interface TiltTune { ffdAccelPitch: number; ffdBrakePitch: number; ffdYawBank: number; ffdResponse: number; ffdAccelThreshold: number; ffdYawFullDegPerSec: number }

export function advanceTilt(state: Tilt, control: FFDControl | 'observed' | undefined, accel: number, yawRate: number, boosting: boolean, dt: number, tune: TiltTune): void {
  // Heading alone is never a control cue. Remote ships explicitly opt into observed motion.
  const thrust = control === 'observed' ? Math.sign(accel) : control?.thrust ?? 0;
  const turning = control === 'observed' || (control && Number.isFinite(control.aim));
  const yaw = turning ? Math.abs(yawRate) > 2 ? yawRate / tune.ffdYawFullDegPerSec : 0 : control?.turn ?? 0;
  const pitch = control === undefined ? 0 : boosting || (thrust > 0 && accel > tune.ffdAccelThreshold) ? -tune.ffdAccelPitch
    : thrust < 0 && accel < -tune.ffdAccelThreshold ? tune.ffdBrakePitch : 0;
  const bank = -Math.max(-1, Math.min(1, yaw)) * tune.ffdYawBank;
  const ease = 1 - Math.exp(-tune.ffdResponse * Math.max(0, Math.min(.05, dt)));
  state.pitch += (pitch - state.pitch) * ease;
  state.bank += (bank - state.bank) * ease;
  if (pitch === 0 && Math.abs(state.pitch) < .01) state.pitch = 0;
  if (bank === 0 && Math.abs(state.bank) < .01) state.bank = 0;
}

export function tiltBasis(pitch: number, bank: number, heading: number): TiltBasis {
  const p = pitch * Math.PI / 180, b = bank * Math.PI / 180, a = heading * Math.PI / 180;
  return { cp: Math.cos(p), sp: Math.sin(p), cb: Math.cos(b), sb: Math.sin(b), ch: Math.cos(a), sh: Math.sin(a) };
}

/** In heading-relative axes, then back to the unchanged top-down rig coordinates. */
export function projectTiltPoint(x: number, y: number, z: number, t: TiltBasis, out = { x: 0, y: 0 }): { x: number; y: number } {
  const bx = t.ch * x + t.sh * y, by = -t.sh * x + t.ch * y;
  const yy = by * t.cp - z * t.sp, zz = by * t.sp + z * t.cp;
  const xx = bx * t.cb + zz * t.sb, depth = -bx * t.sb + zz * t.cb;
  const f = 900 / (900 + depth);
  out.x = (t.ch * xx - t.sh * yy) * f;
  out.y = (t.sh * xx + t.ch * yy) * f;
  return out;
}

export function panelRelief(m: RigModule, u: number, v: number): number {
  const ridge = 1 - Math.abs(2 * u - 1);
  if (m.id === 'armour') return 16 * ridge * (v < .2 ? v / .2 : v > .75 ? (1 - v) / .25 : 1);
  if (m.asset === 'booster-cowling') return 12 * ridge;
  if (m.id === 'chassis') return 5 * ridge;
  return 0; // Glass, guns and engine cores keep rigid surfaces within the shared tilt.
}
