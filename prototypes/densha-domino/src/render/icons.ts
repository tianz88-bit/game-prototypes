import Phaser from 'phaser';
import { hasArt } from './art';

export type IconKind = 'undo' | 'hint' | 'restart' | 'menu' | 'ad' | 'heart' | 'cab';

/** Art key for an icon from loose/icon-<kind>.webp (see art-sets.json). */
export const iconKey = (kind: IconKind): string => 'icon_' + kind;

/**
 * An icon of the given size: the art version when it is loaded, otherwise a vector placeholder
 * drawn in the given colour.
 */
export function makeIcon(scene: Phaser.Scene, kind: IconKind, size: number, color = 0xfffaf0): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | Phaser.GameObjects.Container {
  if (hasArt(scene, iconKey(kind))) {
    // The art is plum on transparent: filled with the requested colour, except the ad badge, which sits on a
    // cream disc so it reads on any button.
    const image = scene.add.image(0, 0, iconKey(kind)).setDisplaySize(size, size);
    if (kind !== 'ad') return image.setTintFill(color);
    const disc = scene.add.graphics().fillStyle(0xfff9ee, 1).fillCircle(0, 0, size * 0.55);
    image.setDisplaySize(size * 0.8, size * 0.8);
    return scene.add.container(0, 0, [disc, image]);
  }
  const g = scene.add.graphics();
  const s = size / 24; // drawn on a 24-unit grid centred on 0
  const line = (w: number) => g.lineStyle(w * s, color, 1);
  switch (kind) {
    case 'undo': {
      line(2.6);
      g.beginPath();
      g.arc(1.5 * s, 1.5 * s, 7 * s, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(100), false);
      g.strokePath();
      g.fillStyle(color, 1).fillTriangle(-9.5 * s, -5 * s, -2 * s, -3.5 * s, -7.5 * s, 2.5 * s);
      break;
    }
    case 'restart': {
      line(2.6);
      g.beginPath();
      g.arc(0, 0.5 * s, 7.5 * s, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(250), false);
      g.strokePath();
      g.fillStyle(color, 1).fillTriangle(1 * s, -10.5 * s, 8.5 * s, -8 * s, 3 * s, -2 * s);
      break;
    }
    case 'menu': {
      g.fillStyle(color, 1);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) g.fillRoundedRect((-8 + c * 9) * s, (-8 + r * 9) * s, 7 * s, 7 * s, 2 * s);
      break;
    }
    case 'hint': {
      g.fillStyle(color, 1).fillCircle(0, -2.5 * s, 7 * s);
      g.fillRect(-3.5 * s, 2 * s, 7 * s, 4 * s);
      g.fillRoundedRect(-3 * s, 6.5 * s, 6 * s, 3 * s, 1.2 * s);
      g.fillStyle(0xffd04a, 1).fillCircle(-2 * s, -4 * s, 2 * s);
      break;
    }
    case 'heart': {
      g.fillStyle(color, 1).fillCircle(-4.5 * s, -3 * s, 5.5 * s).fillCircle(4.5 * s, -3 * s, 5.5 * s).fillTriangle(-9.8 * s, -0.5 * s, 9.8 * s, -0.5 * s, 0, 10 * s);
      break;
    }
    case 'cab': {
      g.fillStyle(color, 1).fillRoundedRect(-10 * s, -7 * s, 20 * s, 12 * s, 4 * s).fillCircle(-5 * s, 7 * s, 2.5 * s).fillCircle(5 * s, 7 * s, 2.5 * s);
      break;
    }
    case 'ad': {
      g.fillStyle(0xffd04a, 1).fillCircle(0, 0, 11 * s);
      g.lineStyle(1.6 * s, 0xfff9ee, 1).strokeCircle(0, 0, 11 * s);
      g.fillStyle(0x74435c, 1).fillTriangle(-3.5 * s, -5.5 * s, -3.5 * s, 5.5 * s, 6 * s, 0);
      break;
    }
  }
  return g;
}
