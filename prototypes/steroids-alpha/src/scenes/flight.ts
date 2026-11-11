import {configVersion} from '../liveConfig';
// On a planet. The view is centred on your ship. Gameplay is a flat wrapping map; everything is
// drawn through the planet projection (render/planet.ts) so the map reads as a ball seen from above,
// lit by one fixed sun as the planet turns and you travel over it.
import Phaser from 'phaser';
import { TUNE } from '../../sim/tune';
import { PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import type { ShipState } from '../../sim/ship';
import { wrapDelta } from '../../sim/wrap';
import { DEBUG, DEBUG_ROTATION, logicalSize } from '../base';
import { clientTune } from '../clientTune';
import { intents } from '../input/intents';
import { NetClient } from '../net/client';
import { fitCamera, text, versionStamp } from './common';
import { ShipView } from '../render/shipView';
import { shipArtStatus,buildShadow,CALIBRATION,SHADOW_ANCHOR } from '../render/shipArt';
import { lightingRadius, planetFrame, projectOffset, shipShadow, sunState } from '../render/planet';
import type { PlanetFrame } from '../render/planet';
import { PlanetGround } from '../render/planetGround';
import { Explosion } from '../render/explosion';
import { loadSave } from '../save';
import type { ShipPlacement } from '../render/shipView';

const W = TUNE.world.width;
const H = TUNE.world.height;
const SPACE = 0x060b17;

export class FlightScene extends Phaser.Scene {
  net!: NetClient;
  private planet!: PlanetId;
  private ground!: PlanetGround;
  private frame: PlanetFrame = planetFrame(0, 0, 0, lightingRadius(W), sunState(TUNE.planet.sunAzimuthDeg,TUNE.planet.sunElevationDeg));
  private view = { cx: 0, cy: 0, w: 1, h: 1, k: 1 };
  private rotationDeg = 0;
  private overlay!: Phaser.GameObjects.Graphics;
  private ships = new Map<number, DrawnShip>();
  private status!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private coords!: Phaser.GameObjects.Text;
  private schemeLabel!: Phaser.GameObjects.Text;
  private world!: Phaser.GameObjects.Graphics;
  private effects: { x: number; y: number; at: number; r: number; ms: number; colour: number }[] = [];
  private explosions: Explosion[] = [];
  /** Where each ship was last drawn (world), to aim shield hits. */
  private shipAt = new Map<number, { x: number; y: number }>();
  /** Shield hits shown so far (test hook). */
  shieldHitCount = 0;
  /** Name tags under ships, by ship id. */
  private tags = new Map<number, Phaser.GameObjects.Text>();
  /** Leaderboard rows by ship id; each slides to its rank's position. */
  private board = new Map<number, { text: Phaser.GameObjects.Text; y: number }>();
  private boardTitle!: Phaser.GameObjects.Text;
  /** Buttons on the death screen, in logical pixels. */
  private deathButtons: { id: 'respawn' | 'menu'; x: number; y: number; w: number; h: number; label: Phaser.GameObjects.Text }[] = [];
  private deathShownAt = 0;

  constructor() {
    super('flight');
  }

  init(data: { planet: PlanetId }): void {
    this.planet = data.planet;
  }

  create(): void {
    this.ships.clear();
    this.net = new NetClient(this.planet, loadSave().name ?? '');
    this.explosions = [];
    this.effects = [];
    this.deathShownAt = 0;
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
    this.tags.clear();
    this.board.clear();
    this.deathButtons = [];
    fitCamera(this);
    this.cameras.main.setBackgroundColor(SPACE);
    this.ground = new PlanetGround(this, 1);
    this.world = this.add.graphics().setDepth(15);
    this.overlay = this.add.graphics().setDepth(900);
    const { w } = logicalSize();
    this.status = text(this, w / 2, 6, '', 12, '#b8c6e6').setOrigin(0.5, 0).setDepth(950);
    this.coords = text(this, 8, 16, '', 10, '#7d8db0').setDepth(950).setVisible(DEBUG);
    this.schemeLabel = text(this, 0, 0, '', 11, '#dfe8ff').setOrigin(0.5).setDepth(951).setVisible(false);
    this.message = text(this, w / 2, logicalSize().h * 0.3, '', 18, '#ffffff').setOrigin(0.5).setDepth(950);
    this.boardTitle = text(this, 0, 0, 'KILLS', 10, '#8fa2c8').setOrigin(1, 0).setDepth(950);
    versionStamp(this);
  }

  private lastConfigVersion='';
  update(): void {
    if(this.lastConfigVersion!==configVersion){for(const ship of this.ships.values())ship.destroy();this.ships.clear();if(shipArtStatus==='ready')buildShadow(this);this.lastConfigVersion=configVersion;}
    const dead = !!this.net.death || this.net.status === 'destroyed';
    const dash = intents.consume('secondary');
    if (!dead) {
      intents.consume('primary');
      intents.consume('pause'); // No leaving during lockdown; warp-out comes in milestone 3.
    }
    if (intents.consume('scheme')) intents.toggleScheme();
    this.net.update({ ...intents.flight(this.net.predicted?.speed ?? TUNE.ship.cruiseSpeed), dash, fire: intents.fire });

    const { w, h } = logicalSize();
    const own = this.net.ownRender();
    // After our ship is destroyed the view stays on the wreck.
    const cx = own?.x ?? this.net.death?.x ?? W / 2;
    const cy = own?.y ?? this.net.death?.y ?? H / 2;
    // One frame for everything drawn this tick: where the view is on the ball and how the sun falls.
    // The planet's turn comes from the server's clock, so players in the same place see the same light.
    // Travel is measured from the middle of the map, so the drop zone starts in daylight.
    const rotationDeg = DEBUG_ROTATION ?? (this.net.asteroidTick() / TUNE.net.tickHz) * TUNE.planet.rotationDegPerSec;
    this.rotationDeg = rotationDeg;
    this.frame = planetFrame(cx - W / 2, cy - H / 2, rotationDeg, lightingRadius(W), sunState(TUNE.planet.sunAzimuthDeg, TUNE.planet.sunElevationDeg));
    this.view = { cx, cy, w, h, k: h / clientTune.render.referenceHeight };
    this.ground.update(w, h, this.view.k, this.frame);

    const alive = new Set<number>();
    if (own) {
      alive.add(this.net.myId);
      this.placeShip(this.net.myId, own, true);
    }
    for (const r of this.net.remoteRender()) {
      alive.add(r.id);
      this.placeShip(r.id, r.s, false);
    }
    for (const [id, ship] of this.ships) {
      if (!alive.has(id)) {
        ship.destroy();
        this.ships.delete(id);
        this.tags.get(id)?.destroy();
        this.tags.delete(id);
      }
    }

    for (const f of this.net.drainFx()) {
      if (f.kind === 'shot') this.ships.get(f.id)?.fire(f.side);
      else if (f.kind === 'explosion') this.explosions.push(new Explosion(f.x, f.y));
      else if (f.kind === 'shield') {
        // Direction from the ship to the impact, on screen.
        const ship = this.shipAt.get(f.id);
        if (ship) {
          const hit = this.toScreen(f.x, f.y);
          const at = this.toScreen(ship.x, ship.y);
          this.ships.get(f.id)?.shieldHit(Math.atan2(hit.y - at.y, hit.x - at.x));
          this.shieldHitCount++;
        }
      }
      else if (f.kind === 'heal') this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: TUNE.asteroid.pickupRadius, ms: 400, colour: 0x7dff9a });
      else this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: f.kind === 'burst' ? TUNE.asteroid.radius[f.size] : 9, ms: f.kind === 'burst' ? 320 : 110, colour: 0xffe2b0 });
    }
    this.drawWorld();
    this.drawTouch(w, h);
    this.drawStatus(own);
    this.drawBoard(w);

    if (this.net.death || this.net.status === 'destroyed') {
      if (this.deathScreen(w, h)) return;
    } else if (this.net.status === 'closed' || this.net.status === 'full') {
      for (const _ of intents.drainTaps()) {
        this.scene.start('menu');
        return;
      }
    } else {
      intents.drainTaps();
    }
  }

  /** Leaderboard names, top to bottom (test hook). */
  boardOrder(): string[] {
    return [...this.board.entries()].sort((a, b) => a[1].y - b[1].y).map(([id]) => this.net.roster.get(id)?.name ?? '');
  }

  /** Death-screen buttons once shown (test hook). */
  deathButtonZones(): { id: string; x: number; y: number }[] {
    return this.time.now - this.deathShownAt > 700 ? this.deathButtons.map((b) => ({ id: b.id, x: b.x, y: b.y })) : [];
  }

  debugExplosion(): void {
    const p = this.net.predicted;
    if (p) this.explosions.push(new Explosion(p.x, p.y + 140));
  }

  /** Debug only: a blocked hit on your ship from the given screen angle, to review the shield effect. */
  debugShieldHit(angle = 0): void {
    this.ships.get(this.net.myId)?.shieldHit(angle);
  }

  explosionCount(): number {
    return this.explosions.length;
  }

  /** Current sunlight at the view centre (test hook). */
  lighting(): { brightness: number; daylight: number; sun: { x: number; y: number; z: number }; rotationDeg: number } {
    return { brightness: this.frame.brightness, daylight: this.frame.daylight, sun: this.frame.sun, rotationDeg: this.rotationDeg };
  }

  /**
   * How bright ships and other game objects are drawn. The ground goes properly dark at night, but
   * things you need to see only dim a little (owner decisions: asteroids and pickups 10%, ships 30%).
   */
  private objectLight(dim = clientTune.render.nightObjectDim): number {
    const night = 1 - (this.frame.brightness - 0.3) / 0.7;
    return 1 - dim * Math.max(0, Math.min(1, night));
  }

  /** World position to screen, through the planet projection. scale is screen pixels per world unit there. */
  private toScreen(wx: number, wy: number): { x: number; y: number; scale: number; visible: boolean } {
    const v = this.view;
    const p = projectOffset(wrapDelta(wx, v.cx, W), wrapDelta(wy, v.cy, H), clientTune.render.planetRadius);
    return { x: v.w / 2 + p.x * v.k, y: v.h / 2 + p.y * v.k, scale: p.scale * v.k, visible: p.visible };
  }

  private placeShip(id: number, s: ShipState, mine: boolean): void {
    let ship = this.ships.get(id);
    if (!ship) {
      ship = shipArtStatus === 'ready' ? new RigShip(this, mine) : new PlaceholderShip(this, mine);
      this.ships.set(id, ship);
    }
    this.shipAt.set(id, { x: s.x, y: s.y });
    const at = this.toScreen(s.x, s.y);
    // The hard shadow lies on the ground, away from the sun.
    const sh = shipShadow(this.frame.sun, clientTune.render.shadowReach);
    sh.x+=CALIBRATION.shadow.x-SHADOW_ANCHOR.x;sh.y+=CALIBRATION.shadow.y-SHADOW_ANCHOR.y;
    const shadow = this.toScreen(s.x + sh.x, s.y + sh.y);
    this.placeTag(id, at, mine);
    // Ships darken 30% on the night side (owner decision); asteroids and pickups only 10%.
    ship.update({ ...at, brightness: this.objectLight(clientTune.render.nightShipDim), shadowX: shadow.x, shadowY: shadow.y, shadowAlpha: shadow.visible ? this.frame.daylight : 0 }, s, this.time.now);
  }

  private drawTouch(w: number, h: number): void {
    const g = this.overlay;
    g.clear();
    // Shield (blue, taken first) over hull (green), bottom centre.
    const p = this.net.predicted;
    if (p && !this.net.death) {
      const bw = Math.min(220, w * 0.5);
      const hull = Math.max(0, Math.min(1, p.hp / TUNE.ship.maxHp));
      const shield = Math.max(0, Math.min(1, p.shield / TUNE.ship.maxShield));
      g.fillStyle(0x000000, 0.45);
      g.fillRect(w / 2 - bw / 2, h - 27, bw, 6);
      g.fillRect(w / 2 - bw / 2, h - 16, bw, 8);
      g.fillStyle(0x5fc8ff, 0.95);
      g.fillRect(w / 2 - bw / 2, h - 27, bw * shield, 6);
      g.fillStyle(hull > 0.35 ? 0x6fe08a : 0xff6b5a, 0.95);
      g.fillRect(w / 2 - bw / 2, h - 16, bw * hull, 8);
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

  /** The pilot's name, just under the ship's ring. */
  private placeTag(id: number, at: { x: number; y: number; scale: number; visible: boolean }, mine: boolean): void {
    const name = this.net.roster.get(id)?.name;
    let tag = this.tags.get(id);
    if (!name) {
      tag?.setVisible(false);
      return;
    }
    if (!tag) {
      tag = text(this, 0, 0, '', 11, mine ? '#9fefff' : '#ffc9a8').setOrigin(0.5, 0).setDepth(30);
      this.tags.set(id, tag);
    }
    if (tag.text !== name) tag.setText(name);
    const below = (clientTune.render.shipRingRadius * clientTune.render.shipScale + 4) * at.scale;
    tag.setPosition(at.x, at.y + below).setVisible(at.visible);
  }

  /** Kills leaderboard, top right. Rows glide to their new place when the order changes. */
  private drawBoard(w: number): void {
    const rows = [...this.net.roster.values()].sort((a, b) => b.kills - a.kills || a.id - b.id).slice(0, 8);
    const right = w - 10;
    const top = intents.touch ? 46 + clientTune.touch.schemeButtonHeight + 10 : 30;
    const line = 16;
    this.boardTitle.setPosition(right, top).setVisible(rows.length > 0);
    const keep = new Set(rows.map((r) => r.id));
    for (const [id, row] of this.board) {
      if (!keep.has(id)) {
        row.text.destroy();
        this.board.delete(id);
      }
    }
    rows.forEach((r, rank) => {
      const target = top + 14 + rank * line;
      let row = this.board.get(r.id);
      if (!row) {
        row = { text: text(this, right, target, '', 12).setOrigin(1, 0).setDepth(950), y: target };
        this.board.set(r.id, row);
      }
      row.y += (target - row.y) * 0.18;
      if (Math.abs(target - row.y) < 0.3) row.y = target;
      const label = `${r.name}  ${r.kills}`;
      if (row.text.text !== label) row.text.setText(label);
      row.text.setColor(r.id === this.net.myId ? '#9fefff' : '#dfe8ff').setPosition(right, row.y);
    });
  }

  /**
   * After our ship is destroyed: who did it, and Respawn (back onto this planet) or Menu.
   * Keyboard: Space or J respawns, Esc goes to the menu. Returns true if the scene was left.
   */
  private deathScreen(w: number, h: number): boolean {
    if (!this.deathShownAt) {
      this.deathShownAt = this.time.now;
      const by = this.net.death?.killer ? `Destroyed by ${this.net.death.killerName || 'another pilot'}` : 'Your ship was destroyed';
      this.message.setText(by);
      const bw = 140;
      const bh = 44;
      this.deathButtons = (['respawn', 'menu'] as const).map((id, i) => {
        const x = w / 2 + (i === 0 ? -1 : 1) * (bw / 2 + 10);
        const y = h * 0.3 + 56;
        return { id, x, y, w: bw, h: bh, label: text(this, x, y, id === 'respawn' ? 'RESPAWN' : 'MENU', 16).setOrigin(0.5).setDepth(961) };
      });
    }
    // The buttons appear after the explosion has had a moment.
    const ready = this.time.now - this.deathShownAt > 700;
    const g = this.overlay;
    for (const b of this.deathButtons) {
      b.label.setVisible(ready);
      if (!ready) continue;
      g.fillStyle(b.id === 'respawn' ? 0x2c6e8f : 0x3a3f52, 0.9);
      g.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 10);
      g.lineStyle(2, 0xdfe8ff, 0.7);
      g.strokeRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 10);
    }
    let choice: 'respawn' | 'menu' | null = null;
    for (const t of intents.drainTaps()) {
      const b = ready && this.deathButtons.find((b) => Math.abs(t.x - b.x) <= b.w / 2 && Math.abs(t.y - b.y) <= b.h / 2);
      if (b) choice = b.id;
    }
    if (ready && intents.consume('primary')) choice = 'respawn';
    if (ready && intents.consume('pause')) choice = 'menu';
    if (choice === 'respawn') {
      this.scene.restart({ planet: this.planet });
      return true;
    }
    if (choice === 'menu') {
      this.scene.start('menu');
      return true;
    }
    return false;
  }

  /** Asteroids, bullets and short effects, drawn through the planet projection. Placeholder shapes until there is art. */
  private drawWorld(): void {
    const g = this.world;
    g.clear();
    const now = performance.now();
    const light = this.objectLight();
    const shade = (c: number): number => (Math.round(((c >> 16) & 255) * light) << 16) | (Math.round(((c >> 8) & 255) * light) << 8) | Math.round((c & 255) * light);
    for (const { a, x, y } of this.net.asteroidRender()) {
      const r = TUNE.asteroid.radius[a.size];
      if (!this.toScreen(x, y).visible) continue;
      // Each corner goes through the projection, so a rock squashes as it nears the horizon.
      const pts: Phaser.Math.Vector2[] = [];
      let hidden = false;
      for (const p of rockShape(a.id, r)) {
        const q = this.toScreen(x + p.x, y + p.y);
        if (!q.visible) hidden = true;
        pts.push(new Phaser.Math.Vector2(q.x, q.y));
      }
      if (hidden) continue;
      const flash = now - (this.net.asteroidHitAt.get(a.id) ?? -1e9) < 90;
      g.fillStyle(flash ? 0xffffff : shade(ROCK_FILL[a.size]), 1);
      g.fillPoints(pts, true);
      g.lineStyle(2, shade(0xd9c7a8), 0.8);
      g.strokePoints(pts, true);
    }
    for (const b of this.net.bullets) {
      const len = 0.018;
      const head = this.toScreen(b.x, b.y);
      const tail = this.toScreen(b.x - b.vx * len, b.y - b.vy * len);
      if (!head.visible || !tail.visible) continue;
      g.lineStyle(Math.max(1.5, 3 * head.scale), b.mine ? 0x9ff3ff : 0xffb37a, 1);
      g.lineBetween(head.x, head.y, tail.x, tail.y);
    }
    // Health boosts: a pulsing green cross in a ring.
    const pulse = 0.75 + 0.25 * Math.sin(now / 160);
    for (const k of this.net.pickups.values()) {
      const at = this.toScreen(k.x, k.y);
      if (!at.visible) continue;
      const r = TUNE.asteroid.pickupRadius * 0.6 * at.scale;
      g.fillStyle(0x0f3a1e, 0.75);
      g.fillCircle(at.x, at.y, r * 1.25);
      g.lineStyle(2, 0x7dff9a, pulse);
      g.strokeCircle(at.x, at.y, r * 1.25);
      g.fillStyle(0x7dff9a, pulse);
      g.fillRect(at.x - r * 0.25, at.y - r * 0.8, r * 0.5, r * 1.6);
      g.fillRect(at.x - r * 0.8, at.y - r * 0.25, r * 1.6, r * 0.5);
    }
    // Ship explosions.
    const dt = Math.min(0.05, this.game.loop.delta / 1000);
    this.explosions = this.explosions.filter((x) => !x.done);
    for (const x of this.explosions) {
      x.update(dt);
      const at = this.toScreen(x.x, x.y);
      if (!at.visible) continue;
      const t = x.age / Explosion.LIFE;
      // Fireball: swells fast, then fades from yellow-white to orange.
      if (t < 0.4) {
        const f = t / 0.4;
        g.fillStyle(0xff7a2e, 0.85 * (1 - f));
        g.fillCircle(at.x, at.y, (40 + 70 * Math.sqrt(f)) * at.scale);
        g.fillStyle(0xffd27a, 0.9 * (1 - f));
        g.fillCircle(at.x, at.y, (26 + 40 * Math.sqrt(f)) * at.scale);
      }
      if (t < 0.12) {
        g.fillStyle(0xffffff, 1 - t / 0.12);
        g.fillCircle(at.x, at.y, (30 + 60 * t) * at.scale);
      }
      g.lineStyle(4 * at.scale + 1, 0xffc070, Math.max(0, 1 - t * 1.6));
      g.strokeCircle(at.x, at.y, (20 + 220 * t) * at.scale);
      g.lineStyle(2 * at.scale + 1, 0xffffff, Math.max(0, 0.7 - t * 1.4));
      g.strokeCircle(at.x, at.y, (10 + 140 * t) * at.scale);
      for (const s of x.sparks) {
        const a = 1 - x.age / s.life;
        if (a <= 0) continue;
        const p = this.toScreen(x.x + s.x, x.y + s.y);
        if (!p.visible) continue;
        g.fillStyle(s.colour, a);
        const c = Math.cos(s.angle);
        const sn = Math.sin(s.angle);
        const hw = (s.w / 2) * p.scale;
        const hh = (s.h / 2) * p.scale;
        g.fillPoints(
          [
            new Phaser.Math.Vector2(p.x - c * hw + sn * hh, p.y - sn * hw - c * hh),
            new Phaser.Math.Vector2(p.x + c * hw + sn * hh, p.y + sn * hw - c * hh),
            new Phaser.Math.Vector2(p.x + c * hw - sn * hh, p.y + sn * hw + c * hh),
            new Phaser.Math.Vector2(p.x - c * hw - sn * hh, p.y - sn * hw + c * hh),
          ],
          true,
        );
      }
    }
    this.effects = this.effects.filter((e) => this.time.now - e.at < e.ms);
    for (const e of this.effects) {
      const at = this.toScreen(e.x, e.y);
      if (!at.visible) continue;
      const k = (this.time.now - e.at) / e.ms;
      g.lineStyle(3, e.colour, 1 - k);
      g.strokeCircle(at.x, at.y, e.r * (0.4 + k) * at.scale);
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
      destroyed: '',
    };
    if (!n.death && n.status !== 'destroyed') this.message.setText(n.status === 'open' && !own ? 'Dropping in…' : msg[n.status]);
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
  shieldHit(angle: number): void;
  update(at: ShipPlacement, s: ShipState, timeMs: number): void;
  destroy(): void;
}

