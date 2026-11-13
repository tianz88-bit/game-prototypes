// Hangar: spend banked credits on unlocks (sim/unlocks.ts: cosmetics and quality of life, never
// raw power) and choose what to wear. Buying takes two taps (tap, then tap again to confirm); the
// server sets the price and checks the balance. Equipping is saved locally and sent on drop-in,
// where the server shows only what the account owns. Placeholder look: Phaser canvas only.
import Phaser from 'phaser';
import { logicalSize } from '../base';
import { intents } from '../input/intents';
import { fitCamera, text, versionStamp } from './common';
import { loadSave, writeSave } from '../save';
import { UI, css, panel } from '../render/ui';
import { TUNE } from '../../sim/tune';
import { UNLOCKS, unlockPrice } from '../../sim/unlocks';
import type { Unlock } from '../../sim/unlocks';
import { buyUnlock, ensureAccount } from '../net/account';

/** Rows of the grid: what sits together. */
const ROWS: string[][] = [
  ['tint.crimson', 'tint.emerald', 'tint.violet', 'tint.gold', 'tint.ice'],
  ['flame.green', 'flame.violet', 'flame.white', 'flame.red', 'killfx.nova'],
  ['shield.green', 'shield.gold', 'shield.pink', 'runlog'],
  ['badge.crown', 'badge.spark', 'badge.skull', 'tag.gold', 'tag.mint', 'tag.rose'],
];

