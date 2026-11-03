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
export type UnitKind = 'infantry' | 'tank' | 'artillery' | 'helicopter' | 'fighter' | 'missile' | 'bomber' | 'mlrs'
  | 'scout' | 'gunner' | 'flak' | 'walker' | 'destroyer' | 'gunship' | 'siege' | 'carrier'
  | 'bunker' | 'silo';
export type BuildingKind = 'hq' | UnitKind;
export type CommitmentKind = 'building' | 'upgrade' | 'research' | 'release';
export interface HexOptions {
  owner: number | null; burnt: boolean; committed: boolean;
  commitment?: CommitmentKind;
  hover?: boolean; valid?: boolean; selected?: boolean;
  capture?: number; captureOwner?: number | null; time?: number;
}
export interface BuildingOptions {
  hp?: number; maxHp?: number; progress?: number; selected?: boolean; time?: number;
  /** Construction/conversion progress, separate from unit-production progress. */
  construction?: number; upgrading?: number;
}
export interface UnitOptions {
  attacking?: boolean; moving?: boolean; phase?: number; hp?: number; maxHp?: number;
  /** Horizontal body facing only. Ring, health and target direction stay unmirrored. */
  facingX?: 1 | -1;
  /** Actual attack-target direction in projected screen radians; never turns the body. */
  angle?: number;
  /** Positive member HP values are alive; zeros preserve holes in formation. */
  members?: number[];
  memberCount?: number;
  /** Cosmetic opacity, used by retirement effects. Does not change Graphics alpha. */
  opacity?: number;
}
export interface CaptureFlipOptions {
  owner: number | null; previousOwner: number | null; committed: boolean;
  commitment?: CommitmentKind;
  progress: number;
  /** Maximum lift in world pixels; defaults to 0.9 times the hex radius. */
  lift?: number;
}
const DEFAULT_BUILDING_OPTIONS: BuildingOptions = {};
const DEFAULT_UNIT_OPTIONS: UnitOptions = {};
const TAU = Math.PI * 2;
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
export function playerColor(owner: number | null): number {
  return owner === null || !Number.isFinite(owner) ? PALETTE.seam : COLORS[((Math.trunc(owner) % COLORS.length) + COLORS.length) % COLORS.length];
}

/** One active faction order, drawn under the commanded HQ rather than the selection. */
export function drawHqCommand(g:Graphics,x:number,y:number,r:number,attack:boolean,phase:number):void {
  const color=attack?0xf3ac3f:0x19b9be,pulse=(1-Math.cos(phase*TAU))/2,cy=y+r*0.18;
  g.fillStyle(color,0.1+0.08*pulse).fillEllipse(x,cy,r*2.85,r*1.9);
  g.lineStyle(5,PALETTE.ink,0.65).strokeEllipse(x,cy,r*2.65,r*1.76);
  g.lineStyle(3,color,1).strokeEllipse(x,cy,r*2.65,r*1.76);
  g.lineStyle(2,color,0.65*(1-phase)).strokeEllipse(x,cy,r*(2.65+phase*0.6),r*(1.76+phase*0.4));
  for(let i=0;i<6;i++) {
    const angle=i*TAU/6,dx=Math.cos(angle),dy=Math.sin(angle),distance=r*(1.42-phase*0.25);
    const tip={x:x+dx*(distance-r*0.19),y:cy+dy*(distance-r*0.19)*0.66};
    const points=[tip,{x:x+dx*distance-dy*r*0.12,y:cy+(dy*distance+dx*r*0.12)*0.66},{x:x+dx*distance+dy*r*0.12,y:cy+(dy*distance-dx*r*0.12)*0.66}];
    g.lineStyle(2,PALETTE.ink,0.85).strokePoints(points,true);
    g.fillStyle(0xfff6db,1).fillPoints(points,true);
  }
}

export function drawUpgradeReady(g:Graphics,x:number,y:number,r:number,bob:number):void {
  const cy=y-r*0.98-bob,points=[{x:x,y:cy-r*0.22},{x:x+r*0.2,y:cy},{x:x+r*0.08,y:cy},{x:x+r*0.08,y:cy+r*0.2},{x:x-r*0.08,y:cy+r*0.2},{x:x-r*0.08,y:cy},{x:x-r*0.2,y:cy}];
  g.lineStyle(3,PALETTE.ink,0.95).strokePoints(points,true);
  g.fillStyle(0xffe59a,1).fillPoints(points,true);
}

function committedColor(owner: number | null): number {
  const c = playerColor(owner);
  return (Math.round((c >> 16 & 255) * 0.66) << 16)
    | (Math.round((c >> 8 & 255) * 0.66) << 8) | Math.round((c & 255) * 0.66);
}

/** Static upgrade arrow can be cached. Draw research markers separately each
 * frame above cached terrain, passing real-time milliseconds for gentle bobbing. */
export function drawCommitmentMarker(g: Graphics, x: number, y: number, r: number, type: CommitmentKind, time = 0): void {
  if (!(r > 0) || type === 'building' || type === 'release') return;
  if (type === 'upgrade') {
    const cy = y + r * 0.15;
    g.fillStyle(PALETTE.cream, 0.85).fillRect(x - r * 0.055, cy - r * 0.05, r * 0.11, r * 0.24);
    g.fillTriangle(x, cy - r * 0.24, x - r * 0.18, cy - r * 0.02, x + r * 0.18, cy - r * 0.02);
    return;
  }
  const cy = y + Math.sin(time / 650) * r * 0.045;
  g.fillStyle(PALETTE.cream, 0.33).fillTriangle(x, cy - r * 0.12, x - r * 0.23, cy + r * 0.24, x + r * 0.23, cy + r * 0.24);
  g.lineStyle(Math.max(1, r * 0.045), PALETTE.cream, 0.58).beginPath()
    .moveTo(x - r * 0.08, cy - r * 0.28).lineTo(x - r * 0.08, cy - r * 0.1)
    .lineTo(x - r * 0.25, cy + r * 0.23).lineTo(x + r * 0.25, cy + r * 0.23)
    .lineTo(x + r * 0.08, cy - r * 0.1).lineTo(x + r * 0.08, cy - r * 0.28).strokePath();
  g.lineBetween(x - r * 0.13, cy - r * 0.28, x + r * 0.13, cy - r * 0.28);
  g.lineStyle(Math.max(1, r * 0.035), PALETTE.cream, 0.38)
    .lineBetween(x - r * 0.14, cy + r * 0.1, x + r * 0.14, cy + r * 0.1);
}

/** Destroyed-support release: progress is ELAPSED fraction (0..1), not seconds
 * remaining. The remaining arc shrinks; completed overlays draw nothing. */
