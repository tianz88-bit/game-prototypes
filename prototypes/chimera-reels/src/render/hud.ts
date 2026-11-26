// Canvas HUD. Drawn with the 2D API onto an offscreen canvas at the device
// pixel ratio, then shown inside the WebGL canvas as a textured quad in front
// of the 3D view (no DOM UI). Also owns the tap layout, so it answers
// hit tests for the pointer device.
import * as THREE from 'three';
import { tune } from '../tune';
import {
  executePreview,
  pocketBuffs,
  pocketGroups,
  reelWindow,
  type Combat,
  type CombatEvent,
  type Fighter,
  type Side,
} from '../sim/combat';
import { isMove, MOVES, tileLabel, type TileId } from '../sim/content';
import type { Intent } from '../input/intents';
import { HEIGHT, WIDTH, type ViewSize } from './view';
import { VERSION_STAMP } from '../version.generated';

interface Rect { x: number; y: number; w: number; h: number }
interface Popup { text: string; x: number; y: number; age: number; color: string; size: number }

const inside = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Layout, logical pixels (390 x 844 portrait).
const L = {
  enemy: {
    hpY: 30, cdY: 46,
    reelX: [16, 72], reelY: 58, tileW: 52, tileH: 30, gap: 2,
    pocketX: 140, pocketY: 76, slot: 36, slotGap: 3,
  },
  player: {
    panelY: 474, hpY: 494, cdY: 512,
    reelX: [16, 112], reelY: 544, tileW: 92, tileH: 50, gap: 4,
    pocketX: 222, pocketY: 560, slotW: 72, slotH: 44, slotGap: 8,
  },
  execute: { x: 16, y: 722, w: 174, h: 104 },
  pocket: { x: 200, y: 722, w: 174, h: 104 },
};

const COLORS: Record<string, string> = {
  attack: '#d4554b', defend: '#4b7fd4', brains: '#9a5ccc',
  power: '#e08e35', quick: '#3caf7c', blank: '#3a3549', jam: '#1d1a24',
};

function tileColor(id: TileId, jammed = false): string {
  if (jammed) return COLORS.jam;
  return isMove(id) ? COLORS[MOVES[id].kind] : COLORS[id];
}

export class Hud {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private texture = new THREE.CanvasTexture(this.canvas);
  private popups: Popup[] = [];
  private pxPerLogical = 1;
  private headPos: (side: Side) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private missedFlash = 0;