interface Card {
  u: Unlock;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class HangarScene extends Phaser.Scene {
  credits: number | null = null;
  unlocks: string[] = [];
  cards: Card[] = [];
  backButton = { x: 0, y: 0, w: 0, h: 0 };
  /** The item waiting for its confirming second tap. */
  private armed: string | null = null;
  private note = '';
  private busy = false;
  private showRuns = false;

  constructor() {
    super('hangar');
  }

  create(data: { credits?: number | null; unlocks?: string[] }): void {
    this.credits = data?.credits ?? null;
    this.unlocks = data?.unlocks ?? [];
    this.armed = null;
    this.note = '';
    this.showRuns = false;
    this.layout();
    this.game.events.on('dpr', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('dpr', this.layout, this));
    intents.drainTaps();
    void ensureAccount().then((a) => {
      if (!a || !this.scene.isActive()) return;
      this.credits = a.balance;
      this.unlocks = a.unlocks;
      this.layout();
    });
  }

  private owned(id: string): boolean {
    return this.unlocks.includes(id);
  }

  private layout(): void {
    this.children.removeAll(true);
    fitCamera(this);
    const { w, h } = logicalSize();
    this.add.rectangle(w / 2, h / 2, w, h, 0x07101c);
    text(this, w / 2, 26, 'HANGAR', 24, css(UI.uiText)).setOrigin(0.5);
    text(this, 136, 26, `CREDITS ${this.credits ?? '…'}`, 16, '#ffd23a').setOrigin(0, 0.5);
    this.backButton = { x: 20 + 50, y: 26, w: 100, h: 32 };
    panel(this.add.graphics(), 20, 10, 100, 32, UI.uiBorder);
    text(this, 70, 26, 'BACK', 13).setOrigin(0.5);

    const look = loadSave().look ?? {};
    const cols = 6;
    const gap = 8;
    const cw = Math.min(180, (w - 40 - gap * (cols - 1)) / cols);
    const top = 54;
    const ch = Math.min(72, (h - top - 34) / ROWS.length - gap);
    const left = (w - (cw * cols + gap * (cols - 1))) / 2;
    this.cards = [];
    ROWS.forEach((row, r) => {
      row.forEach((id, c) => {
        const u = UNLOCKS.find((x) => x.id === id);
        if (!u) return;
        const x = left + c * (cw + gap) + cw / 2;
        const y = top + r * (ch + gap) + ch / 2;
        const owned = this.owned(u.id);
        const equipped = u.slot !== 'qol' && look[u.slot] === u.id;
        const armed = this.armed === u.id;
        const g = this.add.graphics();
        panel(g, x - cw / 2, y - ch / 2, cw, ch, equipped ? UI.uiAccent : armed ? UI.uiGold : owned ? UI.uiBorder : 0x2a3550, equipped || armed);
        // Swatch on the left: colour, flame colours or the badge glyph.
        const sx = x - cw / 2 + 18;
        if (u.palette) u.palette.forEach((p, i) => { g.fillStyle(p, 1); g.fillCircle(sx - 6 + (i % 2) * 12, y - 6 + Math.floor(i / 2) * 12, 5); });
        else if (u.colour !== undefined) { g.fillStyle(u.colour, 1); g.fillCircle(sx, y, 10); }
        else if (u.glyph) text(this, sx, y, u.glyph, 18, '#ffd23a').setOrigin(0.5);
        else text(this, sx, y, '≡', 18, '#dfe8ff').setOrigin(0.5);
        const status = equipped ? 'EQUIPPED' : armed ? 'Tap to confirm' : owned ? (u.slot === 'qol' ? 'OWNED · tap to view' : 'OWNED · tap to wear') : `${unlockPrice(u, TUNE)} credits`;
        const small = cw < 140;
        text(this, sx + 16, y - 9, u.name, small ? 10 : 12, '#e8f0ff').setOrigin(0, 0.5);
        text(this, sx + 16, y + 9, status, small ? 9 : 10, equipped ? '#7fe9ff' : armed ? '#ffd23a' : owned ? '#9fb3d6' : '#ffd98a').setOrigin(0, 0.5);
        this.cards.push({ u, x, y, w: cw, h: ch });
      });
    });
    if (this.note) text(this, w / 2, h - 16, this.note, 12, '#ffd98a').setOrigin(0.5);
    if (this.showRuns) this.drawRuns(w, h);
    versionStamp(this);
  }

  /** Run history (the Run history unlock): the last ten runs, newest first. */
  private drawRuns(w: number, h: number): void {
    const pw = Math.min(520, w - 40);
    const ph = Math.min(300, h - 70);
    const x = w / 2 - pw / 2;
    const y = h / 2 - ph / 2 + 10;
    const g = this.add.graphics();
    g.fillStyle(0x050b15, 0.7);
    g.fillRect(0, 0, w, h);
    panel(g, x, y, pw, ph, UI.uiAccent, true);
    text(this, w / 2, y + 16, 'RUN HISTORY  (tap to close)', 13).setOrigin(0.5);
    const runs = loadSave().runs ?? [];
    if (!runs.length) text(this, w / 2, y + ph / 2, 'No runs yet', 12, '#8fa2c8').setOrigin(0.5);
    const line = Math.min(24, (ph - 40) / 10);
    runs.forEach((r, i) => {
      const t = new Date(r.at);
      const when = `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      const time = `${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, '0')}`;
      const s = `${when}   ${r.planet === 'alpha' ? 'Planet A' : 'Planet B'}   ${r.outcome === 'extracted' ? 'EXTRACTED' : 'DESTROYED'}   ${r.outcome === 'extracted' ? '+' : '-'}${r.salvage} salvage   ${r.kills} KO   ${time}`;
      text(this, x + 14, y + 38 + i * line, s, 11, r.outcome === 'extracted' ? '#7fe9ff' : '#ff9a8a').setOrigin(0, 0.5);
    });
  }

  private async tapCard(u: Unlock): Promise<void> {
    if (this.owned(u.id)) {
      this.armed = null;
      if (u.slot === 'qol') {
        this.showRuns = true;
      } else {
        const look = { ...(loadSave().look ?? {}) };
        if (look[u.slot] === u.id) delete look[u.slot];
        else look[u.slot] = u.id;
        writeSave({ look });
        this.note = look[u.slot] ? `${u.name} equipped` : `${u.name} removed`;
      }
      this.layout();
      return;
    }
    const price = unlockPrice(u, TUNE);
    if (this.credits !== null && this.credits < price) {
      this.armed = null;
      this.note = `${u.name} needs ${price - this.credits} more credits`;
      this.layout();
      return;
    }
    if (this.armed !== u.id) {
      this.armed = u.id;
      this.note = `Tap again to buy ${u.name} for ${price} credits`;
      this.layout();
      return;
    }
    this.armed = null;
    this.busy = true;
    this.note = 'Buying…';
    this.layout();
    const r = await buyUnlock(u.id);
    this.busy = false;
    if ('error' in r) this.note = r.error;
    else {
      this.credits = r.balance;
      this.unlocks = r.unlocks;
      // Wear it straight away (except quality-of-life items, which just work).
      if (u.slot !== 'qol') writeSave({ look: { ...(loadSave().look ?? {}), [u.slot]: u.id } });
      this.note = `${u.name} bought`;
    }
    if (this.scene.isActive()) this.layout();
  }

  update(): void {
    if (intents.consume('pause')) {
      this.scene.start('menu');
      return;
    }
    for (const t of intents.drainTaps()) {
      if (this.showRuns) {
        this.showRuns = false;
        this.layout();
        return;
      }
      const b = this.backButton;
      if (Math.abs(t.x - b.x) <= b.w / 2 && Math.abs(t.y - b.y) <= b.h / 2) {
        this.scene.start('menu');
        return;
      }
      if (this.busy) continue;
      const c = this.cards.find((c) => Math.abs(t.x - c.x) <= c.w / 2 && Math.abs(t.y - c.y) <= c.h / 2);
      if (c) void this.tapCard(c.u);
    }
  }
}
