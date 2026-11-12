import type Phaser from 'phaser';

export function tint(c: number, light: number): number {
  const ch = (v: number) => Math.min(255, Math.max(0, Math.round(v * light)));
  return (ch(c >> 16) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

/** Decoration stays inside the original projected rock outline; collision geometry is untouched. */
export function drawRock(
  g: Phaser.GameObjects.Graphics, pts: {x: number; y: number}[],
  at: {x: number; y: number; scale: number}, radius: number,
  colour: number, light: number, sun: {x: number; y: number}, hp: number, flash: boolean, seed: number,
): void {
  const cx = at.x + Math.sin(seed * 3.1) * radius * .13;
  const cy = at.y + Math.cos(seed * 2.7) * radius * .12;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const nx = (a.x + b.x) * .5 - at.x, ny = (a.y + b.y) * .5 - at.y;
    const n = Math.max(1, Math.hypot(nx, ny));
    const face = .80 + .24 * (nx * sun.x + ny * sun.y) / n + .08 * Math.sin(seed + i * 2.1);
    g.fillStyle(flash ? 0xfff8e8 : tint(colour, light * face), 1);
    g.fillTriangle(cx, cy, a.x, a.y, b.x, b.y);
  }
  g.lineStyle(Math.max(1.2, 2.5 * at.scale), tint(0x302634, Math.max(.65, light)), 1);
  g.strokePoints(pts, true);
  if (flash) return;
  // Small inset pits, distinct from free-floating collidable asteroids.
  for (let i = 0; i < 3; i++) {
    const a = seed * 1.7 + i * 2.4;
    const x = at.x + Math.cos(a) * radius * .43, y = at.y + Math.sin(a) * radius * .32;
    const r = radius * (.09 + .035 * ((seed + i) % 3));
    g.fillStyle(tint(0x403542, light), .65);
    g.fillEllipse(x, y, r * 2, r * 1.45);
    g.lineStyle(Math.max(.7, at.scale), tint(0xd6b9a2, light), .55);
    g.lineBetween(x - r * .7, y + r * .65, x + r * .6, y + r * .65);
  }
  const cracks = hp < .34 ? 3 : hp < .67 ? 2 : 0;
  g.lineStyle(Math.max(1, at.scale * 1.7), tint(0x261f2d, Math.max(.7, light)), .95);
  for (let i = 0; i < cracks; i++) {
    const a = seed + i * 2.1, c = Math.cos(a), s = Math.sin(a);
    g.lineBetween(cx, cy, cx + c * radius * .3 - s * radius * .12, cy + s * radius * .3 + c * radius * .12);
    g.lineBetween(cx + c * radius * .3 - s * radius * .12, cy + s * radius * .3 + c * radius * .12, at.x + c * radius * .85, at.y + s * radius * .85);
  }
}
