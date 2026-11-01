import type Phaser from 'phaser';

/** World-only immediate-mode art. Sizes are world pixels; angles/phases are radians.
 * Callers own Graphics lifetime, clearing, culling and terrain caching. No scene
 * objects, textures, timers, randomness or simulation state are created here. */
export const COLORS = [0x229eaa, 0xed7566, 0x9274c9, 0xd6aa3f, 0x518bc7, 0x78a45e] as const;
export const PALETTE = {
  parchment: 0xeee5c9, sage: 0xd9dfbf, seam: 0xb6bea6, side: 0xb8b69b,
  ink: 0x30464b, cream: 0xfff6db, shadow: 0x263b40,
  crater: 0x77766c, craterDeep: 0x454c49, metal: 0x63777a,
  valid: 0x81b960, invalid: 0xd85e53,
} as const;
type Graphics = Phaser.GameObjects.Graphics;
export type UnitKind = 'infantry' | 'tank' | 'artillery';
export type BuildingKind = 'hq' | UnitKind;
export interface HexOptions {
  owner: number | null; burnt: boolean; committed: boolean;
  hover?: boolean; valid?: boolean; selected?: boolean;
  capture?: number; captureOwner?: number | null; time?: number;
}
export interface BuildingOptions {
  hp?: number; maxHp?: number; progress?: number; selected?: boolean; time?: number;
}
export interface UnitOptions {
  attacking?: boolean; moving?: boolean; phase?: number; hp?: number; maxHp?: number;
  /** Actual attack-target direction in projected screen radians; never turns the body. */
  angle?: number;
}
export interface CaptureFlipOptions {
  owner: number | null; previousOwner: number | null; committed: boolean;
  progress: number;
  /** Maximum lift in world pixels; defaults to half the hex radius. */
  lift?: number;
}
const DEFAULT_BUILDING_OPTIONS: BuildingOptions = {};
const DEFAULT_UNIT_OPTIONS: UnitOptions = {};
const TAU = Math.PI * 2;
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
export function playerColor(owner: number | null): number {
  return owner === null || !Number.isFinite(owner) ? PALETTE.seam : COLORS[((Math.trunc(owner) % COLORS.length) + COLORS.length) % COLORS.length];
}

/** Pointy-top circumradius, with vertical projection applied after construction. */
export function hexPoints(cx: number, cy: number, r: number, sy = 0.72): { x: number; y: number }[] {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * sy });
  }
  return points;
}

