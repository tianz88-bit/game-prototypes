import type Phaser from 'phaser';
import { partKey } from './shipArt';
import { panel } from './ui';

const colours = [0x96d9bb, 0x75d9fc, 0xff9564, 0xf48278, 0xdd9bf0];
const gold = 0xf5c568;
const art = [
  partKey('turret-head', 'human-nomad-battlecruiser-v3'),
  '',
  partKey('gun', 'human-nomad-sparrow-v1'),
  'combat-missile',
  'combat-mine',
];
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
  private picked: { face: CardFace; at: number } | null = null;

  constructor(scene: Phaser.Scene) {
    this.icons = Array.from({ length: 3 }, () => scene.add.image(0, 0, '__WHITE').setVisible(false).setDepth(952));
  }

  begin(now: number, visible: boolean) {
    if (visible && !this.showing) this.opening = now;
    this.showing = visible;
    this.icons.forEach(icon => icon.setVisible(false));
  }

  confirm(face: CardFace, now: number) {
    this.picked = { face, at: now };
  }

  finish(g: Phaser.GameObjects.Graphics, now: number) {
    if (!this.picked) return;
    const { x, y, w, h } = this.picked.face;
    const t = (now - this.picked.at) / 240;
    if (t >= 1) { this.picked = null; return; }
    const a = 1 - t;
    g.lineStyle(1.5, gold, a * .9).strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 4);
    g.lineStyle(2, 0xfff0bd, a).lineBetween(x + 5, y + 3, x + 8 + (w - 16) * t, y + 3);
  }

  draw(g: Phaser.GameObjects.Graphics, slot: number, card: number, face: CardFace, tier: number, slots: number, now: number) {
    const { x, y, w, h } = face;
    const evolve = card >= 10;
    const colour = evolve ? gold : colours[card] ?? 0x99c9eb;
    panel(g, x, y, w, h, colour, true);
    if (evolve) g.fillStyle(0x775129, .6).fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 4);
    g.fillStyle(0x091522, .95).fillRoundedRect(x + 5, y + 5, 23, h - 10, 3);
    g.lineStyle(1, colour, .6).strokeRoundedRect(x + 5, y + 5, 23, h - 10, 3);
    const cx = x + 16.5, cy = y + h / 2;
    const key = evolve ? evolutionArt[card - 10] : art[card];
    const icon = this.icons[slot];
    if (key && icon.scene.textures.exists(key)) {
      const frame = key.startsWith('combat-') && icon.scene.textures.get(key).has('body') ? 'body' : undefined;
      icon.setTexture(key, frame).setPosition(cx, cy).setVisible(true);
      const scale = Math.min(18 / icon.frame.width, 27 / icon.frame.height);
      icon.setDisplaySize(icon.frame.width * scale, icon.frame.height * scale);
    } else this.glyph(g, card, cx, cy, colour);
    if (!evolve) {
      for (let i = 0; i < slots; i++) {
        const px = x + 31 + i * 9;
        g.fillStyle(colour, i < tier ? .95 : .19).fillRoundedRect(px, y + 24, 6, 3, 1);
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
      0: [[-9,-2],[-5,-6],[5,-6],[9,-2],[5,5],[0,3],[-5,5]],
      1: [[-8,-9],[8,-9],[8,-1],[5,5],[0,10],[-5,5],[-8,-1]],
      2: [[-2,-10],[2,-10],[2,-3],[5,-1],[5,8],[-5,8],[-5,-1],[-2,-3]],
      3: [[0,-10],[4,-4],[4,4],[8,8],[2,6],[-2,6],[-8,8],[-4,4],[-4,-4]],
      4: [[-3,-6],[0,-9],[3,-6],[7,-5],[6,-2],[9,0],[6,3],[6,6],[2,6],[0,9],[-3,6],[-6,6],[-6,2],[-9,0],[-6,-2],[-6,-6]],
    };
    const pts = (shapes[card] ?? [[0,-11],[8,6],[5,9],[0,6],[-5,9],[-8,6]]).map(([u, v]) => point(u, v));
    g.fillStyle(colour, .95).fillPoints(pts, true);
    g.lineStyle(1.1, 0x091522, 1).strokePoints(pts, true);
    g.fillStyle(0xffeed0, .65).fillCircle(x, y - 2, card === 1 ? 3 : 2);
  }
}