/** The approved Human Nomad rig with its thruster exhaust. */
class RigShip implements DrawnShip {
  private view: ShipView;

  constructor(scene: Phaser.Scene, mine: boolean) {
    this.view = new ShipView(scene, mine);
  }

  update(at: ShipPlacement, s: ShipState, timeMs: number): void {
    // A dash counts as full throttle for the exhaust.
    this.view.update(at, s.heading, timeMs, s.speed, s.dashTime > 0);
  }

  fire(side: number): void {
    this.view.fire(side);
  }

  shieldHit(angle: number): void {
    this.view.shieldHit(angle);
  }

  destroy(): void {
    this.view.destroy();
  }
}

/** Coloured triangle used when the ship art is not available (placeholder-first). */
class PlaceholderShip implements DrawnShip {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, private mine: boolean) {
    this.g = scene.add.graphics().setDepth(mine ? 20 : 10);
  }

  update(at: ShipPlacement, s: ShipState): void {
    const g = this.g;
    const size = clientTune.render.shipSize;
    g.clear();
    g.setVisible(at.visible);
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
    g.setPosition(at.x, at.y).setRotation(s.heading).setScale(at.scale);
  }

  fire(): void {
    // The placeholder triangle has no guns to animate.
  }

  shieldHit(): void {
    // No shield effect on the placeholder.
  }

  destroy(): void {
    this.g.destroy();
  }
}
