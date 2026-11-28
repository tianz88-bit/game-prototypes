// Canvas HUD. Drawn with the 2D API onto an offscreen canvas at the device
// pixel ratio, then shown inside the WebGL canvas as a textured quad in front
// of the 3D view (no DOM UI). Owns the tap layout and answers hit tests for
// the pointer device. All the slot juice lives here: blurred spins, landing
// overshoot, super teases, tiles flying between reels and pocket, sparks.
import * as THREE from 'three';
import { tune } from '../tune';
import {
  actionSlots,
  isFlying,
  nudgeCost,
  projectedOrder,
  pocketGroups,
  previewBurn,
  previewRow,
  reelLandTime,
  reelWindow,
  REELS,
  rowTiles,
  rowValid,
  shieldCap,
  spinCost,
  unqueuedTiles,
  weakspot,
  type Combat,
  type CombatEvent,
  type LogEntry,
  type PocketTile,
  type Fighter,
  type Side,
} from '../sim/combat';
import {
  isMove,
  isTarget,
  MOVES,
  PARTS,
  reelOf,
  SLOT_ZONE,
  SLOTS,
  SOULS,
  STARTERS,
  tileLabel,
  tileRarity,
  zoneOf,
  ZONE_LABEL,
  type MonsterSpec,
  type PartId,
  type Rarity,
  type ReelIndex,
  type TileId,
} from '../sim/content';
import { entryBet, partNames, starterOptions, type Run } from '../sim/run';
import type { Intent } from '../input/intents';
import { BOTTOM_START, HEIGHT, TOP_END, WIDTH, type ViewSize } from './view';
import { VERSION_STAMP } from '../version.generated';
import { sfx } from '../audio/sfx';
import { drawIcon } from './icons';
import { fullscreenSupported, isFullscreen } from '../fullscreen';

interface Rect { x: number; y: number; w: number; h: number }
interface Popup { text: string; x: number; y: number; age: number; color: string; size: number; life: number }
interface Fly { id: TileId; x0: number; y0: number; x1: number; y1: number; age: number; dur: number; drop: boolean; w: number; h: number; arc: number }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; size: number }

const inside = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const FONT = 'system-ui, -apple-system, Segoe UI, sans-serif';

// Layout, logical pixels (390 x 844 portrait).
const L = {
  // The enemy's reels are not shown (the player cannot act on them); its pocket gets the space.
  enemy: { hpY: 30, cdY: 46, reelX: [16, 64, 112], reelY: 58, tileW: 44, tileH: 28, gap: 2, pocketX: 16, pocketY: 136, slot: 28, slotGap: 4.25 },
  player: { panelY: 474, hpY: 494, cdY: 512, reelX: [16, 139, 262], reelY: 550, tileW: 112, tileH: 44, gap: 4, pocketX: 16, pocketY: 716, slot: 36, slotGap: 4.25 },
  execute: { x: 16, y: 762, w: 174, h: 74 },
  pocket: { x: 200, y: 762, w: 174, h: 74 },
  yield: { x: 318, y: 510, w: 56, h: 18 },
  parts: { x: 300, y: 480, w: 74, h: 26 },
  wide: { x: 16, y: 740, w: 358, h: 92 },
};

const RARITY_COL: Record<Rarity, string | null> = { common: null, rare: '#58b0ff', epic: '#ffcc33' };
const DMG_COL: Record<string, string> = { slash: '#d4554b', pierce: '#c44a80', crush: '#9c6436', exotherm: '#e06a24' };
const TILE_COL: Record<string, string> = { power: '#d9a326', quick: '#3caf7c', shield: '#4b9fd4', target: '#3e6a8a', blank: '#2b2737', broken: '#1b1822' };

function tileColor(id: TileId): string {
  if (isMove(id)) return DMG_COL[MOVES[id].dmg];
  if (isTarget(id)) return TILE_COL.target;
  return TILE_COL[id];
}

