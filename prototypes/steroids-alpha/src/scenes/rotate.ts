// Phone play is landscape only (owner decision). This scene runs on top of every other scene and,
// on a touch device held upright, covers the screen with a prompt to turn the phone. Input is
// blocked meanwhile (see Intents.portraitBlocked); the game underneath keeps running.
import Phaser from 'phaser';
import { logicalSize } from '../base';
import { intents } from '../input/intents';
import { fitCamera, text } from './common';

export class RotateScene extends Phaser.Scene {
  private backdrop!: Phaser.GameObjects.Rectangle;
  private phone!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;

  constructor() {
    super('rotate');
  }

  create(): void {
    this.backdrop = this.add.rectangle(0, 0, 10, 10, 0x05070d, 0.94).setOrigin(0);
    this.phone = this.add.graphics();
    this.label = text(this, 0, 0, 'Turn your phone sideways to play', 18, '#e8f0ff').setOrigin(0.5);
    this.layout();
    this.game.events.on('dpr', this.layout, this);
  }

  private layout(): void {
    fitCamera(this);
    const { w, h } = logicalSize();
    this.backdrop.setSize(w, h);
    this.label.setPosition(w / 2, h / 2 + 90).setWordWrapWidth(w - 40).setAlign('center');
    this.phone.setPosition(w / 2, h / 2 - 20);
  }

  update(time: number): void {
    const show = intents.portraitBlocked;
    this.backdrop.setVisible(show);
    this.label.setVisible(show);
    this.phone.setVisible(show);
    if (!show) return;
    // A phone outline that tips over to landscape and back.
    const g = this.phone;
    g.clear();
    g.lineStyle(3, 0x9fd8ff, 1);
    g.strokeRoundedRect(-28, -50, 56, 100, 10);
    g.fillStyle(0x9fd8ff, 1);
    g.fillCircle(0, 40, 4);
    const t = (time % 2400) / 2400;
    g.setRotation((Math.min(1, Math.max(0, (t - 0.2) / 0.3)) - Math.min(1, Math.max(0, (t - 0.75) / 0.2))) * (Math.PI / 2));
  }
}
