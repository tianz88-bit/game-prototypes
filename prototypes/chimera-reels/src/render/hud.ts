// Canvas HUD. Drawn with the 2D API onto an offscreen canvas at the device
// pixel ratio, then shown inside the WebGL canvas as a textured quad in front
// of the 3D view (no DOM UI). Owns the tap layout and answers hit tests for
// the pointer device. All the slot juice lives here: blurred spins, landing
// overshoot, super teases, tiles flying between reels and pocket, sparks.
import * as THREE from 'three';
import { tune } from '../tune';
import {
  executePreview,
  fragility,
  isFlying,
  pocketBuffs,
  pocketGroups,
  reelLandTime,
  reelWindow,
  weakspot,
  type Combat,
  type CombatEvent,
  type Fighter,
  type Side,
} from '../sim/combat';
import { isMove, MOVES, PARTS, STARTERS, tileLabel, tileShort, type PartId, type TileId } from '../sim/content';
import { entryBet, partNames, type Run } from '../sim/run';
import type { Intent } from '../input/intents';
import { HEIGHT, WIDTH, type ViewSize } from './view';
import { VERSION_STAMP } from '../version.generated';
import { sfx } from '../audio/sfx';

interface Rect { x: number; y: number; w: number; h: number }
interface Popup { text: string; x: number; y: number; age: number; color: string; size: number; life: number }
interface Fly { id: TileId; x0: number; y0: number; x1: number; y1: number; age: number; dur: number; drop: boolean; w: number; h: number; arc: number }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; size: number }

const inside = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const FONT = 'system-ui, -apple-system, Segoe UI, sans-serif';

// Layout, logical pixels (390 x 844 portrait).
const L = {
  enemy: { hpY: 30, cdY: 46, reelX: [16, 72], reelY: 60, tileW: 52, tileH: 30, gap: 2, pocketX: 140, pocketY: 78, slot: 24, slotGap: 2 },
  player: { panelY: 474, hpY: 494, cdY: 512, reelX: [16, 112], reelY: 548, tileW: 92, tileH: 50, gap: 4, pocketX: 222, pocketY: 560, slotW: 48, slotH: 44, slotGapX: 4, slotGapY: 6 },
  execute: { x: 16, y: 726, w: 174, h: 100 },
  pocket: { x: 200, y: 726, w: 174, h: 100 },
  yield: { x: 318, y: 520, w: 56, h: 22 },
  wide: { x: 16, y: 726, w: 358, h: 100 },
};

const COLORS: Record<string, string> = {
  attack: '#d4554b', defend: '#4b7fd4', brains: '#9a5ccc',
  power: '#e08e35', quick: '#3caf7c', high: '#3fa9c9', low: '#8a6d3b', blank: '#3a3549', jam: '#1d1a24', broken: '#241f2b',
};

function tileColor(id: TileId): string {
  return isMove(id) ? COLORS[MOVES[id].kind] : COLORS[id];
}

function describe(id: TileId): string {
  const t = tune;
  switch (id) {
    case 'claw': case 'bite': case 'slam': case 'breath':
      return `Attack, ${MOVES[id].dmg}, power ${(t.moves[id] as { power: number }).power}`;
    case 'guard': return 'Defend: block attacks, heal a little';
    case 'snatch': return 'Brains: enemy drops pocket tiles';
    case 'jam': return 'Brains: blank out enemy tiles';
    case 'power': return `Mutator: x${t.mutators.power.mult} power`;
    case 'quick': return 'Mutator: next spin comes sooner';
    case 'high': return 'Mutator: high attack, strong vs flyers';
    case 'low': return 'Mutator: low attack, misses flyers';
    default: return '';
  }
}

const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

export class Hud {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  private canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private texture = new THREE.CanvasTexture(this.canvas);
  private pxPerLogical = 1;
  private headPos: (side: Side) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private time = 0;
  private popups: Popup[] = [];
  private flies: Fly[] = [];
  private sparks: Spark[] = [];
  /** Pocket slots hidden until a flying tile arrives: side -> slot -> time left. */
  private hidden: Record<Side, Map<number, number>> = { player: new Map(), enemy: new Map() };
  /** Seconds since each reel landed (for overshoot and pop), per side. */
  private landAge: Record<Side, [number, number]> = { player: [9, 9], enemy: [9, 9] };
  private lastTickRow: Record<Side, [number, number]> = { player: [0, 0], enemy: [0, 0] };
  private missedFlash = 0;
  private superFlash = 0;
  private superStamp = 0;
  private shake = 0;
  private press: Record<string, number> = {};
  private yieldArmed = 0;
  /** Starter shown on the select screen. */
  selectIndex = 0;

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

  resetFight() {
    this.popups = [];
    this.flies = [];
    this.sparks = [];
    this.hidden.player.clear();
    this.hidden.enemy.clear();
    this.landAge = { player: [9, 9], enemy: [9, 9] };
    this.superFlash = this.superStamp = 0;
    this.yieldArmed = 0;
  }

  pressed(button: string) {
    this.press[button] = 0.15;
  }

  // ------------------------------------------------------------ geometry

  private reelRect(side: Side, reel: number, row: number): Rect {
    const P = side === 'player' ? L.player : L.enemy;
    return { x: P.reelX[reel], y: P.reelY + row * (P.tileH + P.gap), w: P.tileW, h: P.tileH };
  }

  private slotRect(side: Side, i: number): Rect {
    if (side === 'enemy') {
      const E = L.enemy;
      return { x: E.pocketX + i * (E.slot + E.slotGap), y: E.pocketY, w: E.slot, h: E.slot };
    }
    const P = L.player;
    const col = i % 3;
    const row = Math.floor(i / 3);
    return { x: P.pocketX + col * (P.slotW + P.slotGapX), y: P.pocketY + row * (P.slotH + P.slotGapY), w: P.slotW, h: P.slotH };
  }

