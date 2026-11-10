import Phaser from 'phaser';
import { DPR, logicalSize } from '../base';
import { VERSION_STAMP } from '../version.generated';

/** Map logical coordinates onto the DPR-sized buffer: zoom by DPR around the logical centre. */
export function fitCamera(scene: Phaser.Scene): void {
  const { w, h } = logicalSize();
  const cam = scene.cameras.main;
  cam.setSize(w * DPR, h * DPR);
  cam.setZoom(DPR);
  cam.centerOn(w / 2, h / 2);
}

/** Text sharp at the current DPR. */
export function text(scene: Phaser.Scene, x: number, y: number, s: string, size: number, colour = '#dfe8ff'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, { fontFamily: 'system-ui, sans-serif', fontSize: `${size}px`, color: colour, resolution: DPR });
}

/** Tiny low-contrast version stamp in the top-left corner (repo rule). */
export function versionStamp(scene: Phaser.Scene): Phaser.GameObjects.Text {
  return text(scene, 4, 3, VERSION_STAMP, 9, '#8090b0').setAlpha(0.45).setDepth(1000);
}
