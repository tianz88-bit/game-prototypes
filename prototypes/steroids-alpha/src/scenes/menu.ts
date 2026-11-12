// Main menu: enter a pilot name, then pick a planet to drop into. The hangar (stash and loadout)
// comes in a later milestone. The name is shown under your ship and on the leaderboard.
import Phaser from 'phaser';
import { PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import { logicalSize, serverOrigin } from '../base';
import { intents } from '../input/intents';
import { fitCamera, text, versionStamp } from './common';
import { cleanName } from '../../sim/protocol';
import { loadSave, writeSave } from '../save';
import { clientTune } from '../clientTune';

export interface MenuButton {
  id: PlanetId;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Phones only open their keyboard when the player taps a real text field themselves (a field focused
 * from script does not count on iOS, and a touch's pointerdown is not a user gesture). So the name box
 * is drawn on the canvas and one see-through input element sits exactly on top of it: the tap lands on
 * the field and the browser opens the keyboard. Nothing else on the page is DOM.
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
    field.enterKeyHint = 'done';
    // 16px stops iOS zooming in. The canvas draws the text and caret, so the field shows nothing itself.
    field.style.cssText =
      'position:fixed;display:none;margin:0;padding:0;border:0;outline:none;background:transparent;' +
      'color:transparent;caret-color:transparent;font-size:16px;z-index:5;touch-action:manipulation;';
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
      const f = nameField();
      f.blur();
      f.style.display = 'none';
      intents.textBox = null;
    });
    nameField().onkeydown = (e) => {
      if (e.key === 'Enter') nameField().blur();
    };
    intents.drainTaps();
  }

  private layout(): void {
    this.children.removeAll(true);
    this.countText.clear();
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
    const f = nameField();
    // Opening the keyboard resizes the page and re-runs this layout; keep what is being typed.
    if (document.activeElement !== f) f.value = loadSave().name ?? '';
    const r = this.game.canvas.getBoundingClientRect();
    Object.assign(f.style, { display: 'block', left: `${r.left + w / 2 - bw / 2}px`, top: `${r.top + ny - 18}px`, width: `${bw}px`, height: '36px' });

    text(this, w / 2, ny + 34, 'Choose a planet to drop into', 14, '#8fa2c8').setOrigin(0.5);
    const bh = Math.min(64, Math.max(44, (h - (ny + 60) - 24) / 2 - 12));
    this.buttons = PLANETS.map((p, i) => {
      const x = w / 2;
      const y = ny + 60 + bh / 2 + i * (bh + 12);
      this.add.rectangle(x, y, bw, bh, p.colour).setStrokeStyle(2, 0x9fb4e0);
      text(this, x, y - (bh > 52 ? 8 : 6), p.label, 22).setOrigin(0.5);
      this.countText.set(p.id, text(this, x, y + (bh > 52 ? 16 : 12), '', 12, '#c9d6f2').setOrigin(0.5));
      return { id: p.id, x, y, w: bw, h: bh };
    });
    versionStamp(this);
    this.showCounts();
  }

  /** Pilots on each planet, from the server; refreshed every few seconds while the menu is open. */
  private counts: Record<string, number> | null = null;
  private countText = new Map<string, Phaser.GameObjects.Text>();
  private countsAt = -1e9;
  private async pollCounts(): Promise<void> {
    try {
      const url = serverOrigin().replace(/^ws/, 'http') + '/planets';
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) this.counts = ((await r.json()) as { planets: Record<string, number> }).planets;
    } catch {
      // Offline or the server is unreachable: leave the counts off.
    }
    if (this.scene.isActive()) this.showCounts();
  }

  /** The pilot count shown on each planet button (test hook). */
  countLabels(): Record<string, string> {
    return Object.fromEntries([...this.countText].map(([id, t]) => [id, t.text]));
  }

  private showCounts(): void {
    for (const [id, t] of this.countText) {
      if (!t.active) continue;
      const n = this.counts?.[id];
      t.setText(n === undefined || n < 0 ? '' : n === 1 ? '1 pilot' : `${n} pilots`);
    }
  }

  update(time: number): void {
    if (time - this.countsAt > clientTune.net.planetCountRefreshMs) {
      this.countsAt = time;
      void this.pollCounts();
    }
    const input = nameField();
    const editing = document.activeElement === input;
    const name = cleanName(input.value);
    const caret = editing && Math.floor(time / 500) % 2 === 0 ? '|' : '';
    this.nameText.setText(name || editing ? name + caret : 'Tap to enter a name').setColor(name || editing ? '#e8f0ff' : '#6d7a96');
    this.nameFrame.setStrokeStyle(2, editing ? 0x9fd8ff : 0x5a6b8f);
    for (const t of intents.drainTaps()) {
      const n = this.nameBox;
      // Taps on the name box belong to the text field over it.
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
