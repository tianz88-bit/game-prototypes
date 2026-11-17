import type Phaser from 'phaser';
import type { Level, ObstacleKind } from '../game/types';

export interface YardGeo {
  cs: number;
  ox: number;
  oy: number;
}

const RAIL = 0xa9b2c6;
const TIE = 0x9a7b62;

/** Draws rails along every line a train uses, exit arrows at open ends, and the fixed obstacles. */
export function drawYard(g: Phaser.GameObjects.Graphics, level: Level, geo: YardGeo): void {
  const { cs, ox, oy } = geo;
  const blocked = (c: number, r: number) => level.obstacles.has(r * level.cols + c);
  const lines = new Set(level.trains.map((t) => `${t.axis}${t.line}`));

  // Ground under the yard.
  g.fillStyle(0xe7dcc5, 1);
  g.fillRoundedRect(ox - 8, oy - 8, level.cols * cs + 16, level.rows * cs + 16, 22);
  g.lineStyle(3, 0xffffff, 0.35);
  g.strokeRoundedRect(ox - 8, oy - 8, level.cols * cs + 16, level.rows * cs + 16, 22);

  for (const key of lines) {
    const axis = key[0];
    const line = Number(key.slice(1));
    const len = axis === 'h' ? level.cols : level.rows;
    for (let i = 0; i < len; i++) {
      const [c, r] = axis === 'h' ? [i, line] : [line, i];
      if (blocked(c, r)) continue;
      const cx = ox + (c + 0.5) * cs;
      const cy = oy + (r + 0.5) * cs;
      g.fillStyle(TIE, 1);
      if (axis === 'h') g.fillRoundedRect(cx - cs * 0.07, cy - cs * 0.3, cs * 0.14, cs * 0.6, 2);
      else g.fillRoundedRect(cx - cs * 0.3, cy - cs * 0.07, cs * 0.6, cs * 0.14, 2);
    }
    g.lineStyle(3, RAIL, 1);
    for (const side of [-1, 1]) {
      let run: number | null = null;
      const flush = (end: number) => {
        if (run === null) return;
        const a = run;
        const b = end;
        if (axis === 'h') g.lineBetween(ox + a * cs, oy + (line + 0.5 + side * 0.18) * cs, ox + b * cs, oy + (line + 0.5 + side * 0.18) * cs);
        else g.lineBetween(ox + (line + 0.5 + side * 0.18) * cs, oy + a * cs, ox + (line + 0.5 + side * 0.18) * cs, oy + b * cs);
        run = null;
      };
      for (let i = 0; i < len; i++) {
        const [c, r] = axis === 'h' ? [i, line] : [line, i];
        if (blocked(c, r)) flush(i);
        else if (run === null) run = i;
      }
      flush(len);
    }
    // Exit arrows where the rails reach the edge of the board.
    for (const end of [0, len - 1]) {
      const [c, r] = axis === 'h' ? [end, line] : [line, end];
      if (blocked(c, r)) continue;
      const dir = end === 0 ? -1 : 1;
      const cx = ox + (c + 0.5) * cs;
      const cy = oy + (r + 0.5) * cs;
      const tipX = axis === 'h' ? cx + dir * (cs * 0.5 + 12) : cx;
      const tipY = axis === 'h' ? cy : cy + dir * (cs * 0.5 + 12);
      g.fillStyle(0x6dd36b, 1);
      const a = 7;
      if (axis === 'h') g.fillTriangle(tipX, tipY, tipX - dir * a * 1.2, tipY - a, tipX - dir * a * 1.2, tipY + a);
      else g.fillTriangle(tipX, tipY, tipX - a, tipY - dir * a * 1.2, tipX + a, tipY - dir * a * 1.2);
    }
  }

  for (const [idx, kind] of level.obstacles) drawObstacle(g, kind, ox + (idx % level.cols) * cs, oy + Math.floor(idx / level.cols) * cs, cs);
}

