import type Phaser from 'phaser';
import { IntentBus, bindKeys } from 'dig-kit';
import type { Dir } from '../game/types';

export type Intent =
  | { type: 'tap'; x: number; y: number }
  | { type: 'swipe'; x: number; y: number; dx: number; dy: number }
  | { type: 'tapTrain'; train: number }
  | { type: 'run'; train: number; dir: Dir }
  | { type: 'restart' }
  | { type: 'next' }
  | { type: 'arrow'; dc: number; dr: number }
  | { type: 'confirm' };

export { IntentBus };

/** Keyboard device binding: arrows move a cursor (or pick a direction), Space taps the train under it. */
export function bindKeyboard(scene: Phaser.Scene, bus: IntentBus<Intent>): void {
  bindKeys<Intent>(scene, bus, {
    LEFT: { type: 'arrow', dc: -1, dr: 0 },
    RIGHT: { type: 'arrow', dc: 1, dr: 0 },
    UP: { type: 'arrow', dc: 0, dr: -1 },
    DOWN: { type: 'arrow', dc: 0, dr: 1 },
    SPACE: { type: 'confirm' },
    ENTER: { type: 'confirm' },
    R: { type: 'restart' },
  });
}

/**
 * Pointer/touch device binding. A press and release in place is a tap at that
 * point; a drag past the threshold is a swipe from where it started. The scene
 * works out which train or arrow that means.
 */
export function bindPointer(scene: Phaser.Scene, bus: IntentBus<Intent>, threshold: () => number): void {
  let down: { x: number; y: number } | null = null;
  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    down = scene.cameras.main.getWorldPoint(p.x, p.y);
  });
  scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (!down) return;
    const w = scene.cameras.main.getWorldPoint(p.x, p.y);
    const dx = w.x - down.x;
    const dy = w.y - down.y;
    const d = down;
    down = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= threshold()) bus.emit({ type: 'swipe', x: d.x, y: d.y, dx, dy });
    else bus.emit({ type: 'tap', x: w.x, y: w.y });
  });
}
