import type Phaser from 'phaser';
import parts from '../../title-parts.json';
import { tune } from '../tune';

export function createTitleArt(scene: Phaser.Scene, x: number, y: number, width: number) {
  const order = ['name', 'express', 'salmon', 'honk', 'mint'] as const;
  if (!order.every(part => scene.textures.exists('title_' + part))) return;

  const scale = width / parts.width;
  const group = scene.add.container(x - width / 2, y - parts.height * scale / 2).setScale(scale);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const part of order) {
    const [left, top] = parts.positions[part];
    const sprite = scene.add.image(left, top, 'title_' + part).setOrigin(0);
    group.add(sprite);
    if (reduced) continue;
    const cue = tune.titleEntrance[part];
    sprite.setPosition(left + cue.x / scale, top + cue.y / scale).setAlpha(0);
    scene.tweens.add({
      targets: sprite, x: left, y: top, alpha: 1, delay: cue.delay,
      duration: cue.duration, ease: 'Cubic.Out'
    });
    sprite.once('destroy', () => scene.tweens.killTweensOf(sprite));
  }
  return group;
}
