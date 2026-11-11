// On a planet. Placeholder shapes only. The camera follows your ship; everything is
// placed by wrapped difference from it, so the map has no edges.
// (The pseudo-3D planet curvature and the ship part rig come in later milestones.)
import Phaser from 'phaser';
import { TUNE } from '../../sim/tune';
import { PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import type { ShipState } from '../../sim/ship';
import { wrap, wrapDelta } from '../../sim/wrap';
import { DEBUG, logicalSize } from '../base';
import { clientTune } from '../clientTune';
import { intents } from '../input/intents';
import { NetClient } from '../net/client';
import { fitCamera, text, versionStamp } from './common';
import { ShipView } from '../render/shipView';
import { shipArtStatus } from '../render/shipArt';

const W = TUNE.world.width;
const H = TUNE.world.height;

export class FlightScene extends Phaser.Scene {
  net!: NetClient;
  private planet!: PlanetId;
  private grid!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private ships = new Map<number, DrawnShip>();
  private status!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private coords!: Phaser.GameObjects.Text;
  private schemeLabel!: Phaser.GameObjects.Text;
  private world!: Phaser.GameObjects.Graphics;
  private effects: { x: number; y: number; at: number; r: number; ms: number }[] = [];

  constructor() {
    super('flight');
  }

  init(data: { planet: PlanetId }): void {
    this.planet = data.planet;
  }

  create(): void {
    this.ships.clear();
    this.net = new NetClient(this.planet);
    this.net.connect();
    this.build();
    this.game.events.on('dpr', this.build, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('dpr', this.build, this);
      this.net.close();
      intents.dashButton = null;
      intents.schemeButton = null;
      intents.fireButton = null;
    });
    intents.drainTaps();
  }

  private build(): void {
    this.children.removeAll(true);
    this.ships.clear();
    fitCamera(this);
    const planet = PLANETS.find((p) => p.id === this.planet);
    this.cameras.main.setBackgroundColor(planet ? darken(planet.colour) : 0x05070d);
    this.grid = this.add.graphics().setDepth(0);
    this.world = this.add.graphics().setDepth(15);
    this.overlay = this.add.graphics().setDepth(900);
    const { w } = logicalSize();
    this.status = text(this, w / 2, 6, '', 12, '#b8c6e6').setOrigin(0.5, 0).setDepth(950);
    this.coords = text(this, 8, 16, '', 10, '#7d8db0').setDepth(950).setVisible(DEBUG);
    this.schemeLabel = text(this, 0, 0, '', 11, '#dfe8ff').setOrigin(0.5).setDepth(951).setVisible(false);
    this.message = text(this, w / 2, logicalSize().h * 0.3, '', 18, '#ffffff').setOrigin(0.5).setDepth(950);
    versionStamp(this);
  }

  update(): void {
    const dash = intents.consume('secondary');
    intents.consume('primary');
    intents.consume('pause'); // No leaving during lockdown; warp-out comes in milestone 3.
    if (intents.consume('scheme')) intents.toggleScheme();
    this.net.update({ ...intents.flight(this.net.predicted?.speed ?? TUNE.ship.cruiseSpeed), dash, fire: intents.fire });

    const { w, h } = logicalSize();
    const own = this.net.ownRender();
    const cx = own?.x ?? W / 2;
    const cy = own?.y ?? H / 2;
    this.drawGrid(cx, cy, w, h);

    const alive = new Set<number>();
    if (own) {
      alive.add(this.net.myId);
      this.placeShip(this.net.myId, own, w / 2, h / 2, true);
    }
    for (const r of this.net.remoteRender()) {
      alive.add(r.id);
      this.placeShip(r.id, r.s, w / 2 + wrapDelta(r.s.x, cx, W), h / 2 + wrapDelta(r.s.y, cy, H), false);
    }
    for (const [id, ship] of this.ships) {
      if (!alive.has(id)) {
        ship.destroy();
        this.ships.delete(id);
      }
    }

    for (const f of this.net.drainFx()) {
      if (f.kind === 'shot') this.ships.get(f.id)?.fire(f.side);
      else this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: f.kind === 'burst' ? TUNE.asteroid.radius[f.size] : 9, ms: f.kind === 'burst' ? 320 : 110 });
    }
    this.drawWorld(cx, cy, w, h);
    this.drawTouch(w, h);
    this.drawStatus(own);

    if (this.net.status === 'closed' || this.net.status === 'full' || this.net.status === 'destroyed') {
      for (const _ of intents.drainTaps()) {
        this.scene.start('menu');
        return;
      }
    } else {
      intents.drainTaps();
    }
  }

  private drawGrid(cx: number, cy: number, w: number, h: number): void {
    const g = this.grid;
    g.clear();
    const sp = clientTune.render.gridSpacing;
    const sector = clientTune.render.sectorSpacing;
    const left = cx - w / 2;
    const top = cy - h / 2;
    for (let gx = Math.floor(left / sp) * sp; gx <= left + w; gx += sp) {
      const major = Math.abs(wrap(gx, W) % sector) < 0.5;
      g.lineStyle(major ? 2 : 1, 0x9fb4e0, major ? 0.28 : 0.1);
      g.lineBetween(gx - left, 0, gx - left, h);
    }
    for (let gy = Math.floor(top / sp) * sp; gy <= top + h; gy += sp) {
      const major = Math.abs(wrap(gy, H) % sector) < 0.5;
      g.lineStyle(major ? 2 : 1, 0x9fb4e0, major ? 0.28 : 0.1);
      g.lineBetween(0, gy - top, w, gy - top);
    }
  }

  private placeShip(id: number, s: ShipState, x: number, y: number, mine: boolean): void {
    let ship = this.ships.get(id);
    if (!ship) {
      ship = shipArtStatus === 'ready' ? new RigShip(this, mine) : new PlaceholderShip(this, mine);
      this.ships.set(id, ship);
    }
    ship.update(x, y, s, this.time.now);
  }

  private drawTouch(w: number, h: number): void {
    const g = this.overlay;
    g.clear();
    // Hull bar, bottom centre.
    const hp = this.net.predicted?.hp ?? 0;
    if (this.net.predicted) {
      const bw = Math.min(220, w * 0.5);
      const frac = Math.max(0, Math.min(1, hp / TUNE.ship.maxHp));
      g.fillStyle(0x000000, 0.45);
      g.fillRect(w / 2 - bw / 2, h - 16, bw, 8);
      g.fillStyle(frac > 0.35 ? 0x6fe08a : 0xff6b5a, 0.95);
      g.fillRect(w / 2 - bw / 2, h - 16, bw * frac, 8);
    }
    this.schemeLabel.setVisible(intents.touch);
    if (!intents.touch) {
      intents.dashButton = null;
      intents.schemeButton = null;
      intents.fireButton = null;
      return;
    }
    // Fire button: left of the dash button, held to shoot.
    const fr = clientTune.touch.fireButtonRadius;
    const fb = { x: w - clientTune.touch.dashButtonMargin * 2 - clientTune.touch.dashButtonRadius * 2 - fr, y: h - clientTune.touch.dashButtonMargin - fr };
    intents.fireButton = { x: fb.x, y: fb.y, hw: fr * 1.2, hh: fr * 1.2 };
    g.fillStyle(0xff8a4a, intents.fire ? 0.5 : 0.25);
    g.fillCircle(fb.x, fb.y, fr);
    g.lineStyle(2, 0xffc9a8, 0.8);
    g.strokeCircle(fb.x, fb.y, fr);
    const r = clientTune.touch.dashButtonRadius;
    const m = clientTune.touch.dashButtonMargin;
    const b = { x: w - m - r, y: h - m - r, r };
    intents.dashButton = { x: b.x, y: b.y, hw: r * 1.3, hh: r * 1.3 };
    // Steering scheme toggle, top right under the status line.
    const bw = clientTune.touch.schemeButtonWidth;
    const bh = clientTune.touch.schemeButtonHeight;
    const sb = { x: w - 10 - bw / 2, y: 46 + bh / 2 };
    intents.schemeButton = { x: sb.x, y: sb.y, hw: bw / 2 + 6, hh: bh / 2 + 6 };
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(sb.x - bw / 2, sb.y - bh / 2, bw, bh, 8);
    g.lineStyle(1, 0xffffff, 0.45);
    g.strokeRoundedRect(sb.x - bw / 2, sb.y - bh / 2, bw, bh, 8);
    this.schemeLabel.setPosition(sb.x, sb.y).setText(intents.scheme === 'marker' ? 'STEER: MARKER' : 'STEER: CRAFT');
    const cd = this.net.predicted?.dashCd ?? 0;
    const ready = cd <= 0;
    g.fillStyle(0xffffff, ready ? 0.22 : 0.08);
    g.fillCircle(b.x, b.y, r);
    g.lineStyle(2, 0xffffff, ready ? 0.7 : 0.3);
    g.strokeCircle(b.x, b.y, r);
    if (!ready) {
      g.lineStyle(4, 0xffd27a, 0.9);
      g.beginPath();
      g.arc(b.x, b.y, r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd / TUNE.ship.dashCooldown));
      g.strokePath();
    }
    const st = intents.stick;
    if (st) {
      g.lineStyle(2, 0xffffff, 0.35);
      g.strokeCircle(st.ox, st.oy, clientTune.touch.joystickRadius);
      g.fillStyle(0xffffff, 0.45);
      g.fillCircle(st.ox + st.dx, st.oy + st.dy, 22);
    }
  }

  /** Asteroids, bullets and short effects. Placeholder shapes until there is art. */
  private drawWorld(cx: number, cy: number, w: number, h: number): void {
    const g = this.world;
    g.clear();
    const sx = (x: number): number => w / 2 + wrapDelta(x, cx, W);
    const sy = (y: number): number => h / 2 + wrapDelta(y, cy, H);
    const now = performance.now();
    for (const { a, x, y } of this.net.asteroidRender()) {
      const r = TUNE.asteroid.radius[a.size];
      const px = sx(x);
      const py = sy(y);
      if (px < -r || px > w + r || py < -r || py > h + r) continue;
      const flash = now - (this.net.asteroidHitAt.get(a.id) ?? -1e9) < 90;
      const pts = rockShape(a.id, r).map((p) => new Phaser.Math.Vector2(px + p.x, py + p.y));
      g.fillStyle(flash ? 0xffffff : ROCK_FILL[a.size], 1);
      g.fillPoints(pts, true);
      g.lineStyle(2, 0xd9c7a8, 0.8);
      g.strokePoints(pts, true);
    }
    for (const b of this.net.bullets) {
      const len = 0.018;
      const x = sx(b.x);
      const y = sy(b.y);
      g.lineStyle(3, b.mine ? 0x9ff3ff : 0xffb37a, 1);
      g.lineBetween(x, y, x - b.vx * len, y - b.vy * len);
    }
    this.effects = this.effects.filter((e) => this.time.now - e.at < e.ms);
    for (const e of this.effects) {
      const k = (this.time.now - e.at) / e.ms;
      g.lineStyle(3, 0xffe2b0, 1 - k);
      g.strokeCircle(sx(e.x), sy(e.y), e.r * (0.4 + k));
    }
  }

  private drawStatus(own: ShipState | null): void {
    const planet = PLANETS.find((p) => p.id === this.planet)?.label ?? this.planet;
    const n = this.net;
    const ships = (own ? 1 : 0) + n.remoteCount;
    this.status.setText(`${planet}  ·  ${ships} nearby  ·  ${Math.round(own?.speed ?? 0)} px/s  ·  ${Math.round(n.rttMs)} ms`);
    const msg: Record<string, string> = {
      connecting: 'Connecting…',
      open: '',
      full: 'Planet is full. Tap to go back',
      closed: 'Disconnected. Tap to go back',
      destroyed: 'Ship destroyed. Tap to go back',
    };
    this.message.setText(n.status === 'open' && !own ? 'Dropping in…' : msg[n.status]);
    if (DEBUG && own) {
      this.coords.setText(`x ${own.x.toFixed(0)}  y ${own.y.toFixed(0)}  pending ${n.pendingCount}  corr ${n.lastCorrection.toFixed(1)}`);
    }
  }
}

