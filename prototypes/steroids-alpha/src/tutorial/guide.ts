// Tutorial planet script (owner, 16 November 2026). Step by step, each skill repeated until it
// sticks; a step completes only when the pilot has actually done it. Hints sit at the top of the
// screen and never block play (house rule: never block the player). The room runs in the page
// (localServer.ts), so the script reads and arranges the world directly.
import type Phaser from 'phaser';
import type { ShipState } from '../../sim/ship';
import { topSpeed } from '../../sim/ship';
import { TUNE } from '../../sim/tune';
import { wrap, wrapDelta } from '../../sim/wrap';
import { intents } from '../input/intents';
import { text } from '../scenes/common';
import { panel, UI } from '../render/ui';
import { tutorialRoom } from './localServer';
import { DEBUG } from '../base';

const W = TUNE.world.width, H = TUNE.world.height;

export interface GuideView {
  myId: number;
  predicted: ShipState | null;
  g: Phaser.GameObjects.Graphics;
  w: number;
  h: number;
  toScreen: (x: number, y: number) => { x: number; y: number; scale: number; visible: boolean };
}

type Point = { x: number; y: number };

interface Step {
  title: string;
  /** Instructions for the current control scheme. */
  body: () => string;
  /** Times to repeat (shown as a counter); 0 for none. */
  need: number;
  /** Read-only step: a GOT IT button moves on. */
  info?: boolean;
  enter?: () => void;
  update: (v: GuideView, ship: ShipState) => void;
  draw?: (v: GuideView, ship: ShipState) => void;
}

/** The keys or buttons for each action, in the scheme the pilot uses. */
function keys(): Record<string, string> {
  if (intents.touch) return { steer: 'Drag on the left half of the screen toward where you want to go', fast: 'drag further out', slow: 'let go', fire: 'Hold FIRE', dash: 'Tap DASH', missile: 'Tap MISSILE', mine: 'Tap MINE', buy: 'Open UPGRADES and tap one', warp: 'Tap WARP', evolve: 'EVOLVE in UPGRADES' };
  if (intents.scheme === 'marker') return { steer: 'Move the mouse: the ship turns toward the cursor', fast: 'hold W', slow: 'hold S (or let go of W)', fire: 'Hold LEFT CLICK', dash: 'Press SHIFT', missile: 'RIGHT CLICK (or Q)', mine: 'Press E', buy: 'Press 4 and 5 (or click them in the list)', warp: 'Press R', evolve: 'key 6 / EVOLVE in the list' };
  return { steer: 'A / D turn the ship', fast: 'hold W', slow: 'hold S', fire: 'Hold SPACE', dash: 'Press SHIFT', missile: 'Press Q', mine: 'Press E', buy: 'Press 4 and 5 (or click them in the list)', warp: 'Press R', evolve: 'key 6 / EVOLVE in the list' };
}

const ahead = (s: ShipState, d: number, turn = 0): Point => ({ x: wrap(s.x + Math.cos(s.heading + turn) * d, W), y: wrap(s.y + Math.sin(s.heading + turn) * d, H) });
const dist = (a: Point, b: Point): number => Math.hypot(wrapDelta(a.x, b.x, W), wrapDelta(a.y, b.y, H));

export class TutorialGuide {
  private step = 0;
  private count = 0;
  private enteredFor = -1;
  private done = false;
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Text;
  private buttonZone: { x: number; y: number; hw: number; hh: number } | null = null;
  // Per-step state.
  private target: Point | null = null;
  private ids: number[] = [];
  private seen = new Set<number>();
  private last = new Map<number, Point>();
  private flag = false;
  private base = 0;
  private fireAt = 0;
  private turretAt: Point | null = null;
  private steps: Step[];

  constructor() {
    this.steps = this.build();
  }

  /** Back to the first step (a fresh visit from the menu). */
  reset(): void {
    this.step = 0;
    this.count = 0;
    this.enteredFor = -1;
    this.done = false;
  }

  get finished(): boolean {
    return this.done;
  }

  attach(scene: Phaser.Scene): void {
    this.title = text(scene, 0, 0, '', 12, '#ffd27a').setOrigin(0.5, 0).setDepth(955);
    this.body = text(scene, 0, 0, '', 11, '#dfe8ff').setOrigin(0.5, 0).setDepth(955).setAlign('center');
    this.button = text(scene, 0, 0, 'GOT IT', 12, '#ffffff').setOrigin(0.5).setDepth(956).setVisible(false);
  }