  private lootRect(i: number): Rect {
    return { ...this.choiceRect(i, 2), y: 500, h: 215 };
  }

  private choiceRect(i: number, n: number): Rect {
    const w = (358 - (n - 1) * 8) / n;
    return { x: 16 + i * (w + 8), y: 540, w, h: 170 };
  }

  // ------------------------------------------------------------ input

  hitTest(x: number, y: number, run: Run): Intent | null {
    switch (run.screen) {
      case 'select':
        for (let i = 0; i < STARTERS.length; i++) if (inside(this.choiceRect(i, STARTERS.length), x, y)) return { type: 'choose', index: i };
        return inside(L.wide, x, y) ? { type: 'primary' } : null;
      case 'loot':
        for (let i = 0; i < 2; i++) if (inside(this.lootRect(i), x, y)) return { type: 'choose', index: i };
        return null;
      case 'levelup':
        for (let i = 0; i < run.offers.length; i++) if (inside(this.choiceRect(i, run.offers.length), x, y)) return { type: 'choose', index: i };
        return null;
      case 'prefight':
      case 'result':
      case 'gameover':
        return inside(L.wide, x, y) ? { type: 'primary' } : null;
      case 'fight': {
        const c = run.combat;
        if (!c || c.winner) return null;
        if (inside(L.execute, x, y)) return { type: 'primary' };
        if (inside(L.pocket, x, y)) return { type: 'secondary' };
        if (inside(L.yield, x, y)) return { type: 'yield' };
        const f = c.fighters.player;
        for (let i = 0; i < f.pocket.length; i++) {
          if (inside(this.slotRect('player', i), x, y)) {
            const group = pocketGroups(f).findIndex((gr) => gr.id === f.pocket[i].id);
            return { type: 'burn', group };
          }
        }
        return null;
      }
    }
  }

  /** First tap arms yield, a second tap within 2 seconds confirms. */
  armYield(): boolean {
    if (this.yieldArmed > 0) {
      this.yieldArmed = 0;
      return true;
    }
    this.yieldArmed = 2;
    sfx.ui();
    return false;
  }

  // ------------------------------------------------------------ events

  private pop(side: Side, text: string, color: string, size = 18, dy = 0, life = tune.feel.popupSec) {
    const p = this.headPos(side);
    this.popups.push({ text, x: Math.max(60, Math.min(WIDTH - 60, p.x)), y: Math.max(200, p.y + dy), age: 0, color, size, life });
  }