const ROCK_FILL = [0x6b5a4a, 0x7a6753, 0x8a755d];
const shapes = new Map<string, { x: number; y: number }[]>();
/** A lumpy outline, the same every time for a given asteroid id. */
function rockShape(id: number, r: number): { x: number; y: number }[] {
  const key = `${id}:${r}`;
  let pts = shapes.get(key);
  if (!pts) {
    pts = [];
    let seed = id * 9301 + 49297;
    const n = 11;
    for (let i = 0; i < n; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const k = 0.78 + (seed / 233280) * 0.3;
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: Math.cos(a) * r * k, y: Math.sin(a) * r * k });
    }
    if (shapes.size > 400) shapes.clear();
    shapes.set(key, pts);
  }
  return pts;
}

interface DrawnShip {
  fire(side: number): void;
  update(x: number, y: number, s: ShipState, timeMs: number): void;
  destroy(): void;
}

/** The approved Human Nomad rig, plus a placeholder dash flame until thrust art and FFD exist. */
class RigShip implements DrawnShip {
  private view: ShipView;
  private flame: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, mine: boolean) {
    this.flame = scene.add.graphics().setDepth(19);
    this.view = new ShipView(scene, mine);
  }

  update(x: number, y: number, s: ShipState, timeMs: number): void {
    this.view.update(x, y, s.heading, timeMs);
    this.flame.clear();
    if (s.dashTime > 0) {
      // Behind the thrusters: the rig's engines sit about 110 rig px aft of the centre.
      const k = clientTune.render.shipScale;
      this.flame.fillStyle(0xffd27a, 0.8);
      this.flame.fillTriangle(-110 * k, -40 * k, -110 * k, 40 * k, -230 * k, 0);
      this.flame.setPosition(x, y - 28 * k).setRotation(s.heading);
    }
  }

  fire(side: number): void {
    this.view.fire(side);
  }

  destroy(): void {
    this.view.destroy();
    this.flame.destroy();
  }
}