  private get room() {
    return tutorialRoom();
  }
  private get world() {
    return this.room.sim;
  }

  private next(): void {
    this.step = Math.min(this.steps.length - 1, this.step + 1);
    this.count = 0;
    this.enteredFor = -1;
  }

  private clearBots(): void {
    for (const id of this.room.tutorialBots) this.room.removeTutorialBot(id);
  }

  /** Bots of this step still alive (by id). */
  private alive(ids: number[]): number[] {
    return ids.filter((id) => (this.world.ships.get(id)?.hp ?? 0) > 0);
  }

  /** Hide the panel (death and completion screens). */
  hide(): void {
    this.title?.setVisible(false);
    this.body?.setVisible(false);
    this.button?.setVisible(false);
  }

  update(v: GuideView): void {
    const ship = this.world.ships.get(v.myId);
    const st = this.steps[this.step];
    this.title.setVisible(false);
    this.body.setVisible(false);
    this.button.setVisible(false);
    if (this.buttonZone) {
      intents.uiZones = intents.uiZones.filter((z) => z !== this.buttonZone);
      this.buttonZone = null;
    }
    if (!ship || ship.hp <= 0) return;
    // (Re)arrange the step for this ship: on entering it, and after a respawn (a new ship id).
    if (this.enteredFor !== v.myId) {
      this.enteredFor = v.myId;
      this.target = null;
      this.ids = [];
      this.seen.clear();
      this.last.clear();
      this.flag = false;
      this.turretAt = null;
      st.enter?.();
    }
    st.update(v, ship);
    // Instructions panel, top centre, below the warp button. Display only (no input taken) except
    // the GOT IT button on info steps.
    // Desktop: top centre, under the warp button. Phones: a compact panel bottom left, clear of the
    // ship, the header and the fire/dash buttons (display only, so steering drags pass through it).
    const touch = intents.touch;
    const pw = touch ? Math.min(300, v.w * 0.42) : Math.min(460, v.w - 40);
    const counter = st.need > 0 ? `   ${Math.min(this.count, st.need)} / ${st.need}` : '';
    this.title.setVisible(true).setFontSize(touch ? 10 : 12).setText(`TUTORIAL ${this.step + 1}/${this.steps.length} · ${st.title}${counter}`);
    this.body.setVisible(true).setFontSize(touch ? 9 : 11).setWordWrapWidth(pw - 20).setText(st.body());
    const ph = (touch ? 28 : 34) + this.body.height + (st.info ? 34 : 0);
    const px = touch ? 8 + pw / 2 : v.w / 2, py = touch ? v.h - ph - 8 : 84;
    this.title.setPosition(px, py + 7);
    this.body.setPosition(px, py + (touch ? 21 : 26));
    panel(v.g, px - pw / 2, py, pw, ph, UI.uiGold);
    if (st.info) {
      const by = py + ph - 20, bw = 110;
      panel(v.g, px - bw / 2, by - 13, bw, 26, UI.uiAccent, true);
      this.button.setVisible(true).setPosition(px, by);
      this.buttonZone = { x: px, y: by, hw: bw / 2, hh: 13 };
      intents.uiZones.push(this.buttonZone);
      const hit = intents.taps.findIndex((t) => Math.abs(t.x - px) <= bw / 2 && Math.abs(t.y - by) <= 13);
      if (hit >= 0) {
        intents.taps.splice(hit, 1);
        this.next();
      }
    }
    st.draw?.(v, ship);
  }

  /** A ring or gate in the world, with an edge arrow while it is off screen. */
  private drawMark(v: GuideView, at: Point, r: number, colour: number, label: string): void {
    const p = v.toScreen(at.x, at.y);
    const g = v.g;
    if (p.visible && p.x > 20 && p.x < v.w - 20 && p.y > 20 && p.y < v.h - 20) {
      g.lineStyle(3, colour, 0.85);
      g.strokeCircle(p.x, p.y, r * p.scale);
      g.lineStyle(1, colour, 0.35);
      g.strokeCircle(p.x, p.y, r * p.scale + 6);
      return;
    }
    const me = v.predicted;
    if (!me) return;
    const a = Math.atan2(wrapDelta(at.y, me.y, H), wrapDelta(at.x, me.x, W)), c = Math.cos(a), s = Math.sin(a);
    const x = v.w / 2 + c * v.w * 0.38, y = v.h / 2 + s * v.h * 0.34;
    g.fillStyle(colour, 0.9);
    g.fillTriangle(x + c * 12, y + s * 12, x - c * 5 - s * 8, y - s * 5 + c * 8, x - c * 5 + s * 8, y - s * 5 - c * 8);
    void label;
  }