export function drawReleaseCountdown(g: Graphics, x: number, y: number, r: number, progress: number): void {
  const p = clamp(progress);
  if (!(r > 0) || p >= 1) return;
  const radius = r * 0.29;
  g.fillStyle(PALETTE.cream, 0.76).fillCircle(x, y, radius * 1.2);
  g.lineStyle(Math.max(1, r * 0.035), PALETTE.ink, 0.25).strokeCircle(x, y, radius);
  g.lineStyle(Math.max(1.5, r * 0.06), PALETTE.metal, 0.85).beginPath()
    .arc(x, y, radius, -Math.PI / 2 + p * TAU, Math.PI * 1.5, false).strokePath();
  g.lineStyle(Math.max(1, r * 0.04), PALETTE.ink, 0.7)
    .lineBetween(x, y, x, y - radius * 0.6).lineBetween(x, y, x + radius * 0.43, y + radius * 0.18);
  g.fillStyle(PALETTE.ink, 0.7).fillCircle(x, y, r * 0.025);
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
    g.fillStyle(committedColor(o.owner), 0.75).fillPoints(hexPoints(x, y + r * 0.025, r * 0.77), true);
    g.lineStyle(edge, PALETTE.ink, 0.18).strokePoints(hexPoints(x, y, r * 0.77), true);
    if (o.commitment === 'upgrade') drawCommitmentMarker(g, x, y, r, 'upgrade');
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
 * cached tile. Caller owns lifetime (suggested 900ms) and reduced-motion policy.
 * Both endpoints exactly match drawHex; no shadow remains after landing. */
export function drawCaptureFlip(g: Graphics, x: number, y: number, r: number, o: CaptureFlipOptions): void {
  if (!(r > 0)) return;
  const p = clamp(o.progress);
  const owner = p < 0.5 ? o.previousOwner : o.owner;
  if (p === 0 || p === 1) {
    drawHex(g, x, y, r, { owner, burnt: false, committed: o.committed, commitment: o.commitment });
    return;
  }
  let sx = 1, sy = 1, height = 0, tilt = 0, underside = false;
  if (p < 0.1) {
    const press = Math.sin(p / 0.1 * Math.PI);
    sx += press * 0.08; sy -= press * 0.13; height = -press * r * 0.035;
  } else if (p < 0.82) {
    const flight = (p - 0.1) / 0.72;
    const arc = Math.sin(flight * Math.PI);
    height = arc * Math.max(0, o.lift ?? r * 0.9);
    sx += arc * 0.14;
    const turn = Math.cos(flight * TAU);
    sy = Math.max(0.025, Math.abs(turn));
    underside = turn < 0;
    tilt = Math.sin(flight * TAU) * 0.2;
  } else {
    const settle = (p - 0.82) / 0.18;
    const squash = Math.sin(settle * Math.PI) * (1 - settle);
    sx += squash * 0.22; sy -= squash * 0.28; height = -squash * r * 0.04;
  }
  // Empty socket stays on the board, separating the airborne tile from terrain.
  g.fillStyle(PALETTE.side).fillPoints(hexPoints(x, y, r * 0.98), true);
  g.fillStyle(PALETTE.shadow, 0.23).fillPoints(hexPoints(x, y, r * 0.83), true);
  g.fillStyle(PALETTE.shadow, 0.22).fillEllipse(x, y + r * 0.08, r * (1.65 - Math.max(0, height) / r * 0.25), r * 0.78);
  // Unscaled thickness prevents the edge-on tile from vanishing into a hairline.
  g.lineStyle(Math.max(2, r * 0.1), PALETTE.metal)
    .lineBetween(x - r * 0.85 * sx, y - height + r * 0.03, x + r * 0.85 * sx, y - height + r * 0.03);
  g.save().translateCanvas(x, y - height);
  // Anisotropic scaling between opposite rotations gives a cheap affine skew.
  g.rotateCanvas(tilt).scaleCanvas(sx, sy).rotateCanvas(-tilt);
  if (underside) {
    g.fillStyle(PALETTE.metal).fillPoints(hexPoints(0, r * 0.075, r * 0.98), true);
    g.fillStyle(PALETTE.side).fillPoints(hexPoints(0, 0, r * 0.98), true);
    perimeter(g, 0, 0, r * 0.9, 1, PALETTE.ink, Math.max(1, r * 0.04));
    g.lineStyle(Math.max(1, r * 0.055), PALETTE.metal);
    g.lineBetween(-r * 0.4, -r * 0.24, r * 0.4, r * 0.24);
    g.lineBetween(-r * 0.4, r * 0.24, r * 0.4, -r * 0.24);
  } else drawHex(g, 0, 0, r, { owner, burnt: false, committed: o.committed, commitment: o.commitment });
  g.restore();
  if (p >= 0.82) {
    const settle = (p - 0.82) / 0.18;
    g.lineStyle(Math.max(1, r * 0.045), playerColor(o.owner), (1 - settle) * 0.65)
      .strokeEllipse(x, y + r * 0.07, r * (1.7 + settle * 0.5), r * (0.9 + settle * 0.3));
  }
}

export interface BuildConfirmationOptions { valid: boolean; /** Real-time milliseconds. */ time?: number }
/** Draw last over the selected build hex; supporting footprint tiles stay separate. */
export function drawBuildConfirmation(g: Graphics, x: number, y: number, r: number, o: BuildConfirmationOptions): void {
  if (!(r > 0)) return;
  const pulse = 0.5 + Math.sin((o.time ?? 0) / 230) * 0.5;
  const color = o.valid ? 0xe6b641 : PALETTE.invalid;
  g.fillStyle(color, 0.22 + pulse * 0.08).fillPoints(hexPoints(x, y, r * 0.89), true);
  perimeter(g, x, y, r * 0.88, 1, PALETTE.ink, Math.max(3, r * 0.11));
  perimeter(g, x, y, r * 0.88, 1, color, Math.max(2, r * 0.065));
  // Cream medallion keeps the icon legible over units and footprint overlays.
  g.fillStyle(PALETTE.cream, 0.97).fillCircle(x, y, r * 0.32);
  if (!o.valid) {
    g.lineStyle(Math.max(2, r * 0.08), PALETTE.invalid);
    g.lineBetween(x - r * 0.15, y - r * 0.15, x + r * 0.15, y + r * 0.15);
    g.lineBetween(x - r * 0.15, y + r * 0.15, x + r * 0.15, y - r * 0.15);
    return;
  }
  g.save().translateCanvas(x, y).rotateCanvas(Math.PI / 4);
  g.fillStyle(PALETTE.ink).fillRoundedRect(-r * 0.045, -r * 0.04, r * 0.09, r * 0.28, r * 0.015);
  g.fillStyle(PALETTE.metal).fillRoundedRect(-r * 0.2, -r * 0.15, r * 0.4, r * 0.15, r * 0.025);
  g.fillStyle(color).fillRect(-r * 0.2, -r * 0.15, r * 0.09, r * 0.15);
  g.restore();
}

/** Event-driven shot, not a persistent link. Coordinates are world pixels,
 * progress is normalized over the caller's lifetime (about 220ms). */
export function drawBulletTrace(g: Graphics, fromX: number, fromY: number, toX: number, toY: number, kind: UnitKind, progress: number): void {
  const p = clamp(progress);
  const dx = toX - fromX, dy = toY - fromY, length = Math.hypot(dx, dy);
  if (p >= 1 || length < 0.01) return;
  const arrival = 0.7, head = Math.min(1, p / arrival);
  const lightTrace = kind === 'infantry' || kind === 'helicopter';
  const width = lightTrace ? 1.8 : kind === 'fighter' ? 2.4 : kind === 'tank' ? 2.8 : 3.4;
  const segment = Math.min(length * 0.3, lightTrace ? 12 : 18);
  const tail = Math.max(0, head - segment / length);
  // Artillery traces follow a shallow cosmetic arc; no gameplay trajectory implied.
  const lift = kind === 'artillery' || kind === 'mlrs' ? Math.min(18, length * 0.13) : 0;
  if (p < arrival) {
    const hx = fromX + dx * head, hy = fromY + dy * head - Math.sin(head * Math.PI) * lift;
    const tx = fromX + dx * tail, ty = fromY + dy * tail - Math.sin(tail * Math.PI) * lift;
    g.lineStyle(width + 1.8, PALETTE.ink, 0.65).lineBetween(tx, ty, hx, hy);
    g.lineStyle(width, 0xf1bc50).lineBetween(tx, ty, hx, hy);
    g.fillStyle(PALETTE.cream).fillCircle(hx, hy, width * 0.6);
  } else {
    const hit = (p - arrival) / (1 - arrival), radius = 2 + hit * (lightTrace ? 4 : 7);
    g.lineStyle(1.5, 0xf1bc50, 1 - hit).strokeCircle(toX, toY, radius);
    g.fillStyle(PALETTE.cream, 1 - hit).fillCircle(toX, toY, radius * 0.45);
  }
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

/** Additional producer silhouettes share the foundation, not the roof profile. */
function expandedProducer(g: Graphics, kind: BuildingKind, color: number): boolean {
  switch (kind) {
    case 'bunker':
      // Low reinforced dome, deep firing slit and a thick, stepped concrete lip.
      g.fillStyle(PALETTE.metal).fillRoundedRect(-0.66, -0.42, 1.32, 0.59, 0.18);
      g.fillStyle(PALETTE.side).fillEllipse(0, -0.43, 1.29, 0.57);
      g.fillStyle(color).fillEllipse(0, -0.52, 0.88, 0.31);
      g.fillStyle(PALETTE.ink).fillRoundedRect(-0.47, -0.27, 0.94, 0.13, 0.025);
      g.fillStyle(PALETTE.cream).fillRect(-0.56, 0.03, 1.12, 0.07);
      g.fillStyle(PALETTE.metal).fillRoundedRect(-0.74, 0.17, 1.48, 0.14, 0.045);
      g.lineStyle(0.065, PALETTE.ink).lineBetween(0.17, -0.19, 0.64, -0.19);
      return true;
    case 'silo':
      // Round silo hatch and upright missile service cradle read at portrait scale.
      g.fillStyle(PALETTE.ink).fillEllipse(-0.06, -0.08, 1.14, 0.65);
      g.fillStyle(PALETTE.metal).fillEllipse(-0.06, -0.16, 1.14, 0.65);
      g.fillStyle(PALETTE.cream).fillEllipse(-0.06, -0.21, 0.91, 0.46);
      g.lineStyle(0.04, PALETTE.ink).lineBetween(-0.46, -0.21, 0.34, -0.21);
      g.fillStyle(color).fillRoundedRect(-0.21, -0.88, 0.3, 0.68, 0.045);
      g.fillStyle(PALETTE.cream).fillTriangle(-0.21, -0.84, -0.06, -1.15, 0.09, -0.84);
      g.fillStyle(PALETTE.metal).fillTriangle(-0.21, -0.48, -0.36, -0.18, -0.17, -0.23)
        .fillTriangle(0.09, -0.48, 0.24, -0.18, 0.05, -0.23);
      g.fillStyle(PALETTE.ink).fillRect(0.34, -0.91, 0.11, 0.98);
      g.lineStyle(0.045, PALETTE.metal).lineBetween(0.09, -0.76, 0.39, -0.76)
        .lineBetween(0.09, -0.45, 0.39, -0.45);
      return true;
    case 'scout':
      // Recon post: open-sided canopy with a high observation mast.
      g.fillStyle(PALETTE.ink).fillRect(-0.5, -0.4, 0.09, 0.7).fillRect(0.4, -0.4, 0.09, 0.7);
      g.fillStyle(color).fillTriangle(-0.68, -0.36, 0, -0.73, 0.68, -0.36);
      g.lineStyle(0.045, PALETTE.ink).lineBetween(0.33, -0.65, 0.33, -1.13);
      g.fillStyle(PALETTE.metal).fillEllipse(0.33, -1.1, 0.42, 0.16);
      g.fillStyle(PALETTE.cream).fillRect(-0.35, 0.03, 0.64, 0.12); return true;
    case 'gunner':
      // Support barracks: twin pitched roofs and sandbag bunker mouth.
      g.fillStyle(color).fillTriangle(-0.65, -0.36, -0.32, -0.82, 0, -0.36)
        .fillTriangle(-0.03, -0.36, 0.3, -0.82, 0.65, -0.36);
      g.fillStyle(PALETTE.ink).fillRoundedRect(-0.39, -0.17, 0.78, 0.48, 0.05);
      g.fillStyle(PALETTE.side).fillRoundedRect(-0.58, 0.19, 0.4, 0.16, 0.06)
        .fillRoundedRect(0.18, 0.19, 0.4, 0.16, 0.06);
      g.lineStyle(0.08, PALETTE.metal).lineBetween(-0.1, -0.48, 0.48, -0.48); return true;
    case 'flak':
      // Air defence: raised radar cup and conspicuous paired vertical cannons.
      g.fillStyle(color).fillRoundedRect(-0.4, -0.61, 0.8, 0.34, 0.09);
      g.lineStyle(0.08, PALETTE.ink).lineBetween(-0.19, -0.55, -0.32, -1.05)
        .lineBetween(0.13, -0.55, 0.26, -1.05);
      g.fillStyle(PALETTE.cream).fillEllipse(0, -0.67, 0.38, 0.18);
      g.fillStyle(PALETTE.ink).fillRect(-0.25, 0.1, 0.5, 0.26); return true;
    case 'walker':
      // Assault foundry: tall gantry, suspended assembly cradle and side towers.
      g.fillStyle(PALETTE.metal).fillRect(-0.59, -0.98, 0.18, 1.28).fillRect(0.41, -0.98, 0.18, 1.28);
      g.fillStyle(color).fillRoundedRect(-0.66, -1.06, 1.32, 0.25, 0.04);
      g.lineStyle(0.05, PALETTE.ink).lineBetween(0, -0.81, 0, -0.49);
      g.fillStyle(PALETTE.ink).fillRoundedRect(-0.22, -0.51, 0.44, 0.4, 0.08);
      g.fillStyle(PALETTE.cream).fillRect(-0.14, -0.4, 0.28, 0.065); return true;
    case 'destroyer':
      // Anti-tank depot: low wedge roof and a long horizontal weapon test bed.
      g.fillStyle(color).fillTriangle(-0.62, -0.34, -0.45, -0.75, 0.62, -0.34);
      g.fillStyle(PALETTE.metal).fillRoundedRect(-0.25, -0.6, 0.45, 0.19, 0.03);
      g.lineStyle(0.11, PALETTE.ink).lineBetween(-0.09, -0.54, 0.78, -0.54);
      g.fillStyle(PALETTE.ink).fillRect(-0.44, 0.08, 0.32, 0.28).fillRect(0.19, 0.08, 0.32, 0.28); return true;
    case 'gunship':
      // Attack helipad: two fortified roof shoulders and a raised landing deck.
      g.fillStyle(color).fillRoundedRect(-0.62, -0.8, 0.27, 0.71, 0.04)
        .fillRoundedRect(0.35, -0.8, 0.27, 0.71, 0.04);
      g.fillStyle(PALETTE.metal).fillEllipse(0, -0.63, 1.18, 0.36);
      g.lineStyle(0.045, PALETTE.cream).strokeEllipse(0, -0.63, 0.83, 0.24)
        .lineBetween(-0.12, -0.63, 0.12, -0.63);
      g.fillStyle(PALETTE.ink).fillRoundedRect(-0.28, -0.11, 0.56, 0.47, 0.04); return true;
    case 'siege':
      // Siege foundry: broad arched furnace and twin squat exhaust chimneys.
      g.fillStyle(PALETTE.metal).fillRect(-0.57, -1, 0.24, 0.73).fillRect(0.33, -1, 0.24, 0.73);
      g.fillStyle(color).fillRoundedRect(-0.61, -0.73, 1.22, 0.82, 0.23);
      g.fillStyle(PALETTE.ink).fillRoundedRect(-0.4, -0.41, 0.8, 0.76, 0.17);
      g.lineStyle(0.07, PALETTE.cream).lineBetween(-0.26, -0.23, 0.26, -0.23);
      g.fillStyle(PALETTE.side).fillRect(-0.42, 0.27, 0.84, 0.08); return true;
    case 'carrier':
      // Carrier command: wide flight deck with a narrow side control island.
      g.fillStyle(PALETTE.metal).fillRoundedRect(-0.73, -0.67, 1.46, 0.47, 0.05);
      g.fillStyle(color).fillRoundedRect(-0.73, -0.73, 1.46, 0.24, 0.04);
      g.lineStyle(0.045, PALETTE.cream).lineBetween(-0.52, -0.61, 0.27, -0.61);
      g.fillStyle(PALETTE.metal).fillRect(0.29, -1.07, 0.26, 0.51);
      g.fillStyle(PALETTE.ink).fillRect(0.25, -1.08, 0.35, 0.13);
      g.fillStyle(PALETTE.ink).fillRect(-0.38, 0.02, 0.76, 0.33); return true;
    default: return false;
  }
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
  } else if (expandedProducer(g, kind, color)) {
    // Dedicated silhouette drawn above the shared foundation.
  } else if (kind === 'infantry' || kind === 'missile') {
    // Barracks: broad low roof, two doorways, helmet-shaped roof emblem.
    g.fillStyle(color).fillRoundedRect(-0.55, -0.57, 1.1, 0.29, 0.05);
    g.fillStyle(PALETTE.ink).fillRect(-0.42, 0.09, 0.26, 0.28).fillRect(0.15, 0.09, 0.26, 0.28);
    g.fillStyle(PALETTE.cream).fillCircle(0, -0.46, 0.13).fillRect(-0.18, -0.44, 0.36, 0.055);
    if (kind === 'missile') {
      g.fillStyle(PALETTE.ink).fillRoundedRect(-0.4, -0.67, 0.8, 0.17, 0.035);
      g.fillStyle(PALETTE.cream).fillTriangle(0.32, -0.7, 0.56, -0.58, 0.32, -0.47);
    }
  } else if (kind === 'tank') {
    // Factory: tall paired stacks and a full-width garage shutter.
    g.fillStyle(PALETTE.ink).fillRect(0.15, -0.93, 0.13, 0.59).fillRect(0.37, -0.78, 0.13, 0.44);
    g.fillStyle(color).fillRect(0.15, -0.85, 0.13, 0.1).fillRect(0.37, -0.7, 0.13, 0.1);
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.43, -0.11, 0.86, 0.48, 0.03);
    g.lineStyle(0.035, PALETTE.metal);
    for (let i = 0; i < 3; i++) g.lineBetween(-0.37, 0.02 + i * 0.1, 0.37, 0.02 + i * 0.1);
  } else if (kind === 'helicopter') {
    // Hangar: broad curved roof, open bay and unmistakable rooftop helipad.
    g.fillStyle(color).fillRoundedRect(-0.57, -0.68, 1.14, 0.53, 0.23);
    g.fillStyle(PALETTE.metal).fillEllipse(0, -0.51, 0.77, 0.32);
    g.lineStyle(0.035, PALETTE.cream).strokeEllipse(0, -0.51, 0.66, 0.25);
    g.lineStyle(0.045, PALETTE.cream).lineBetween(-0.1, -0.59, -0.1, -0.43)
      .lineBetween(0.1, -0.59, 0.1, -0.43).lineBetween(-0.1, -0.51, 0.1, -0.51);
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.43, -0.08, 0.86, 0.45, 0.06);
    g.fillStyle(PALETTE.cream).fillRect(-0.38, 0.29, 0.76, 0.045);
  } else if (kind === 'fighter' || kind === 'bomber') {
    // Airfield: runway apron, swept-wing roof emblem and short control tower.
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.54, -0.37, 0.72, 0.69, 0.04);
    g.lineStyle(0.035, PALETTE.cream);
    for (let i = 0; i < 3; i++) g.lineBetween(-0.18, -0.29 + i * 0.2, -0.18, -0.19 + i * 0.2);
    g.fillStyle(color).fillTriangle(-0.34, -0.16, 0.04, -0.16, -0.15, -0.46);
    g.fillStyle(PALETTE.metal).fillRect(0.27, -0.81, 0.22, 0.88);
    g.fillStyle(color).fillRoundedRect(0.14, -0.97, 0.48, 0.3, 0.04);
    g.fillStyle(PALETTE.ink).fillRect(0.19, -0.91, 0.38, 0.11);
    g.fillStyle(PALETTE.cream).fillRect(0.14, -1.01, 0.48, 0.065);
    if (kind === 'bomber') {
      g.fillStyle(color).fillRoundedRect(-0.53, -0.65, 0.69, 0.22, 0.06);
      g.fillStyle(PALETTE.cream).fillTriangle(-0.49, -0.55, 0.1, -0.55, -0.19, -0.74);
      g.fillStyle(PALETTE.ink).fillCircle(-0.4, -0.42, 0.055).fillCircle(-0.02, -0.42, 0.055);
    }
  } else if (kind === 'mlrs') {
    // Rocket depot: low ammunition bays and a prominent bank of launch tubes.
    g.fillStyle(color).fillRoundedRect(-0.54, -0.62, 1.08, 0.29, 0.05);
    for (let i = 0; i < 3; i++) {
      const rx = -0.36 + i * 0.35;
      g.fillStyle(PALETTE.metal).fillRoundedRect(rx - 0.12, -0.79, 0.24, 0.27, 0.03);
      g.fillStyle(PALETTE.ink).fillCircle(rx, -0.67, 0.075);
      g.fillStyle(PALETTE.ink).fillRect(rx - 0.12, 0.09, 0.24, 0.28);
    }
  } else {
    // Artillery works: ammunition shed with a raised, angled test barrel.
    g.fillStyle(color).fillTriangle(-0.62, -0.44, 0, -0.82, 0.62, -0.44);
    g.lineStyle(0.16, PALETTE.ink).lineBetween(-0.05, -0.57, 0.49, -1.02);
    g.lineStyle(0.09, PALETTE.metal).lineBetween(-0.05, -0.6, 0.49, -1.05);
    g.fillStyle(PALETTE.ink).fillRect(-0.18, 0.08, 0.36, 0.29);
    g.fillStyle(color).fillRoundedRect(-0.53, 0.14, 0.21, 0.22, 0.02);
  }
  const work = o.construction !== undefined && o.construction < 1 ? o.construction
    : o.upgrading !== undefined && o.upgrading < 1 ? o.upgrading : undefined;
  if (work !== undefined) {
    // Translucent roof wash and open scaffolding preserve the building silhouette.
    g.fillStyle(PALETTE.cream, 0.47).fillRoundedRect(-0.65, -0.85, 1.3, 1.2, 0.06);
    g.lineStyle(0.045, PALETTE.metal);
    for (let i = 0; i < 3; i++) {
      const sx = -0.68 + i * 0.68;
      g.lineBetween(sx, -0.88, sx, 0.37);
    }
    g.lineBetween(-0.68, -0.77, 0.68, -0.77).lineBetween(-0.68, -0.23, 0.68, -0.23)
      .lineBetween(-0.68, 0.32, 0.68, 0.32).lineBetween(-0.68, 0.32, 0, -0.77)
      .lineBetween(0, -0.77, 0.68, 0.32);
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.51, 0.4, 1.02, 0.1, 0.025);
    g.fillStyle(o.upgrading !== undefined ? 0xe6b641 : color).fillRect(-0.51, 0.4, 1.02 * clamp(work), 0.1);
  } else if (o.progress !== undefined) {
    g.fillStyle(PALETTE.ink).fillRoundedRect(-0.51, 0.4, 1.02, 0.09, 0.025);
    g.fillStyle(color).fillRoundedRect(-0.51, 0.4, 1.02 * clamp(o.progress), 0.09, 0.025);
  }
  g.restore();
  health(g, x, y - size * 1.51, size * 1.1, o.hp, o.maxHp);
}

