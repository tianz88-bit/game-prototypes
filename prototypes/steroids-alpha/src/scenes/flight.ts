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

const W = TUNE.world.width;
const H = TUNE.world.height;

export class FlightScene extends Phaser.Scene {
  net!: NetClient;
  private planet!: PlanetId;
  private grid!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private ships = new Map<number, Phaser.GameObjects.Graphics>();
  private status!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private coords!: Phaser.GameObjects.Text;

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
    this.overlay = this.add.graphics().setDepth(900);
    const { w } = logicalSize();
    this.status = text(this, w / 2, 6, '', 12, '#b8c6e6').setOrigin(0.5, 0).setDepth(950);
    this.coords = text(this, 8, 16, '', 10, '#7d8db0').setDepth(950).setVisible(DEBUG);
    this.message = text(this, w / 2, logicalSize().h * 0.3, '', 18, '#ffffff').setOrigin(0.5).setDepth(950);
    versionStamp(this);
  }

  update(): void {
    const dash = intents.consume('secondary');
    intents.consume('primary');
    intents.consume('pause'); // No leaving during lockdown; warp-out comes in milestone 3.
    this.net.update({ turn: intents.turn, aim: intents.aim, dash });

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
    for (const [id, g] of this.ships) {
      if (!alive.has(id)) {
        g.destroy();
        this.ships.delete(id);
      }
    }

    this.drawTouch(w, h);
    this.drawStatus(own);

    if (this.net.status === 'closed' || this.net.status === 'full') {
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
    let g = this.ships.get(id);
    if (!g) {
      g = this.add.graphics().setDepth(mine ? 20 : 10);
      this.ships.set(id, g);
    }
    const size = clientTune.render.shipSize;
    g.clear();
    if (s.dashTime > 0) {
      g.fillStyle(0xffd27a, 0.85);
      g.fillTriangle(-size * 0.5, -size * 0.3, -size * 0.5, size * 0.3, -size * 1.4, 0);
    }
    g.fillStyle(mine ? 0x5fe3ff : 0xff8a4a, 1);
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

  private drawTouch(w: number, h: number): void {
    const g = this.overlay;
    g.clear();
    if (!intents.touch) {
      intents.dashButton = null;
      return;
    }
    const r = clientTune.touch.dashButtonRadius;
    const m = clientTune.touch.dashButtonMargin;
    const b = { x: w - m - r, y: h - m - r, r };
    intents.dashButton = b;
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

  private drawStatus(own: ShipState | null): void {
    const planet = PLANETS.find((p) => p.id === this.planet)?.label ?? this.planet;
    const n = this.net;
    const ships = (own ? 1 : 0) + n.remoteCount;
    this.status.setText(`${planet}  ·  ${ships} nearby  ·  ${Math.round(n.rttMs)} ms`);
    const msg: Record<string, string> = {
      connecting: 'Connecting…',
      open: '',
      full: 'Planet is full. Tap to go back',
      closed: 'Disconnected. Tap to go back',
    };
    this.message.setText(n.status === 'open' && !own ? 'Dropping in…' : msg[n.status]);
    if (DEBUG && own) {
      this.coords.setText(`x ${own.x.toFixed(0)}  y ${own.y.toFixed(0)}  pending ${n.pendingCount}  corr ${n.lastCorrection.toFixed(1)}`);
    }
  }
}

function darken(c: number): number {
  const r = ((c >> 16) & 0xff) * 0.25;
  const g = ((c >> 8) & 0xff) * 0.25;
  const b = (c & 0xff) * 0.25;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