function describe(id: TileId): string {
  if (isMove(id)) return `Attack, ${MOVES[id].dmg}, power ${(tune.moves[id] as { power: number }).power}`;
  if (id === 'power') return `Mutator: x${tune.mutators.power.mult} damage`;
  if (id === 'quick') return 'Mutator: next spin sooner';
  if (id === 'shield') return 'Mutator: gain shield points';
  return '';
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
  /** Pocket tiles still flying in (hidden in the pocket until they land), by tile. */
  private hidden = new Map<PocketTile, number>();
  /** Displayed x of each pocket tile, eased towards its slot so re-sorting slides. */
  private slotX = new Map<string, number>();
  private frameDt = 1 / 60;
  private landAge: Record<Side, number[]> = { player: [9, 9, 9], enemy: [9, 9, 9] };
  /** Player reel slide after a nudge, logical px, easing back to 0. */
  private nudgeOff = [0, 0, 0];
  private lastTickRow = [0, 0, 0];
  private missedFlash = 0;
  private superFlash = 0;
  private superStamp = 0;
  private shake = 0;
  private press: Record<string, number> = {};
  private yieldArmed = 0;
  /** Starter shown on the select screen (0..3, 3 = random roll). */
  selectIndex = 0;
  /** Parts viewer state: open flag and the selected slot index. */
  viewerOpen = false;
  viewerSlot = 1;
  /** Title screen state, set by main. */
  title: { hasSave: boolean; best: number; floor: number; gold: number; name: string } | null = null;
  private newRunArmed = 0;
  /** Post-battle combat log state. */
  logOpen = false;
  logPage = 0;

  constructor() {
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    // Full-width panel backgrounds and a dimmer behind the HUD bands.
    const backMat = new THREE.MeshBasicMaterial({ color: 0x0e0b16, transparent: true, opacity: 0.88, depthTest: false, depthWrite: false });
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backMat);
      this.backs.push(m);
      this.scene.add(m);
    }
    this.dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0810, transparent: true, opacity: 0.96, depthTest: false, depthWrite: false }));
    this.dim.position.set(0.5, 0.5, 0);
    this.scene.add(this.dim);
    // The HUD texture is shown as three bands (top, middle, bottom), placed per screen shape.
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      this.bands.push(m);
      this.scene.add(m);
    }
    // Full-screen overlays (the battle log) span all bands, so they are shown
    // as one uniformly scaled quad instead of three separately placed bands.
    this.whole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.whole.visible = false;
    this.scene.add(this.whole);
    // Version stamp: its own small texture, pinned to the screen's top-left corner.
    this.stampTex = new THREE.CanvasTexture(this.stampCanvas);
    this.stampTex.colorSpace = THREE.SRGBColorSpace;
    this.stampTex.minFilter = THREE.LinearFilter;
    this.stampTex.generateMipmaps = false;
    this.stamp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.stampTex, transparent: true, depthTest: false, depthWrite: false }));
    this.scene.add(this.stamp);
  }

  private bands: THREE.Mesh[] = [];
  private whole: THREE.Mesh;
  private backs: THREE.Mesh[] = [];
  private dim: THREE.Mesh;
  private stamp: THREE.Mesh;
  private stampCanvas = document.createElement('canvas');
  private stampTex: THREE.CanvasTexture;

  /** Place a quad in normalised screen space from CSS px (y down). */
  private place(m: THREE.Mesh, v: ViewSize, x: number, y: number, w: number, h: number) {
    m.scale.set(w / v.cssW, h / v.cssH, 1);
    m.position.set((x + w / 2) / v.cssW, 1 - (y + h / 2) / v.cssH, 0);
  }

  /** Set a band quad's texture window to design rows [y0, y1). */
  private bandUv(m: THREE.Mesh, y0: number, y1: number) {
    const uv = m.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const v0 = 1 - y1 / HEIGHT;
    const v1 = 1 - y0 / HEIGHT;
    // PlaneGeometry uv order: (0,1) (1,1) (0,0) (1,0).
    uv.setXY(0, 0, v1); uv.setXY(1, 1, v1); uv.setXY(2, 0, v0); uv.setXY(3, 1, v0);
    uv.needsUpdate = true;
  }

  setHeadLocator(fn: (side: Side) => { x: number; y: number }) {
    this.headPos = fn;
  }

  resize(v: ViewSize) {
    // Render at the larger of the band scales so the enlarged bottom band stays sharp.
    this.pxPerLogical = Math.max(v.scale, v.bottomScale) * v.pixelRatio;
    this.canvas.width = Math.round(WIDTH * this.pxPerLogical);
    this.canvas.height = Math.round(HEIGHT * this.pxPerLogical);
    this.texture.dispose();
    this.texture.needsUpdate = true;
    const colW = WIDTH * v.scale;
    const midH = (BOTTOM_START - TOP_END) * v.scale;
    this.place(this.bands[0], v, v.offX, 0, colW, v.topH);
    this.bandUv(this.bands[0], 0, TOP_END);
    this.place(this.bands[1], v, v.offX, v.midTop, colW, midH);
    this.bandUv(this.bands[1], TOP_END, BOTTOM_START);
    this.place(this.bands[2], v, v.bottomOffX, v.cssH - v.bottomH, WIDTH * v.bottomScale, v.bottomH);
    this.bandUv(this.bands[2], BOTTOM_START, HEIGHT);
    this.place(this.backs[0], v, 0, 0, v.cssW, v.topH + 10 * v.scale);
    this.place(this.backs[1], v, 0, v.cssH - v.bottomH, v.cssW, v.bottomH);
    this.place(this.dim, v, 0, 0, v.cssW, v.cssH);
    // One quad for the whole design, fitted to the screen (used by the log).
    const fit = Math.min(v.cssW / WIDTH, v.cssH / HEIGHT);
    this.place(this.whole, v, (v.cssW - WIDTH * fit) / 2, (v.cssH - HEIGHT * fit) / 2, WIDTH * fit, HEIGHT * fit);
    // Version stamp, drawn once at this size.
    const pr = v.pixelRatio;
    const sw = 90 * Math.max(1, v.scale);
    const sh = 14 * Math.max(1, v.scale);
    this.stampCanvas.width = Math.round(sw * pr);
    this.stampCanvas.height = Math.round(sh * pr);
    const sg = this.stampCanvas.getContext('2d')!;
    sg.setTransform(pr * Math.max(1, v.scale), 0, 0, pr * Math.max(1, v.scale), 0, 0);
    sg.font = '9px monospace';
    sg.textBaseline = 'middle';
    sg.fillStyle = 'rgba(255,255,255,0.28)';
    sg.fillText(VERSION_STAMP, 4, 8);
    this.stampTex.dispose();
    this.stampTex.needsUpdate = true;
    this.place(this.stamp, v, 0, 0, sw, sh);
  }

  resetFight() {
    this.popups = [];
    this.flies = [];
    this.sparks = [];
    this.hidden.clear();
    this.landAge = { player: [9, 9, 9], enemy: [9, 9, 9] };
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

  /** Pocket stack slot i when the pocket has n type slots; slots share one row. */
  private slotRect(side: Side, i: number, n = 6): Rect {
    const P = side === 'player' ? L.player : L.enemy;
    const total = 358;
    const maxW = 58;
    const w = Math.min(maxW, (total - (n - 1) * P.slotGap) / n);
    return { x: P.pocketX + i * (w + P.slotGap), y: P.pocketY, w, h: P.slot };
  }

  private choiceRect(i: number, n: number): Rect {
    const gap = n > 3 ? 6 : 8;
    const w = (358 - (n - 1) * gap) / n;
    return { x: 16 + i * (w + gap), y: 540, w, h: 186 };
  }

  private lootRect(i: number): Rect {
    return { ...this.choiceRect(i, 2), y: 516, h: 215 };
  }

  private viewerRow(i: number): Rect {
    return { x: 16, y: 516 + i * 31, w: 150, h: 28 };
  }

  // ------------------------------------------------------------ input

  private viewerAvailable(run: Run) {
    return run.screen === 'select' || run.screen === 'prefight' || run.screen === 'loot' || run.screen === 'levelup';
  }

  private logButtons() {
    const y = L.wide.y + 20;
    return { prev: { x: 16, y, w: 100, h: 60 }, close: { x: 124, y, w: 142, h: 60 }, next: { x: 274, y, w: 100, h: 60 } };
  }

  logAvailable(run: Run) {
    return (run.screen === 'result' || run.screen === 'gameover') && !!run.combat;
  }

  private static readonly NEW_RUN: Rect = { x: 115, y: 770, w: 160, h: 40 };
  private static readonly FULLSCREEN: Rect = { x: 276, y: 14, w: 100, h: 28 };

  /** New run from the title replaces a saved run, so it needs a second tap. */
  armNewRun(): boolean {
    if (!this.title?.hasSave || this.newRunArmed > 0) {
      this.newRunArmed = 0;
      return true;
    }
    this.newRunArmed = 2;
    sfx.ui();
    return false;
  }

  hitTest(x: number, y: number, run: Run): Intent | null {
    if (this.title) {
      if (fullscreenSupported() && inside(Hud.FULLSCREEN, x, y)) return { type: 'fullscreen' };
      return this.title.hasSave && inside(Hud.NEW_RUN, x, y) ? { type: 'choose', index: 0 } : { type: 'primary' };
    }
    if (this.logOpen) {
      const b = this.logButtons();
      if (inside(b.prev, x, y)) return { type: 'choose', index: 0 };
      if (inside(b.next, x, y)) return { type: 'choose', index: 1 };
      return inside(b.close, x, y) ? { type: 'log' } : null;
    }
    if (this.logAvailable(run) && inside(L.parts, x, y)) return { type: 'log' };
    if (this.viewerAvailable(run) && inside(L.parts, x, y)) return { type: 'viewer' };
    if (this.viewerOpen) {
      for (let i = 0; i <= SLOTS.length; i++) if (inside(this.viewerRow(i), x, y)) return { type: 'choose', index: i };
      return inside(L.wide, x, y) ? { type: 'viewer' } : null;
    }
    switch (run.screen) {
      case 'select': {
        const n = starterOptions(run).length;
        for (let i = 0; i < n; i++) if (inside(this.choiceRect(i, n), x, y)) return { type: 'choose', index: i };
        return inside(L.wide, x, y) ? { type: 'primary' } : null;
      }
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
        if (c.phase !== 'prep') return null;
        if (inside(L.execute, x, y)) return { type: 'secondary' };
        if (inside(L.pocket, x, y)) return { type: 'primary' };
        if (inside(L.yield, x, y)) return { type: 'yield' };
        const f = c.fighters.player;
        for (const reel of REELS) {
          const hr = this.nudgeRect(reel);
          if (inside(hr, x, y)) return { type: 'nudge', reel, dir: x < hr.x + hr.w / 2 ? -1 : 1 };
        }
        for (let row = 0; row < 3; row++) if (inside(this.rowRect(row), x, y)) return { type: 'row', row };
        const groups = pocketGroups(f);
        for (let i = 0; i < groups.length; i++) {
          if (inside(this.slotRect('player', i, f.pocketSize), x, y)) return { type: 'burn', group: i };
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
    const half = Math.min(WIDTH / 2 - 6, text.length * size * 0.33);
    this.popups.push({ text, x: Math.max(half + 6, Math.min(WIDTH - half - 6, p.x)), y: Math.max(205, Math.min(460, p.y + dy)), age: 0, color, size, life });
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
    const small = e.type !== 'end' && 'side' in e && e.side === 'enemy';
    const tw = small ? 20 : 34;
    switch (e.type) {
      case 'spin': {
        this.landAge[e.side] = [9, 9, 9];
        this.nudgeOff = [0, 0, 0];
        break;
      }
      case 'nudge':
        // Tiles slide one row from where they were.
        if (e.side === 'player') this.nudgeOff[e.reel] = -e.dir * (L.player.tileH + L.player.gap);
        break;
      case 'sabotage': {
        const part = c.fighters[e.side].parts[e.part];
        const name = PARTS[part.id].name.toUpperCase();
        this.pop(e.side, e.shielded >= e.amount ? `${name} SHIELDED` : `-${e.amount - e.shielded} ${name}`, e.shielded >= e.amount ? '#bfefff' : '#9ff0ff', 18, 6);
        sfx.hit(false);
        break;
      }
      case 'fizzle':
        this.pop(e.side, `${MOVES[e.move].label.toUpperCase()} FIZZLED`, '#a89fbc', 16, -26);
        this.pop(e.side, `(${e.part} broken)`, '#a89fbc', 12, -8);
        sfx.miss();
        break;
      case 'clash':
        sfx.execute();
        break;
      case 'prep':
        sfx.land();
        break;
      case 'reelLand':
      case 'land': {
        const reels: ReelIndex[] = e.type === 'land' ? REELS : [e.reel];
        for (const r of reels) {
          if (this.landAge[e.side][r] < 9) continue;
          this.landAge[e.side][r] = 0;
          if (e.side === 'player') sfx.reelStop(r);
          if (e.side !== 'player') continue;
          const lr = this.reelRect(e.side, r, 1);
          this.sparkBurst(lr.x + lr.w / 2, lr.y + lr.h, e.side === 'player' ? 6 : 3, ['#ffe08a', '#ffffff'], 90, 2);
        }
        if (e.type === 'land' && e.side === 'player') {
          // A super on the board gets a fanfare.
          const best = Math.max(0, ...[0, 1, 2].map((row) => previewRow(c, 'player', row)?.tier ?? 0));
          if (best) sfx.match(best);
          if (best >= 3) {
            const lr = this.reelRect('player', 0, 1);
            this.sparkBurst(lr.x + lr.w, lr.y + lr.h / 2, 30, ['#ffe24a', '#ff8a3a', '#ffffff'], 260, 4);
          }
        }
        break;
      }
      case 'action': {
        const name = MOVES[e.move].label.toUpperCase();
        const head = e.burn ? `BURN ${name} x${e.tier}` : e.isSuper ? `SUPER ${name}!` : `${name}${'+'.repeat(e.tier)}`;
        this.pop(e.side, `${head} > ${ZONE_LABEL[e.zone].toUpperCase()}`, e.isSuper ? '#ffd84a' : '#ffffff', e.isSuper ? 24 : 16, -26);
        if (e.isSuper) {
          this.superFlash = 0.35;
          this.shake = 0.4;
          sfx.super();
        } else if (!e.burn) sfx.execute();
        const fl = c.fighters[e.side];
        e.consumed.forEach(({ id, from: slot }, k) => {
          const from = center(this.slotRect(e.side, slot, fl.pocketSize));
          const to = e.side === 'player' ? center(this.reelRect(e.side, reelOf(id), 1)) : this.headPos('enemy');
          this.flies.push({ id, x0: from.x, y0: from.y, x1: to.x, y1: to.y, age: -k * 0.05, dur: f.tileFlySec, drop: false, w: tw, h: tw, arc: -50 });
        });
        if (!e.burn && e.consumed.length) {
          const lr = e.side === 'player' ? this.reelRect(e.side, 0, 1) : { ...this.headPos('enemy'), w: 0, h: 0 };
          this.sparkBurst(lr.x + lr.w / 2, lr.y + lr.h / 2, 10 + e.tier * 8, ['#ffe08a', tileColor(e.move), '#ffffff'], 180 + e.tier * 40, 3);
        }
        break;
      }
      case 'hit': {
        const big = e.amount >= f.bigHit;
        const absorbed = e.shielded >= e.amount;
        const tags = [absorbed && 'SHIELDED', e.weak && 'WEAK SPOT!', e.resist > 1.05 && 'EFFECTIVE', e.resist < 0.95 && 'RESISTED'].filter(Boolean).join(' ');
        this.pop(e.side, String(e.amount), absorbed ? '#bfefff' : e.weak || big ? '#ffd84a' : '#ffffff', big ? 30 : 22, 6);
        if (tags) this.pop(e.side, tags, e.weak ? '#ff9a5a' : '#cfd6ff', 13, 30);
        if (absorbed) sfx.block();
        else sfx.hit(big);
        if (big) this.shake = Math.max(this.shake, 0.2);
        break;
      }
      case 'miss':
        this.pop(e.side, e.reason, '#cfd6ff', 16, 6);
        sfx.miss();
        break;
      case 'shield':
        this.pop(e.side, `+${e.amount} SHIELD`, '#9fe3ff', 16, 34);
        sfx.pocket();
        break;
      case 'drop': {
        this.pop(e.side, 'TILE KNOCKED OUT', '#ffb36b', 14, 54);
        const fl = c.fighters[e.side];
        const r = center(this.slotRect(e.side, e.from, fl.pocketSize));
        this.sparkBurst(r.x, r.y, 10, ['#ffb36b', '#ffffff'], 140, 3);
        break;
      }
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
        e.stored.forEach((s, k) => {
          const from = e.side === 'player' ? center(this.reelRect(e.side, Math.floor(s.from / 3), s.from % 3)) : this.headPos('enemy');
          const slot = this.slotRect(e.side, s.to, fl.pocketSize);
          const to = center(slot);
          this.hidden.set(s.tile, f.tileFlySec + k * 0.04);
          this.slotX.set(`${e.side}:${s.id}`, slot.x);
          this.flies.push({ id: s.id, x0: from.x, y0: from.y, x1: to.x, y1: to.y, age: -k * 0.04, dur: f.tileFlySec, drop: false, w: tw, h: tw, arc: -40 });
        });
        for (const slot of e.side === 'player' ? e.discarded : []) {
          const r = this.reelRect(e.side, Math.floor(slot / 3), slot % 3);
          const t = reelWindow(fl, Math.floor(slot / 3) as ReelIndex)[slot % 3];
          this.flies.push({ id: t.id, x0: r.x + r.w / 2, y0: r.y + r.h / 2, x1: r.x + r.w / 2 + (Math.random() - 0.5) * 60, y1: r.y + 160, age: 0, dur: 0.5, drop: true, w: tw, h: tw, arc: -30 });
        }
        if (e.side === 'player') sfx.pocket();
        this.pop(e.side, `POCKET +${e.stored.length}`, '#ffe08a', 15, -26);
        break;
      }
      case 'burn': {
        const fl = c.fighters[e.side];
        for (const slot of e.from) {
          const r = center(this.slotRect(e.side, slot, fl.pocketSize));
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

  payout(amount: number) {
    for (let i = 0; i < Math.min(24, 6 + amount / 5); i++) {
      this.sparks.push({ x: 195 + (Math.random() - 0.5) * 60, y: 330, vx: (Math.random() - 0.5) * 260, vy: -200 - Math.random() * 200, age: 0, life: 0.9 + Math.random() * 0.4, color: '#ffd24a', size: 5 });
      sfx.coin(i % 6);
    }
  }

  update(dt: number, run: Run) {
    this.time += dt;
    this.frameDt = dt;
    for (const [k, v] of this.hidden) v - dt <= 0 ? this.hidden.delete(k) : this.hidden.set(k, v - dt);
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

      for (const r of REELS) this.landAge[side][r] += dt;
      if (side === 'player') this.nudgeOff = this.nudgeOff.map((o) => o * Math.exp(-dt * 22));
    }
    for (const k of Object.keys(this.press)) this.press[k] = Math.max(0, this.press[k] - dt);
    this.missedFlash = Math.max(0, this.missedFlash - dt);
    this.superFlash = Math.max(0, this.superFlash - dt);
    this.superStamp = Math.max(0, this.superStamp - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.yieldArmed = Math.max(0, this.yieldArmed - dt);
    this.newRunArmed = Math.max(0, this.newRunArmed - dt);
    const c = run.combat;
    if (run.screen === 'fight' && c) {
      const f = c.fighters.player;
      if (f.spinLeft > 0) {
        const el = f.spinTotal - f.spinLeft;
        for (const r of REELS) {
          if (el >= reelLandTime(f, r)) continue;
          const row = Math.floor(el * tune.feel.reelScrollSpeed);
          if (row !== this.lastTickRow[r]) {
            this.lastTickRow[r] = row;
            if (r === 0) sfx.tick(1);
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
    const panels = !this.title;
    for (const b of this.backs) b.visible = panels;
    this.dim.visible = this.logOpen;
    this.whole.visible = this.logOpen;
    for (const b of this.bands) b.visible = !this.logOpen;
    if (this.title) {
      this.drawTitle();
      this.finishFrame();
      return;
    }
    // Panel backgrounds are full-width quads behind the HUD (see resize).

    if (this.logOpen && run.combat) this.drawLog(run.combat);
    else if (this.viewerOpen) this.drawViewer(run);
    else {
      switch (run.screen) {
        case 'select': this.drawSelect(run); break;
        case 'prefight': this.drawPrefight(run); break;
        case 'fight': if (run.combat) this.drawFight(run.combat); break;
        case 'result': if (run.combat) this.drawFight(run.combat, true); this.drawResult(run); break;
        case 'loot': this.drawLoot(run); break;
        case 'levelup': this.drawLevelUp(run); break;
        case 'gameover': this.drawGameOver(run); break;
      }
    }
    if (this.logAvailable(run) && !this.logOpen) {
      this.button(L.parts, 'parts', 'rgba(255,255,255,0.12)', false);
      this.text('Battle log', L.parts.x + L.parts.w / 2, L.parts.y + L.parts.h / 2 + 1, 11, '#fff', 'center', '800');
    }
    if (this.viewerAvailable(run)) {
      this.button(L.parts, 'parts', this.viewerOpen ? '#ffe08a' : 'rgba(255,255,255,0.12)', false);
      this.text(this.viewerOpen ? 'Close' : 'Parts', L.parts.x + L.parts.w / 2, L.parts.y + L.parts.h / 2 + 1, 12, this.viewerOpen ? '#1a1424' : '#fff', 'center', '800');
    }
    this.drawFlies();
    this.drawSparks();
    this.drawPopups();
    if (this.superFlash > 0) {
      g.fillStyle = `rgba(255,246,210,${(this.superFlash / 0.35) * 0.55})`;
      g.fillRect(-10, -10, WIDTH + 20, HEIGHT + 20);
    }
    this.texture.needsUpdate = true;
  }

  /** Title overlay: the 3D title scene carries the art, this adds the prompts. */
  private drawTitle() {
    const t = this.title!;
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
    const g = this.g;
    g.globalAlpha = pulse;
    this.outlined(t.hasSave ? 'TAP TO CONTINUE' : 'TAP TO START', 195, 700, 26, '#ffe08a', 1 + 0.04 * Math.sin(this.time * 4));
    g.globalAlpha = 1;
    if (t.hasSave) {
      this.text(`${t.name}  ·  Floor ${t.floor}  ·  ${t.gold} gold`, 195, 734, 12, '#cfc7d9', 'center', '700');
      const r = Hud.NEW_RUN;
      this.button(r, 'newrun', this.newRunArmed > 0 ? '#e2574c' : 'rgba(255,255,255,0.12)', false);
      this.text(this.newRunArmed > 0 ? 'Tap again: lose save' : 'New run', r.x + r.w / 2, r.y + r.h / 2 + 1, 13, '#fff', 'center', '800');
    }
    if (t.best) this.text(`Best streak ${t.best}`, 195, 830, 11, '#a89fbc', 'center', '700');
    if (fullscreenSupported()) {
      const r = Hud.FULLSCREEN;
      this.button(r, 'fullscreen', 'rgba(255,255,255,0.12)', false);
      this.text(isFullscreen() ? 'Exit fullscreen' : 'Fullscreen', r.x + r.w / 2, r.y + r.h / 2 + 1, 11, '#fff', 'center', '800');
    }
  }

  private finishFrame() {
    const g = this.g;
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

  /** A chunky slot tile: colour = category, icon, optional label, rarity border. */
  private tile(r: Rect, id: TileId, o: { dim?: boolean; label?: boolean; broken?: boolean; scale?: number; alpha?: number; glow?: string; badge?: string }) {
    const g = this.g;
    g.save();
    g.globalAlpha = o.alpha ?? 1;
    const s = o.scale ?? 1;
    g.translate(r.x + r.w / 2, r.y + r.h / 2);
    g.scale(s, s);
    const rr = { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h };
    const rad = Math.min(8, r.h / 4);
    this.rr(rr, rad, o.broken ? TILE_COL.broken : tileColor(id));
    if (!o.broken && id !== 'blank') {
      const grad = g.createLinearGradient(0, rr.y, 0, rr.y + rr.h);
      grad.addColorStop(0, 'rgba(255,255,255,0.3)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.03)');
      grad.addColorStop(1, 'rgba(0,0,0,0.25)');
      this.rr(rr, rad, grad);
      const rc = RARITY_COL[tileRarity(id)];
      if (rc) this.rr(rr, rad, 'rgba(0,0,0,0)', rc, 2);
    }
    if (o.glow) this.rr({ x: rr.x - 2, y: rr.y - 2, w: rr.w + 4, h: rr.h + 4 }, rad + 2, 'rgba(0,0,0,0)', o.glow, 2.5);
    const col = o.dim ? 'rgba(255,255,255,0.55)' : '#ffffff';
    if (o.broken) this.text('X', 0, 1, Math.min(r.h * 0.5, 16), 'rgba(255,255,255,0.25)', 'center', '900');
    else if (o.label && id !== 'blank') {
      drawIcon(g, id, -r.w * 0.22, 0, r.h * 0.62, col);
      this.text(tileLabel(id), r.w * 0.12, 1, Math.min(13, r.h * 0.3), col, 'center', '800');
    } else drawIcon(g, id, 0, 0, Math.min(r.w, r.h) * 0.72, col);
    if (o.badge) {
      this.rr({ x: rr.x + rr.w - 22, y: rr.y + rr.h - 12, w: 24, h: 13 }, 4, 'rgba(10,8,18,0.85)');
      this.text(o.badge, rr.x + rr.w - 10, rr.y + rr.h - 5, 9, '#ffe08a', 'center', '800');
    }
    g.restore();
  }

  private bars(f: Fighter, y: number) {
    const hpFrac = f.hp / f.maxHp;
    this.text(f.name, 16, y - 11, 13, '#f4efe6', 'left', '800');
    const shieldTxt = f.shield > 0 ? `  +${f.shield}` : '';
    this.text(`${f.hp}/${f.maxHp}${shieldTxt}`, 374, y - 11, 12, f.shield > 0 ? '#9fe3ff' : '#cfc7d9', 'right', '700');
    this.rr({ x: 16, y, w: 358, h: 10 }, 5, '#2d2738');
    if (hpFrac > 0) this.rr({ x: 16, y, w: 358 * hpFrac, h: 10 }, 5, hpFrac > 0.35 ? '#5fd08b' : '#e2574c');
    if (f.shield > 0) {
      const w = Math.min(358, (358 * f.shield) / f.maxHp);
      this.rr({ x: 16, y: y - 2, w, h: 14 }, 6, 'rgba(159,227,255,0.45)', '#bfefff', 1.5);
    }
    if (isFlying(f)) this.text('FLYING', 195, y - 11, 11, '#9fe3ff', 'center', '800');
  }

  /** A grid row (all three reels), the tap target for queueing it. */
  private rowRect(row: number): Rect {
    const P = L.player;
    const h = P.tileH + P.gap;
    return { x: P.reelX[0] - 6, y: P.reelY + row * h - 3, w: P.reelX[2] + P.tileW - P.reelX[0] + 12, h: P.tileH + 6 };
  }

  /** The header above a reel: left half nudges the tiles up, right half down. */
  private nudgeRect(reel: number): Rect {
    const P = L.player;
    return { x: P.reelX[reel], y: P.reelY - 21, w: P.tileW, h: 17 };
  }

  /** The player's 3x3 grid: scroll while spinning, held reels locked, queued rows framed. */
  private drawGrid(c: Combat, f: Fighter, foe: Fighter) {
    const g = this.g;
    const P = L.player;
    const h = P.tileH + P.gap;
    const el = f.spinTotal - f.spinLeft;
    const w = weakspot(foe);
    const weakTile = w >= 0 && foe.parts[w].zone ? `t_${foe.parts[w].zone}` : '';
    const prep = c.phase === 'prep';
    const rowsLive = prep ? [0, 1, 2] : f.plan.map((a) => a.row);
    for (const reel of REELS) {
      const x = P.reelX[reel];
      const spinning = f.spinLeft > 0 && el < reelLandTime(f, reel);
      g.save();
      g.beginPath();
      g.rect(x - 3, P.reelY - 3, P.tileW + 6, h * 3 + 4);
      g.clip();
      this.rr({ x: x - 3, y: P.reelY - 3, w: P.tileW + 6, h: h * 3 + 4 }, 6, 'rgba(0,0,0,0.35)');
      const strip = f.strips[reel];
      const n = strip.length;
      if (spinning) {
        const scroll = el * tune.feel.reelScrollSpeed;
        const base = Math.floor(scroll);
        const frac = scroll - base;
        for (let row = -1; row < 3; row++) {
          const t = strip[(((f.reelPos[reel] - base + row) % n) + n) % n];
          this.tile({ x, y: P.reelY + (row + frac) * h - 3, w: P.tileW, h: P.tileH + 6 }, t.id, { dim: true, label: true, broken: t.broken, alpha: 0.7 });
        }
      } else {
        const age = this.landAge.player[reel];
        const t = Math.min(1, age / tune.feel.reelLandSec);
        const bounce = age < tune.feel.reelLandSec ? Math.sin(t * Math.PI) * (1 - t) * tune.feel.reelOvershoot * h : 0;
        const off = bounce + this.nudgeOff[reel];
        // Rows -1 and 3 only show while a nudge slides the reel.
        const rows = Math.abs(this.nudgeOff[reel]) > 0.5 ? [-1, 0, 1, 2, 3] : [0, 1, 2];
        for (const row of rows) {
          const st = strip[(((f.reelPos[reel] + row - 1) % n) + n) % n];
          const glow = reel === 1 && st.id === weakTile && !st.broken ? `rgba(255,120,90,${0.6 + 0.4 * Math.sin(this.time * 8)})` : undefined;
          const dim = !rowsLive.includes(row) || (!prep && f.plan.find((a) => a.row === row)?.done === true);
          this.tile({ x, y: P.reelY + row * h + off, w: P.tileW, h: P.tileH }, st.id, { dim, label: true, broken: st.broken, glow, alpha: dim && !prep ? 0.45 : 1 });
        }
      }
      g.restore();
      // Nudge arrows above each reel: left half moves tiles up, right half down.
      const hr = this.nudgeRect(reel);
      const can = prep && f.spinLeft <= 0 && this.gold >= nudgeCost(f);
      const arrow = can ? '#ffe08a' : 'rgba(255,255,255,0.3)';
      this.rr(hr, 5, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.18)', 1);
      if (prep) {
        this.rr({ x: hr.x + 1, y: hr.y + 1, w: 26, h: hr.h - 2 }, 4, can ? 'rgba(232,193,90,0.25)' : 'rgba(0,0,0,0)');
        this.rr({ x: hr.x + hr.w - 27, y: hr.y + 1, w: 26, h: hr.h - 2 }, 4, can ? 'rgba(232,193,90,0.25)' : 'rgba(0,0,0,0)');
        this.text('▲', hr.x + 14, hr.y + hr.h / 2 + 1, 10, arrow, 'center', '900');
        this.text('▼', hr.x + hr.w - 14, hr.y + hr.h / 2 + 1, 10, arrow, 'center', '900');
      }
      this.text(['WHAT', 'WHERE', 'HOW'][reel], hr.x + hr.w / 2, hr.y + hr.h / 2 + 1, 9, 'rgba(255,224,138,0.8)', 'center', '800');
    }
    if (f.spinLeft > 0) return;
    // Rows: valid ones can be queued; queued ones are framed and numbered with
    // their place in the clash (both sides counted), and show their damage.
    const seq = projectedOrder(c);
    for (let row = 0; row < 3; row++) {
      const r = this.rowRect(row);
      const order = prep ? f.queued.indexOf(row) : f.plan.findIndex((a) => a.row === row);
      const place = seq.findIndex((o) => o.side === 'player' && o.row === row);
      const valid = rowValid(f, row);
      if (order >= 0) {
        const done = !prep && f.plan[order]?.done;
        const pulse = 0.7 + 0.3 * Math.sin(this.time * 6);
        this.rr(r, 9, 'rgba(0,0,0,0)', done ? 'rgba(255,255,255,0.25)' : `rgba(255,224,138,${pulse})`, 3);
        this.rr({ x: r.x - 9, y: r.y + r.h / 2 - 9, w: 18, h: 18 }, 9, done ? '#6b6278' : '#e8c15a');
        this.text(done ? '✓' : String(place + 1), r.x, r.y + r.h / 2 + 1, 11, '#1a1424', 'center', '900');
      }
      if (prep && valid) {
        const pv = previewRow(c, 'player', row);
        if (pv) {
          const bx = r.x + r.w - 40;
          this.rr({ x: bx, y: r.y + 4, w: 38, h: 15 }, 5, 'rgba(10,8,18,0.85)');
          this.text(`${pv.hit.damage}${pv.tier >= 3 ? '!' : ''}`, bx + 19, r.y + 12, 10, pv.hit.weak || pv.tier ? '#ffe24a' : '#ffe8d0', 'center', '900');
        }
      } else if (prep && !valid) {
        this.text('no action', r.x + r.w / 2, r.y + r.h - 6, 8, 'rgba(255,255,255,0.45)', 'center', '700');
      }
    }
  }

  private drawPocket(c: Combat, f: Fighter, side: Side, aimPart = -1) {
    const groups = pocketGroups(f);
    const n = f.pocketSize;
    const cap = tune.pocket.stackCap;
    for (let i = 0; i < n; i++) this.rr(this.slotRect(side, i, n), side === 'player' ? 7 : 4, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.13)', 1);
    groups.forEach((g, i) => {
      const slot = this.slotRect(side, i, n);
      // Stacks ease towards their sorted slot, so re-ordering reads as a slide.
      const key = `${side}:${g.id}`;
      const x0 = this.slotX.get(key) ?? slot.x;
      const x = x0 + (slot.x - x0) * Math.min(1, this.frameDt * 14);
      this.slotX.set(key, x);
      const tiles = f.pocket.filter((t) => t.id === g.id);
      const shown = tiles.filter((t) => !this.hidden.has(t)).length;
      if (shown <= 0) return;
      const full = shown >= cap && isMove(g.id);
      let badge: string | undefined;
      if (side === 'player' && c.phase === 'prep') {
        const b = previewBurn(c, 'player', g.id);
        if (b?.sabotage) badge = b.sabotage.breaks ? 'BRK' : `-${b.sabotage.toPart}`;
        else if (b?.chip) badge = String(b.chip.damage);
        else if (g.id === 'power') badge = `+${Math.round(tune.combat.powerBurnBonus[Math.min(3, g.count)] * 100)}%`;
        else if (g.id === 'quick') badge = '1st';
      }
      this.tile({ x, y: slot.y, w: slot.w, h: slot.h }, g.id, { glow: full ? 'rgba(255,226,74,0.9)' : undefined, badge });
      this.rr({ x: x + 2, y: slot.y + 2, w: 18, h: 11 }, 4, 'rgba(10,8,18,0.8)');
      this.text(`x${shown}`, x + 11, slot.y + 8, 8.5, shown >= cap ? '#ffe24a' : '#fff', 'center', '900');
      const risk = aimPart >= 0 ? tiles.filter((t) => t.part === aimPart).length : 0;
      if (risk) this.rr({ x: x - 2, y: slot.y - 2, w: slot.w + 4, h: slot.h + 4 }, 6, 'rgba(0,0,0,0)', `rgba(120,230,255,${0.6 + 0.4 * Math.sin(this.time * 12)})`, 2);
    });
  }

  /** Enemy plan as action chips, with damage on the player; lit as they fire. */
  private drawEnemyPlan(c: Combat, e: Fighter) {
    const p = c.fighters.player;
    const prep = c.phase === 'prep';
    const rows = prep ? e.queued.map((row) => ({ row, done: false })) : e.plan.map((a) => ({ row: a.row, done: a.done }));
    const seq = projectedOrder(c);
    this.text(prep ? 'ENEMY PLAN' : `ROUND ${c.round} CLASH`, 16, 58, 10, '#ff9a8a', 'left', '900');
    if (e.spinLeft > 0 && prep) {
      this.text('spinning...', 110, 58, 10, '#a89fbc', 'left', '700');
      return;
    }
    const w = (358 - 2 * 6) / 3;
    rows.forEach(({ row, done }, i) => {
      const r = { x: 16 + i * (w + 6), y: 64, w, h: 56 };
      // Raw reel tiles, so an action whose part has broken still shows (and fizzles).
      const win = (reel: 0 | 1 | 2) => reelWindow(e, reel)[row];
      const tiles = prep ? { move: win(0).id, target: win(1).id, mut: win(2).id, part: win(0).part } : e.plan[i];
      const src = tiles.part !== undefined ? e.parts[tiles.part] : undefined;
      const fizzles = !!src?.broken;
      // Can the player's stash break the part behind this action right now?
      const zone = src?.zone;
      const sab = prep && zone && !fizzles ? previewBurn(c, 'player', `t_${zone}` as TileId)?.sabotage : null;
      const breakable = !!sab?.breaks && pocketGroups(p).some((g) => g.id === `t_${zone}`);
      const dim = done || fizzles;
      const edge = breakable ? `rgba(120,230,255,${0.6 + 0.4 * Math.sin(this.time * 8)})` : dim ? 'rgba(255,255,255,0.12)' : 'rgba(255,154,138,0.6)';
      this.rr(r, 8, dim ? 'rgba(255,255,255,0.04)' : 'rgba(255,154,138,0.12)', edge, breakable ? 2 : 1);
      if (isMove(tiles.move)) this.tile({ x: r.x + 4, y: r.y + 5, w: 30, h: 30 }, tiles.move, { alpha: dim ? 0.4 : 1 });
      const zoneLabel = isTarget(tiles.target) ? ZONE_LABEL[zoneOf(tiles.target)] : '-';
      this.text(`> ${zoneLabel}`, r.x + 38, r.y + 12, 10, dim ? '#6b6278' : '#fff', 'left', '800');
      const place = seq.findIndex((o) => o.side === 'enemy' && o.row === row);
      if (fizzles) this.text('FIZZLES', r.x + 38, r.y + 29, 11, '#9ff0ff', 'left', '900');
      else if (prep) {
        const pv = previewRow(c, 'enemy', row);
        if (pv) this.text(`${pv.hit.damage} dmg`, r.x + 38, r.y + 29, 11, pv.hit.weak ? '#ffb36b' : '#ffe8d0', 'left', '900');
      } else this.text(done ? 'done' : 'next', r.x + 38, r.y + 29, 10, '#a89fbc', 'left', '700');
      // Clash order badge (both sides counted).
      if (!done && place >= 0) {
        this.rr({ x: r.x + r.w - 20, y: r.y + 3, w: 17, h: 15 }, 7, '#ff9a8a');
        this.text(String(place + 1), r.x + r.w - 11.5, r.y + 11, 10, '#1a1424', 'center', '900');
      }
      if (tiles.mut !== 'blank' && !dim) this.tile({ x: r.x + r.w - 19, y: r.y + 21, w: 15, h: 15 }, tiles.mut, {});
      // Where the move comes from: break that part and the action fizzles.
      const from = src ? `${src.zone ? ZONE_LABEL[src.zone] : 'Body'} ${Math.max(0, Math.ceil(src.hp))}/${src.maxHp}` : 'innate';
      const tag = breakable ? `${from} · BREAK IT` : src?.slot === 'body' ? `${from} (core)` : `from ${from}`;
      this.text(tag, r.x + 5, r.y + 47, 8.5, breakable ? '#9ff0ff' : '#a89fbc', 'left', '800');
    });
    if (!rows.length) this.text('no actions this round', 16, 84, 11, '#a89fbc', 'left', '700');
    void p;
  }

  private drawFight(c: Combat, frozen = false) {
    const e = c.fighters.enemy;
    const p = c.fighters.player;
    this.bars(e, L.enemy.hpY);
    this.drawEnemyPlan(c, e);
    this.text(`Foe stash ${pocketGroups(e).length}/${e.pocketSize}`, L.enemy.pocketX, L.enemy.pocketY - 7, 9, '#cfc7d9');
    this.drawPocket(c, e, 'enemy');
    const w = weakspot(e);
    const broken = e.parts.filter((pt) => pt.broken).length;
    this.text(`Weak: ${w >= 0 ? PARTS[e.parts[w].id].name : '-'}   Armour: ${e.armour}${broken ? `   ${broken} broken` : ''}`, 16, 177, 10, '#ff9a8a', 'left', '700');

    this.bars(p, L.player.hpY);
    const prep = c.phase === 'prep';
    const lead = p.initiative > e.initiative ? ' · Initiative' : '';
    const status = prep ? `Round ${c.round} · Actions ${p.queued.length}/${actionSlots(p)}${lead}` : `Round ${c.round} · Clash!`;
    this.text(status, 16, 519, 11, '#ffe08a', 'left', '800');
    this.drawGrid(c, p, e);
    this.text(`Stash ${pocketGroups(p).length}/${p.pocketSize} · stacks of ${tune.pocket.stackCap}`, 16, L.player.pocketY - 9, 10, '#cfc7d9', 'left', '700');
    if (prep && p.pocket.length) this.text('tap stack = burn', 374, L.player.pocketY - 9, 10, '#e8c15a', 'right', '700');
    this.drawPocket(c, p, 'player');
    if (!frozen) {
      this.drawButtons(c, p);
      if (prep) {
        const y = L.yield;
        this.rr(y, 6, this.yieldArmed > 0 ? '#e2574c' : 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.2)', 1);
        this.text(this.yieldArmed > 0 ? 'SURE?' : 'Yield', y.x + y.w / 2, y.y + y.h / 2 + 1, 10, '#fff', 'center', '700');
      }
    }
  }

  private button(r: Rect, key: string, fill: string, live: boolean) {
    const g = this.g;
    const s = 1 - (this.press[key] ?? 0) * 0.6;
    g.save();
    g.translate(r.x + r.w / 2, r.y + r.h / 2);
    g.scale(s, s);
    const rr = { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h };
    const rad = Math.min(16, r.h / 3);
    this.rr({ ...rr, y: rr.y + 4 }, rad, 'rgba(0,0,0,0.4)');
    this.rr(rr, rad, fill);
    if (live) {
      const grad = g.createLinearGradient(0, rr.y, 0, rr.y + rr.h);
      grad.addColorStop(0, 'rgba(255,255,255,0.3)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0)');
      this.rr(rr, rad, grad);
      const sweep = ((this.time * 0.8) % 1.6) - 0.3;
      g.save();
      g.beginPath();
      g.roundRect(rr.x, rr.y, rr.w, rr.h, rad);
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

  /** Gold available for re-spins, set by main each frame. */
  gold = 0;

  private drawButtons(c: Combat, f: Fighter) {
    const sp = L.execute;
    const fi = L.pocket;
    if (c.phase !== 'prep') {
      this.button({ x: sp.x, y: sp.y, w: fi.x + fi.w - sp.x, h: sp.h }, 'clash', '#3a2f3f', false);
      this.text('CLASH!', 195, sp.y + 30, 22, '#ffe08a', 'center', '900');
      this.text('watch the plans play out', 195, sp.y + 54, 11, 'rgba(255,255,255,0.55)', 'center', '700');
      return;
    }
    const busy = f.spinLeft > 0;
    const cost = spinCost(f);
    const canSpin = !busy && this.gold >= cost;
    this.button(sp, 'spin', canSpin ? '#4b7fd4' : '#2e3348', canSpin);
    this.text('RE-SPIN', sp.x + sp.w / 2, sp.y + 22, 16, canSpin ? '#fff' : 'rgba(255,255,255,0.4)', 'center', '900');
    this.text(`${cost} gold  (have ${this.gold})`, sp.x + sp.w / 2, sp.y + 44, 11, canSpin ? '#ffe08a' : 'rgba(255,255,255,0.4)', 'center', '800');
    const nudgeText = f.freeNudges > 0 ? `${f.freeNudges} free nudge${f.freeNudges > 1 ? 's' : ''} ▲▼` : `nudge ▲▼ ${tune.prep.nudgeCost} gold`;
    this.text(nudgeText, sp.x + sp.w / 2, sp.y + 60, 10, f.freeNudges > 0 ? '#9ff0ff' : 'rgba(255,255,255,0.75)', 'center', '700');
    const ready = !busy && f.queued.length > 0;
    this.button(fi, 'fight', ready ? '#d4554b' : '#3a2f3f', ready);
    this.text('FIGHT!', fi.x + fi.w / 2, fi.y + 22, 18, ready ? '#fff' : 'rgba(255,255,255,0.4)', 'center', '900');
    this.text(`${f.queued.length}/${actionSlots(f)} actions`, fi.x + fi.w / 2, fi.y + 44, 11, '#fff', 'center', '800');
    const stashN = unqueuedTiles(f).length;
    if (stashN) this.text(`stash ${stashN} tiles`, fi.x + fi.w / 2, fi.y + 60, 10, 'rgba(255,255,255,0.75)', 'center', '700');
  }

  private drawFlies() {
    for (const fl of this.flies) {
      if (fl.age < 0) continue;
      const t = Math.min(1, fl.age / fl.dur);
      const e = fl.drop ? t : 1 - Math.pow(1 - t, 3);
      const x = fl.x0 + (fl.x1 - fl.x0) * e;
      const y = fl.y0 + (fl.y1 - fl.y0) * e + (fl.drop ? 0 : Math.sin(t * Math.PI) * fl.arc);
      const scale = fl.drop ? 1 - t * 0.4 : 1 + Math.sin(t * Math.PI) * 0.25;
      this.tile({ x: x - fl.w / 2, y: y - fl.h / 2, w: fl.w, h: fl.h }, fl.id, { scale, alpha: fl.drop ? 1 - t : 1 });
    }
  }

  private drawSparks() {
    const g = this.g;
    for (const s of this.sparks) {
      g.globalAlpha = 1 - s.age / s.life;
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, s.size * (1 - (s.age / s.life) * 0.5), 0, Math.PI * 2);
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
    this.text(label, 195, r.y + (sub ? 36 : r.h / 2), 22, '#1a1424', 'center', '900');
    if (sub) this.text(sub, 195, r.y + 64, 13, 'rgba(26,20,36,0.8)', 'center', '700');
  }

  private rarityName(id: PartId) {
    return RARITY_COL[PARTS[id].rarity] ?? '#cfc7d9';
  }

  private drawSelect(run: Run) {
    this.outlined('WOW! REEL CHIMERAS!', 195, 48, 26, '#ffe08a');
    this.text('Pick a starter chimera', 195, 86, 14, '#cfc7d9', 'center', '700');
    if (run.bestStreak) this.text(`Best streak: ${run.bestStreak}`, 195, 108, 12, '#ffe08a', 'center', '700');
    this.text('WHAT hits WHERE, HOW. Execute fires the middle row.', 195, 140, 11, '#a89fbc', 'center');
    this.text('Pocket saves the rest. Duplicates power you up.', 195, 158, 11, '#a89fbc', 'center');
    const opts = starterOptions(run);
    opts.forEach((s, i) => {
      const r = this.choiceRect(i, opts.length);
      const sel = i === this.selectIndex;
      const random = i === STARTERS.length;
      this.rr(r, 10, sel ? 'rgba(255,224,138,0.16)' : 'rgba(255,255,255,0.05)', sel ? '#ffe08a' : 'rgba(255,255,255,0.15)', sel ? 2.5 : 1);
      this.rr({ x: r.x + 6, y: r.y + 8, w: 14, h: 14 }, 7, s.palette.body);
      this.rr({ x: r.x + 15, y: r.y + 8, w: 9, h: 9 }, 5, s.palette.part);
      this.text(random ? 'Random' : s.name, r.x + 28, r.y + 16, 11, '#fff', 'left', '800');
      partNames(s).forEach((n, k) => this.text(n.replace(' body', '').replace(' head', '').replace(' legs', ''), r.x + 6, r.y + 40 + k * 17, 9.5, this.rarityName(s.build[SLOTS[k]])));
      this.text(`Soul: ${SOULS[s.soul].name}`, r.x + 6, r.y + 148, 8.5, SOULS[s.soul].color, 'left', '900');
      if (random) this.text(sel ? 'tap again to re-roll' : 'random parts', r.x + r.w / 2, r.y + r.h - 12, 9, '#ffe08a', 'center', '700');
    });
    const chosen = opts[this.selectIndex];
    this.bigButton(`CHOOSE ${(this.selectIndex === STARTERS.length ? 'RANDOM' : chosen.name).toUpperCase()}`, '');
  }

  private drawPrefight(run: Run) {
    const e = run.enemy!;
    this.text(`FLOOR ${run.floor}`, 16, 26, 13, '#ffe08a', 'left', '900');
    this.outlined(e.name, 195, 58, 24, '#ff9a8a');
    SLOTS.forEach((slot, k) => this.text(PARTS[e.build[slot]].name, k % 2 ? 210 : 40, 92 + Math.floor(k / 2) * 18, 11, this.rarityName(e.build[slot])));
    this.text('Enemy', 374, 26, 11, '#8a82a0', 'right');
    const m = run.monster!;
    this.text(m.name, 16, 494, 16, '#fff', 'left', '900');
    this.text(`Level ${run.level}   Soul: ${SOULS[m.soul].name}`, 16, 516, 12, '#ffe08a', 'left', '800');
    const stats: [string, string][] = [
      ['Gold', `${run.gold}`], ['Entry bet', `${entryBet(run)}`], ['Win pays', `${Math.round(entryBet(run) * tune.run.payoutMult)}`], ['Streak', `${run.streak}`],
    ];
    stats.forEach(([k, v], i) => {
      const x = 16 + (i % 2) * 180;
      const y = 552 + Math.floor(i / 2) * 44;
      this.text(k, x, y, 11, '#a89fbc');
      this.text(v, x, y + 18, 20, i === 0 ? '#ffd24a' : '#fff', 'left', '900');
    });
    if (m.extra.length) this.text(`Bonus tiles: ${m.extra.map(tileLabel).join(', ')}`, 16, 660, 11, '#cfc7d9');
    this.text('Losing to the final hit loses the monster. Yield to keep it.', 16, 700, 10.5, '#ff9a8a');
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
    const rc = RARITY_COL[def.rarity];
    this.rr(r, 12, 'rgba(255,255,255,0.06)', rc ?? accent, rc ? 2.5 : 1.5);
    this.text(title, r.x + r.w / 2, r.y + 16, 11, accent, 'center', '800');
    this.text(def.name, r.x + r.w / 2, r.y + 38, 15, '#fff', 'center', '900');
    this.text(def.rarity.toUpperCase(), r.x + r.w / 2, r.y + 56, 9, rc ?? '#8a82a0', 'center', '800');
    this.partStats(id, r.x + r.w / 2, r.y + 74, 'center');
    const tiles = [...def.moves, ...def.mutators];
    tiles.slice(0, 6).forEach((t, i) => {
      const tw = (r.w - 24) / 3;
      this.tile({ x: r.x + 8 + (i % 3) * (tw + 4), y: r.y + 156 + Math.floor(i / 3) * 28, w: tw, h: 24 }, t, {});
    });
  }

  private partStats(id: PartId, x: number, y: number, align: CanvasTextAlign) {
    const st = tune.parts.stats[id] as Record<string, number>;
    const bits = (['hp', 'speed', 'atk', 'def', 'weak', 'shield', 'pocket'] as const)
      .filter((k) => st[k])
      .map((k) => `${k.toUpperCase()} ${st[k] > 0 ? '+' : ''}${st[k]}`);
    if (PARTS[id].flight) bits.push('FLIGHT');
    bits.forEach((b, i) => this.text(b, x, y + i * 12, 9.5, '#cfc7d9', align));
  }

  private drawLoot(run: Run) {
    const drop = run.drop!;
    const slot = PARTS[drop].slot;
    const current = run.monster!.build[slot];
    this.outlined('PART DROPPED!', 195, 56, 28, '#ffb36b');
    this.text(`The enemy left its ${PARTS[drop].name}.`, 195, 96, 13, '#cfc7d9', 'center', '700');
    this.text(`Swap it into your ${slot} slot, or keep yours.`, 195, 118, 12, '#a89fbc', 'center');
    this.partCard(this.lootRect(0), drop, 'TAKE NEW', '#ffb36b');
    this.partCard(this.lootRect(1), current, 'KEEP CURRENT', 'rgba(255,255,255,0.4)');
  }

  private drawLevelUp(run: Run) {
    this.outlined(`LEVEL ${run.level}!`, 195, 56, 30, '#ffe08a');
    this.text('Pick one tile to add to your reels', 195, 96, 13, '#cfc7d9', 'center', '700');
    this.text(`Gold ${run.gold}   Streak ${run.streak}`, 195, 120, 12, '#ffd24a', 'center', '700');
    run.offers.forEach((id, i) => {
      const r = this.choiceRect(i, run.offers.length);
      const bob = Math.sin(this.time * 3 + i) * 3;
      const rc = RARITY_COL[tileRarity(id)];
      this.rr(r, 12, 'rgba(255,255,255,0.06)', rc ?? 'rgba(255,224,138,0.5)', rc ? 2.5 : 1.5);
      this.tile({ x: r.x + 12, y: r.y + 18 + bob, w: r.w - 24, h: 54 }, id, { label: true });
      this.text(tileRarity(id).toUpperCase(), r.x + r.w / 2, r.y + 88, 9, rc ?? '#8a82a0', 'center', '800');
      this.text(isMove(id) ? 'Move reel' : 'Mutator reel', r.x + r.w / 2, r.y + 104, 10, '#ffe08a', 'center', '700');
      const words = describe(id).split(' ');
      let line = '';
      let row = 0;
      for (const w of words) {
        if ((line + ' ' + w).length > 16) {
          this.text(line, r.x + r.w / 2, r.y + 124 + row * 15, 10, '#cfc7d9', 'center');
          line = w;
          row++;
        } else line = line ? `${line} ${w}` : w;
      }
      if (line) this.text(line, r.x + r.w / 2, r.y + 124 + row * 15, 10, '#cfc7d9', 'center');
    });
  }

  private drawGameOver(run: Run) {
    this.outlined('RUN OVER', 195, 60, 34, '#ff8a7a');
    this.text(run.gameOverReason, 195, 104, 12, '#cfc7d9', 'center', '700');
    this.text(`Reached floor ${run.floor}   Best streak ${run.bestStreak}`, 195, 130, 13, '#ffe08a', 'center', '800');
    this.bigButton('NEW RUN', '');
  }

  private static readonly LOG_LINES = 15;

  logPages(c: Combat) {
    return Math.max(1, Math.ceil(c.log.length / Hud.LOG_LINES));
  }

  private logAction(e: LogEntry): string {
    const name = tileLabel(e.tile) || 'Whiff';
    let a = e.kind === 'burn' ? `Burn ${name} x${e.count}` : e.tier >= 3 ? `SUPER ${name}` : `${name}${'+'.repeat(e.tier)}`;
    if (e.zone) a += ` > ${ZONE_LABEL[e.zone]}`;
    if (e.kind === 'execute' && e.mut !== 'blank') a += ` + ${tileLabel(e.mut)}${e.mutStack > 1 ? ` x${e.mutStack}` : ''}`;
    return a;
  }

  private logOutcome(e: LogEntry): string {
    const bits: string[] = [];
    if (e.miss) bits.push(e.miss === 'fizzled' ? 'FIZZLED, its part was broken' : e.miss === 'whiff' ? 'whiff, no attack' : 'missed, no target');
    if (e.partOnly) bits.push(`sabotage ${e.damage - e.shielded} part dmg${e.shielded ? ` (${e.shielded} to shield)` : ''}`);
    else if (e.damage) {
      bits.push(`${e.damage} dmg${e.shielded ? ` (${e.shielded} to shield)` : ''}`);
      if (e.weak) bits.push('weak spot');
      if (e.resist > 1.05) bits.push('effective');
      if (e.resist < 0.95) bits.push('resisted');
    }
    if (e.broke) bits.push(`${e.broke} BROKEN`);
    if (e.knockedOut) bits.push('knocked out a tile');
    if (e.shieldGain) bits.push(`+${e.shieldGain} shield`);
    const quicks = e.kind === 'burn' ? (e.tile === 'quick' ? e.count : 0) : e.mut === 'quick' ? e.mutStack : 0;
    if (quicks) bits.push(e.kind === 'burn' ? 'initiative: acts sooner this round' : ['next action sooner', 'next action much sooner', 'next action instant'][Math.min(3, quicks) - 1]);
    if (e.kind === 'burn' && e.tile === 'power') bits.push(`+${Math.round(tune.combat.powerBurnBonus[Math.min(3, e.count)] * 100)}% on the first action`);
    if (e.boost) bits.push(`boosted +${Math.round(e.boost * 100)}%`);
    return bits.join(', ') || 'no effect';
  }

  private drawLog(c: Combat) {
    const g = this.g;
    g.fillStyle = 'rgba(10,8,16,0.96)';
    g.fillRect(-10, -10, WIDTH + 20, HEIGHT + 20);
    this.outlined('BATTLE LOG', 195, 34, 24, '#ffe08a');
    const sum = (side: Side) => c.log.filter((e) => e.side === side).reduce((s, e) => s + e.damage, 0);
    const breaks = (side: Side) => c.log.filter((e) => e.side === side && e.broke).length;
    const supers = (side: Side) => c.log.filter((e) => e.side === side && e.kind === 'execute' && e.tier >= 3).length;
    this.text(`${c.time.toFixed(0)}s   ${c.log.length} actions`, 195, 62, 11, '#a89fbc', 'center', '700');
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const line = (side: Side) => `${sum(side)} dmg  ${plural(breaks(side), 'break')}  ${plural(supers(side), 'super')}`;
    this.text(`YOU  ${line('player')}`, 16, 86, 11, '#7be3a4', 'left', '800');
    this.text(`FOE  ${line('enemy')}`, 16, 104, 11, '#ff9a8a', 'left', '800');
    const pages = this.logPages(c);
    this.logPage = Math.min(this.logPage, pages - 1);
    const start = this.logPage * Hud.LOG_LINES;
    c.log.slice(start, start + Hud.LOG_LINES).forEach((e, i) => {
      const y = 126 + i * 40;
      const you = e.side === 'player';
      this.rr({ x: 12, y, w: 366, h: 36 }, 6, you ? 'rgba(123,227,164,0.07)' : 'rgba(255,154,138,0.07)');
      this.text(`${e.t.toFixed(1)}s`, 18, y + 11, 9, '#8a82a0', 'left', '700');
      this.text(you ? 'YOU' : 'FOE', 18, y + 25, 9, you ? '#7be3a4' : '#ff9a8a', 'left', '900');
      if (e.tile !== 'blank') this.tile({ x: 52, y: y + 4, w: 28, h: 28 }, e.tile, {});
      this.text(this.logAction(e), 88, y + 11, 11, e.tier >= 3 ? '#ffe24a' : '#fff', 'left', '800');
      const outcome = this.logOutcome(e);
      this.text(outcome, 88, y + 26, outcome.length > 50 ? 8 : 9.5, e.broke ? '#ffb36b' : '#cfc7d9', 'left', '600');
    });
    if (!c.log.length) this.text('No actions this fight.', 195, 200, 12, '#a89fbc', 'center');
    const b = this.logButtons();
    this.button(b.prev, 'prev', this.logPage > 0 ? '#e8c15a' : '#3a3530', false);
    this.button(b.close, 'close', 'rgba(255,224,138,0.85)', false);
    this.button(b.next, 'next', this.logPage < pages - 1 ? '#e8c15a' : '#3a3530', false);
    this.text('< Prev', b.prev.x + b.prev.w / 2, b.prev.y + 30, 14, '#1a1424', 'center', '900');
    this.text(`Close  ${this.logPage + 1}/${pages}`, b.close.x + b.close.w / 2, b.close.y + 30, 14, '#1a1424', 'center', '900');
    this.text('Next >', b.next.x + b.next.w / 2, b.next.y + 30, 14, '#1a1424', 'center', '900');
  }

  /** Which monster the parts viewer shows on this screen. */
  viewerSpec(run: Run): MonsterSpec | null {
    if (run.screen === 'select') return starterOptions(run)[this.selectIndex];
    return run.monster;
  }

  private drawViewer(run: Run) {
    const spec = this.viewerSpec(run);
    if (!spec) return;
    this.outlined(spec.name, 195, 48, 26, '#ffe08a');
    this.text('Parts viewer: tap a part to inspect it', 195, 86, 12, '#cfc7d9', 'center', '700');
    const soul = tune.souls[spec.soul] as Record<string, number>;
    let hp = soul.hp;
    let spd = soul.speed;
    for (const s of SLOTS) {
      const st = tune.parts.stats[spec.build[s]] as Record<string, number>;
      hp += st.hp ?? 0;
      spd += st.speed ?? 0;
    }
    this.text(`HP ${hp}   SPEED ${spd.toFixed(2)}`, 195, 112, 12, '#ffe08a', 'center', '800');
    SLOTS.forEach((slot, i) => {
      const r = this.viewerRow(i);
      const id = spec.build[slot];
      const sel = i === this.viewerSlot;
      this.rr(r, 8, sel ? 'rgba(255,224,138,0.18)' : 'rgba(255,255,255,0.05)', sel ? '#ffe08a' : this.rarityName(id), sel ? 2 : 1);
      this.text(slot.toUpperCase(), r.x + 8, r.y + 10, 8, '#8a82a0', 'left', '800');
      this.text(PARTS[id].name, r.x + 8, r.y + 20, 11, this.rarityName(id), 'left', '800');
    });
    // The Soul: a fixed 7th row.
    const sr = this.viewerRow(SLOTS.length);
    const sd = SOULS[spec.soul];
    const soulSel = this.viewerSlot === SLOTS.length;
    this.rr(sr, 8, soulSel ? 'rgba(255,224,138,0.18)' : 'rgba(255,255,255,0.05)', soulSel ? '#ffe08a' : sd.color, soulSel ? 2 : 1.5);
    this.text('SOUL', sr.x + 8, sr.y + 9, 8, '#8a82a0', 'left', '800');
    this.text(sd.name, sr.x + 8, sr.y + 20, 11, sd.color, 'left', '900');
    if (soulSel) {
      const x = 180;
      this.text(`${sd.name} soul`, x, 528, 15, sd.color, 'left', '900');
      this.text('FIXED: cannot be hit, broken or swapped', x, 548, 9.5, '#8a82a0', 'left', '800');
      const words = sd.ability.split(' ');
      let line = '';
      let row = 0;
      for (const w of words) {
        if ((line + ' ' + w).length > 30) {
          this.text(line, x, 570 + row * 14, 10, '#fff', 'left', '700');
          line = w;
          row++;
        } else line = line ? `${line} ${w}` : w;
      }
      if (line) this.text(line, x, 570 + row * 14, 10, '#fff', 'left', '700');
      const bits = (['hp', 'atk', 'def', 'speed', 'shield', 'pocket'] as const).filter((k) => soul[k]).map((k) => `${k.toUpperCase()} +${soul[k]}`);
      bits.forEach((b, i) => this.text(b, x, 630 + i * 13, 9.5, '#cfc7d9', 'left'));
      this.bigButton('CLOSE', '', 'rgba(255,224,138,0.85)');
      return;
    }
    const id = spec.build[SLOTS[this.viewerSlot]];
    const def = PARTS[id];
    const x = 180;
    this.text(def.name, x, 528, 15, '#fff', 'left', '900');
    this.text(`${def.rarity.toUpperCase()}${SLOT_ZONE[def.slot] ? `  hit zone: ${ZONE_LABEL[SLOT_ZONE[def.slot]!]}` : '  armour'}`, x, 548, 9.5, RARITY_COL[def.rarity] ?? '#8a82a0', 'left', '800');
    this.partStats(id, x, 568, 'left');
    const tiles = [...def.moves, ...def.mutators];
    tiles.slice(0, 6).forEach((t, i) => this.tile({ x: x + (i % 3) * 64, y: 656 + Math.floor(i / 3) * 34, w: 60, h: 30 }, t, { label: false }));
    if (!tiles.length) this.text('No reel tiles', x, 670, 10, '#8a82a0');
    this.bigButton('CLOSE', '', 'rgba(255,224,138,0.85)');
  }
}