  private build(): Step[] {
    const k = keys;
    return [
      {
        title: 'STEER',
        body: () => `${k().steer}. Fly through the rings.`,
        need: 5,
        update: (_v, s) => {
          const turns = [0, 0.9, -0.9, 1.6, -1.3];
          if (!this.target) this.target = ahead(s, 520, turns[this.count % turns.length]);
          if (dist(s, this.target) < 75) {
            this.count++;
            this.target = this.count < 5 ? ahead(s, 520, turns[this.count % turns.length]) : null;
            if (this.count >= 5) this.next();
          }
        },
        draw: (v) => this.target && this.drawMark(v, this.target, 75, 0x7dffc4, 'RING'),
      },
      {
        title: 'SPEED',
        body: () => `Speed up to full (${k().fast}), then slow right down (${k().slow}). Your ship never stops, but it can go slow. Watch SPEED at the top.`,
        need: 3,
        update: (_v, s) => {
          const top = topSpeed(s.hullMax, TUNE, s.chassis);
          if (!this.flag && s.speed >= top * 0.97) this.flag = true;
          if (this.flag && s.speed <= TUNE.ship.minSpeed + 4) {
            this.flag = false;
            if (++this.count >= 3) this.next();
          }
        },
      },
      {
        title: 'DASH',
        body: () => `${k().dash} to dash: a short charge, then a burst of speed (you can steer it a little). Dash through the gates. The dash needs a few seconds to recharge.`,
        need: 3,
        update: (_v, s) => {
          if (!this.target) this.target = ahead(s, 650);
          if (dist(s, this.target) < 95 && s.dashTime > 0) {
            this.target = null;
            if (++this.count >= 3) this.next();
          }
          // A gate missed far behind: put a new one ahead.
          else if (dist(s, this.target) > 1400) this.target = null;
        },
        draw: (v) => this.target && this.drawMark(v, this.target, 95, 0x87d6cf, 'GATE'),
      },
      {
        title: 'RAM',
        body: () => `Dash INTO a ship to ram it. Rams skip shields: the target loses at least 15% of its maximum hull, so even a small ship can bring down a big one. You take the same hit on your shield (on your hull only if your shield is already down). This battered Battlecruiser goes down in 3 rams. ${k().dash} when it is right ahead.`,
        need: 3,
        update: (_v, s) => {
          // A practice Battlecruiser at 45% hull that never shoots: three rams finish it.
          if (!this.alive(this.ids).length && this.count < 3) {
            if (this.ids.length) this.count = 3; // destroyed: done
            else {
              const id = this.spawnBot('drone', ahead(s, 700), 'BATTLECRUISER');
              const b = this.world.ships.get(id)!;
              b.chassis = 2;
              b.hullMax = TUNE.battlecruiser.powerFloor;
              b.hp = b.hullMax * 0.45;
              this.ids = [id];
              this.base = b.hp;
            }
          }
          const b = this.world.ships.get(this.ids[0]);
          if (b && b.hp < this.base - 10 && s.dashTime > 0) {
            this.count = Math.min(2, this.count + 1);
            this.base = b.hp;
          }
          if (this.count >= 3) {
            this.clearBots();
            this.next();
          }
        },
      },
      {
        title: 'SHOOT',
        body: () => `${k().fire} to shoot. Your guns aim straight ahead (and help a little on targets). Destroy the asteroids.`,
        need: 4,
        enter: () => {
          const s = this.world.ships.get(this.enteredFor)!;
          this.ids = [-1.2, -0.4, 0.4, 1.2].map((side) => {
            const p = ahead(s, 480);
            return this.world.spawnAsteroid(2, wrap(p.x + Math.cos(s.heading + Math.PI / 2) * side * 150, W), wrap(p.y + Math.sin(s.heading + Math.PI / 2) * side * 150, H));
          });
        },
        update: () => {
          this.count = this.ids.filter((id) => !this.world.asteroids.has(id)).length;
          if (this.count >= 4) this.next();
        },
      },
      {
        title: 'MINE MINERALS',
        body: () => 'Fly over minerals to collect them. Minerals repair your hull and grow it: your hull is your POWER. More power: tougher, but bigger and a little slower.',
        need: 15,
        enter: () => {
          const s = this.world.ships.get(this.enteredFor)!;
          this.base = s.hullMax;
          for (let i = 0; i < 6; i++) {
            const p = ahead(s, 260 + i * 70, Math.sin(i) * 0.25);
            this.world.spawnPickup('mineral', p.x, p.y, 5);
          }
        },
        update: (_v, s) => {
          this.count = Math.floor(s.hullMax - this.base);
          if (this.count >= 15) this.next();
          // Ran out of minerals nearby: a few more ahead.
          if (![...this.world.pickups.values()].some((p) => p.kind === 'mineral' && dist(p, s) < 900)) {
            const p = ahead(s, 300);
            this.world.spawnPickup('mineral', p.x, p.y, 5);
          }
        },
      },
      {
        title: 'OVERHEAT',
        body: () => `${k().fire} without stopping until the guns OVERHEAT and lock. Then they need to cool down before they fire again. Short bursts never overheat.`,
        need: 2,
        update: (_v, s) => {
          if (s.overheated && !this.flag) {
            this.flag = true;
            if (++this.count >= 2) this.next();
          }
          if (!s.overheated) this.flag = false;
        },
      },
      {
        title: 'SHIELD AND HULL',
        body: () =>
          this.flag
            ? 'Your shield broke and the hull took damage (the screen edge flashes red). Collect the repair pod (the green cross) to fix it.'
            : 'A training turret is shooting at you. Your SHIELD (blue) takes hits first and recharges if you avoid damage for a moment. When it breaks, your HULL takes the damage, and at zero hull you are destroyed. Let it break your shield.',
        need: 0,
        update: (_v, s) => {
          const t = this.turretAt ?? (this.turretAt = ahead(s, 380, Math.PI / 2));
          if (!this.flag) {
            const now = this.world.tick;
            if (now >= this.fireAt && s.hp > s.hullMax * 0.4) {
              this.fireAt = now + Math.round(0.4 * TUNE.net.tickHz);
              const dx = wrapDelta(s.x, t.x, W), dy = wrapDelta(s.y, t.y, H), d = Math.hypot(dx, dy) || 1, sp = 650;
              const lead = d / sp, tx = dx + Math.cos(s.heading) * s.speed * lead, ty = dy + Math.sin(s.heading) * s.speed * lead, n = Math.hypot(tx, ty) || 1;
              this.world.spawnBullet(t.x, t.y, (tx / n) * sp, (ty / n) * sp, 7, Math.ceil(((d + 200) / sp) * TUNE.net.tickHz));
            }
            if (s.shield <= 0 && s.hp < s.hullMax * 0.9) {
              this.flag = true;
              const p = ahead(s, 280);
              this.ids = [this.world.spawnPickup('heal', p.x, p.y, 1)];
              this.base = s.hp;
            }
            return;
          }
          if (!this.world.pickups.has(this.ids[0])) {
            if (s.hp > this.base) this.next();
            else {
              const p = ahead(s, 280);
              this.ids = [this.world.spawnPickup('heal', p.x, p.y, 1)];
            }
          }
        },
        draw: (v) => {
          if (!this.turretAt || this.flag) return;
          const p = v.toScreen(this.turretAt.x, this.turretAt.y);
          if (!p.visible) return;
          v.g.fillStyle(0xff8a6c, 0.9);
          v.g.fillCircle(p.x, p.y, 14 * p.scale);
          v.g.lineStyle(2, 0xffd27a, 0.9);
          v.g.strokeCircle(p.x, p.y, 20 * p.scale);
        },
      },
      {
        title: 'UPGRADES',
        body: () => `Upgrades cost power (your hull shrinks by the price) and each needs a minimum power. We have topped your power up. ${k().buy}: buy MISSILES (4) and MINES (5).`,
        need: 2,
        enter: () => {
          const s = this.world.ships.get(this.enteredFor)!;
          s.hullMax = Math.max(s.hullMax, 320);
          s.hp = s.hullMax;
        },
        update: (_v, s) => {
          this.count = (s.missileTier > 0 ? 1 : 0) + (s.mineTier > 0 ? 1 : 0);
          if (this.count >= 2) this.next();
        },
      },
      {
        title: 'MISSILES',
        body: () => `Missiles home in on a LOCKED target. Keep the drone in front of you until the lock bracket closes on it, then ${k().missile}. Missiles reload over a few seconds. Land 3 locked launches.`,
        need: 3,
        update: (_v, s) => {
          const me = this.enteredFor;
          if (!this.alive(this.ids).length) this.ids = [this.spawnBot('drone', ahead(s, 650), 'DRONE')];
          for (const o of this.world.ordnance.values()) {
            if (o.kind !== 'missile' || o.owner !== me || o.target === 0 || this.seen.has(o.id)) continue;
            this.seen.add(o.id);
            if (++this.count >= 3) {
              this.clearBots();
              this.next();
              return;
            }
          }
        },
      },
      {
        title: 'MINES',
        body: () => `Mines arm after a moment and drift toward enemies close by. A chaser is on your tail: ${k().mine} to drop a mine in its path. Hit it with 2 mines.`,
        need: 2,
        update: (_v, s) => {
          const me = this.enteredFor;
          if (!this.alive(this.ids).length) this.ids = [this.spawnBot('chaser', ahead(s, 420, Math.PI), 'CHASER')];
          const mines = new Map<number, Point>();
          for (const o of this.world.ordnance.values()) if (o.kind === 'mine' && o.owner === me) mines.set(o.id, { x: o.x, y: o.y });
          // A mine of ours that went off next to the chaser counts as a hit.
          for (const [id, at] of this.last) {
            if (mines.has(id)) continue;
            const reach = TUNE.mine.blastRadius + 40;
            if (this.alive(this.ids).some((b) => dist(this.world.ships.get(b)!, at) < reach) || this.ids.some((b) => !this.world.ships.has(b))) this.count++;
          }
          this.last = mines;
          if (this.count >= 2) {
            this.clearBots();
            this.next();
          }
        },
      },
      {
        title: 'DOGFIGHT',
        body: () => 'Three practice pilots, and they fight back (badly). Use everything: guns, dash, missiles, mines. Destroy 3.',
        need: 3,
        update: (_v, s) => {
          const living = this.alive(this.ids);
          this.count += this.ids.length - living.length;
          this.ids = living;
          if (this.count >= 3) {
            this.clearBots();
            this.next();
            return;
          }
          while (this.ids.length < Math.min(2, 3 - this.count)) this.ids.push(this.spawnBot('noob', ahead(s, 700, (this.ids.length ? 1 : -1) * 0.8), `PILOT ${this.count + this.ids.length + 1}`));
        },
      },
      {
        title: 'EVOLVE',
        body: () => `With enough upgrades and power you can EVOLVE into the BATTLECRUISER (${k().evolve}): much bigger and tougher, with four cannons, but slower. You need ${TUNE.battlecruiser.minUpgrades} upgrades and ${TUNE.battlecruiser.powerFloor} power.`,
        need: 0,
        info: true,
        update: () => {},
      },
      {
        title: 'FREE PLAY',
        body: () => `Hunt the helpless drones as long as you like. When you are ready, ${k().warp} to WARP OUT and finish the tutorial. Out there, warping out is how you keep what you carry.`,
        need: 0,
        enter: () => {
          const s = this.world.ships.get(this.enteredFor)!;
          s.lockdown = 0;
        },
        update: (_v, s) => {
          this.ids = this.alive(this.ids);
          while (this.ids.length < 5) this.ids.push(this.spawnBot('drone', ahead(s, 600 + this.ids.length * 150, this.ids.length * 1.3), 'DRONE'));
          if (s.warping || s.warpDist > 0) this.done = true;
        },
      },
    ];
  }

  private spawnBot(kind: 'drone' | 'chaser' | 'noob', at: Point, name: string): number {
    return this.room.addTutorialBot(kind, at.x, at.y, name);
  }
}

/** One guide for the page: progress survives a respawn (the scene restarts), not a visit from the menu. */
export const guide = new TutorialGuide();
// Test hook (?debug=1 only): lets the browser check drive the script.
if (DEBUG) (window as unknown as { __tutorial: unknown }).__tutorial = { guide, room: tutorialRoom };
