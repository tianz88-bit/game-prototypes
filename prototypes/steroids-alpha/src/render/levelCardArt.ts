import type Phaser from 'phaser';
import { partKey } from './shipArt';

const steel = 0x9caab5;
const gold = 0xeac47b;
const evolutionArt = [
  partKey('chassis', 'human-nomad-battlecruiser-v3'),
  partKey('chassis', 'human-nomad-missile-cruiser-v1'),
];

export type CardFace = { x: number; y: number; w: number; h: number };

/** Decorative only. Flight owns the normal hit zones and authoritative picks. */
export class LevelCardArt {
  private readonly icons: Phaser.GameObjects.Image[];
  private opening = -Infinity;
  private showing = false;
  private picked: { face: CardFace; at: number; evolution: boolean } | null = null;

  constructor(scene: Phaser.Scene) {
    this.icons = Array.from({ length: 3 }, () => scene.add.image(0, 0, '__WHITE').setVisible(false).setDepth(954));
  }

  begin(now: number, visible: boolean) {
    if (visible && !this.showing) this.opening = now;
    this.showing = visible;
    this.icons.forEach(icon => icon.setVisible(false));
  }

  confirm(face: CardFace, now: number, evolution: boolean) {
    this.picked = { face, at: now, evolution };
  }

  tray(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.fillStyle(0x101419, .96).fillRoundedRect(x, y, w, h, 4);
    g.lineStyle(1, 0x5b646e, .85).strokeRoundedRect(x, y, w, h, 4);
    g.lineStyle(1, 0x3c454e, .85).lineBetween(x + 6, y + 19, x + w - 6, y + 19);
  }

  finish(g: Phaser.GameObjects.Graphics, now: number) {
    if (!this.picked) return;
    const { x, y, w, h } = this.picked.face;
    const t = (now - this.picked.at) / 240;
    if (t >= 1) { this.picked = null; return; }
    const a = 1 - t;
    const light = this.picked.evolution ? gold : 0xe6eef3;
    g.lineStyle(1.5, light, a * .9).strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 4);
    g.lineStyle(2, light, a).lineBetween(x + 5, y + 3, x + 8 + (w - 16) * t, y + 3);
  }

  draw(g: Phaser.GameObjects.Graphics, slot: number, card: number, face: CardFace, tier: number, slots: number, now: number) {
    const { x, y, w, h } = face;
    const evolve = card >= 10;
    const colour = evolve ? gold : steel;
    g.fillStyle(evolve ? 0x322818 : 0x272e35, 1).fillRoundedRect(x, y, w, h, 3);
    g.lineStyle(1, colour, evolve ? .9 : .54).strokeRoundedRect(x + .5, y + .5, w - 1, h - 1, 3);
    g.lineStyle(1, colour, .62).lineBetween(x + 5, y + 2, x + w - 5, y + 2);
    g.fillStyle(0x14191e, 1).fillRoundedRect(x + 5, y + 6, 26, h - 12, 2);
    g.lineStyle(1, evolve ? 0x7f663d : 0x4c5760, 1).strokeRoundedRect(x + 5, y + 6, 26, h - 12, 2);
    const cx = x + 18, cy = y + h / 2;
    const key = evolve ? evolutionArt[card - 10] : undefined;
    const icon = this.icons[slot];
    if (key && icon.scene.textures.exists(key)) {
      icon.setTexture(key).setPosition(cx, cy).setVisible(true);
      const scale = Math.min(21 / icon.frame.width, 29 / icon.frame.height);
      icon.setDisplaySize(icon.frame.width * scale, icon.frame.height * scale);
    } else this.glyph(g, card, cx, cy, colour);
    if (!evolve) {
      for (let i = 0; i < slots; i++) {
        const px = x + 37 + i * 9;
        g.fillStyle(colour, i < tier ? .95 : .26).fillRect(px, y + h - 8, 6, 2);
      }
    }
    const age = now - this.opening - slot * 30;
    if (age >= 0 && age < 220) {
      g.lineStyle(1.5, colour, (1 - age / 220) * .8).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 4);
    }
  }

  private glyph(g: Phaser.GameObjects.Graphics, card: number, x: number, y: number, colour: number) {
    const point = (u: number, v: number) => ({ x: x + u, y: y + v });
    const shapes: Record<number, [number, number][]> = {
      0: [[-10,-4],[-6,-7],[-4,-3],[-2,-6],[2,-6],[4,-3],[6,-7],[10,-4],[9,3],[5,3],[2,7],[-2,7],[-5,3],[-9,3]],
      1: [[-8,-9],[8,-9],[8,-1],[5,5],[0,10],[-5,5],[-8,-1]],
      2: [[-10,-4],[-6,-6],[1,-6],[1,-3],[9,-3],[9,1],[2,1],[2,4],[-3,4],[-3,7],[-8,7],[-8,2],[-10,2]],
      3: [[0,-10],[4,-4],[4,4],[8,8],[2,6],[-2,6],[-8,8],[-4,4],[-4,-4]],
      4: [[-3,-6],[0,-9],[3,-6],[7,-5],[6,-2],[9,0],[6,3],[6,6],[2,6],[0,9],[-3,6],[-6,6],[-6,2],[-9,0],[-6,-2],[-6,-6]],
    };
    const pts = (shapes[card] ?? [[0,-11],[8,6],[5,9],[0,6],[-5,9],[-8,6]]).map(([u, v]) => point(u, v));
    g.fillStyle(colour, 1).fillPoints(pts, true);
    g.lineStyle(1, 0xe5edf3, .75).strokePoints(pts, true);
    g.fillStyle(0x303943, 1);
    switch (card) {
      case 0:
        g.fillRect(x - 7, y - 2, 3, 2).fillRect(x + 4, y - 2, 3, 2).fillRect(x - 2, y - 4, 4, 6);
        break;
      case 1:
        g.fillPoints([point(-5, -6), point(5, -6), point(4, 1), point(0, 6), point(-4, 1)], true);
        g.lineStyle(1, 0xd8e4eb, 1).lineBetween(x, y - 4, x, y + 3);
        break;
      case 2:
        g.fillRect(x - 7, y - 3, 5, 3).fillRect(x + 1, y - 1, 7, 1).fillRect(x - 7, y + 3, 3, 2);
        break;
      case 3:
        g.fillRect(x - 3, y - 2, 6, 2).fillRect(x - 2, y + 3, 4, 2);
        break;
      case 4:
        g.fillCircle(x, y, 4);
        g.fillStyle(0xe5edf3, 1).fillRect(x - 1, y - 1, 2, 2);
        break;
    }
  }
}
