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
import { UNLOCKS, effectiveOwned, unclaimedLegacy, unlockPrice } from '../../sim/unlocks';
import type { Unlock } from '../../sim/unlocks';
import { buyUnlock, ensureAccount } from '../net/account';

/** Categories, one per tab (owner request: the shop by category). */
const TABS: { label: string; items: string[] }[] = [
  { label: 'SHIPS', items: ['ship.scrappy', 'ship.interceptor'] },
  { label: 'PALETTES', items: ['palette.0', 'palette.1', 'palette.2', 'palette.3'] },
  { label: 'FLAMES', items: ['flame.green', 'flame.violet', 'flame.white', 'flame.red'] },
  { label: 'SHIELDS', items: ['shield.green', 'shield.gold', 'shield.pink'] },
  { label: 'KILL FX', items: ['killfx.nova'] },
  { label: 'BADGES', items: ['badge.crown', 'badge.spark', 'badge.skull'] },
  { label: 'NAMES', items: ['tag.gold', 'tag.mint', 'tag.rose'] },
  { label: 'EXTRAS', items: ['runlog'] },
];
/** The open tab, kept while the game is open (back to the menu and in again). */
let openTab = 0;

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
  tabs: { index: number; label: string; x: number; y: number; w: number; h: number }[] = [];
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

  /** Owned: bought, free (Scrappy, the default palette) or converted from a hull tint. */
  private owned(id: string): boolean {
    return effectiveOwned(this.unlocks).has(id);
  }

  /** What an item costs this account now: 0 while a gold or ice tint can be exchanged for a palette. */
  private priceOf(u: Unlock): number | null {
    if (u.slot === 'palette' && unclaimedLegacy(this.unlocks)) return 0;
    return unlockPrice(u, TUNE);
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
    const gap = 8;
    // Tabs: one per category.
    const tw = Math.min(124, (w - 40 - gap * (TABS.length - 1)) / TABS.length);
    const tLeft = (w - (tw * TABS.length + gap * (TABS.length - 1))) / 2;
    this.tabs = TABS.map((t, i) => {
      const x = tLeft + i * (tw + gap) + tw / 2;
      const y = 70;
      const on = i === openTab;
      panel(this.add.graphics(), x - tw / 2, y - 16, tw, 32, on ? UI.uiAccent : UI.uiBorder, on);
      text(this, x, y, t.label, tw < 100 ? 11 : 12, on ? '#ffffff' : '#9fb3d6').setOrigin(0.5);
      return { index: i, label: t.label, x, y, w: tw, h: 32 };
    });
    // The open category's items, large cards.
    const items = TABS[openTab].items;
    const cols = Math.min(4, Math.max(2, items.length));
    const cw = Math.min(250, (w - 40 - gap * (cols - 1)) / cols);
    const ch = Math.min(84, (h - 104 - 50) / 2 - gap);
    const top = 104;
    const left = (w - (cw * cols + gap * (cols - 1))) / 2;
    this.cards = [];
    items.forEach((id, n) => {
      {
        const c = n % cols;
        const r = Math.floor(n / cols);
        const u = UNLOCKS.find((x) => x.id === id);
        if (!u) return;
        const x = left + c * (cw + gap) + cw / 2;
        const y = top + r * (ch + gap) + ch / 2;
        const owned = this.owned(u.id);
        // Defaults count as equipped when nothing else is chosen in their slot.
        const equipped = u.slot !== 'qol' && (look[u.slot] === u.id || (!look[u.slot] && !!u.free));
        const armed = this.armed === u.id;
        const g = this.add.graphics();
        panel(g, x - cw / 2, y - ch / 2, cw, ch, equipped ? UI.uiAccent : armed ? UI.uiGold : owned ? UI.uiBorder : 0x2a3550, equipped || armed);
        // Swatch on the left: colour, flame colours or the badge glyph.
        const sx = x - cw / 2 + 18;
        if (u.palette) u.palette.forEach((p, i) => { g.fillStyle(p, 1); g.fillCircle(sx - 6 + (i % 2) * 12, y - 6 + Math.floor(i / 2) * 12, 5); });
        else if (u.slot === 'ship') { g.fillStyle(u.index === 1 ? 0x7fe9ff : 0x5fa8ff, 1); g.fillTriangle(sx, y - 11, sx - 8, y + 9, sx + 8, y + 9); }
        else if (u.colour !== undefined) { g.fillStyle(u.colour, 1); g.fillCircle(sx, y, 10); }
        else if (u.glyph) text(this, sx, y, u.glyph, 18, '#ffd23a').setOrigin(0.5);
        else text(this, sx, y, '≡', 18, '#dfe8ff').setOrigin(0.5);
        const price = this.priceOf(u);
        const status = equipped ? (u.slot === 'ship' ? 'FLYING' : 'EQUIPPED') : armed ? 'Tap to confirm' : owned ? (u.slot === 'qol' ? 'OWNED · tap to view' : u.slot === 'ship' ? 'OWNED · tap to fly' : 'OWNED · tap to wear') : price === 0 ? 'FREE (old tint)' : `${price} credits`;
        const small = cw < 160;
        text(this, sx + 16, y - 10, u.name, small ? 11 : 15, '#e8f0ff').setOrigin(0, 0.5);
        text(this, sx + 16, y + 11, status, small ? 10 : 12, equipped ? '#7fe9ff' : armed ? '#ffd23a' : owned ? '#9fb3d6' : '#ffd98a').setOrigin(0, 0.5);
        this.cards.push({ u, x, y, w: cw, h: ch });
      }
    });
    if (openTab === 0) {
      // The Battlecruiser is not bought here: fighters evolve into it during a run (owner design).
      const n = items.length;
      const x = left + (n % cols) * (cw + gap) + cw / 2;
      const y = top + Math.floor(n / cols) * (ch + gap) + ch / 2;
      const g = this.add.graphics();
      panel(g, x - cw / 2, y - ch / 2, cw, ch, 0x2a3550);
      const sx = x - cw / 2 + 18;
      g.fillStyle(0xffd23a, 0.8);
      g.fillRect(sx - 9, y - 8, 18, 16);
      text(this, sx + 16, y - 9, 'Battlecruiser', cw < 160 ? 10 : 12, '#e8f0ff').setOrigin(0, 0.5);
      text(this, sx + 16, y + 9, 'Evolve during a run', cw < 160 ? 9 : 10, '#8fa2c8').setOrigin(0, 0.5);
      text(this, w / 2, h - 34, 'Battlecruiser: in a run, the EVOLVE card unlocks with enough upgrades and power', 11, '#8fa2c8').setOrigin(0.5);
    }
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
        // Ship and palette always have one choice (tapping the current one keeps it); others toggle.
        if (u.slot === 'ship' || u.slot === 'palette') look[u.slot] = u.id;
        else if (look[u.slot] === u.id) delete look[u.slot];
        else look[u.slot] = u.id;
        writeSave({ look });
        this.note = look[u.slot] ? (u.slot === 'ship' ? `Flying the ${u.name} next run` : `${u.name} equipped`) : `${u.name} removed`;
      }
      this.layout();
      return;
    }
    const price = this.priceOf(u);
    if (price === null) return;
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
      const tab = this.tabs.find((b) => Math.abs(t.x - b.x) <= b.w / 2 && Math.abs(t.y - b.y) <= b.h / 2);
      if (tab) {
        openTab = tab.index;
        this.armed = null;
        this.note = '';
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