/** Partial hex perimeter, starting at the north tip; progress is normalized. */
function perimeter(g: Graphics, x: number, y: number, r: number, progress: number, color: number, width: number) {
  const points = hexPoints(x, y, r);
  let remaining = clamp(progress) * 6;
  g.lineStyle(width, color, 1);
  for (let i = 0; i < 6 && remaining > 0; i++, remaining--) {
    const a = points[i], b = points[(i + 1) % 6], t = Math.min(1, remaining);
    g.lineBetween(a.x, a.y, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }
}

export function drawHex(g: Graphics, x: number, y: number, r: number, o: HexOptions): void {
  if (!(r > 0)) return;
  const edge = Math.max(1, r * 0.035), color = playerColor(o.owner);
  g.fillStyle(PALETTE.side).fillPoints(hexPoints(x, y + r * 0.075, r * 0.98), true);
  g.fillStyle(o.burnt ? PALETTE.crater : o.owner === null ? PALETTE.parchment : PALETTE.sage)
    .fillPoints(hexPoints(x, y, r * 0.98), true);
  g.lineStyle(edge, PALETTE.seam).strokePoints(hexPoints(x, y, r * 0.98), true);
  if (o.burnt) {
    g.fillStyle(PALETTE.craterDeep).fillPoints(hexPoints(x, y + r * 0.055, r * 0.61), true);
    g.fillStyle(PALETTE.crater).fillPoints(hexPoints(x, y + r * 0.12, r * 0.49), true);
    g.lineStyle(edge * 1.2, PALETTE.craterDeep);
    g.lineBetween(x - r * 0.74, y - r * 0.18, x - r * 0.38, y - r * 0.1);
    g.lineBetween(x - r * 0.38, y - r * 0.1, x - r * 0.29, y - r * 0.34);
    g.lineBetween(x + r * 0.33, y + r * 0.18, x + r * 0.7, y + r * 0.28);
    g.lineBetween(x + r * 0.55, y + r * 0.24, x + r * 0.61, y + r * 0.46);
  } else if (o.committed) {
    // Short parallel grooves deliberately stay inside the pointy hex.
    g.lineStyle(Math.max(1.5, r * 0.075), PALETTE.ink, 0.18);
    for (let i = -2; i <= 2; i++) {
      const dx = i * r * 0.19, h = r * (0.31 - Math.abs(i) * 0.045);
      g.lineBetween(x + dx - r * 0.13, y + h, x + dx + r * 0.13, y - h);
    }
  } else {
    g.lineStyle(edge * 0.7, PALETTE.cream, 0.55).strokePoints(hexPoints(x, y, r * 0.77), true);
  }
  if (o.owner !== null) perimeter(g, x, y, r * 0.92, 1, color, edge * 1.5);
  if (o.capture !== undefined && o.capture > 0) {
    perimeter(g, x, y, r * 0.8, 1, PALETTE.ink, edge * 2.4);
    perimeter(g, x, y, r * 0.8, o.capture, playerColor(o.captureOwner ?? null), edge * 2.4);
  }
  if (o.hover || o.selected || o.valid !== undefined) {
    const highlight = o.valid === false ? PALETTE.invalid : o.valid === true ? PALETTE.valid : PALETTE.cream;
    g.fillStyle(highlight, o.valid === false ? 0.2 : 0.12).fillPoints(hexPoints(x, y, r * 0.88), true);
    perimeter(g, x, y, r * 0.87, 1, highlight, edge * 2);
  }
}

/** Cosmetic ownership transition only. Draw below entities, in place of the
 * cached tile. Caller owns lifetime (suggested 650ms) and reduced-motion policy.
 * Both endpoints exactly match drawHex; no shadow remains after landing. */
export function drawCaptureFlip(g: Graphics, x: number, y: number, r: number, o: CaptureFlipOptions): void {
  if (!(r > 0)) return;
  const p = clamp(o.progress);
  const owner = p < 0.5 ? o.previousOwner : o.owner;
  if (p === 0 || p === 1) {
    drawHex(g, x, y, r, { owner, burnt: false, committed: o.committed });
    return;
  }
  let sx = 1, sy = 1, height = 0, tilt = 0;
  if (p < 0.15) {
    const press = Math.sin(p / 0.15 * Math.PI);
    sx += press * 0.08; sy -= press * 0.13; height = -press * r * 0.035;
  } else if (p < 0.85) {
    const flight = (p - 0.15) / 0.7;
    const arc = Math.sin(flight * Math.PI);
    height = arc * Math.max(0, o.lift ?? r * 0.5);
    sx += arc * 0.1;
    // Positive scale avoids mirrored hatching; owner changes at the edge-on pose.
    sy = Math.max(0.045, Math.abs(Math.cos(flight * Math.PI)));
    tilt = Math.sin(flight * TAU) * 0.13;
  } else {
    const settle = (p - 0.85) / 0.15;
    const squash = Math.sin(settle * Math.PI) * (1 - settle);
    sx += squash * 0.22; sy -= squash * 0.28; height = -squash * r * 0.04;
  }
  g.fillStyle(PALETTE.shadow, 0.13 + Math.max(0, height) / r * 0.12)
    .fillEllipse(x, y + r * 0.055, r * 1.6, r * 0.9);
  g.save().translateCanvas(x, y - height);
  // Anisotropic scaling between opposite rotations gives a cheap affine skew.
  g.rotateCanvas(tilt).scaleCanvas(sx, sy).rotateCanvas(-tilt);
  drawHex(g, 0, 0, r, { owner, burnt: false, committed: o.committed });
  g.restore();
}

function health(g: Graphics, x: number, y: number, w: number, hp?: number, maxHp?: number) {
  if (hp === undefined || maxHp === undefined || maxHp <= 0 || hp >= maxHp) return;
  g.fillStyle(PALETTE.ink).fillRoundedRect(x - w / 2, y, w, Math.max(2, w * 0.1), 1);
  g.fillStyle(hp / maxHp > 0.35 ? 0x8fc477 : PALETTE.invalid)
    .fillRoundedRect(x - w / 2, y, w * clamp(hp / maxHp), Math.max(2, w * 0.1), 1);
}

/** A small owner glyph provides a non-colour cue, shared by units and buildings. */
function badge(g: Graphics, owner: number, x: number, y: number, r: number) {
  const index = ((Math.trunc(owner) % 6) + 6) % 6;
  g.fillStyle(PALETTE.cream).lineStyle(Math.max(1, r * 0.35), PALETTE.cream);
  if (index === 0) g.fillCircle(x, y, r);
  else if (index === 1) g.fillTriangle(x, y - r * 1.2, x + r, y + r, x - r, y + r);
  else if (index === 2) g.fillRect(x - r, y - r, r * 2, r * 2);
  else if (index === 3) {
    g.lineBetween(x - r, y, x + r, y); g.lineBetween(x, y - r, x, y + r);
  } else if (index === 4) {
    g.lineBetween(x - r, y - r, x + r, y + r); g.lineBetween(x - r, y + r, x + r, y - r);
  } else g.strokeCircle(x, y, r);
}

export function drawBuilding(g: Graphics, x: number, y: number, size: number, owner: number, kind: BuildingKind, o: BuildingOptions = DEFAULT_BUILDING_OPTIONS): void {
  if (!(size > 0)) return;
  const color = playerColor(owner);
  g.save().translateCanvas(x, y).scaleCanvas(size, size);
  g.fillStyle(PALETTE.shadow, 0.18).fillEllipse(0.03, 0.2, 1.58, 0.53);
  if (o.selected) g.lineStyle(0.06, PALETTE.cream).strokeEllipse(0, 0.15, 1.6, 0.63);
  g.fillStyle(PALETTE.metal).fillRoundedRect(-0.63, -0.29, 1.26, 0.66, 0.09);
  g.fillStyle(PALETTE.cream).fillRoundedRect(-0.63, -0.44, 1.26, 0.52, 0.08);
  g.fillStyle(color).fillRect(-0.63, -0.02, 1.26, 0.11);
  if (kind === 'hq') {
    g.fillStyle(color).fillRoundedRect(-0.37, -0.86, 0.74, 0.88, 0.06);
    g.fillStyle(PALETTE.cream).fillRoundedRect(-0.4, -0.94, 0.8, 0.22, 0.04);
    badge(g, owner, 0, -0.43, 0.12);
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.17, 0.06, 0.34, 0.31, 0.03);
    g.lineStyle(0.045, PALETTE.ink).lineBetween(0.22, -0.96, 0.22, -1.34);
    g.fillStyle(color).fillTriangle(0.24, -1.34, 0.58, -1.22, 0.24, -1.1);
  } else if (kind === 'infantry') {
    // Barracks: broad low roof, two doorways, helmet-shaped roof emblem.
    g.fillStyle(color).fillRoundedRect(-0.55, -0.57, 1.1, 0.29, 0.05);
    g.fillStyle(PALETTE.ink).fillRect(-0.42, 0.09, 0.26, 0.28).fillRect(0.15, 0.09, 0.26, 0.28);
    g.fillStyle(PALETTE.cream).fillCircle(0, -0.46, 0.13).fillRect(-0.18, -0.44, 0.36, 0.055);
  } else if (kind === 'tank') {
    // Factory: tall paired stacks and a full-width garage shutter.
    g.fillStyle(PALETTE.ink).fillRect(0.15, -0.93, 0.13, 0.59).fillRect(0.37, -0.78, 0.13, 0.44);
    g.fillStyle(color).fillRect(0.15, -0.85, 0.13, 0.1).fillRect(0.37, -0.7, 0.13, 0.1);
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.43, -0.11, 0.86, 0.48, 0.03);
    g.lineStyle(0.035, PALETTE.metal);
    for (let i = 0; i < 3; i++) g.lineBetween(-0.37, 0.02 + i * 0.1, 0.37, 0.02 + i * 0.1);
  } else {
    // Artillery works: ammunition shed with a raised, angled test barrel.
    g.fillStyle(color).fillTriangle(-0.62, -0.44, 0, -0.82, 0.62, -0.44);
    g.lineStyle(0.16, PALETTE.ink).lineBetween(-0.05, -0.57, 0.49, -1.02);
    g.lineStyle(0.09, PALETTE.metal).lineBetween(-0.05, -0.6, 0.49, -1.05);
    g.fillStyle(PALETTE.ink).fillRect(-0.18, 0.08, 0.36, 0.29);
    g.fillStyle(color).fillRoundedRect(-0.53, 0.14, 0.21, 0.22, 0.02);
  }
  if (o.progress !== undefined) {
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.51, 0.4, 1.02, 0.09, 0.025);
    g.fillStyle(color).fillRoundedRect(-0.51, 0.4, 1.02 * clamp(o.progress), 0.09, 0.025);
  }
  g.restore();
  health(g, x, y - size * 1.51, size * 1.1, o.hp, o.maxHp);
}

