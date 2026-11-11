// One ship on screen, drawn with the approved Human Nomad rig: twelve parts in fixed Z order with
// the kit's 3% per-layer shading, parent-accumulated facing offsets, engine rattle, canopy lean on turns,
// hover lift and a hard ground shadow. A ground ring marks your ship (cyan) versus others (orange).
// Guns kick with the kit's recoil curve when they fire.
// Not yet ported: FFD pitch/bank tilt (needs a Phaser Mesh renderer and profiling).
import Phaser from 'phaser';
import { MODULES, depth, layerBrightness, pose, recoilPose, rigAngle } from './shipRig';
import { CALIBRATION, SHADOW_KEY, partKey } from './shipArt';
import { clientTune } from '../clientTune';

const SHIP_DEPTH = 20;

export class ShipView {
  private container: Phaser.GameObjects.Container;
  private parts: { m: (typeof MODULES)[number]; img: Phaser.GameObjects.Image; scale: number }[] = [];
  /** When each gun last fired (ms), by side: -1 left, 1 right. */
  private firedAt: Record<number, number> = { [-1]: -1e9, 1: -1e9 };
  private now = 0;
  private shadow: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private lastAngle: number | null = null;
  private lastTime = 0;

  constructor(scene: Phaser.Scene, mine: boolean) {
    this.ring = scene.add.graphics().setDepth(SHIP_DEPTH - 2);
    const r = clientTune.render.shipRingRadius;
    this.ring.lineStyle(2 / clientTune.render.shipScale, mine ? 0x5fe3ff : 0xff8a4a, 0.55);
    this.ring.strokeCircle(0, 0, r);
    this.shadow = scene.add.image(0, 0, SHADOW_KEY).setDepth(SHIP_DEPTH - 1).setAlpha(CALIBRATION.shadow.opacity);
    this.container = scene.add.container(0, 0).setDepth(mine ? SHIP_DEPTH + 1 : SHIP_DEPTH);
    // Fixed Z: sort once by the calibrated order; container children draw in list order.
    const sorted = [...MODULES].sort((a, b) => depth(a, CALIBRATION) - depth(b, CALIBRATION));
    for (const m of sorted) {
      const img = scene.add.image(0, 0, partKey(m.asset)).setFlipX(!!m.mirror);
      const scale = CALIBRATION.modules[m.id].width / img.width;
      img.setScale(scale);
      const shade = Math.round(255 * layerBrightness(m, CALIBRATION));
      img.setTint((shade << 16) | (shade << 8) | shade);
      this.container.add(img);
      this.parts.push({ m, img, scale });
    }
  }

  /** headingRad uses game convention (0 = +x). x, y are logical screen pixels. timeMs drives idle motion. */
  update(x: number, y: number, headingRad: number, timeMs: number): void {
    const scale = clientTune.render.shipScale;
    const angle = rigAngle(headingRad);
    // Canopy/cockpit lean from turn rate, as in the kit lab: degrees per ms x 20, clamped.
    const dt = Math.max(1, timeMs - this.lastTime);
    const dA = this.lastAngle === null ? 0 : ((angle - this.lastAngle + 540) % 360) - 180;
    const turn = Math.max(-1, Math.min(1, (dA / dt) * 20));
    this.lastAngle = angle;
    this.lastTime = timeMs;

    const hover = CALIBRATION.hoverLift;
    this.now = timeMs;
    for (const { m, img, scale } of this.parts) {
      const gun = m.asset === 'gun';
      const k = gun ? recoilPose(timeMs - this.firedAt[m.side ?? 1]) : null;
      const p = pose(m, angle, CALIBRATION, timeMs, 1, turn, k ? k.kick / 7 : 0);
      img.setPosition(p.x, p.y - hover).setRotation(p.rotation);
      if (k) img.setScale(scale * k.scaleX, scale * k.scaleY);
    }
    this.container.setPosition(x, y).setScale(scale);
    this.shadow
      .setPosition(x + CALIBRATION.shadow.x * scale, y + CALIBRATION.shadow.y * scale)
      .setScale(scale)
      .setRotation((angle * Math.PI) / 180);
    this.ring.setPosition(x, y).setScale(scale);
  }

  /** A gun fired: side 1 right, -1 left. */
  fire(side: number): void {
    this.firedAt[side] = this.now;
  }

  destroy(): void {
    this.container.destroy();
    this.shadow.destroy();
    this.ring.destroy();
  }
}