const SQUAD_POSITIONS = [[-0.3, -0.17], [0.3, -0.17], [-0.43, 0.22], [0, 0.3], [0.43, 0.22]] as const;

function expandedUnit(g: Graphics, kind: UnitKind, color: number, phase: number, moving: boolean, opacity: number): boolean {
  if (kind === 'scout' || kind === 'flak') {
    // Exposed buggy cage versus armoured AA rover with upright twin guns.
    for (const wx of [-0.4, 0.36]) {
      g.fillStyle(PALETTE.ink, opacity).fillCircle(wx, 0.18, 0.19);
      g.fillStyle(PALETTE.metal, opacity).fillCircle(wx, 0.18, 0.085);
    }
    g.fillStyle(color, opacity).fillRoundedRect(-0.55, -0.17, 1.08, 0.3, 0.08);
    if (kind === 'scout') {
      g.lineStyle(0.065, PALETTE.ink, opacity).lineBetween(-0.23, -0.15, -0.18, -0.48)
        .lineBetween(-0.18, -0.48, 0.22, -0.48).lineBetween(0.22, -0.48, 0.31, -0.15);
      g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(-0.13, -0.25, 0.3, 0.15, 0.035);
      g.fillStyle(PALETTE.cream, opacity).fillRect(0.39, -0.12, 0.12, 0.07);
      g.lineStyle(0.03, PALETTE.ink, opacity).lineBetween(-0.42, -0.16, -0.48, -0.69);
    } else {
      g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.34, -0.39, 0.65, 0.3, 0.06);
      g.lineStyle(0.085, PALETTE.ink, opacity).lineBetween(-0.12, -0.32, 0.08, -0.82)
        .lineBetween(0.1, -0.32, 0.3, -0.82);
      g.fillStyle(color, opacity).fillEllipse(-0.24, -0.45, 0.3, 0.13);
    }
    return true;
  }
  if (kind === 'walker') {
    const stride = moving ? Math.sin(phase) * 0.1 : 0;
    g.lineStyle(0.17, PALETTE.metal, opacity).lineBetween(-0.2, -0.18, -0.35 - stride, 0.25)
      .lineBetween(0.2, -0.18, 0.35 + stride, 0.25);
    g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(-0.54 - stride, 0.18, 0.38, 0.16, 0.035)
      .fillRoundedRect(0.17 + stride, 0.18, 0.38, 0.16, 0.035);
    g.fillStyle(color, opacity).fillRoundedRect(-0.4, -0.82, 0.8, 0.65, 0.14);
    g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(-0.2, -0.68, 0.45, 0.13, 0.035);
    g.fillStyle(PALETTE.cream, opacity).fillRect(-0.14, -0.66, 0.2, 0.035);
    g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(0.26, -0.43, 0.48, 0.16, 0.035);
    g.fillStyle(PALETTE.ink, opacity).fillRect(0.64, -0.4, 0.16, 0.09); return true;
  }
  if (kind === 'destroyer' || kind === 'siege') {
    const heavy = kind === 'siege';
    g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(-0.64, -0.28, 1.25, 0.23, 0.07)
      .fillRoundedRect(-0.64, 0.16, 1.25, 0.23, 0.07);
    g.fillStyle(color, opacity).fillRoundedRect(-0.56, -0.22, 1.12, 0.48, 0.09);
    g.fillStyle(PALETTE.metal, opacity).fillTriangle(-0.52, -0.12, 0.36, -0.5, 0.47, 0.02);
    if (heavy) {
      g.fillStyle(color, opacity).fillRoundedRect(-0.4, -0.55, 0.79, 0.42, 0.07);
      g.lineStyle(0.22, PALETTE.ink, opacity).lineBetween(0.17, -0.37, 0.9, -0.37);
      g.lineStyle(0.11, PALETTE.metal, opacity).lineBetween(0.2, -0.4, 0.87, -0.4);
      g.fillStyle(PALETTE.cream, opacity).fillRect(-0.3, -0.53, 0.48, 0.055);
      g.lineStyle(0.08, PALETTE.metal, opacity).lineBetween(-0.54, 0.21, -0.73, 0.44)
        .lineBetween(0.48, 0.21, 0.68, 0.44);
    } else {
      g.lineStyle(0.1, PALETTE.ink, opacity).lineBetween(0.04, -0.28, 1.02, -0.28);
      g.lineStyle(0.045, PALETTE.metal, opacity).lineBetween(0.04, -0.3, 1.02, -0.3);
      g.fillStyle(PALETTE.cream, opacity).fillRect(-0.35, -0.18, 0.22, 0.07);
    }
    return true;
  }
  if (kind === 'carrier') {
    // Broad assault transport: deep central hull, short wings and four lift pods.
    g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.64, -0.29, 1.23, 0.4, 0.12);
    g.fillStyle(color, opacity).fillTriangle(-0.17, -0.12, -0.44, -0.7, 0.28, -0.12)
      .fillTriangle(-0.17, -0.02, -0.44, 0.51, 0.28, -0.02);
    for (let i = 0; i < 2; i++) {
      const py = i === 0 ? -0.56 : 0.29;
      g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(-0.43, py, 0.35, 0.17, 0.05)
        .fillRoundedRect(0.09, py, 0.35, 0.17, 0.05);
      g.fillStyle(PALETTE.cream, opacity * 0.7).fillRect(-0.37, py + 0.04, 0.17, 0.03)
        .fillRect(0.15, py + 0.04, 0.17, 0.03);
    }
    g.fillStyle(color, opacity).fillRoundedRect(-0.58, -0.28, 1.22, 0.35, 0.12);
    g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(0.3, -0.22, 0.26, 0.14, 0.04);
    g.fillStyle(PALETTE.cream, opacity).fillRect(-0.43, -0.27, 0.55, 0.05);
    g.lineStyle(0.04, PALETTE.ink, opacity).lineBetween(-0.39, -0.09, -0.1, -0.09); return true;
  }
  return false;
}

