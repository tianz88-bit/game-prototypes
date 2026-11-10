// Main menu: pick a planet to drop into. The hangar (stash and loadout) comes in a later milestone.
import Phaser from 'phaser';
import { PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import { logicalSize } from '../base';
import { intents } from '../input/intents';
import { fitCamera, text, versionStamp } from './common';

export interface MenuButton {
  id: PlanetId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class MenuScene extends Phaser.Scene {
  buttons: MenuButton[] = [];

  constructor() {
    super('menu');
  }

  create(): void {
    this.layout();
    this.game.events.on('dpr', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('dpr', this.layout, this));
    intents.drainTaps();
  }

  private layout(): void {
    this.children.removeAll(true);
    fitCamera(this);
    const { w, h } = logicalSize();
    this.add.rectangle(w / 2, h / 2, w, h, 0x05070d);
    text(this, w / 2, h * 0.22, 'STEROIDS-ALPHA', Math.min(44, w / 10), '#e8f0ff').setOrigin(0.5);
    text(this, w / 2, h * 0.22 + Math.min(44, w / 10), 'Choose a planet to drop into', 16, '#8fa2c8').setOrigin(0.5);

    const bw = Math.min(320, w - 48);
    const bh = 64;
    this.buttons = PLANETS.map((p, i) => {
      const x = w / 2;
      const y = h * 0.5 + i * (bh + 18);
      this.add.rectangle(x, y, bw, bh, p.colour).setStrokeStyle(2, 0x9fb4e0);
      text(this, x, y, p.label, 22).setOrigin(0.5);
      return { id: p.id, x, y, w: bw, h: bh };
    });
    versionStamp(this);
  }

  update(): void {
    for (const t of intents.drainTaps()) {
      const b = this.buttons.find((b) => Math.abs(t.x - b.x) <= b.w / 2 && Math.abs(t.y - b.y) <= b.h / 2);
      if (b) {
        this.scene.start('flight', { planet: b.id });
        return;
      }
    }
  }
}
