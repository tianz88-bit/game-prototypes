// One ship on screen, drawn with the approved Human Nomad rig: twelve parts in fixed Z order with
// the kit's 3% per-layer shading, parent-accumulated facing offsets, engine rattle, canopy lean on turns,
// hover lift and a hard ground shadow cast away from the planet's sun. A ground ring marks your ship (cyan) versus others (orange).
// Guns kick with the kit's recoil curve when they fire. Thruster exhaust comes from the nozzles.
// Not yet ported: FFD pitch/bank tilt (needs a Phaser Mesh renderer and profiling).
import Phaser from 'phaser';
import { MODULES, depth, layerBrightness, pose, recoilPose, rigAngle } from './shipRig';
import { CALIBRATION, SHADOW_KEY, partKey } from './shipArt';
import { clientTune } from '../clientTune';
import { ThrusterVFX } from './thrusters';
import type { NozzleOrigin, ThrusterInput } from './thrusters';

const SHIP_DEPTH = 20;

/** Where and how to draw a ship this frame, from the planet projection and lighting. */
export interface ShipPlacement {
  x: number;
  y: number;
  /** Screen pixels per world unit at the ship. */
  scale: number;
  /** False when the ship is over the horizon. */
  visible: boolean;
  /** How bright to draw the ship: 1 in daylight, slightly dimmer on the night side. */
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
  private exhaust = new ThrusterVFX();
  /** Shield impacts: the direction the hit came from (screen radians) and when. */
  private shieldHits: { angle: number; at: number }[] = [];
  private shieldGfx: Phaser.GameObjects.Graphics;
  private exhaustGfx: Phaser.GameObjects.Graphics;
  private lastSpeed: number | null = null;
  /** Until when (ms) each thruster demand stays on after it was last seen, so jitter cannot retrigger bursts. */
  private demandUntil = { throttle: 0, left: 0, right: 0 };
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
    this.exhaustGfx = scene.add.graphics().setDepth(SHIP_DEPTH - 0.5);
    this.shieldGfx = scene.add.graphics().setDepth(SHIP_DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD);
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

  /**
   * headingRad uses game convention (0 = +x). timeMs drives idle motion. speed (world units a second)
   * and boosting (dash) drive the thrusters: accelerating fires both engines, turning fires the outside one.
   */
  update(at: ShipPlacement, headingRad: number, timeMs: number, speed: number, boosting: boolean): void {
    this.exhaustGfx.setVisible(at.visible);
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
    // Thruster demand, read from how the ship is actually moving, so it works the same for your own
    // ship and for other players'.
    const t = clientTune.render;
    const accel = this.lastSpeed === null ? 0 : ((speed - this.lastSpeed) / dt) * 1000;
    const degPerSec = (dA / dt) * 1000;
    if (boosting || accel > t.thrusterAccel) this.demandUntil.throttle = timeMs + t.thrusterHoldMs;
    if (degPerSec < -t.thrusterTurnDegPerSec) this.demandUntil.left = timeMs + t.thrusterHoldMs;
    if (degPerSec > t.thrusterTurnDegPerSec) this.demandUntil.right = timeMs + t.thrusterHoldMs;
    const demand: ThrusterInput = { throttle: timeMs < this.demandUntil.throttle, left: timeMs < this.demandUntil.left, right: timeMs < this.demandUntil.right };
    this.lastSpeed = speed;
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
    this.updateExhaust(dt / 1000, demand, angle, timeMs, at);
    this.drawShield(at, timeMs);
    this.shadow
      .setPosition(at.shadowX, at.shadowY)
      .setScale(scale)
      .setAlpha(CALIBRATION.shadow.opacity * at.shadowAlpha)
      .setRotation((angle * Math.PI) / 180);
    this.ring.setPosition(x, y).setScale(scale);
  }

  /** Nozzle of an engine core: 43% of the core's length aft of its centre, as in the handoff's lab. */
  private nozzle(id: string, angle: number, timeMs: number): NozzleOrigin {
    const part = this.parts.find((p) => p.m.id === id) as (typeof this.parts)[number];
    const p = pose(part.m, angle, CALIBRATION, timeMs, 1, 0, 0);
    const w = CALIBRATION.modules[id].width;
    const h = (w * part.img.height) / part.img.width;
    const k = clientTune.render.shipScale;
    return {
      x: (p.x - Math.sin(p.rotation) * h * 0.43) * k,
      y: (p.y + Math.cos(p.rotation) * h * 0.43 - CALIBRATION.hoverLift) * k,
      width: w * k * 0.7,
      particleScale: k / 0.48,
      angle: (p.rotation * 180) / Math.PI,
    };
  }

