// Main menu: enter a pilot name, then pick a planet to drop into. The hangar (stash and loadout)
// comes in a later milestone. The name is shown under your ship and on the leaderboard.
import Phaser from 'phaser';
import { PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import { SHARE_URL, logicalSize, serverOrigin } from '../base';
import QRCode from 'qrcode';
import { intents } from '../input/intents';
import { fitCamera, text, versionStamp } from './common';
import { cleanName } from '../../sim/protocol';
import { loadSave, writeSave } from '../save';
import { clientTune } from '../clientTune';
import { UI, css, panel } from '../render/ui';
import { ensureAccount, recoverAccount } from '../net/account';

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
      intents.copyZone = null;
    });
    nameField().onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      if (this.codeMode) void this.submitCode();
      nameField().blur();
    };
    intents.drainTaps();
    void this.refreshAccount();
  }

  /** Bank balance (null until known, or when the bank is unreachable) and the account panel state. */
  credits: number | null = null;
  private codeMode = false;
  private accountNote = '';
  private async refreshAccount(): Promise<void> {
    this.credits = await ensureAccount();
    if (this.scene.isActive()) this.layout();
  }

  /** Restore: the name box takes a recovery code instead; Enter (or RESTORE again) submits. */
  private async submitCode(): Promise<void> {
    const code = nameField().value;
    this.accountNote = 'Checking code…';
    this.layout();
    const r = await recoverAccount(code);
    if ('error' in r) this.accountNote = r.error;
    else {
      this.credits = r.balance;
      this.accountNote = 'Account restored';
      this.codeMode = false;
      nameField().value = loadSave().name ?? '';
    }
    if (this.scene.isActive()) this.layout();
  }

  accountButton: { x: number; y: number; w: number; h: number } | null = null;
  /** Account panel, left of the menu (mirrors the QR panel): credits, recovery code, restore. */
  private drawAccount(w: number, h: number, bw: number): void {
    const side = (w - bw) / 2;
    this.accountButton = null;
    const recovery = loadSave().account?.recovery ?? '';
    const credits = this.credits === null ? '…' : String(this.credits);
    if (side < 150) {
      // Narrow screens: one line under the title.
      text(this, w / 2, h - 14, `CREDITS ${credits}${recovery ? `  ·  code ${recovery}` : ''}`, 11, '#ffd23a').setOrigin(0.5);
      return;
    }
    const pw = Math.min(200, side - 32);
    const x = side / 2;
    const top = h * 0.5 - 90;
    panel(this.add.graphics(), x - pw / 2, top, pw, 176, UI.uiGold);
    text(this, x, top + 16, 'CREDITS', 11, '#8fa2c8').setOrigin(0.5);
    text(this, x, top + 40, credits, 24, '#ffd23a').setOrigin(0.5);
    text(this, x, top + 70, 'RECOVERY CODE', 10, '#8fa2c8').setOrigin(0.5);
    text(this, x, top + 88, recovery || '-', 13, '#dfe8ff').setOrigin(0.5);
    text(this, x, top + 104, 'Write it down to keep your credits', 9, '#6d7a96').setOrigin(0.5);
    const by = top + 140;
    const bwid = pw - 32;
    panel(this.add.graphics(), x - bwid / 2, by - 16, bwid, 32, this.codeMode ? UI.uiDanger : UI.uiBorder, this.codeMode);
    text(this, x, by, this.codeMode ? 'CANCEL' : 'RESTORE ACCOUNT', 12).setOrigin(0.5);
    this.accountButton = { x, y: by, w: bwid, h: 32 };
    if (this.accountNote) text(this, x, top + 186, this.accountNote, 11, '#ffd98a').setOrigin(0.5);
  }

  private layout(): void {
    this.children.removeAll(true);
    this.countText.clear();
    fitCamera(this);
    const { w, h } = logicalSize();
    this.add.rectangle(w / 2, h / 2, w, h, 0x07101c);
    const backdrop=this.add.graphics();
    backdrop.lineStyle(1,UI.uiBorder,.16);
    for(let i=0;i<12;i++)backdrop.lineBetween(i*w/8-h*.3,0,i*w/8+h*.3,h);
    backdrop.lineStyle(1,UI.uiAccent,.18);backdrop.strokeCircle(w*.13,h*.7,h*.32);backdrop.strokeCircle(w*.13,h*.7,h*.27);
    backdrop.lineStyle(3,UI.uiGold,.75);backdrop.lineBetween(w/2-40,h*.11-20,w/2+40,h*.11-20);
    const title = Math.min(40, w / 10, h / 9);
    text(this, w / 2, h * 0.11, 'STEROIDS-ALPHA', title, css(UI.uiText)).setOrigin(0.5);

    // Pilot name.
    const bw = Math.min(320, w - 48);
    const ny = h * 0.11 + title * 0.6 + 34;
    text(this, w / 2 - bw / 2, ny - 30, this.codeMode ? 'RECOVERY CODE (press Enter)' : 'PILOT NAME', 11, this.codeMode ? '#ffd98a' : '#8fa2c8');
    this.nameBox = { x: w / 2, y: ny, w: bw, h: 36 };
    intents.textBox = { zone: { x: w / 2, y: ny, hw: bw / 2, hh: 18 }, field: nameField() };
    panel(this.add.graphics(),w/2-bw/2,ny-18,bw,36,UI.uiBorder);
    this.nameFrame = this.add.rectangle(w / 2, ny, bw, 36, UI.uiPanel,0).setStrokeStyle(1, UI.uiBorder);
    this.nameText = text(this, w / 2 - bw / 2 + 12, ny, '', 16).setOrigin(0, 0.5);
    const f = nameField();
    // Opening the keyboard resizes the page and re-runs this layout; keep what is being typed.
    if (document.activeElement !== f && !this.codeMode) f.value = loadSave().name ?? '';
    f.setAttribute('aria-label', this.codeMode ? 'Recovery code' : 'Pilot name');
    const r = this.game.canvas.getBoundingClientRect();
    Object.assign(f.style, { display: 'block', left: `${r.left + w / 2 - bw / 2}px`, top: `${r.top + ny - 18}px`, width: `${bw}px`, height: '36px' });

    text(this, w / 2, ny + 34, 'Choose a planet to drop into', 14, '#8fa2c8').setOrigin(0.5);
    const bh = Math.min(64, Math.max(44, (h - (ny + 60) - 24) / 2 - 12));
    this.buttons = PLANETS.map((p, i) => {
      const x = w / 2;
      const y = ny + 60 + bh / 2 + i * (bh + 12);
      const card=this.add.graphics();panel(card,x-bw/2,y-bh/2,bw,bh,UI.uiAccent,true);
      card.fillStyle(p.colour,.8);card.fillRoundedRect(x-bw/2+5,y-bh/2+5,5,bh-10,2);
      text(this, x, y - (bh > 52 ? 8 : 6), p.label, 22).setOrigin(0.5);
      this.countText.set(p.id, text(this, x, y + (bh > 52 ? 16 : 12), '', 12, '#c9d6f2').setOrigin(0.5));
      return { id: p.id, x, y, w: bw, h: bh };
    });
    this.drawShare(w, h, bw);
    this.drawAccount(w, h, bw);
    versionStamp(this);
    this.showCounts();
  }

  /** Share: a QR code of the game's page beside the menu; tapping it copies the link. */
  shareBox: { x: number; y: number; size: number } | null = null;
  private shareHint!: Phaser.GameObjects.Text;
  private shareHintUntil = 0;
  private drawShare(w: number, h: number, bw: number): void {
    const side = (w - bw) / 2;
    const size = Math.floor(Math.min(150, side - 40, h * 0.42));
    intents.copyZone = null;
    this.shareBox = null;
    if (size < 72) return; // no room beside the menu (very narrow screens)
    const x = w / 2 + bw / 2 + side / 2;
    const y = h * 0.5 - 14;
    // The repo's shared QR library (also used by Punchies, mp-console and suits-mp).
    const qr = QRCode.create(SHARE_URL, { errorCorrectionLevel: 'M' });
    const cells = qr.modules.size;
    const n = cells + 8; // 4-module quiet zone each side
    const cell = size / n;
    const g = this.add.graphics();
    panel(g,x-size/2-8,y-size/2-8,size+16,size+16,UI.uiBorder);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x - size / 2, y - size / 2, size, size, 6);
    g.fillStyle(0x05070d, 1);
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        if (qr.modules.get(r, c)) g.fillRect(x - size / 2 + (c + 4) * cell, y - size / 2 + (r + 4) * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }

    text(this, x, y + size / 2 + 8, 'Scan to join', 12, '#dfe8ff').setOrigin(0.5, 0);
    this.shareHint = text(this, x, y + size / 2 + 26, 'Tap to copy link', 11, '#8fa2c8').setOrigin(0.5, 0);
    this.shareBox = { x, y, size };
    intents.copyZone = { zone: { x, y, hw: size / 2, hh: size / 2 }, text: SHARE_URL };
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
    const copied = intents.consume('copied');
    const failed = intents.consume('copyFailed');
    if (this.shareHint?.active && (copied || failed)) {
      this.shareHint.setText(copied ? 'Link copied!' : SHARE_URL.replace('https://', '')).setColor(copied ? '#7dff9a' : '#ffd98a');
      this.shareHintUntil = time + (copied ? 1800 : 6000);
    }
    if (this.shareHint?.active && this.shareHintUntil && time > this.shareHintUntil) {
      this.shareHint.setText('Tap to copy link').setColor('#8fa2c8');
      this.shareHintUntil = 0;
    }
    if (time - this.countsAt > clientTune.net.planetCountRefreshMs) {
      this.countsAt = time;
      void this.pollCounts();
    }
    const input = nameField();
    const editing = document.activeElement === input;
    const caret = editing && Math.floor(time / 500) % 2 === 0 ? '|' : '';
    if (this.codeMode) {
      const code = input.value.toUpperCase();
      this.nameText.setText(code || editing ? code + caret : 'Tap to type your code').setColor(code || editing ? '#ffd98a' : '#6d7a96');
    }
    const name = this.codeMode ? loadSave().name ?? '' : cleanName(input.value);
    if (!this.codeMode) this.nameText.setText(name || editing ? name + caret : 'Tap to enter a name').setColor(name || editing ? '#e8f0ff' : '#6d7a96');
    this.nameFrame.setStrokeStyle(1, editing ? UI.uiAccent : UI.uiBorder);
    for (const t of intents.drainTaps()) {
      const n = this.nameBox;
      // Taps on the name box belong to the text field over it.
      if (Math.abs(t.x - n.x) <= n.w / 2 && Math.abs(t.y - n.y) <= n.h / 2) continue;
      const ab = this.accountButton;
      if (ab && Math.abs(t.x - ab.x) <= ab.w / 2 && Math.abs(t.y - ab.y) <= ab.h / 2) {
        // RESTORE: the name box takes a recovery code; CANCEL goes back to the name.
        this.codeMode = !this.codeMode;
        this.accountNote = this.codeMode ? 'Type the code in the box, then Enter' : '';
        input.value = this.codeMode ? '' : loadSave().name ?? '';
        this.layout();
        return;
      }
      const b = this.buttons.find((b) => Math.abs(t.x - b.x) <= b.w / 2 && Math.abs(t.y - b.y) <= b.h / 2);
      if (b) {
        writeSave({ name });
        this.scene.start('flight', { planet: b.id });
        return;
      }
    }
    if (!this.codeMode && !editing && (loadSave().name ?? '') !== name) writeSave({ name });
  }
}
