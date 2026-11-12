// One ship on screen, drawn with the approved Human Nomad rig: twelve parts in fixed Z order with
// the kit's 3% per-layer shading, parent-accumulated facing offsets, engine rattle, canopy lean on turns,
// hover lift and a hard ground shadow cast away from the planet's sun. A ground ring marks your ship (cyan) versus others (orange).
// Guns kick with the kit's recoil curve when they fire. Thruster exhaust comes from the nozzles.
// Not yet ported: FFD pitch/bank tilt (needs a Phaser Mesh renderer and profiling).
import Phaser from 'phaser';
import { MODULES, depth, layerBrightness, pose, recoilPose, rigAngle } from './shipRig';
import { CALIBRATION, SHADOW_KEY, partKey } from './shipArt';
import { clientTune } from '../clientTune';
import { TUNE } from '../../sim/tune';
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
    // The plume lengthens over the top quarter of the speed range and is longest at max speed or in a dash.
    const top = TUNE.ship.maxSpeed;
    const from = top - (top - TUNE.ship.cruiseSpeed) / 2;
    const speedTrail = boosting ? 1 : Math.max(0, Math.min(1, (speed - from) / Math.max(1, top - 1 - from)));
    const demand: ThrusterInput = { throttle: timeMs < this.demandUntil.throttle, left: timeMs < this.demandUntil.left, right: timeMs < this.demandUntil.right, speedTrail };
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
    this.updateExhaust(dt / 1000, demand, angle, timeMs, at, boosting);
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
  private updateExhaust(dt: number, demand: ThrusterInput, angle: number, timeMs: number, at: ShipPlacement, boosting: boolean): void {
    const nozzles:[NozzleOrigin,NozzleOrigin]=[this.nozzle('engineL',angle,timeMs),this.nozzle('engineR',angle,timeMs)];
    this.exhaust.update(dt, demand, nozzles, clientTune.render.thrusterTopSpeedStretch);
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
    for(let i=0;i<nozzles.length;i++){
      const n=nozzles[i],a=n.angle*Math.PI/180,len=n.width*(this.exhaust.strong[i]?1.5: .7)*(boosting?1.6:1);
      g.fillStyle(0x73d9ff,.25);rect(n.x,n.y,n.width*.65,len,a,len*.4);
      g.fillStyle(0xe8fdff,.85);rect(n.x,n.y,n.width*.24,n.width*.38,a,n.width*.12);
    }
    if(boosting){const a=angle*Math.PI/180,dx=-Math.sin(a),dy=Math.cos(a),sx=Math.cos(a),sy=Math.sin(a);
      g.lineStyle(Math.max(1,s*2),0x9befff,.4);
      for(const side of [-1,1])for(let i=0;i<3;i++){const start=20+i*14,end=start+24-i*4,off=side*(16+i*7);
        g.lineBetween(at.x+(dx*start+sx*off)*s,at.y+(dy*start+sy*off)*s,at.x+(dx*end+sx*off)*s,at.y+(dy*end+sy*off)*s);}
    }
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
   * Blocked hits (owner reference: a glowing sphere tiled with hexagons). The shield shows as a sphere
   * seen from above: a hex grid wrapped onto it, so cells shrink and flatten toward the rim, a translucent
   * blue body and a glowing rim. On a hit the sphere fades in; some cells on the hit side (picked by a
   * fixed pattern, so it reads as pieces lighting up) flash bright, strongest nearest the impact.
   */
  private drawShield(at: ShipPlacement, timeMs: number): void {
    const g = this.shieldGfx;
    g.clear();
    const LIFE = 500;
    this.shieldHits = this.shieldHits.filter((h) => timeMs - h.at < LIFE).slice(-8);
    g.setVisible(at.visible && this.shieldHits.length > 0);
    if (!at.visible || !this.shieldHits.length) return;
    const R = clientTune.render.shipRingRadius * clientTune.render.shipScale * at.scale * 1.2;
    let bubble = 0;
    for (const h of this.shieldHits) bubble = Math.max(bubble, 1 - (timeMs - h.at) / LIFE);
    // Body and rim glow.
    g.fillStyle(0x0b2a6a, 0.16 * bubble);
    g.fillCircle(at.x, at.y, R);
    for (let k = 0; k < 3; k++) {
      g.lineStyle(6 - k * 1.4, 0x3a8cff, (0.12 + k * 0.12) * bubble);
      g.strokeCircle(at.x, at.y, R - k * 1.5);
    }
    for(const hit of this.shieldHits){const fade=1-(timeMs-hit.at)/LIFE;
      g.lineStyle(Math.max(1,at.scale*3),0xc9f7ff,fade*.8);g.beginPath();g.arc(at.x,at.y,R,hit.angle-.28,hit.angle+.28);g.strokePath();}
    // Hex cells on the sphere: centres on a flat hex grid in sphere-angle units (|p| = 1 is the rim),
    // mapped by the orthographic view of a sphere: screen radius = sin(|p| x 90 degrees) x R.
    const project = (u: number, v: number): { x: number; y: number } | null => {
      const r = Math.hypot(u, v);
      if (r >= 1) return null;
      const k = r < 1e-6 ? 1 : Math.sin((r * Math.PI) / 2) / r;
      return { x: at.x + u * k * R, y: at.y + v * k * R };
    };
    const cell = 0.2; // hex radius in sphere-angle units
    const dx = cell * Math.sqrt(3);
    const dy = cell * 1.5;
    for (let row = -6; row <= 6; row++) {
      for (let col = -6; col <= 6; col++) {
        const u = col * dx + (row & 1 ? dx / 2 : 0);
        const v = row * dy;
        const r = Math.hypot(u, v);
        if (r > 0.93) continue;
        const centre = project(u, v);
        if (!centre) continue;
        // Flash: cells facing the hit, a fixed half of them (pieces), brightest near the impact.
        let flash = 0;
        const ang = Math.atan2(v, u);
        for (const h of this.shieldHits) {
          const fade = 1 - (timeMs - h.at) / LIFE;
          const off = Math.abs(((ang - h.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const side = Math.max(0, 1 - off / (Math.PI / 2.4)) * Math.min(1, r * 1.6);
          const pick = ((row * 7 + col * 13) & 3) !== 0 ? 1 : 0.25;
          flash = Math.max(flash, fade * side * side * pick);
        }
        const pts: Phaser.Math.Vector2[] = [];
        for (let n = 0; n < 6; n++) {
          const t = Math.PI / 6 + (n * Math.PI) / 3;
          const q = project(u + Math.cos(t) * cell * 0.86, v + Math.sin(t) * cell * 0.86);
          if (q) pts.push(new Phaser.Math.Vector2(q.x, q.y));
        }
        if (pts.length < 6) continue;
        if (flash > 0.03) {
          g.fillStyle(0x6fd0ff, 0.5 * flash);
          g.fillPoints(pts, true);
        }
        g.lineStyle(flash > 0.03 ? 2 : 1, flash > 0.03 ? 0xd6f4ff : 0x5aa8ff, Math.max(0.22 * bubble, flash));
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
