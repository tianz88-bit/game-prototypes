// Thruster exhaust: TypeScript port of the environment handoff v09's ThrusterVFX
// (tools/steroids-alpha-art-v09/environment-lab/thrusters.mjs). Same emission rates, burst size,
// particle sizes, speeds, lifetimes and colours. Pure: no Phaser, so the rules test can run it.
//
// - Idle: a steady 40 rectangles a second per engine.
// - Throttle: both engines burst once when it starts, then emit strongly (155 a second) while held.
// - Turning: the outside engine bursts and strengthens (left turn uses the right engine).
// - A held input never bursts again; releasing returns to idle and existing particles die out.
// Positions are relative to the ship's centre, in the same units as the nozzle origins.

export interface NozzleOrigin {
  x: number;
  y: number;
  width: number;
  /** Degrees, 0 = nose up, clockwise. */
  angle: number;
  /** Scales particle size and speed with the craft (0.375 for the 18% ship). */
  particleScale?: number;
}

export interface ThrusterInput {
  throttle: boolean;
  left: boolean;
  right: boolean;
}

export interface ExhaustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  w: number;
  h: number;
  /** Radians. */
  angle: number;
  colour: number;
}

export interface ExhaustFlash extends NozzleOrigin {
  age: number;
  life: number;
}

const MAX_PARTICLES = 900;

export class ThrusterVFX {
  particles: ExhaustParticle[] = [];
  flashes: ExhaustFlash[] = [];
  /** Bursts fired so far by the craft-left and craft-right engine. */
  bursts: [number, number] = [0, 0];
  strong: [boolean, boolean] = [false, false];
  private previous: ThrusterInput = { throttle: false, left: false, right: false };
  private credits: [number, number] = [0, 0];

  constructor(private random: () => number = Math.random) {}

  spawn(origin: NozzleOrigin, strong: boolean, burst = false): void {
    const r = this.random;
    const particleScale = origin.particleScale ?? 1;
    const a = (origin.angle * Math.PI) / 180;
    const side = (r() - 0.5) * (burst ? 1.4 : 0.45);
    const speed = (burst ? 180 : strong ? 270 : 95) * (0.7 + r() * 0.6) * particleScale;
    const dx = -Math.sin(a);
    const dy = Math.cos(a);
    const sx = Math.cos(a);
    const sy = Math.sin(a);
    const q = r();
    this.particles.push({
      x: origin.x + sx * (r() - 0.5) * origin.width * 0.55,
      y: origin.y + sy * (r() - 0.5) * origin.width * 0.55,
      vx: (dx + sx * side) * speed,
      vy: (dy + sy * side) * speed,
      age: 0,
      life: burst ? 0.22 + r() * 0.22 : strong ? 0.22 + r() * 0.22 : 0.16 + r() * 0.21,
      w: (burst ? 4.5 + r() * 8 : 2.2 + r() * 3.5) * particleScale,
      h: (burst ? 6 + r() * 12 : strong ? 7 + r() * 13 : 4 + r() * 7) * particleScale,
      angle: a,
      // Mostly blue and white, about 12% orange.
      colour: q < 0.12 ? 0xffa65f : q < 0.42 ? 0xe4fcff : q < 0.78 ? 0x62d9ff : 0x4286ff,
    });
  }

  /** origins: craft-left then craft-right nozzle. */
  update(dt: number, input: ThrusterInput, origins: [NozzleOrigin, NozzleOrigin]): void {
    dt = Math.min(0.05, Math.max(0, dt));
    const edges = { throttle: input.throttle && !this.previous.throttle, left: input.left && !this.previous.left, right: input.right && !this.previous.right };
    // The outside engine drives the yaw.
    this.strong = [input.throttle || input.right, input.throttle || input.left];
    const burst = [edges.throttle || edges.right, edges.throttle || edges.left];
    for (let i = 0; i < 2; i++) {
      if (burst[i]) {
        this.bursts[i]++;
        this.flashes.push({ ...origins[i], age: 0, life: 0.18 });
        for (let n = 0; n < 86; n++) this.spawn(origins[i], true, true);
      }
      this.credits[i] += dt * (this.strong[i] ? 155 : 40);
      while (this.credits[i] >= 1) {
        this.spawn(origins[i], this.strong[i]);
        this.credits[i]--;
      }
    }
    this.previous = { ...input };
    const drag = Math.exp(-dt * 1.1);
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
    }
    this.particles = this.particles.filter((p) => p.age < p.life).slice(-MAX_PARTICLES);
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < f.life);
  }
}