export function drawUnit(g: Graphics, x: number, y: number, size: number, owner: number, kind: UnitKind, o: UnitOptions = DEFAULT_UNIT_OPTIONS): void {
  if (!(size > 0)) return;
  // Utility cards have no mobile unit. Generic portrait callers get their building.
  if (kind === 'bunker' || kind === 'silo') {
    drawBuilding(g, x, y, size, owner, kind, { hp: o.hp, maxHp: o.maxHp });
    return;
  }
  const color = playerColor(owner), phase = o.phase ?? 0;
  const opacity = clamp(o.opacity ?? 1);
  if (opacity === 0) return;
  const kick = o.attacking ? Math.max(0, Math.cos(phase)) * 0.1 : 0;
  g.save().translateCanvas(x, y).scaleCanvas(size, size);
  g.fillStyle(PALETTE.shadow, (0.2) * opacity).fillEllipse(0, 0.25, 1.2, 0.42);
  // Body and ownership marker always remain upright in this 2D view.
  g.lineStyle(0.055, color, opacity).strokeEllipse(0, 0.23, 1.16, 0.46);
  if (opacity === 1) badge(g, owner, -0.44, 0.23, 0.055);
  g.save().scaleCanvas(o.facingX === -1 ? -1 : 1, 1);
  const airborne = kind === 'helicopter' || kind === 'fighter' || kind === 'bomber' || kind === 'gunship' || kind === 'carrier';
  // x/y always identify the ground hex. Only the air body floats; UI stays grounded.
  if (airborne) g.translateCanvas(0, -0.42 - Math.sin(phase) * 0.035);
  if (expandedUnit(g, kind, color, phase, !!o.moving, opacity)) {
    // Body drawn, with ring and attack direction still handled by the caller frame.
  } else if (kind === 'infantry' || kind === 'missile' || kind === 'gunner') {
    const squad = o.members !== undefined || o.memberCount !== undefined;
    const count = o.members ? Math.min(5, o.members.length) : Math.min(5, Math.max(0, Math.trunc(o.memberCount ?? 1)));
    for (let member = 0; member < count; member++) {
      if (o.members && !(o.members[member] > 0)) continue;
      g.save();
      if (squad) {
        const pos = SQUAD_POSITIONS[member];
        g.translateCanvas(pos[0], pos[1]).scaleCanvas(0.47, 0.47);
      }
    const stride = o.moving && !o.attacking ? Math.sin(phase) * 0.14 : 0;
    const bob = o.attacking ? kick * 0.3 : o.moving ? Math.abs(Math.sin(phase)) * 0.035 : 0;
    g.lineStyle(0.16, PALETTE.ink, opacity);
    g.lineBetween(-0.13, 0.02, -0.19 - stride, 0.31);
    g.lineBetween(0.13, 0.02, 0.19 + stride, 0.31);
    g.fillStyle(color, opacity).fillRoundedRect(-0.25 - kick, -0.48 - bob, 0.5, 0.57, 0.12);
    g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.34 - kick, -0.43 - bob, 0.15, 0.37, 0.04);
    g.fillStyle(0xe7bf90, opacity).fillCircle(-kick, -0.58 - bob, 0.2);
    g.fillStyle(color, opacity).fillEllipse(-0.03 - kick, -0.71 - bob, 0.54, 0.35);
    g.fillStyle(PALETTE.ink, opacity).fillRect(0.03 - kick, -0.6 - bob, 0.19, 0.065);
    if (kind === 'missile') {
      g.lineStyle(0.19, PALETTE.ink, opacity).lineBetween(-0.2 - kick, -0.4, 0.58 - kick, -0.48);
      g.lineStyle(0.11, PALETTE.metal, opacity).lineBetween(-0.2 - kick, -0.42, 0.56 - kick, -0.5);
      g.fillStyle(PALETTE.cream, opacity).fillTriangle(0.56 - kick, -0.61, 0.78 - kick, -0.51, 0.56 - kick, -0.4);
    } else if (kind === 'gunner') {
      g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.03 - kick, -0.37, 0.49, 0.16, 0.03);
      g.lineStyle(0.09, PALETTE.ink, opacity).lineBetween(0.33 - kick, -0.3, 0.79 - kick, -0.3);
      g.fillStyle(0xd6aa3f, opacity).fillRect(0.07 - kick, -0.23, 0.16, 0.19);
      g.lineStyle(0.04, PALETTE.ink, opacity).lineBetween(0.58 - kick, -0.29, 0.5 - kick, 0.02);
    } else g.lineStyle(0.11, PALETTE.ink, opacity).lineBetween(0.06 - kick, -0.21, 0.58 - kick, -0.33);
    g.fillStyle(0xe7bf90, opacity).fillCircle(0.24 - kick, -0.26, 0.085);
      g.restore();
    }
  } else if (kind === 'helicopter' || kind === 'gunship') {
    // Side-on toy helicopter: tail boom, rounded cabin, skids and projected rotor.
    g.lineStyle(0.1, PALETTE.metal, opacity).lineBetween(-0.22, -0.21, -0.76, -0.34);
    g.fillStyle(color, opacity).fillTriangle(-0.82, -0.33, -0.63, -0.33, -0.8, -0.59);
    g.lineStyle(0.045, PALETTE.ink, opacity).lineBetween(-0.81, -0.42, -0.63, -0.23)
      .lineBetween(-0.81, -0.23, -0.63, -0.42);
    g.lineStyle(0.045, PALETTE.ink, opacity).lineBetween(-0.2, 0.02, -0.24, 0.22)
      .lineBetween(0.22, 0.02, 0.26, 0.22).lineBetween(-0.38, 0.22, 0.46, 0.22);
    g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.38, -0.43, 0.94, 0.52, 0.23);
    g.fillStyle(color, opacity).fillRoundedRect(-0.38, -0.47, 0.94, 0.43, 0.2);
    g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(0.13, -0.42, 0.35, 0.24, 0.09);
    g.fillStyle(PALETTE.cream, (0.7) * opacity).fillRect(0.18, -0.39, 0.16, 0.035);
    g.lineStyle(0.06, PALETTE.ink, opacity).lineBetween(-0.04, -0.47, -0.04, -0.65);
    const rotor = phase * 4, rx = Math.cos(rotor) * 0.83, ry = Math.sin(rotor) * 0.15;
    const sx = Math.cos(rotor + Math.PI / 2) * 0.83, sy = Math.sin(rotor + Math.PI / 2) * 0.15;
    g.lineStyle(0.055, PALETTE.ink, opacity).lineBetween(-0.04 - rx, -0.65 - ry, -0.04 + rx, -0.65 + ry)
      .lineBetween(-0.04 - sx, -0.65 - sy, -0.04 + sx, -0.65 + sy);
    g.fillStyle(PALETTE.cream, opacity).fillCircle(-0.04, -0.65, 0.055);
    if (kind === 'gunship') {
      g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.33, -0.18, 0.76, 0.26, 0.06);
      g.fillStyle(color, opacity).fillRoundedRect(-0.43, -0.12, 0.27, 0.2, 0.04)
        .fillRoundedRect(0.29, -0.12, 0.27, 0.2, 0.04);
      g.fillStyle(PALETTE.ink, opacity).fillCircle(-0.29, -0.02, 0.065).fillCircle(0.43, -0.02, 0.065);
      g.lineStyle(0.07, PALETTE.ink, opacity).lineBetween(0.28, 0.04, 0.67, 0.04);
    }
  } else if (kind === 'bomber') {
    // Broad heavy wings, twin engines and rounded nose, distinct from the swept jet.
    g.fillStyle(PALETTE.metal, opacity).fillTriangle(0.17, -0.16, -0.42, -0.72, -0.36, 0.51);
    g.fillStyle(color, opacity).fillTriangle(0.07, -0.15, -0.34, -0.63, -0.3, 0.43);
    g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(-0.29, -0.58, 0.48, 0.15, 0.05)
      .fillRoundedRect(-0.29, 0.23, 0.48, 0.15, 0.05);
    g.fillStyle(PALETTE.metal, opacity).fillTriangle(-0.35, -0.14, -0.73, -0.42, -0.69, 0.23);
    g.fillStyle(color, opacity).fillRoundedRect(-0.68, -0.27, 1.4, 0.32, 0.14);
    g.fillStyle(PALETTE.cream, opacity).fillRoundedRect(-0.55, -0.26, 0.94, 0.07, 0.025);
    g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(0.34, -0.21, 0.27, 0.13, 0.04);
  } else if (kind === 'fighter') {
    // Swept wings and tail distinguish the jet without rotating its silhouette.
    if (o.moving || o.attacking) {
      const exhaust = 0.12 + (Math.sin(phase * 3) + 1) * 0.025;
      g.fillStyle(0xf1bc50, (0.65) * opacity).fillTriangle(-0.51, -0.17, -0.51, -0.04, -0.65 - exhaust, -0.105);
    }
    g.fillStyle(PALETTE.metal, opacity).fillTriangle(0.21, -0.13, -0.38, -0.66, -0.23, -0.1)
      .fillTriangle(0.21, -0.08, -0.38, 0.46, -0.23, -0.1);
    g.fillStyle(color, opacity).fillTriangle(0.15, -0.16, -0.32, -0.57, -0.19, -0.14)
      .fillTriangle(0.15, -0.04, -0.32, 0.37, -0.19, -0.05);
    g.fillStyle(PALETTE.ink, opacity).fillTriangle(-0.32, -0.15, -0.66, -0.4, -0.56, -0.07)
      .fillTriangle(-0.32, -0.04, -0.66, 0.23, -0.56, -0.14);
    g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.56, -0.23, 1.03, 0.25, 0.09);
    g.fillStyle(color, opacity).fillTriangle(0.14, -0.23, 0.81, -0.11, 0.14, 0.02);
    g.fillStyle(PALETTE.cream, opacity).fillRoundedRect(-0.43, -0.24, 0.64, 0.07, 0.025);
    g.fillStyle(PALETTE.ink, opacity).fillEllipse(0.19, -0.15, 0.37, 0.13);
    g.fillStyle(PALETTE.cream, (0.65) * opacity).fillEllipse(0.2, -0.17, 0.2, 0.035);
  } else {
    const artillery = kind === 'artillery';
    g.fillStyle(PALETTE.ink, opacity).fillRoundedRect(-0.57, -0.35, 1.07, 0.23, 0.08)
      .fillRoundedRect(-0.57, 0.14, 1.07, 0.23, 0.08);
    g.lineStyle(0.025, PALETTE.metal, opacity);
    for (let i = 0; i < 4; i++) {
      const tx = -0.42 + i * 0.23;
      g.lineBetween(tx, -0.32, tx, -0.15); g.lineBetween(tx, 0.18, tx, 0.33);
    }
    g.fillStyle(color, opacity).fillRoundedRect(-0.5 - kick, -0.29, 0.97, 0.54, 0.12);
    g.fillStyle(PALETTE.cream, (0.5) * opacity).fillRoundedRect(-0.42 - kick, -0.27, 0.76, 0.08, 0.03);
    if (kind === 'mlrs') {
      g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.43, -0.53, 0.74, 0.47, 0.035);
      g.fillStyle(color, opacity).fillRoundedRect(-0.43, -0.55, 0.74, 0.12, 0.025);
      for (let i = 0; i < 3; i++) {
        const rx = -0.29 + i * 0.23;
        g.fillStyle(PALETTE.ink, opacity).fillCircle(rx, -0.29, 0.075);
        g.fillStyle(PALETTE.cream, opacity).fillCircle(rx, -0.3, 0.025);
      }
    } else {
    g.fillStyle(PALETTE.metal, opacity).fillRoundedRect(-0.26 - kick, -0.24, 0.57, 0.38, 0.1);
    g.fillStyle(color, opacity).fillRoundedRect(-0.26 - kick, -0.29, 0.57, 0.29, 0.08);
    g.lineStyle(artillery ? 0.14 : 0.12, PALETTE.ink, opacity)
      .lineBetween(0.15 - kick, -0.13, (artillery ? 0.98 : 0.79) - kick, artillery ? -0.37 : -0.13);
    g.lineStyle(0.065, PALETTE.metal, opacity)
      .lineBetween(0.15 - kick, -0.15, (artillery ? 0.98 : 0.79) - kick, artillery ? -0.39 : -0.15);
    if (artillery) {
      g.lineStyle(0.07, PALETTE.ink, opacity).lineBetween(-0.43, 0.14, -0.7, 0.42);
      g.lineBetween(-0.43, -0.19, -0.7, -0.45);
    }
    }
  }
  g.restore();
  if (o.attacking) {
    const angle = Number.isFinite(o.angle) ? o.angle! : 0;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    // Intersect the actual screen-space ray with the elliptical ownership ring.
    const distance = 1 / Math.hypot(dx / 0.58, dy / 0.23);
    const ax = dx * distance, ay = 0.23 + dy * distance;
    g.lineStyle(0.035, PALETTE.ink, opacity).fillStyle(color, opacity);
    const tipX = ax + dx * 0.17, tipY = ay + dy * 0.17;
    const leftX = ax - dx * 0.04 - dy * 0.1, leftY = ay - dy * 0.04 + dx * 0.1;
    const rightX = ax - dx * 0.04 + dy * 0.1, rightY = ay - dy * 0.04 - dx * 0.1;
    g.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY)
      .strokeTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
  }
  g.restore();
  health(g, x, y - size * (airborne ? 1.45 : 1.02), size * 0.9, o.hp, o.maxHp);
}