function drawObstacle(g: Phaser.GameObjects.Graphics, kind: ObstacleKind, x: number, y: number, cs: number): void {
  const p = cs * 0.08;
  const w = cs - p * 2;
  const bx = x + p;
  const by = y + p;
  g.fillStyle(0x000000, 0.18);
  g.fillRoundedRect(bx + 2, by + 4, w, w, cs * 0.16);
  switch (kind) {
    case 'concrete':
      g.fillStyle(0xb7bccb, 1);
      g.fillRoundedRect(bx, by, w, w, cs * 0.16);
      g.fillStyle(0xd7dbe6, 1);
      g.fillRoundedRect(bx + 3, by + 3, w - 6, w * 0.4, cs * 0.12);
      g.lineStyle(2, 0x8d93a5, 0.7);
      for (let i = 1; i < 4; i++) g.lineBetween(bx + (w * i) / 4, by + w - 4, bx + (w * i) / 4 + 8, by + w * 0.55);
      break;
    case 'kiosk':
      g.fillStyle(0xffd28a, 1);
      g.fillRoundedRect(bx, by + w * 0.28, w, w * 0.72, cs * 0.1);
      g.fillStyle(0xe8434f, 1);
      g.fillTriangle(bx - 2, by + w * 0.34, bx + w + 2, by + w * 0.34, bx + w * 0.5, by);
      g.fillStyle(0x7ac8ff, 1);
      g.fillRoundedRect(bx + w * 0.16, by + w * 0.52, w * 0.68, w * 0.22, 3);
      break;
    case 'signal':
      g.fillStyle(0x4a4a5c, 1);
      g.fillRect(bx + w * 0.46, by + w * 0.35, w * 0.08, w * 0.65);
      g.fillStyle(0x2c2f3a, 1);
      g.fillRoundedRect(bx + w * 0.28, by, w * 0.44, w * 0.46, 5);
      g.fillStyle(0xff5d5d, 1);
      g.fillCircle(bx + w * 0.5, by + w * 0.13, w * 0.07);
      g.fillStyle(0x6dd36b, 1);
      g.fillCircle(bx + w * 0.5, by + w * 0.32, w * 0.07);
      break;
    case 'tree':
      g.fillStyle(0x8a5a3a, 1);
      g.fillRect(bx + w * 0.44, by + w * 0.55, w * 0.12, w * 0.4);
      g.fillStyle(0x3fbf5a, 1);
      g.fillCircle(bx + w * 0.5, by + w * 0.35, w * 0.3);
      g.fillCircle(bx + w * 0.3, by + w * 0.5, w * 0.2);
      g.fillCircle(bx + w * 0.7, by + w * 0.5, w * 0.2);
      g.fillStyle(0x7be08e, 0.8);
      g.fillCircle(bx + w * 0.42, by + w * 0.26, w * 0.1);
      break;
    case 'machine':
      g.fillStyle(0x4d9bff, 1);
      g.fillRoundedRect(bx + w * 0.12, by + w * 0.05, w * 0.76, w * 0.9, 6);
      g.fillStyle(0xe9f6ff, 1);
      g.fillRoundedRect(bx + w * 0.22, by + w * 0.14, w * 0.4, w * 0.5, 4);
      g.fillStyle(0xffd04a, 1);
      for (let i = 0; i < 3; i++) g.fillCircle(bx + w * 0.74, by + w * (0.22 + i * 0.16), w * 0.04);
      break;
    case 'buffer':
      g.fillStyle(0x6b6f80, 1);
      g.fillRoundedRect(bx + w * 0.05, by + w * 0.42, w * 0.9, w * 0.16, 4);
      g.fillStyle(0xe8434f, 1);
      g.fillRoundedRect(bx + w * 0.12, by + w * 0.25, w * 0.76, w * 0.2, 5);
      g.fillStyle(0xffffff, 0.8);
      for (let i = 0; i < 3; i++) g.fillRect(bx + w * (0.2 + i * 0.22), by + w * 0.27, w * 0.1, w * 0.16);
      break;
  }
}