  /** Exhaust lives in ship-relative units and is drawn at the ship's place and scale on screen. */
  private updateExhaust(dt: number, demand: ThrusterInput, angle: number, timeMs: number, at: ShipPlacement): void {
    this.exhaust.update(dt, demand, [this.nozzle('engineL', angle, timeMs), this.nozzle('engineR', angle, timeMs)]);
    const g = this.exhaustGfx;
    g.clear();
    const s = at.scale;
    const rect = (cx: number, cy: number, w: number, h: number, a: number, oy = 0): void => {
      // A rotated rectangle as four points; oy shifts it along its own length (for the flash blocks).
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const pts: Phaser.Math.Vector2[] = [];
      for (const [u, v] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]]) {
        const lx = u * w;
        const ly = (v - 0.5) * h + oy;
        pts.push(new Phaser.Math.Vector2(at.x + (cx + c * lx - sn * ly) * s, at.y + (cy + sn * lx + c * ly) * s));
      }
      g.fillPoints(pts, true);
    };
    for (const p of this.exhaust.particles) {
      const a = 1 - p.age / p.life;
      g.fillStyle(p.colour, a * a);
      rect(p.x, p.y, p.w, p.h, p.angle);
    }
    for (const f of this.exhaust.flashes) {
      const t = f.age / f.life;
      const size = f.width * (0.8 + t * 1.2);
      const a = (f.angle * Math.PI) / 180;
      g.fillStyle(0x73cfff, (1 - t) * 0.85);
      rect(f.x, f.y, size, size * 0.5, a, size * 0.25);
      g.fillStyle(0xf0fcff, (1 - t) * 0.85);
      rect(f.x, f.y, size * 0.6, size * 0.26, a, size * 0.13);
      g.fillStyle(0xffb173, (1 - t) * 0.85);
      rect(f.x, f.y, size * 0.28, 4 * (f.particleScale ?? 1), a, 0);
    }
  }

  /** The shield blocked a hit coming from this screen direction (radians). */
  shieldHit(angle: number): void {
    this.shieldHits.push({ angle, at: this.now });
  }

  /**
   * Blocked hits: a honeycomb of blue hexagon cells lights up on the shield bubble where the hit landed,
   * brightest at the impact and fading outward, with a faint flash of the whole bubble.
   */
  private drawShield(at: ShipPlacement, timeMs: number): void {
    const g = this.shieldGfx;
    g.clear();
    const LIFE = 450;
    this.shieldHits = this.shieldHits.filter((h) => timeMs - h.at < LIFE);
    g.setVisible(at.visible && this.shieldHits.length > 0);
    if (!at.visible || !this.shieldHits.length) return;
    const R = clientTune.render.shipRingRadius * clientTune.render.shipScale * at.scale * 1.12;
    const hex = R * 0.34;
    for (const h of this.shieldHits) {
      const k = (timeMs - h.at) / LIFE;
      const fade = 1 - k;
      // The whole bubble flashes briefly, then the hex patch holds where the hit landed.
      g.fillStyle(0x2f8cff, 0.22 * fade);
      g.fillCircle(at.x, at.y, R);
      g.lineStyle(2.5, 0x6fd0ff, 0.9 * fade);
      g.strokeCircle(at.x, at.y, R);
      // A honeycomb patch centred on the impact: one cell, its ring of six, fading outward.
      const ix = at.x + Math.cos(h.angle) * R * 0.9;
      const iy = at.y + Math.sin(h.angle) * R * 0.9;
      const cells: [number, number, number][] = [[0, 0, 1]];
      for (let n = 0; n < 6; n++) {
        const t = h.angle + Math.PI / 6 + (n * Math.PI) / 3;
        cells.push([Math.cos(t) * hex * 1.73, Math.sin(t) * hex * 1.73, 0.6]);
      }
      for (const [dx, dy, w] of cells) {
        const a = fade * w;
        const cx = ix + dx;
        const cy = iy + dy;
        const pts: Phaser.Math.Vector2[] = [];
        for (let v = 0; v < 6; v++) {
          const t = h.angle + (v * Math.PI) / 3;
          pts.push(new Phaser.Math.Vector2(cx + Math.cos(t) * hex * 0.94, cy + Math.sin(t) * hex * 0.94));
        }
        g.fillStyle(0x3aa8ff, 0.75 * a);
        g.fillPoints(pts, true);
        g.lineStyle(3, 0xbfeaff, a);
        g.strokePoints(pts, true);
      }
    }
  }

  /** A gun fired: side 1 right, -1 left. */
  fire(side: number): void {
    this.firedAt[side] = this.now;
  }

  destroy(): void {
    this.container.destroy();
    this.exhaustGfx.destroy();
    this.shieldGfx.destroy();
    this.shadow.destroy();
    this.ring.destroy();
  }
}