/** Cosmetic retirement only. Caller may interpolate x/y toward the producer;
 * r is hex radius. A small upward slide/fade never changes gameplay occupancy.
 * Optional members are per-member HP, matching UnitOptions.members. */
export function drawRetreat(g: Graphics, x: number, y: number, r: number, owner: number, kind: UnitKind, progress: number, members?: number[]): void {
  const p = clamp(progress);
  if (p >= 1 || !(r > 0)) return;
  const infantry = kind === 'infantry' || kind === 'missile' || kind === 'gunner';
  const squad = infantry && members !== undefined;
  const size = r * (squad ? 0.8 : infantry ? 0.58 : 0.69);
  drawUnit(g, x, y - r * p * 0.16, size, owner, kind, {
    moving: true, phase: p * 8, opacity: (1 - p) * (1 - p), members,
  });
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

/** Impact-only, owner-neutral nuclear cloud. No flight telegraph or randomness.
 * r is a world-pixel VISUAL SCALE: cloud width peaks near 3.2r, top near y-2.6r;
 * shockwave diameter peaks near 4.6r. Caller owns lifetime (suggested 2400ms),
 * layering and reduced-motion substitution. Progress 1 draws nothing. */
export function drawNuclearImpact(g: Graphics, x: number, y: number, r: number, progress: number): void {
  const p = clamp(progress);
  if (!(r > 0) || p >= 1) return;
  const fade = 1 - clamp((p - 0.62) / 0.38);
  const rise = 1 - Math.pow(1 - clamp((p - 0.06) / 0.74), 2);
  // Ground anchor: restrained oval flash and an expanding flattened shockwave.
  g.fillStyle(PALETTE.shadow, 0.17 * fade).fillEllipse(x, y + r * 0.08, r * (1.2 + rise), r * 0.65);
  if (p < 0.17) {
    const flash = 1 - p / 0.17;
    g.fillStyle(0xf6c967, flash * 0.58).fillEllipse(x, y, r * (0.8 + p * 13), r * (0.4 + p * 6));
    g.fillStyle(PALETTE.cream, flash * 0.9).fillCircle(x, y - r * 0.1, r * (0.22 + p * 3));
  }
  if (p < 0.68) {
    const wave = clamp(p / 0.68), alpha = (1 - wave) * 0.85;
    g.lineStyle(Math.max(1.2, r * 0.055), PALETTE.cream, alpha)
      .strokeEllipse(x, y + r * 0.05, r * (0.55 + wave * 4.05), r * (0.3 + wave * 2.05));
    g.lineStyle(Math.max(1, r * 0.03), 0xd4a458, alpha * 0.65)
      .strokeEllipse(x, y + r * 0.05, r * (0.45 + wave * 3.65), r * (0.25 + wave * 1.8));
  }
  if (p < 0.045) return;
  const form = clamp((p - 0.045) / 0.2), cloudAlpha = fade * form;
  const top = y - r * (0.3 + rise * 1.85);
  const capWidth = r * (0.38 + rise * 1.16);
  // Five overlapping stem lobes keep a tapered vertical column beneath the cap.
  for (let i = 0; i < 5; i++) {
    const t = i / 4, cy = y + (top - y) * t;
    const width = r * (0.23 + (1 - t) * 0.18 + rise * 0.07);
    const drift = Math.sin(i * 2.1 + p * 3) * r * 0.065 * rise;
    g.fillStyle(0x77786d, cloudAlpha * 0.9).fillEllipse(x + drift, cy, width * 2, r * (0.38 + rise * 0.17));
    g.fillStyle(p < 0.34 ? 0xd69b55 : 0xb8ac87, cloudAlpha * 0.68)
      .fillEllipse(x + drift - width * 0.12, cy - r * 0.05, width * 1.3, r * 0.32);
  }
  // Mushroom rim: broad dark underside, scalloped billows and warm upper planes.
  g.fillStyle(0x5f6863, cloudAlpha).fillEllipse(x, top + r * 0.17, capWidth * 2.05, r * (0.35 + rise * 0.3));
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) / 3, edge = Math.abs(t);
    const cx = x + t * capWidth * 0.77;
    const cy = top - (1 - edge * edge) * r * (0.13 + rise * 0.15);
    const puff = r * (0.19 + rise * 0.36) * (1 - edge * 0.17);
    g.fillStyle(0x8a8977, cloudAlpha).fillEllipse(cx, cy, puff * 1.9, puff * 1.4);
    g.fillStyle(p < 0.38 ? 0xe8ba73 : 0xcebf96, cloudAlpha * 0.94)
      .fillEllipse(cx - puff * 0.12, cy - puff * 0.13, puff * 1.52, puff * 1.02);
  }
  // Low dust skirt stays on the ground; it never conceals the entire battlefield.
  g.lineStyle(Math.max(1.5, r * 0.07), 0xb8ac87, cloudAlpha * 0.6)
    .strokeEllipse(x, y + r * 0.06, r * (0.95 + rise * 0.55), r * 0.46);
}