  private sparkBurst(x: number, y: number, n: number, colors: string[], speed = 160, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, age: 0, life: 0.4 + Math.random() * 0.4, color: colors[i % colors.length], size: size * (0.6 + Math.random() * 0.8) });
    }
  }

  onEvent(e: CombatEvent, c: Combat) {
    const f = tune.feel;
    switch (e.type) {
      case 'spin':
        this.landAge[e.side] = [9, 9];
        if (e.side === 'player' && e.tease) sfx.tease();
        break;
      case 'reelLand':
      case 'land': {
        const reels: (0 | 1)[] = e.type === 'land' ? [0, 1] : [e.reel];
        for (const r of reels) {
          if (this.landAge[e.side][r] < 9) continue;
          this.landAge[e.side][r] = 0;
          if (e.side === 'player') sfx.reelStop(r);
          const lr = this.reelRect(e.side, r, 1);
          this.sparkBurst(lr.x + lr.w / 2, lr.y + lr.h, e.side === 'player' ? 6 : 3, ['#ffe08a', '#ffffff'], 90, 2);
        }
        if (e.type === 'land' && e.side === 'player') {
          const p = executePreview(c.fighters.player);
          if (p.tier) sfx.match(p.tier);
          else sfx.land();
          if (p.tier >= 3) {
            this.superStamp = 1.2;
            const lr = this.reelRect('player', 0, 1);
            this.sparkBurst(lr.x + lr.w, lr.y + lr.h / 2, 30, ['#ffe24a', '#ff8a3a', '#ffffff'], 260, 4);
          }
        }
        break;
      }
      case 'action': {
        const name = MOVES[e.move].label.toUpperCase();
        const text = e.burn ? `BURN ${name} x${e.tier}` : e.isSuper ? `SUPER ${name}!` : e.tier ? `${name} ${'+'.repeat(e.tier)}` : name;
        const dirTag = !e.burn && e.dir !== 'front' ? ` ${e.dir.toUpperCase()}` : '';
        this.pop(e.side, text + dirTag, e.isSuper ? '#ffd84a' : '#ffffff', e.isSuper ? 26 : 17, -26);
        if (e.isSuper) {
          this.superFlash = 0.35;
          this.shake = 0.4;
          sfx.super();
        } else if (!e.burn) sfx.execute();
        // Consumed pocket tiles fly into the line.
        const fl = c.fighters[e.side];
        const line = center(this.reelRect(e.side, 0, 1));
        e.consumed.forEach((id, k) => {
          const from = center(this.slotRect(e.side, fl.pocket.length + k));
          this.flies.push({ id, x0: from.x, y0: from.y, x1: line.x, y1: line.y, age: -k * 0.05, dur: f.tileFlySec, drop: false, w: e.side === 'player' ? 44 : 22, h: e.side === 'player' ? 40 : 22, arc: -50 });
        });
        if (!e.burn && e.tier > 0) {
          const lr = this.reelRect(e.side, 0, 1);
          this.sparkBurst(lr.x + lr.w / 2, lr.y + lr.h / 2, 10 + e.tier * 8, ['#ffe08a', tileColor(e.move), '#ffffff'], 180 + e.tier * 40, 3);
        }
        break;
      }
      case 'hit': {
        if (e.chip && e.amount <= 1) break;
        const big = e.amount >= f.bigHit;
        const tags = [e.blocked && 'BLOCKED', e.interrupted && 'INTERRUPT!', e.weak && 'WEAK SPOT!', e.resist > 1.05 && 'EFFECTIVE', e.resist < 0.95 && 'RESISTED'].filter(Boolean).join(' ');
        this.pop(e.side, String(e.amount), e.blocked ? '#9fb6dd' : e.weak || big ? '#ffd84a' : '#ffffff', big ? 30 : e.chip ? 14 : 22, 6);
        if (tags) this.pop(e.side, tags, e.weak ? '#ff9a5a' : '#cfd6ff', 13, 30);
        if (!e.chip) {
          e.blocked ? sfx.block() : sfx.hit(big);
          if (big) this.shake = Math.max(this.shake, 0.2);
        }
        break;
      }
      case 'miss':
        this.pop(e.side, `MISS (${e.reason})`, '#cfd6ff', 16, 6);
        sfx.miss();
        break;
      case 'heal':
        this.pop(e.side, `+${e.amount}`, '#7be3a4', 16, 34);
        break;
      case 'drop':
        this.pop(e.side, `DROPPED ${e.count}`, '#f08fd0', 16, 54);
        break;
      case 'jam':
        this.pop(e.side, `JAMMED ${e.count}`, '#c9a3ff', 16, 54);
        break;
      case 'break': {
        const p = c.fighters[e.side].parts[e.part];
        this.pop(e.side, `${PARTS[p.id].name.toUpperCase()} BROKEN!`, '#ff9a3a', 20, -50, 1.4);
        if (e.cancelled) this.pop(e.side, 'MOVE CANCELLED', '#ff8a7a', 14, -28, 1.2);
        this.shake = 0.35;
        sfx.break();
        break;
      }
      case 'pocket': {
        const fl = c.fighters[e.side];
        const start = fl.pocket.length - e.stored.length;
        const small = e.side === 'enemy';
        e.stored.forEach((s, k) => {
          const from = center(this.reelRect(e.side, Math.floor(s.from / 3), s.from % 3));
          const to = center(this.slotRect(e.side, start + k));
          this.hidden[e.side].set(start + k, f.tileFlySec + k * 0.04);
          this.flies.push({ id: s.id, x0: from.x, y0: from.y, x1: to.x, y1: to.y, age: -k * 0.04, dur: f.tileFlySec, drop: false, w: small ? 22 : 44, h: small ? 22 : 40, arc: -40 });
        });
        for (const slot of e.discarded) {
          const r = this.reelRect(e.side, Math.floor(slot / 3), slot % 3);
          const t = reelWindow(fl, Math.floor(slot / 3) as 0 | 1)[slot % 3];
          this.flies.push({ id: t.id, x0: r.x + r.w / 2, y0: r.y + r.h / 2, x1: r.x + r.w / 2 + (Math.random() - 0.5) * 60, y1: r.y + 160, age: 0, dur: 0.5, drop: true, w: r.w * 0.8, h: r.h * 0.8, arc: -30 });
        }
        if (e.side === 'player') sfx.pocket();
        this.pop(e.side, `POCKET +${e.stored.length}`, '#ffe08a', 15, -26);
        break;
      }
      case 'burn': {
        const fl = c.fighters[e.side];
        for (let k = 0; k < e.count; k++) {
          const r = center(this.slotRect(e.side, fl.pocket.length + k));
          this.sparkBurst(r.x, r.y, 14, ['#ff6a2a', '#ffd24a', '#fff2c2', tileColor(e.id)], 150, 3.5);
        }
        if (e.side === 'player') sfx.burn();
        break;
      }
      case 'lost':
        this.pop(e.side, 'MISSED SPIN', '#ff8a7a', 15, -26);
        if (e.side === 'player') {
          this.missedFlash = 0.9;
          sfx.lost();
        }
        break;
      case 'end':
        if (e.winner === 'player') sfx.win();
        else sfx.lose();
        break;
    }
  }

  /** Coin shower when a payout lands. */
  payout(amount: number) {
    for (let i = 0; i < Math.min(24, 6 + amount / 5); i++) {
      this.sparks.push({ x: 195 + (Math.random() - 0.5) * 60, y: 330, vx: (Math.random() - 0.5) * 260, vy: -200 - Math.random() * 200, age: 0, life: 0.9 + Math.random() * 0.4, color: '#ffd24a', size: 5 });
      sfx.coin(i % 6);
    }
  }

  update(dt: number, run: Run) {
    this.time += dt;
    for (const p of this.popups) p.age += dt;
    this.popups = this.popups.filter((p) => p.age < p.life);
    for (const fl of this.flies) fl.age += dt;
    this.flies = this.flies.filter((fl) => fl.age < fl.dur);
    for (const s of this.sparks) {
      s.age += dt;
      s.vy += 520 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.sparks = this.sparks.filter((s) => s.age < s.life);
    for (const side of ['player', 'enemy'] as const) {
      for (const [k, v] of this.hidden[side]) v - dt <= 0 ? this.hidden[side].delete(k) : this.hidden[side].set(k, v - dt);
      this.landAge[side][0] += dt;
      this.landAge[side][1] += dt;
    }
    for (const k of Object.keys(this.press)) this.press[k] = Math.max(0, this.press[k] - dt);
    this.missedFlash = Math.max(0, this.missedFlash - dt);
    this.superFlash = Math.max(0, this.superFlash - dt);
    this.superStamp = Math.max(0, this.superStamp - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.yieldArmed = Math.max(0, this.yieldArmed - dt);
    // Reel ticks while the player's reels spin.
    const c = run.combat;
    if (run.screen === 'fight' && c) {
      const f = c.fighters.player;
      if (f.spinLeft > 0) {
        const el = f.spinTotal - f.spinLeft;
        for (const r of [0, 1] as const) {
          if (el >= reelLandTime(f, r)) continue;
          const row = Math.floor(el * tune.feel.reelScrollSpeed);
          if (row !== this.lastTickRow.player[r]) {
            this.lastTickRow.player[r] = row;
            if (r === 0 || !f.tease) sfx.tick(r === 0 ? 1 : 1.25);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ drawing

  draw(run: Run) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * 8 * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * 8 * this.shake : 0;
    g.setTransform(this.pxPerLogical, 0, 0, this.pxPerLogical, sx * this.pxPerLogical, sy * this.pxPerLogical);
    g.textBaseline = 'middle';

    g.fillStyle = 'rgba(14,11,22,0.88)';
    g.fillRect(-10, -10, WIDTH + 20, 196);
    g.fillRect(-10, L.player.panelY, WIDTH + 20, HEIGHT - L.player.panelY + 10);

    switch (run.screen) {
      case 'select': this.drawSelect(run); break;
      case 'prefight': this.drawPrefight(run); break;
      case 'fight': if (run.combat) this.drawFight(run.combat); break;
      case 'result': if (run.combat) this.drawFight(run.combat, true); this.drawResult(run); break;
      case 'loot': this.drawLoot(run); break;
      case 'levelup': this.drawLevelUp(run); break;
      case 'gameover': this.drawGameOver(run); break;
    }
    this.drawFlies();
    this.drawSparks();
    this.drawPopups();
    if (this.superFlash > 0) {
      g.fillStyle = `rgba(255,246,210,${(this.superFlash / 0.35) * 0.55})`;
      g.fillRect(-10, -10, WIDTH + 20, HEIGHT + 20);
    }

    g.setTransform(this.pxPerLogical, 0, 0, this.pxPerLogical, 0, 0);
    g.font = '9px monospace';
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillText(VERSION_STAMP, 4, 8);
    this.texture.needsUpdate = true;
  }

  private text(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = '600') {
    const g = this.g;
    g.font = `${weight} ${size}px ${FONT}`;
    g.textAlign = align;
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  private outlined(s: string, x: number, y: number, size: number, color: string, scale = 1) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    g.font = `900 ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(3, size / 6);
    g.strokeStyle = 'rgba(20,10,30,0.85)';
    g.strokeText(s, 0, 0);
    g.fillStyle = color;
    g.fillText(s, 0, 0);
    g.restore();
  }

  private rr(r: Rect, radius: number, fill: string | CanvasGradient, stroke?: string, lw = 2) {
    const g = this.g;
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

  /** A chunky tile with a bevel highlight, like a physical slot symbol. */
  private tile(r: Rect, id: TileId, o: { dim?: boolean; size: number; short?: boolean; jam?: boolean; broken?: boolean; scale?: number; alpha?: number }) {
    const g = this.g;
    g.save();
    g.globalAlpha = o.alpha ?? 1;
    const s = o.scale ?? 1;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    g.translate(cx, cy);
    g.scale(s, s);
    const rr = { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h };
    const base = o.broken ? COLORS.broken : o.jam ? COLORS.jam : tileColor(id);
    this.rr(rr, Math.min(8, r.h / 4), base);
    if (!o.broken && !o.jam && id !== 'blank') {
      const grad = g.createLinearGradient(0, rr.y, 0, rr.y + rr.h);
      grad.addColorStop(0, 'rgba(255,255,255,0.32)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.04)');
      grad.addColorStop(1, 'rgba(0,0,0,0.25)');
      this.rr(rr, Math.min(8, r.h / 4), grad);
    }
    const label = o.broken ? 'X' : o.jam ? 'JAM' : o.short ? tileShort(id) : tileLabel(id);
    g.font = `800 ${o.size}px ${FONT}`;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillText(label, 0, 2);
    g.fillStyle = o.dim ? 'rgba(255,255,255,0.6)' : '#ffffff';
    g.fillText(label, 0, 1);
    g.restore();
  }

  private bars(f: Fighter, y: number, cdY: number) {
    const hpFrac = f.hp / f.maxHp;
    this.text(f.name, 16, y - 11, 13, '#f4efe6', 'left', '800');
    this.text(`${f.hp}/${f.maxHp}`, 374, y - 11, 12, '#cfc7d9', 'right');
    this.rr({ x: 16, y, w: 358, h: 10 }, 5, '#2d2738');
    if (hpFrac > 0) this.rr({ x: 16, y, w: 358 * hpFrac, h: 10 }, 5, hpFrac > 0.35 ? '#5fd08b' : '#e2574c');
    const frac = f.spinLeft > 0 ? 1 : 1 - Math.max(0, f.cooldown) / tune.timing.baseCooldownSec;
    this.rr({ x: 16, y: cdY, w: 358, h: 5 }, 2.5, '#231e2d');
    this.rr({ x: 16, y: cdY, w: Math.max(4, 358 * Math.min(1, frac)), h: 5 }, 2.5, f.landed ? '#8a7a4a' : '#e8c15a');
    const chips: [string, string][] = [];
    if (f.stance !== 'none') chips.push(f.stance === 'defend' ? ['GUARDING', '#8fb3ff'] : ['SCHEMING', '#d1a6ff']);
    if (isFlying(f)) chips.push(['FLYING', '#9fe3ff']);
    chips.forEach(([t, col], i) => this.text(t, 195 + (i - (chips.length - 1) / 2) * 80, y - 11, 11, col, 'center', '800'));
  }

  /** The 2x3 reel window: blurred scroll while spinning, overshoot on landing. */
  private drawReels(f: Fighter, side: Side) {
    const g = this.g;
    const P = side === 'player' ? L.player : L.enemy;
    const font = side === 'player' ? 15 : 11;
    const h = P.tileH + P.gap;
    const el = f.spinTotal - f.spinLeft;
    for (const reel of [0, 1] as const) {
      const x = P.reelX[reel];
      const spinning = f.spinLeft > 0 && el < reelLandTime(f, reel);
      const teasing = spinning && f.tease && reel === 0 && el > reelLandTime(f, 1);
      g.save();
      g.beginPath();
      g.rect(x - 3, P.reelY - 3, P.tileW + 6, h * 3 + 4);
      g.clip();
      this.rr({ x: x - 3, y: P.reelY - 3, w: P.tileW + 6, h: h * 3 + 4 }, 6, 'rgba(0,0,0,0.35)');
      const strip = f.strips[reel];
      const n = strip.length;
      if (spinning) {
        // Slows down for the tease so the last symbols crawl past.
        const speed = teasing ? tune.feel.reelScrollSpeed * 0.35 : tune.feel.reelScrollSpeed;
        const scroll = el * speed;
        const base = Math.floor(scroll);
        const frac = scroll - base;
        for (let row = -1; row < 3; row++) {
          const t = strip[(((f.reelPos[reel] - base + row) % n) + n) % n];
          const y = P.reelY + (row + frac) * h;
          g.globalAlpha = teasing ? 0.95 : 0.7;
          this.tile({ x, y: y - 3, w: P.tileW, h: P.tileH + 6 }, t.id, { dim: true, size: font, short: side === 'enemy', jam: !!t.jam, broken: t.broken });
          g.globalAlpha = 1;
        }
        // Motion streaks.
        g.fillStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < 3; i++) g.fillRect(x + 8 + i * (P.tileW / 3), P.reelY, 2, h * 3);
      } else {
        const age = this.landAge[side][reel];
        const t = Math.min(1, age / tune.feel.reelLandSec);
        const bounce = age < tune.feel.reelLandSec ? Math.sin(t * Math.PI) * (1 - t) * tune.feel.reelOvershoot * h : 0;
        reelWindow(f, reel).forEach((st, row) => {
          const pop = row === 1 && age < 0.25 ? 1 + 0.18 * Math.sin((age / 0.25) * Math.PI) : 1;
          this.tile({ x, y: P.reelY + row * h + bounce, w: P.tileW, h: P.tileH }, st.id, {
            dim: row !== 1, size: font, short: side === 'enemy', jam: !!st.jam, broken: st.broken, scale: pop,
          });
        });
      }
      // Shading at top and bottom so the window reads as a drum.
      const grad = g.createLinearGradient(0, P.reelY - 3, 0, P.reelY + h * 3);
      grad.addColorStop(0, 'rgba(10,8,18,0.7)');
      grad.addColorStop(0.22, 'rgba(10,8,18,0)');
      grad.addColorStop(0.78, 'rgba(10,8,18,0)');
      grad.addColorStop(1, 'rgba(10,8,18,0.7)');
      g.fillStyle = grad;
      g.fillRect(x - 3, P.reelY - 3, P.tileW + 6, h * 3 + 4);
      g.restore();
      if (teasing) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 30);
        this.rr({ x: x - 4, y: P.reelY - 4, w: P.tileW + 8, h: h * 3 + 6 }, 8, 'rgba(0,0,0,0)', `rgba(255,${180 + pulse * 70},60,1)`, 3);
        if (side === 'player') this.outlined('!!!', x + P.tileW / 2, P.reelY - 14, 20, '#ffe24a', 1 + pulse * 0.2);
      }
    }
    // The line.
    const lineY = P.reelY + h - 1;
    const glow = f.landed ? 0.6 + 0.4 * Math.sin(this.time * 8) : 0.35;
    g.lineWidth = side === 'player' ? 3 : 2;
    g.strokeStyle = `rgba(255,224,138,${glow})`;
    g.beginPath();
    g.roundRect(P.reelX[0] - 6, lineY - 4, P.reelX[1] + P.tileW - P.reelX[0] + 12, P.tileH + 9, 9);
    g.stroke();
    if (side === 'player') {
      for (const [ax, dir] of [[P.reelX[0] - 12, 1], [P.reelX[1] + P.tileW + 12, -1]] as const) {
        g.fillStyle = `rgba(255,224,138,${glow})`;
        g.beginPath();
        g.moveTo(ax, lineY + P.tileH / 2 - 7);
        g.lineTo(ax + dir * 7, lineY + P.tileH / 2);
        g.lineTo(ax, lineY + P.tileH / 2 + 7);
        g.fill();
      }
    }
  }

  private drawPocket(f: Fighter, side: Side) {
    const preview = f.landed ? executePreview(f) : null;
    const groups = pocketGroups(f);
    const count = side === 'enemy' ? Math.min(9, f.pocketSize) : Math.min(9, Math.max(6, f.pocketSize));
    for (let i = 0; i < count; i++) {
      const r = this.slotRect(side, i);
      const t = f.pocket[i];
      if (!t || this.hidden[side].has(i)) {
        if (i < f.pocketSize) this.rr(r, side === 'player' ? 8 : 5, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.13)', 1);
        continue;
      }
      const match = preview && (t.id === preview.move || t.id === preview.mut) && t.id !== 'blank';
      const wob = match ? Math.sin(this.time * 14 + i) * 1.5 : 0;
      this.tile({ x: r.x, y: r.y + wob, w: r.w, h: r.h }, t.id, { size: side === 'player' ? 11 : 8, short: true, scale: match ? 1.06 : 1 });
      if (side === 'player') {
        const n = groups.find((gr) => gr.id === t.id)?.count ?? 1;
        if (n > 1) this.text(`x${n}`, r.x + r.w - 4, r.y + 8, 9, '#ffffff', 'right', '800');
      }
      if (match) {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 10);
        this.rr({ x: r.x - 2, y: r.y - 2 + wob, w: r.w + 4, h: r.h + 4 }, 9, 'rgba(0,0,0,0)', `rgba(255,224,138,${pulse})`, 2);
        if (Math.random() < 0.08) this.sparks.push({ x: r.x + Math.random() * r.w, y: r.y + Math.random() * r.h, vx: 0, vy: -40, age: 0, life: 0.5, color: '#fff2b0', size: 2 });
      }
    }
  }

  private buffLine(f: Fighter, x: number, y: number, align: CanvasTextAlign = 'left') {
    const b = pocketBuffs(f);
    const parts: string[] = [];
    if (b.attack) parts.push(`ATK +${Math.round(b.attack * 100)}%`);
    if (b.defend) parts.push(`DEF +${Math.round(b.defend * 100)}%`);
    if (b.speed) parts.push(`SPD +${Math.round(b.speed * 100)}%`);
    if (parts.length) this.text(parts.join('  '), x, y, 10, '#ffe08a', align, '700');
  }

  private drawFight(c: Combat, frozen = false) {
    const e = c.fighters.enemy;
    const p = c.fighters.player;
    // Enemy panel.
    this.bars(e, L.enemy.hpY, L.enemy.cdY);
    this.drawReels(e, 'enemy');
    this.text(`Pocket ${e.pocket.length}/${e.pocketSize}`, L.enemy.pocketX, L.enemy.pocketY - 10, 10, '#cfc7d9');
    this.drawPocket(e, 'enemy');
    const w = weakspot(e);
    this.text(`Weak: ${w >= 0 ? PARTS[e.parts[w].id].name : '-'}`, 140, 120, 11, '#ff9a8a', 'left', '700');
    this.text(`Armour: ${e.armour}  Frag +${Math.round(fragility(e) * 100)}%`, 140, 136, 10, '#cfc7d9');
    const broken = e.parts.filter((pt) => pt.broken).length;
    if (broken) this.text(`${broken} part${broken > 1 ? 's' : ''} broken`, 140, 152, 10, '#ff9a3a', 'left', '700');
    this.buffLine(e, 140, 168);
    if (e.landed) this.text('deciding...', 374, 168, 10, '#e8c15a', 'right');

    // Player panel.
    this.bars(p, L.player.hpY, L.player.cdY);
    this.buffLine(p, 16, 530);
    if (this.missedFlash > 0) this.text('Too slow, spin lost!', 200, 530, 11, '#ff8a7a', 'left', '700');
    this.drawReels(p, 'player');
    this.text(`Pocket ${p.pocket.length}/${p.pocketSize}`, L.player.pocketX, L.player.pocketY - 10, 11, '#cfc7d9', 'left', '700');
    if (p.landed && p.pocket.length) this.text('tap = burn', 374, L.player.pocketY - 10, 10, '#e8c15a', 'right', '700');
    this.drawPocket(p, 'player');
    if (!frozen) {
      this.drawButtons(p);
      const y = L.yield;
      this.rr(y, 6, this.yieldArmed > 0 ? '#e2574c' : 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.2)', 1);
      this.text(this.yieldArmed > 0 ? 'SURE?' : 'Yield', y.x + y.w / 2, y.y + y.h / 2 + 1, 10, '#fff', 'center', '700');
    }
    if (this.superStamp > 0) {
      const t = 1 - this.superStamp / 1.2;
      const s = t < 0.15 ? easeOutBack(t / 0.15) * 1.3 : 1.3 - (t - 0.15) * 0.3;
      this.g.globalAlpha = Math.min(1, this.superStamp * 3);
      this.outlined('SUPER READY!', 195, 444, 30, '#ffe24a', s);
      this.g.globalAlpha = 1;
    }
  }

  private button(r: Rect, key: string, fill: string, live: boolean) {
    const g = this.g;
    const press = this.press[key] ?? 0;
    const s = 1 - press * 0.6;
    g.save();
    g.translate(r.x + r.w / 2, r.y + r.h / 2);
    g.scale(s, s);
    const rr = { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h };
    this.rr({ ...rr, y: rr.y + 5 }, 16, 'rgba(0,0,0,0.4)');
    this.rr(rr, 16, fill);
    if (live) {
      const grad = g.createLinearGradient(0, rr.y, 0, rr.y + rr.h);
      grad.addColorStop(0, 'rgba(255,255,255,0.3)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0)');
      this.rr(rr, 16, grad);
      // Gleam sweeping across a live button.
      const sweep = ((this.time * 0.8) % 1.6) - 0.3;
      g.save();
      g.beginPath();
      g.roundRect(rr.x, rr.y, rr.w, rr.h, 16);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath();
      const gx = rr.x + sweep * rr.w;
      g.moveTo(gx, rr.y); g.lineTo(gx + 30, rr.y); g.lineTo(gx + 10, rr.y + rr.h); g.lineTo(gx - 20, rr.y + rr.h);
      g.fill();
      g.restore();
    }
    g.restore();
  }

  private drawButtons(f: Fighter) {
    const live = f.landed;
    const ex = L.execute;
    const po = L.pocket;
    const p = live ? executePreview(f) : null;
    const hot = p && p.tier >= 3;
    this.button(ex, 'execute', !live ? '#3a2f3f' : hot ? '#e8a020' : '#d4554b', live);
    this.button(po, 'pocket', live ? '#e0a83a' : '#3a3530', live);
    this.text('EXECUTE', ex.x + ex.w / 2, ex.y + 30, 20, live ? '#fff' : 'rgba(255,255,255,0.35)', 'center', '900');
    this.text('POCKET', po.x + po.w / 2, po.y + 30, 20, live ? '#1a1424' : 'rgba(255,255,255,0.35)', 'center', '900');
    if (!live || !p) {
      const sub = f.spinLeft > 0 ? 'spinning...' : 'charging';
      this.text(sub, ex.x + ex.w / 2, ex.y + 62, 13, 'rgba(255,255,255,0.35)', 'center');
      this.text(sub, po.x + po.w / 2, po.y + 62, 13, 'rgba(255,255,255,0.35)', 'center');
      return;
    }
    const name = tileLabel(p.move);
    const head = p.move === 'blank' ? 'whiff' : p.tier >= 3 ? `SUPER ${name}` : `${name}${'+'.repeat(p.tier)}`;
    this.text(head, ex.x + ex.w / 2, ex.y + 60, hot ? 18 : 15, hot ? '#fff6b0' : '#fff', 'center', '900');
    const mutText = p.mut === 'blank' ? '' : `${tileLabel(p.mut)}${p.mutMatches ? ` x${p.mutMatches + 1}` : ''}`;
    if (mutText) this.text(mutText, ex.x + ex.w / 2, ex.y + 80, 12, 'rgba(255,255,255,0.85)', 'center', '700');
    const visible = [0, 1].flatMap((reel) => reelWindow(f, reel as 0 | 1)).filter((t) => t.id !== 'blank').length;
    const free = f.pocketSize - f.pocket.length;
    const store = Math.min(free, visible);
    this.text(`store ${store}`, po.x + po.w / 2, po.y + 60, 15, '#1a1424', 'center', '800');
    if (visible > store) this.text(`lose ${visible - store}`, po.x + po.w / 2, po.y + 80, 12, 'rgba(26,20,36,0.75)', 'center', '700');
  }

  private drawFlies() {
    for (const fl of this.flies) {
      if (fl.age < 0) continue;
      const t = Math.min(1, fl.age / fl.dur);
      const e = fl.drop ? t : 1 - Math.pow(1 - t, 3);
      const x = fl.x0 + (fl.x1 - fl.x0) * e;
      const y = fl.y0 + (fl.y1 - fl.y0) * e + (fl.drop ? 0 : Math.sin(t * Math.PI) * fl.arc);
      const scale = fl.drop ? 1 - t * 0.4 : 1 + Math.sin(t * Math.PI) * 0.25;
      this.tile({ x: x - fl.w / 2, y: y - fl.h / 2, w: fl.w, h: fl.h }, fl.id, { size: fl.w > 30 ? 11 : 8, short: true, scale, alpha: fl.drop ? 1 - t : 1 });
    }
  }

  private drawSparks() {
    const g = this.g;
    for (const s of this.sparks) {
      g.globalAlpha = 1 - s.age / s.life;
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, s.size * (1 - s.age / s.life * 0.5), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  private drawPopups() {
    const g = this.g;
    for (const p of this.popups) {
      const t = p.age / p.life;
      g.globalAlpha = 1 - Math.pow(t, 3);
      const s = t < 0.12 ? easeOutBack(t / 0.12) : 1;
      this.outlined(p.text, p.x, p.y - t * 36, p.size, p.color, Math.max(0.01, s));
    }
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------ run screens

  private bigButton(label: string, sub: string, color = '#e8c15a') {
    const r = L.wide;
    this.button(r, 'wide', color, true);
    this.text(label, 195, r.y + (sub ? 40 : r.h / 2), 22, '#1a1424', 'center', '900');
    if (sub) this.text(sub, 195, r.y + 70, 13, 'rgba(26,20,36,0.8)', 'center', '700');
  }

  private drawSelect(run: Run) {
    this.outlined('CHIMERA REELS', 195, 50, 32, '#ffe08a');
    this.text('Pick a starter chimera', 195, 92, 14, '#cfc7d9', 'center', '700');
    if (run.bestStreak) this.text(`Best streak: ${run.bestStreak}`, 195, 116, 12, '#ffe08a', 'center', '700');
    this.text('Tap Execute to fire the line. Pocket to save tiles.', 195, 146, 11, '#a89fbc', 'center');
    this.text('Match pocketed tiles for power, 3 = SUPER.', 195, 162, 11, '#a89fbc', 'center');
    STARTERS.forEach((s, i) => {
      const r = this.choiceRect(i, STARTERS.length);
      const sel = i === this.selectIndex;
      this.rr(r, 12, sel ? 'rgba(255,224,138,0.16)' : 'rgba(255,255,255,0.05)', sel ? '#ffe08a' : 'rgba(255,255,255,0.15)', sel ? 2.5 : 1);
      this.rr({ x: r.x + 10, y: r.y + 10, w: 18, h: 18 }, 9, s.palette.body);
      this.rr({ x: r.x + 22, y: r.y + 10, w: 12, h: 12 }, 6, s.palette.part);
      this.text(s.name, r.x + 40, r.y + 19, 13, '#fff', 'left', '800');
      partNames(s).forEach((n, k) => this.text(n, r.x + 10, r.y + 46 + k * 18, 10.5, '#cfc7d9'));
    });
    this.text(`Weak spot, armour and speed come from parts`, 195, 718, 10, '#8a82a0', 'center');
    this.bigButton(`CHOOSE ${STARTERS[this.selectIndex].name.toUpperCase()}`, '');
  }

  private drawPrefight(run: Run) {
    const e = run.enemy!;
    this.text(`FLOOR ${run.floor}`, 16, 26, 13, '#ffe08a', 'left', '900');
    this.outlined(e.name, 195, 58, 24, '#ff9a8a');
    partNames(e).forEach((n, k) => this.text(n, k % 2 ? 210 : 40, 92 + Math.floor(k / 2) * 18, 11, '#cfc7d9'));
    this.text('Enemy', 374, 26, 11, '#8a82a0', 'right');
    const m = run.monster!;
    this.text(m.name, 16, 500, 16, '#fff', 'left', '900');
    this.text(`Level ${run.level}`, 374, 500, 13, '#ffe08a', 'right', '800');
    const stats: [string, string][] = [
      ['Gold', `${run.gold}`], ['Entry bet', `${entryBet(run)}`], ['Win pays', `${Math.round(entryBet(run) * tune.run.payoutMult)}`], ['Streak', `${run.streak}`],
    ];
    stats.forEach(([k, v], i) => {
      const x = 16 + (i % 2) * 180;
      const y = 540 + Math.floor(i / 2) * 44;
      this.text(k, x, y, 11, '#a89fbc');
      this.text(v, x, y + 18, 20, i === 0 ? '#ffd24a' : '#fff', 'left', '900');
    });
    if (m.extra.length) this.text(`Bonus tiles: ${m.extra.map(tileLabel).join(', ')}`, 16, 650, 11, '#cfc7d9');
    this.text('Losing to the final hit loses the monster. Yield to keep it.', 16, 690, 10.5, '#ff9a8a');
    this.bigButton('ENTER FIGHT', `pay ${entryBet(run)} gold`);
  }

  private drawResult(run: Run) {
    const last = run.last!;
    const label = last.won ? 'VICTORY' : last.yielded ? 'YIELDED' : 'DEFEAT';
    const color = last.won ? '#ffe08a' : last.yielded ? '#cfd6ff' : '#ff8a7a';
    this.rr({ x: 50, y: 280, w: 290, h: 110 }, 18, 'rgba(14,11,22,0.92)', color, 2);
    this.outlined(label, 195, 318, 36, color);
    this.text(last.won ? `+${last.payout} gold   streak ${run.streak}` : last.yielded ? `${run.monster?.name} survives. Bet lost.` : `${run.monster?.name} is lost.`, 195, 360, 13, '#fff', 'center', '700');
    this.bigButton(last.won ? 'COLLECT' : 'CONTINUE', '');
  }

  private partCard(r: Rect, id: PartId, title: string, accent: string) {
    const def = PARTS[id];
    this.rr(r, 12, 'rgba(255,255,255,0.06)', accent, 1.5);
    this.text(title, r.x + r.w / 2, r.y + 18, 11, accent, 'center', '800');
    this.text(def.name, r.x + r.w / 2, r.y + 42, 16, '#fff', 'center', '900');
    const st = tune.parts.stats[id] as Record<string, number>;
    const bits = (['hp', 'speed', 'atk', 'def', 'weak', 'pocket'] as const)
      .filter((k) => st[k])
      .map((k) => `${k.toUpperCase()} ${st[k] > 0 ? '+' : ''}${st[k]}`);
    bits.forEach((b, i) => this.text(b, r.x + r.w / 2, r.y + 64 + i * 13, 10, '#cfc7d9', 'center'));
    const tiles = [...def.moves, ...def.mutators.filter((m) => m !== 'blank')];
    tiles.slice(0, 6).forEach((t, i) => {
      const tw = (r.w - 24) / 3;
      this.tile({ x: r.x + 8 + (i % 3) * (tw + 4), y: r.y + 162 + Math.floor(i / 3) * 24, w: tw, h: 20 }, t, { size: 9, short: true });
    });
    if (def.flight) this.text('FLIGHT', r.x + r.w / 2, r.y + 148, 10, '#9fe3ff', 'center', '800');
  }

  private drawLoot(run: Run) {
    const drop = run.drop!;
    const slot = PARTS[drop].slot;
    const current = run.monster!.build[slot];
    this.outlined('PART DROPPED!', 195, 60, 30, '#ffb36b');
    this.text(`The enemy left its ${PARTS[drop].name}.`, 195, 100, 13, '#cfc7d9', 'center', '700');
    this.text(`Swap it into your ${slot} slot, or keep yours.`, 195, 122, 12, '#a89fbc', 'center');
    this.partCard(this.lootRect(0), drop, 'TAKE NEW', '#ffb36b');
    this.partCard(this.lootRect(1), current, 'KEEP CURRENT', 'rgba(255,255,255,0.4)');
    this.text('Parts change stats, weak spots and the tiles on your reels', 195, 730, 10, '#8a82a0', 'center');
  }

  private drawLevelUp(run: Run) {
    this.outlined(`LEVEL ${run.level}!`, 195, 60, 32, '#ffe08a');
    this.text('Pick one tile to add to your reels', 195, 100, 13, '#cfc7d9', 'center', '700');
    this.text(`Gold ${run.gold}   Streak ${run.streak}`, 195, 128, 12, '#ffd24a', 'center', '700');
    run.offers.forEach((id, i) => {
      const r = this.choiceRect(i, run.offers.length);
      const bob = Math.sin(this.time * 3 + i) * 3;
      this.rr(r, 12, 'rgba(255,255,255,0.06)', 'rgba(255,224,138,0.5)', 1.5);
      this.tile({ x: r.x + 14, y: r.y + 20 + bob, w: r.w - 28, h: 54 }, id, { size: 15 });
      this.text(isMove(id) ? 'Move reel' : 'Mutator reel', r.x + r.w / 2, r.y + 96, 10, '#ffe08a', 'center', '700');
      const words = describe(id).split(' ');
      let line = '';
      let row = 0;
      for (const w of words) {
        if ((line + ' ' + w).length > 16) {
          this.text(line, r.x + r.w / 2, r.y + 118 + row * 15, 10, '#cfc7d9', 'center');
          line = w;
          row++;
        } else line = line ? `${line} ${w}` : w;
      }
      if (line) this.text(line, r.x + r.w / 2, r.y + 118 + row * 15, 10, '#cfc7d9', 'center');
    });
  }

  private drawGameOver(run: Run) {
    this.outlined('RUN OVER', 195, 60, 34, '#ff8a7a');
    this.text(run.gameOverReason, 195, 104, 12, '#cfc7d9', 'center', '700');
    this.text(`Reached floor ${run.floor}   Best streak ${run.bestStreak}`, 195, 130, 13, '#ffe08a', 'center', '800');
    this.bigButton('NEW RUN', '');
  }
}