/** Coloured triangle used when the ship art is not available (placeholder-first). */
class PlaceholderShip implements DrawnShip {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, private mine: boolean) {
    this.g = scene.add.graphics().setDepth(mine ? 20 : 10);
  }

  update(x: number, y: number, s: ShipState): void {
    const g = this.g;
    const size = clientTune.render.shipSize;
    g.clear();
    if (s.dashTime > 0) {
      g.fillStyle(0xffd27a, 0.85);
      g.fillTriangle(-size * 0.5, -size * 0.3, -size * 0.5, size * 0.3, -size * 1.4, 0);
    }
    g.fillStyle(this.mine ? 0x5fe3ff : 0xff8a4a, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(size, 0),
        new Phaser.Math.Vector2(-size * 0.7, size * 0.65),
        new Phaser.Math.Vector2(-size * 0.4, 0),
        new Phaser.Math.Vector2(-size * 0.7, -size * 0.65),
      ],
      true,
    );
    g.setPosition(x, y).setRotation(s.heading);
  }

  fire(): void {
    // The placeholder triangle has no guns to animate.
  }

  destroy(): void {
    this.g.destroy();
  }
}

function darken(c: number): number {
  const r = ((c >> 16) & 0xff) * 0.25;
  const g = ((c >> 8) & 0xff) * 0.25;
  const b = (c & 0xff) * 0.25;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
