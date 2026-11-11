// A ship blowing up: a white flash, an orange fireball, two expanding shock rings, a spray of hot
// rectangular sparks and some slower dark debris. Lives in world units around the blast point, so it is drawn
// through the planet projection like everything else. Pure: no Phaser.

export interface Spark {
  /** Offset from the blast centre, world units. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  angle: number;
  spin: number;
  life: number;
  colour: number;
}

export class Explosion {
  age = 0;
  readonly sparks: Spark[] = [];
  static readonly LIFE = 1.4;

  constructor(
    readonly x: number,
    readonly y: number,
    random: () => number = Math.random,
  ) {
    for (let i = 0; i < 90; i++) {
      const a = random() * Math.PI * 2;
      const hot = i < 66;
      const speed = (hot ? 120 + random() * 260 : 50 + random() * 110) * (0.6 + random() * 0.6);
      const q = random();
      this.sparks.push({
        x: Math.cos(a) * 6,
        y: Math.sin(a) * 6,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        w: hot ? 5 + random() * 7 : 8 + random() * 12,
        h: hot ? 10 + random() * 18 : 6 + random() * 10,
        angle: a,
        spin: (random() - 0.5) * (hot ? 2 : 10),
        life: hot ? 0.5 + random() * 0.6 : 0.9 + random() * 0.5,
        colour: hot ? (q < 0.3 ? 0xfff6d8 : q < 0.7 ? 0xffb347 : 0xff6a2b) : q < 0.5 ? 0x3d3a45 : 0x5a5363,
      });
    }
  }

  get done(): boolean {
    return this.age >= Explosion.LIFE;
  }

  update(dt: number): void {
    this.age += dt;
    const drag = Math.exp(-dt * 2.2);
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= drag;
      s.vy *= drag;
      s.angle += s.spin * dt;
    }
  }
}
