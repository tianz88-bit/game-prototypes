import Phaser from 'phaser';
import { bakeTexture, mix, pillow, shade } from 'dig-kit';
import type { TrainDef } from '../game/types';
import { tune } from '../tune';

const carKey = (color: number) => `dd_car_${color}`;

/** Bakes the car pillow (body, roof stripe, windows) for a livery, once. */
export function bakeCar(scene: Phaser.Scene, color: number, cs: number): void {
  const w = cs * tune.feel.carLengthFrac;
  const h = cs * tune.feel.carWidthFrac;
  bakeTexture(scene, carKey(color), w, h, (g, res) => {
    const W = w * res;
    const H = h * res;
    pillow(g, 0, 0, W, H, H * 0.36, color, true);
    // Roof stripe in a darker shade of the livery, then three windows.
    g.fillStyle(shade(color, 0.72), 0.9);
    g.fillRoundedRect(W * 0.08, H * 0.4, W * 0.84, H * 0.07, H * 0.03);
    g.fillStyle(0xe9f6ff, 1);
    for (let i = 0; i < 3; i++) g.fillRoundedRect(W * (0.13 + i * 0.27), H * 0.16, W * 0.2, H * 0.2, H * 0.06);
    g.fillStyle(mix(color, 0xffffff, 0.45), 1);
    g.fillRoundedRect(W * 0.08, H * 0.58, W * 0.84, H * 0.1, H * 0.04);
  });
}

/** A train on the board: a row of cars with couplers and headlights, drawn along its axis. */
export class TrainView {
  readonly container: Phaser.GameObjects.Container;
  private cars: Phaser.GameObjects.Image[] = [];
  private tilt = 1;

  constructor(private scene: Phaser.Scene, readonly def: TrainDef, private cs: number) {
    this.container = scene.add.container(0, 0);
    this.tilt = def.id % 2 === 0 ? 1 : -1;
    const n = def.len;
    const horizontal = def.axis === 'h';
    const g = scene.add.graphics();
    this.container.add(g);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * cs;
      const img = scene.add.image(horizontal ? off : 0, horizontal ? 0 : off, carKey(def.color)).setDisplaySize(cs * tune.feel.carLengthFrac, cs * tune.feel.carWidthFrac);
      if (!horizontal) img.setAngle(90);
      this.cars.push(img);
      this.container.add(img);
      if (i < n - 1) {
        g.fillStyle(0x4a4a5c, 1);
        const cx = horizontal ? off + cs / 2 : 0;
        const cy = horizontal ? 0 : off + cs / 2;
        g.fillRoundedRect(cx - (horizontal ? 3 : 4), cy - (horizontal ? 4 : 3), horizontal ? 6 : 8, horizontal ? 8 : 6, 2);
      }
    }
    // Headlights at both ends, since a train can run either way.
    const half = (n * cs) / 2 - 5;
    g.fillStyle(0xfff3a8, 1);
    for (const end of [-1, 1])
      for (const side of [-1, 1]) {
        const px = horizontal ? end * half : side * cs * 0.17;
        const py = horizontal ? side * cs * 0.17 : end * half;
        g.fillCircle(px, py, 2.6);
      }
  }

  /** Centre of the train in board pixels for a start cell along its axis. */
  centre(pos: number, ox: number, oy: number): { x: number; y: number } {
    const along = (pos + this.def.len / 2) * this.cs;
    const across = (this.def.line + 0.5) * this.cs;
    return this.def.axis === 'h' ? { x: ox + along, y: oy + across } : { x: ox + across, y: oy + along };
  }

  /** Pose for the "spooked" anticipation: stretched along the track, narrower, sheared and tilted. k runs 0 to 1. */
  pose(k: number, stretch: number, squash: number, skewPx: number, tiltDeg: number): void {
    const along = 1 + stretch * k;
    const across = 1 - squash * k;
    const horizontal = this.def.axis === 'h';
    this.container.setScale(horizontal ? along : across, horizontal ? across : along);
    this.container.setAngle(this.tilt * tiltDeg * k);
    const n = this.cars.length;
    this.cars.forEach((c, i) => {
      const shear = skewPx * k * (i - (n - 1) / 2);
      const off = (i - (n - 1) / 2) * this.cs;
      if (horizontal) c.setPosition(off, shear);
      else c.setPosition(shear, off);
    });
  }

  rest(): void {
    this.pose(0, 0, 0, 0, 0);
    this.container.setScale(1);
  }

  /** Squash along the track when braking against something. */
  brake(): void {
    const horizontal = this.def.axis === 'h';
    const s = tune.feel.brakeSquash;
    this.scene.tweens.add({
      targets: this.container,
      scaleX: horizontal ? s : 1 + (1 - s) * 0.6,
      scaleY: horizontal ? 1 + (1 - s) * 0.6 : s,
      duration: tune.feel.brakeMs,
      yoyo: true,
      ease: 'Sine.Out',
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}
