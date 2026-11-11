// Main menu: enter a pilot name, then pick a planet to drop into. The hangar (stash and loadout)
// comes in a later milestone. The name is shown under your ship and on the leaderboard.
import Phaser from 'phaser';
import { PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import { logicalSize } from '../base';
import { intents } from '../input/intents';
import { fitCamera, text, versionStamp } from './common';
import { cleanName } from '../../sim/protocol';
import { loadSave, writeSave } from '../save';

export interface MenuButton {
  id: PlanetId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Phones only open their keyboard for a real text field, so the name box is drawn on the canvas but
 * typing goes to one invisible input element. Nothing else on the page is DOM.
 */
let field: HTMLInputElement | null = null;
function nameField(): HTMLInputElement {
  if (!field) {
    field = document.createElement('input');
    field.type = 'text';
    field.maxLength = 16;
    field.autocomplete = 'off';
    field.spellcheck = false;
    field.setAttribute('aria-label', 'Pilot name');
    // 16px stops iOS zooming in; off-screen and transparent, but focusable.
    field.style.cssText = 'position:fixed;left:-1000px;top:0;width:200px;font-size:16px;opacity:0;';
    document.body.appendChild(field);
  }
  return field;
}

export class MenuScene extends Phaser.Scene {
  buttons: MenuButton[] = [];
  nameBox = { x: 0, y: 0, w: 0, h: 0 };
  private nameText!: Phaser.GameObjects.Text;
  private nameFrame!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('menu');
  }

  create(): void {
    this.layout();
    this.game.events.on('dpr', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('dpr', this.layout, this);
      nameField().blur();
      intents.textBox = null;
    });
    nameField().onkeydown = (e) => {
      if (e.key === 'Enter') nameField().blur();
    };
    intents.drainTaps();
  }

  private layout(): void {
    this.children.removeAll(true);
    fitCamera(this);
    const { w, h } = logicalSize();
    this.add.rectangle(w / 2, h / 2, w, h, 0x05070d);
    const title = Math.min(40, w / 10, h / 9);
    text(this, w / 2, h * 0.11, 'STEROIDS-ALPHA', title, '#e8f0ff').setOrigin(0.5);

    // Pilot name.
    const bw = Math.min(320, w - 48);
    const ny = h * 0.11 + title * 0.6 + 34;
    text(this, w / 2 - bw / 2, ny - 30, 'PILOT NAME', 11, '#8fa2c8');
    this.nameBox = { x: w / 2, y: ny, w: bw, h: 36 };
    intents.textBox = { zone: { x: w / 2, y: ny, hw: bw / 2, hh: 18 }, field: nameField() };
    this.nameFrame = this.add.rectangle(w / 2, ny, bw, 36, 0x0d1424).setStrokeStyle(2, 0x5a6b8f);
    this.nameText = text(this, w / 2 - bw / 2 + 12, ny, '', 16).setOrigin(0, 0.5);
    nameField().value = loadSave().name ?? '';

    text(this, w / 2, ny + 34, 'Choose a planet to drop into', 14, '#8fa2c8').setOrigin(0.5);
    const bh = Math.min(64, Math.max(44, (h - (ny + 60) - 24) / 2 - 12));
    this.buttons = PLANETS.map((p, i) => {
      const x = w / 2;
      const y = ny + 60 + bh / 2 + i * (bh + 12);
      this.add.rectangle(x, y, bw, bh, p.colour).setStrokeStyle(2, 0x9fb4e0);
      text(this, x, y, p.label, 22).setOrigin(0.5);
      return { id: p.id, x, y, w: bw, h: bh };
    });
    versionStamp(this);
  }

  update(time: number): void {
    const input = nameField();
    const editing = document.activeElement === input;
    const name = cleanName(input.value);
    const caret = editing && Math.floor(time / 500) % 2 === 0 ? '|' : '';
    this.nameText.setText(name || editing ? name + caret : 'Tap to enter a name').setColor(name || editing ? '#e8f0ff' : '#6d7a96');
    this.nameFrame.setStrokeStyle(2, editing ? 0x9fd8ff : 0x5a6b8f);
    for (const t of intents.drainTaps()) {
      const n = this.nameBox;
      // Focus and blur already happened in the tap itself (Intents.textBox).
      if (Math.abs(t.x - n.x) <= n.w / 2 && Math.abs(t.y - n.y) <= n.h / 2) continue;
      const b = this.buttons.find((b) => Math.abs(t.x - b.x) <= b.w / 2 && Math.abs(t.y - b.y) <= b.h / 2);
      if (b) {
        writeSave({ name });
        this.scene.start('flight', { planet: b.id });
        return;
      }
    }
    if (!editing && (loadSave().name ?? '') !== name) writeSave({ name });
  }
}