export function drawUnit(g: Graphics, x: number, y: number, size: number, owner: number, kind: UnitKind, o: UnitOptions = DEFAULT_UNIT_OPTIONS): void {
  if (!(size > 0)) return;
  const color = playerColor(owner), phase = o.phase ?? 0;
  const kick = o.attacking ? Math.max(0, Math.cos(phase)) * 0.1 : 0;
  g.save().translateCanvas(x, y).scaleCanvas(size, size);
  g.fillStyle(PALETTE.shadow, 0.2).fillEllipse(0, 0.25, 1.2, 0.42);
  // Body and ownership marker always remain upright in this 2D view.
  g.lineStyle(0.055, color).strokeEllipse(0, 0.23, 1.16, 0.46);
  badge(g, owner, -0.44, 0.23, 0.055);
  if (kind === 'infantry') {
    const stride = o.moving && !o.attacking ? Math.sin(phase) * 0.14 : 0;
    const bob = o.attacking ? kick * 0.3 : o.moving ? Math.abs(Math.sin(phase)) * 0.035 : 0;
    g.lineStyle(0.16, PALETTE.ink);
    g.lineBetween(-0.13, 0.02, -0.19 - stride, 0.31);
    g.lineBetween(0.13, 0.02, 0.19 + stride, 0.31);
    g.fillStyle(color).fillRoundedRect(-0.25 - kick, -0.48 - bob, 0.5, 0.57, 0.12);
    g.fillStyle(PALETTE.metal).fillRoundedRect(-0.34 - kick, -0.43 - bob, 0.15, 0.37, 0.04);
    g.fillStyle(0xe7bf90).fillCircle(-kick, -0.58 - bob, 0.2);
    g.fillStyle(color).fillEllipse(-0.03 - kick, -0.71 - bob, 0.54, 0.35);
    g.fillStyle(PALETTE.ink).fillRect(0.03 - kick, -0.6 - bob, 0.19, 0.065);
    g.lineStyle(0.11, PALETTE.ink).lineBetween(0.06 - kick, -0.21, 0.58 - kick, -0.33);
    g.fillStyle(0xe7bf90).fillCircle(0.24 - kick, -0.26, 0.085);
  } else {
    const artillery = kind === 'artillery';
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.57, -0.35, 1.07, 0.23, 0.08)
      .fillRoundedRect(-0.57, 0.14, 1.07, 0.23, 0.08);
    g.lineStyle(0.025, PALETTE.metal);
    for (let i = 0; i < 4; i++) {
      const tx = -0.42 + i * 0.23;
      g.lineBetween(tx, -0.32, tx, -0.15); g.lineBetween(tx, 0.18, tx, 0.33);
    }
    g.fillStyle(color).fillRoundedRect(-0.5 - kick, -0.29, 0.97, 0.54, 0.12);
    g.fillStyle(PALETTE.cream, 0.5).fillRoundedRect(-0.42 - kick, -0.27, 0.76, 0.08, 0.03);
    g.fillStyle(PALETTE.metal).fillRoundedRect(-0.26 - kick, -0.24, 0.57, 0.38, 0.1);
    g.fillStyle(color).fillRoundedRect(-0.26 - kick, -0.29, 0.57, 0.29, 0.08);
    g.lineStyle(artillery ? 0.14 : 0.12, PALETTE.ink)
      .lineBetween(0.15 - kick, -0.13, (artillery ? 0.98 : 0.79) - kick, artillery ? -0.37 : -0.13);
    g.lineStyle(0.065, PALETTE.metal)
      .lineBetween(0.15 - kick, -0.15, (artillery ? 0.98 : 0.79) - kick, artillery ? -0.39 : -0.15);
    if (artillery) {
      g.lineStyle(0.07, PALETTE.ink).lineBetween(-0.43, 0.14, -0.7, 0.42);
      g.lineBetween(-0.43, -0.19, -0.7, -0.45);
    }
    badge(g, owner, -0.34 - kick, -0.06, 0.065);
  }
  if (o.attacking) {
    const angle = Number.isFinite(o.angle) ? o.angle! : 0;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    // Intersect the actual screen-space ray with the elliptical ownership ring.
    const distance = 1 / Math.hypot(dx / 0.58, dy / 0.23);
    const ax = dx * distance, ay = 0.23 + dy * distance;
    g.lineStyle(0.035, PALETTE.ink).fillStyle(color);
    const tipX = ax + dx * 0.17, tipY = ay + dy * 0.17;
    const leftX = ax - dx * 0.04 - dy * 0.1, leftY = ay - dy * 0.04 + dx * 0.1;
    const rightX = ax - dx * 0.04 + dy * 0.1, rightY = ay - dy * 0.04 - dx * 0.1;
    g.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY)
      .strokeTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
    if (Math.cos(phase) > 0.65) {
      // External firing cue follows the target; the upright gun art stays fixed.
      g.lineStyle(0.045, 0xf3bf55).lineBetween(ax + dx * 0.23, ay + dy * 0.23, ax + dx * 0.42, ay + dy * 0.42);
      g.fillStyle(PALETTE.cream).fillCircle(ax + dx * 0.3, ay + dy * 0.3, 0.055);
    }
  }
  g.restore();
  health(g, x, y - size * 1.02, size * 0.9, o.hp, o.maxHp);
}

/** Caller supplies normalized lifetime; can be culled/pooled without timers. */
export function drawExplosion(g: Graphics, x: number, y: number, size: number, progress: number): void {
  const p = clamp(progress);
  if (p >= 1 || !(size > 0)) return;
  const fade = 1 - p;
  g.fillStyle(PALETTE.shadow, fade * 0.15).fillEllipse(x, y + size * 0.2, size * (1 + p), size * 0.4);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6, spread = size * p * 0.8;
    g.fillStyle(p < 0.4 ? 0xed9d42 : PALETTE.crater, fade * 0.8)
      .fillCircle(x + Math.cos(a) * spread, y + Math.sin(a) * spread * 0.7 - size * p * 0.4, size * fade * 0.3);
  }
  if (p < 0.5) g.fillStyle(PALETTE.cream, 1 - p * 2).fillCircle(x, y - size * p * 0.2, size * (0.25 + p));
}
