// One ship on screen, drawn with the approved Human Nomad rig: twelve parts in fixed Z order with
// the kit's 3% per-layer shading, parent-accumulated facing offsets, engine rattle, canopy lean on turns,
// hover lift and a hard ground shadow cast away from the planet's sun. A ground ring marks your ship (cyan) versus others (orange).
// Guns kick with the kit's recoil curve when they fire.
// Not yet ported: FFD pitch/bank tilt (needs a Phaser Mesh renderer and profiling).
import Phaser from 'phaser';
import { MODULES, depth, layerBrightness, pose, recoilPose, rigAngle } from './shipRig';
import { CALIBRATION, SHADOW_KEY, partKey } from './shipArt';
import { clientTune } from '../clientTune';

const SHIP_DEPTH = 20;

/** Where and how to draw a ship this frame, from the planet projection and lighting. */
export interface ShipPlacement {
  x: number;
  y: number;
  /** Screen pixels per world unit at the ship. */
  scale: number;
  /** False when the ship is over the horizon. */
  visible: boolean;
  /** 0.3 (night) to 1 (full sun). */
  brightness: number;
  /** Screen position of the hard ground shadow, and its strength (0 at night). */
  shadowX: number;
  shadowY: number;
  shadowAlpha: number;
}

export class ShipView {
  private container: Phaser.GameObjects.Container;
  private parts: { m: (typeof MODULES)[number]; img: Phaser.GameObjects.Image; scale: number; shade: number }[] = [];
  private lastBrightness = -1;
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
      this.container.add(img);
      this.parts.push({ m, img, scale, shade: layerBrightness(m, CALIBRATION) });
    }
  }

  /** headingRad uses game convention (0 = +x). timeMs drives idle motion. */
  update(at: ShipPlacement, headingRad: number, timeMs: number): void {
    this.container.setVisible(at.visible);
    this.shadow.setVisible(at.visible && at.shadowAlpha > 0.01);
    this.ring.setVisible(at.visible);
    if (!at.visible) return;
    const x = at.x;
    const y = at.y;
    const scale = clientTune.render.shipScale * at.scale;
    // Sunlight scales every layer's 3% step shade together; retint only when it changes visibly.
    if (Math.abs(at.brightness - this.lastBrightness) > 0.004) {
      this.lastBrightness = at.brightness;
      for (const p of this.parts) {
        const c = Math.round(255 * p.shade * at.brightness);
        p.img.setTint((c << 16) | (c << 8) | c);
      }
    }
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
      .setPosition(at.shadowX, at.shadowY)
      .setScale(scale)
      .setAlpha(CALIBRATION.shadow.opacity * at.shadowAlpha)
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