  constructor() {
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false }),
    );
    quad.position.set(0.5, 0.5, 0);
    this.scene.add(quad);
  }

  setHeadLocator(fn: (side: Side) => { x: number; y: number }) {
    this.headPos = fn;
  }

  resize(v: ViewSize) {
    this.pxPerLogical = v.scale * v.pixelRatio;
    this.canvas.width = Math.round(WIDTH * this.pxPerLogical);
    this.canvas.height = Math.round(HEIGHT * this.pxPerLogical);
    this.texture.dispose();
    this.texture.needsUpdate = true;
  }

  clearPopups() {
    this.popups = [];
  }

  onEvent(e: CombatEvent) {
    const pop = (side: Side, text: string, color: string, size = 18, dy = 0) => {
      const p = this.headPos(side);
      this.popups.push({ text, x: p.x, y: p.y + dy, age: 0, color, size });
    };
    switch (e.type) {
      case 'action': {
        const name = MOVES[e.move].label.toUpperCase();
        const text = e.burn ? `BURN ${name} x${e.tier}` : e.isSuper ? `SUPER ${name}!` : e.tier ? `${name} ${'+'.repeat(e.tier)}` : name;
        pop(e.side, text, e.isSuper ? '#ffd84a' : '#ffffff', e.isSuper ? 24 : 16, -22);
        break;
      }
      case 'hit':
        if (e.chip && e.amount <= 1) break;
        pop(e.side, `${e.amount}${e.blocked ? ' BLOCKED' : ''}${e.interrupted ? ' INTERRUPT!' : ''}`, e.blocked ? '#9fb6dd' : e.amount >= 25 ? '#ffd84a' : '#ffffff', e.amount >= 25 ? 26 : 20, 8);
        break;
      case 'heal':
        pop(e.side, `+${e.amount}`, '#7be3a4', 16, 30);
        break;
      case 'drop':
        pop(e.side, `DROPPED ${e.count}`, '#f08fd0', 16, 50);
        break;
      case 'jam':
        pop(e.side, `JAMMED ${e.count}`, '#c9a3ff', 16, 50);
        break;
      case 'pocket':
        pop(e.side, `POCKET +${e.stored}`, '#ffe08a', 16, -22);
        break;
      case 'lost':
        pop(e.side, 'MISSED SPIN', '#ff8a7a', 16, -22);
        if (e.side === 'player') this.missedFlash = 0.8;
        break;
      default:
        break;
    }
  }

  update(dt: number) {
    for (const p of this.popups) p.age += dt;
    this.popups = this.popups.filter((p) => p.age < tune.feel.popupSec);
    this.missedFlash = Math.max(0, this.missedFlash - dt);
  }

  // ------------------------------------------------------------ input

  hitTest(x: number, y: number, c: Combat): Intent | null {
    if (inside(L.execute, x, y)) return { type: 'primary' };
    if (c.winner) return null;
    if (inside(L.pocket, x, y)) return { type: 'secondary' };
    const slot = this.playerPocketSlotAt(x, y);
    if (slot >= 0) {
      const f = c.fighters.player;
      const id = f.pocket[slot];
      if (id === undefined) return null;
      const group = pocketGroups(f).findIndex((g) => g.id === id);
      return { type: 'burn', group };
    }
    return null;
  }

  private playerPocketSlotAt(x: number, y: number): number {
    for (let i = 0; i < 6; i++) {
      if (inside(this.playerSlotRect(i), x, y)) return i;
    }
    return -1;
  }

  private playerSlotRect(i: number): Rect {
    const P = L.player;
    const col = i % 2;
    const row = Math.floor(i / 2);
    return { x: P.pocketX + col * (P.slotW + P.slotGap), y: P.pocketY + row * (P.slotH + P.slotGap), w: P.slotW, h: P.slotH };
  }

  // ------------------------------------------------------------ drawing

  draw(c: Combat) {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.pxPerLogical, 0, 0, this.pxPerLogical, 0, 0);
    g.textBaseline = 'middle';

    // Panels top and bottom; the middle band shows the 3D arena.
    g.fillStyle = 'rgba(14,11,22,0.86)';
    g.fillRect(0, 0, WIDTH, 186);
    g.fillRect(0, L.player.panelY, WIDTH, HEIGHT - L.player.panelY);

    this.drawEnemy(c.fighters.enemy);
    this.drawPlayer(c, c.fighters.player);
    this.drawPopups();
    if (c.winner) this.drawResult(c.winner);

    g.font = '9px monospace';
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillText(VERSION_STAMP, 4, 8);

    this.texture.needsUpdate = true;
  }

  private text(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = '600') {
    const g = this.ctx;
    g.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    g.textAlign = align;
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  private roundRect(r: Rect, radius: number, fill: string, stroke?: string, lw = 2) {
    const g = this.ctx;
    g.beginPath();
    g.roundRect(r.x, r.y, r.w, r.h, radius);
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.lineWidth = lw;
      g.strokeStyle = stroke;
      g.stroke();
    }
  }

  private bars(f: Fighter, y: number, cdY: number) {
    const hpFrac = f.hp / f.maxHp;
    this.text(f.name, 16, y - 10, 13, '#f4efe6', 'left', '700');
    this.text(`${f.hp}/${f.maxHp}`, 374, y - 10, 12, '#cfc7d9', 'right');
    this.roundRect({ x: 16, y, w: 358, h: 10 }, 5, '#2d2738');
    if (hpFrac > 0) this.roundRect({ x: 16, y, w: 358 * hpFrac, h: 10 }, 5, hpFrac > 0.35 ? '#5fd08b' : '#e2574c');
    // Cooldown to next spin. Dimmed while a result is waiting (slowed).
    const frac = f.spinLeft > 0 ? 1 : 1 - Math.max(0, f.cooldown) / tune.timing.baseCooldownSec;
    this.roundRect({ x: 16, y: cdY, w: 358, h: 5 }, 2.5, '#231e2d');
    this.roundRect({ x: 16, y: cdY, w: Math.max(4, 358 * Math.min(1, frac)), h: 5 }, 2.5, f.landed ? '#8a7a4a' : '#e8c15a');
    if (f.stance !== 'none') {
      const label = f.stance === 'defend' ? 'GUARDING' : 'SCHEMING';
      this.text(label, 195, y - 10, 11, f.stance === 'defend' ? '#8fb3ff' : '#d1a6ff', 'center', '800');
    }
  }

  private drawTile(r: Rect, id: TileId, opts: { jammed?: boolean; dim?: boolean; size: number }) {
    this.roundRect(r, 6, tileColor(id, opts.jammed));
    const label = opts.jammed ? 'JAM' : tileLabel(id);
    this.text(label, r.x + r.w / 2, r.y + r.h / 2 + 1, opts.size, opts.dim ? 'rgba(255,255,255,0.55)' : '#ffffff', 'center', '700');
  }

  /** Draws the 2x3 reel window, scrolling while a reel is still spinning. */
  private drawReels(f: Fighter, xs: number[], y0: number, w: number, h: number, gap: number, font: number) {
    const g = this.ctx;
    const total = tune.timing.spinSec + tune.timing.reelStaggerSec;
    const elapsed = total - f.spinLeft;
    for (const reel of [0, 1] as const) {
      const x = xs[reel];
      const spinning = f.spinLeft > 0 && elapsed < tune.timing.spinSec + (reel === 1 ? tune.timing.reelStaggerSec : 0);
      g.save();
      g.beginPath();
      g.rect(x - 2, y0 - 2, w + 4, h * 3 + gap * 2 + 4);
      g.clip();
      if (spinning) {
        const strip = f.strips[reel];
        const scroll = elapsed * 14;
        const base = Math.floor(scroll);
        const frac = scroll - base;
        for (let row = -1; row < 3; row++) {
          const t = strip[(((f.reelPos[reel] + base + row) % strip.length) + strip.length) % strip.length];
          this.drawTile({ x, y: y0 + (row + frac) * (h + gap), w, h }, t.id, { jammed: !!t.jam, dim: true, size: font });
        }
      } else {
        reelWindow(f, reel).forEach((t, row) => {
          this.drawTile({ x, y: y0 + row * (h + gap), w, h }, t.id, { jammed: !!t.jam, dim: row !== 1, size: font });
        });
      }
      g.restore();
    }
    // The line.
    const lineY = y0 + h + gap;
    g.lineWidth = 2.5;
    g.strokeStyle = f.landed ? '#ffe08a' : 'rgba(255,224,138,0.45)';
    g.beginPath();
    g.roundRect(xs[0] - 5, lineY - 4, xs[1] + w - xs[0] + 10, h + 8, 8);
    g.stroke();
  }

  private drawEnemy(f: Fighter) {
    const E = L.enemy;
    this.bars(f, E.hpY, E.cdY);
    this.drawReels(f, E.reelX, E.reelY, E.tileW, E.tileH, E.gap, 11);
    this.text(`Pocket ${f.pocket.length}/${f.pocketSize}`, E.pocketX, E.pocketY - 10, 11, '#cfc7d9');
    for (let i = 0; i < f.pocketSize; i++) {
      const r = { x: E.pocketX + i * (E.slot + E.slotGap), y: E.pocketY, w: E.slot, h: E.slot };
      const id = f.pocket[i];
      if (id) this.drawTile(r, id, { size: 9 });
      else this.roundRect(r, 6, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)', 1);
    }
    this.buffLine(f, E.pocketX, E.pocketY + E.slot + 14);
    if (f.landed) this.text('deciding...', E.pocketX, E.pocketY + E.slot + 32, 11, '#e8c15a');
  }

  private buffLine(f: Fighter, x: number, y: number) {
    const b = pocketBuffs(f);
    const parts: string[] = [];
    if (b.attack) parts.push(`ATK +${Math.round(b.attack * 100)}%`);
    if (b.defend) parts.push(`DEF +${Math.round(b.defend * 100)}%`);
    if (b.speed) parts.push(`SPD +${Math.round(b.speed * 100)}%`);
    if (parts.length) this.text(parts.join('  '), x, y, 11, '#ffe08a');
  }

  private drawPlayer(c: Combat, f: Fighter) {
    const P = L.player;
    this.bars(f, P.hpY, P.cdY);
    this.drawReels(f, P.reelX, P.reelY, P.tileW, P.tileH, P.gap, 15);

    // Pocket: tap a tile to burn its whole group (only while deciding).
    const groups = pocketGroups(f);
    this.text(`Pocket ${f.pocket.length}/${f.pocketSize}`, P.pocketX, P.pocketY - 12, 12, '#cfc7d9');
    if (f.landed && f.pocket.length) this.text('tap to burn', 374, P.pocketY - 12, 11, '#e8c15a', 'right');
    const preview = f.landed ? executePreview(f) : null;
    for (let i = 0; i < Math.max(6, f.pocketSize); i++) {
      const r = this.playerSlotRect(i);
      const id = f.pocket[i];
      if (!id) {
        if (i < f.pocketSize) this.roundRect(r, 8, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.14)', 1);
        continue;
      }
      this.drawTile(r, id, { size: 13 });
      const n = groups.find((gr) => gr.id === id)?.count ?? 1;
      if (n > 1) this.text(`x${n}`, r.x + r.w - 5, r.y + 9, 10, '#ffffff', 'right', '800');
      // Highlight tiles the current line would consume.
      if (preview && (id === preview.move || id === preview.mut)) {
        this.roundRect({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, 9, 'rgba(0,0,0,0)', '#ffe08a', 2);
      }
    }
    this.buffLine(f, 16, P.cdY + 18);
    if (this.missedFlash > 0) this.text('Too slow, spin lost', 374, P.cdY + 18, 11, '#ff8a7a', 'right');

    this.drawButtons(c, f);
  }

  private drawButtons(c: Combat, f: Fighter) {
    if (c.winner) {
      const r = { x: 16, y: L.execute.y, w: 358, h: L.execute.h };
      this.roundRect(r, 14, '#e8c15a');
      this.text('FIGHT AGAIN', 195, r.y + r.h / 2, 22, '#1a1424', 'center', '800');
      return;
    }
    const live = f.landed;
    const ex = L.execute;
    const po = L.pocket;
    this.roundRect(ex, 14, live ? '#d4554b' : '#3a2f3f');
    this.roundRect(po, 14, live ? '#e0a83a' : '#3a3530');
    this.text('EXECUTE', ex.x + ex.w / 2, ex.y + 34, 20, live ? '#fff' : 'rgba(255,255,255,0.4)', 'center', '800');
    this.text('POCKET', po.x + po.w / 2, po.y + 34, 20, live ? '#1a1424' : 'rgba(255,255,255,0.4)', 'center', '800');
    if (!live) {
      const sub = f.spinLeft > 0 ? 'spinning' : 'charging';
      this.text(sub, ex.x + ex.w / 2, ex.y + 66, 13, 'rgba(255,255,255,0.4)', 'center');
      this.text(sub, po.x + po.w / 2, po.y + 66, 13, 'rgba(255,255,255,0.4)', 'center');
      return;
    }
    const p = executePreview(f);
    const name = tileLabel(p.move);
    const head = p.tier >= 3 ? `SUPER ${name}` : `${name}${'+'.repeat(p.tier)}`;
    const mutText = p.mut === 'blank' ? '' : `${tileLabel(p.mut)}${p.mutMatches ? ` x${p.mutMatches + 1}` : ''}`;
    this.text(head, ex.x + ex.w / 2, ex.y + 64, p.tier >= 3 ? 17 : 15, p.tier >= 3 ? '#ffe24a' : '#fff', 'center', '800');
    if (mutText) this.text(mutText, ex.x + ex.w / 2, ex.y + 84, 12, 'rgba(255,255,255,0.85)', 'center');
    const visible = [0, 1].flatMap((reel) => reelWindow(f, reel as 0 | 1)).filter((t) => t.id !== 'blank').length;
    const free = f.pocketSize - f.pocket.length;
    const store = Math.min(free, visible);
    this.text(`store ${store}`, po.x + po.w / 2, po.y + 64, 15, '#1a1424', 'center', '700');
    if (visible > store) this.text(`lose ${visible - store}`, po.x + po.w / 2, po.y + 84, 12, 'rgba(26,20,36,0.75)', 'center');
  }

  private drawPopups() {
    const g = this.ctx;
    for (const p of this.popups) {
      const t = p.age / tune.feel.popupSec;
      g.globalAlpha = 1 - t * t;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.font = `800 ${p.size}px system-ui, -apple-system, Segoe UI, sans-serif`;
      g.textAlign = 'center';
      const y = p.y - t * 34;
      g.strokeText(p.text, p.x, y);
      g.fillStyle = p.color;
      g.fillText(p.text, p.x, y);
    }
    g.globalAlpha = 1;
  }

  private drawResult(winner: Side) {
    const y = 330;
    this.roundRect({ x: 60, y: y - 40, w: 270, h: 80 }, 16, 'rgba(14,11,22,0.9)', winner === 'player' ? '#ffe08a' : '#e2574c', 2);
    this.text(winner === 'player' ? 'VICTORY' : 'DEFEAT', 195, y, 34, winner === 'player' ? '#ffe08a' : '#ff8a7a', 'center', '900');
  }
}
