import {configVersion} from '../liveConfig';
// On a planet. The view is centred on your ship. Gameplay is a flat wrapping map; everything is
// drawn through the planet projection (render/planet.ts) so the map reads as a ball seen from above,
// lit by one fixed sun as the planet turns and you travel over it.
import Phaser from 'phaser';
import { TUNE } from '../../sim/tune';
import { PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import { maxShield, shipRadius, powerGrowth } from '../../sim/ship';
import { TURRET_MOUNTS, turretCount } from '../../sim/turrets';
import { BATTLECRUISER, TURRET_MOUNTS_BY_CHASSIS, chassisStats, upgradeTotal } from '../../sim/chassis';
import { SHOP_ITEMS, canBuy, shopOffer, shopTier, EVOLVE_ITEM, canEvolve } from '../../sim/shop';
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
import { loadSave, recordRun } from '../save';
import type { ShipPlacement } from '../render/shipView';
import { missileLock } from '../../sim/ordnance';
import { UI, css, panel, controlFace } from '../render/ui';
import { unlockById } from '../../sim/unlocks';
import type { Look } from '../../sim/unlocks';
import { drawPickup, drawOrdnance, drawExplosionCore, drawBullet, drawDrone, drawHitSpark } from '../render/worldArt';
import { PixelRocks } from '../render/rockPixels';
import { PaintedRocks, paintedRocksReady } from '../render/rockPainted';

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
  /** Painted rocks (owner art); the pixel rocks only if that art failed to load. */
  private rocks!: PixelRocks | PaintedRocks;
  private hullBorder!: Phaser.GameObjects.Graphics;
  private hullHitAt=-1e9;
  private missileTrails = new Map<number, {x:number;y:number;at:number}[]>();
  private effects: { x: number; y: number; at: number; r: number; ms: number; colour: number; chips?: number; heal?: boolean; sparkAngle?: number }[] = [];
  private explosions: Explosion[] = [];
  /** Where each ship was last drawn (world), to aim shield hits. */
  private shipAt = new Map<number, { x: number; y: number }>();
  /** Shield hits shown so far (test hook). */
  shieldHitCount = 0;
  ramCount = 0;
  /** Frames the dash charge effect was drawn (test hook). */
  dashChargeFrames = 0;
  /** Name tags under ships, by ship id. */
  private tags = new Map<number, Phaser.GameObjects.Text>();
  /** Leaderboard chips by ship id; each slides to its rank's position. */
  private board = new Map<number, BoardChip>();
  private boardTitle!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  /** Charge counts on the missile and mine buttons. */
  private weaponTexts: Phaser.GameObjects.Text[] = [];
  /** Bounty label: over the holder's ship, at the edge tracker, or "BOUNTY ON YOU". */
  private bountyText!: Phaser.GameObjects.Text;
  /** Label on the warp button: lockdown countdown, WARP, or warp progress and CANCEL. */
  private warpText!: Phaser.GameObjects.Text;
  /** Salvage carried, beside the hull bar. */
  private salvageText!: Phaser.GameObjects.Text;
  /** Hot zone label: on the zone when in view, else on its edge tracker. */
  private hotZoneText!: Phaser.GameObjects.Text;
  private lockedOnMe = false;
  /** Shown to a pilot with a missile locked on them in flight. */
  private lockText!: Phaser.GameObjects.Text;
  private shopTexts: { title: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }[] = [];
  /** Turrets, drawn over the ships. Aim per ship and turret comes from the shots the server reports. */
  private turretGfx!: Phaser.GameObjects.Graphics;
  private turretAim = new Map<number, { angle: number[]; firedAt: number[] }>();
  /** Buttons on the death screen, in logical pixels. */
  private deathButtons: { id: 'respawn' | 'menu'; x: number; y: number; w: number; h: number; label: Phaser.GameObjects.Text }[] = [];
  private deathShownAt = 0;

  constructor() {
    super('flight');
  }

  init(data: { planet: PlanetId }): void {
    this.planet = data.planet;
  }

  /** When this run started (for the run history). */
  private runStartedAt = 0;

  create(): void {
    this.runStartedAt = Date.now();
    this.ships.clear();
    this.net = new NetClient(this.planet, loadSave().name ?? '');
    this.explosions = [];
    this.effects = [];
    this.hullHitAt=-1e9;
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
      intents.missileButton = null;
      intents.mineButton = null;
      intents.warpButton = null;
      intents.shopZones = [];
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
    this.rocks = paintedRocksReady() ? new PaintedRocks(this) : new PixelRocks(this);
    this.turretGfx = this.add.graphics().setDepth(23);
    this.overlay = this.add.graphics().setDepth(900);
    this.hullBorder=this.add.graphics().setDepth(940);
    const { w } = logicalSize();
    this.status = text(this, w / 2, 6, '', 12, '#b8c6e6').setOrigin(0.5, 0).setDepth(950);
    this.coords = text(this, 8, 16, '', 10, '#7d8db0').setDepth(950).setVisible(DEBUG);
    this.schemeLabel = text(this, 0, 0, '', 11, '#dfe8ff').setOrigin(0.5).setDepth(951).setVisible(false);
    this.message = text(this, w / 2, logicalSize().h * 0.3, '', 18, '#ffffff').setOrigin(0.5).setDepth(950);
    this.boardTitle = text(this, 0, 0, 'KO · POWER', 10, '#8fa2c8').setOrigin(1, 0).setDepth(950);
    this.salvageText = text(this, 0, 0, '', 12, '#ffd23a').setOrigin(1, 0.5).setDepth(953).setVisible(false);
    this.hotZoneText = text(this, 0, 0, '', 11, '#7dffc4').setOrigin(0.5).setDepth(953).setVisible(false);
    this.warpText = text(this, 0, 0, '', 12, '#ffffff').setOrigin(0.5).setDepth(953).setVisible(false);
    this.bountyText = text(this, 0, 0, '', 11, '#ffd23a').setOrigin(0.5).setDepth(953).setVisible(false);
    this.lockText = text(this, 0, 0, 'MISSILE LOCK', 13, '#ff5a3a').setOrigin(0.5).setDepth(953).setVisible(false);
    this.weaponTexts = [0, 1].map(() => text(this, 0, 0, '', 12, '#ffffff').setOrigin(0.5).setDepth(952).setVisible(false));
    this.powerText = text(this, 0, 0, '', 11, '#ffd98a').setOrigin(0.5, 1).setDepth(950).setVisible(false);
    this.shopTexts = [...SHOP_ITEMS, 'evolve'].map(() => ({
      title: text(this, 0, 0, '', 12, '#ffffff').setOrigin(0, 0.5).setDepth(951).setVisible(false),
      sub: text(this, 0, 0, '', 10, '#c9d6f2').setOrigin(0, 0.5).setDepth(951).setVisible(false),
    }));
    versionStamp(this);
  }

  private lastConfigVersion='';
  update(): void {
    if(this.lastConfigVersion!==configVersion){for(const ship of this.ships.values())ship.destroy();this.ships.clear();if(shipArtStatus==='ready')buildShadow(this);this.lastConfigVersion=configVersion;}
    const dead = !!this.net.death || this.net.status === 'destroyed';
    const dash = intents.consume('secondary');
    const missile = intents.consume('missile');
    const mine = intents.consume('mine');
    const warp = intents.consume('warp');
    const over = dead || !!this.net.extracted || this.net.status === 'extracted';
    if (!over) {
      intents.consume('primary');
      intents.consume('pause'); // No menu exit mid-run: leave by warping out (lockdown, then Warp).
    }
    if (intents.consume('scheme')) intents.toggleScheme();
    const heading = this.net.predicted?.heading ?? 0;
    this.net.update({ ...intents.flight(this.net.predicted?.speed ?? TUNE.ship.cruiseSpeed), dash, dashAim: intents.dashAim(heading), fire: intents.fire, missile, mine, warp });
    // Shop: each tap asks the server for the tier on offer now; the server checks power and price.
    for (const item of intents.consumeBuys()) {
      const p = this.net.predicted;
      if (p && item === EVOLVE_ITEM) {
        if (canEvolve(p, TUNE)) this.net.buy(EVOLVE_ITEM, 0);
        continue;
      }
      const name = SHOP_ITEMS[item];
      if (p && name && shopOffer(p, name, TUNE)) this.net.buy(item, shopTier(p, name));
    }

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

    this.turretGfx.clear();
    const alive = new Set<number>();
    // An extracted ship has left the planet: it is no longer drawn.
    if (own && !this.net.extracted && this.net.status !== 'extracted') {
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
        this.turretAim.delete(id);
      }
    }

    for (const f of this.net.drainFx()) {
      if (f.kind === 'shot') this.ships.get(f.id)?.fire(f.side);
      else if (f.kind === 'turret') {
        let aim = this.turretAim.get(f.id);
        if (!aim) this.turretAim.set(f.id, (aim = { angle: [], firedAt: [] }));
        aim.angle[f.index] = f.angle;
        aim.firedAt[f.index] = this.time.now;
      }
      else if (f.kind === 'hull') {
        if(f.id===this.net.myId)this.hullHitAt=this.time.now;
        const ship=this.shipAt.get(f.id);
        const angle=ship?Math.atan2(wrapDelta(f.y,ship.y,H),wrapDelta(f.x,ship.x,W)):0;
        this.effects.push({x:f.x,y:f.y,at:this.time.now,r:30,ms:220,colour:0xffd49c,sparkAngle:angle});
      } else if(f.kind==='spark')this.effects.push({x:f.x,y:f.y,at:this.time.now,r:24,ms:190,colour:0xffdfa3,sparkAngle:f.angle??0});
      else if (f.kind === 'explosion') {
        this.explosions.push(new Explosion(f.x, f.y));
        // Nova kill effect (an unlock the killer wears): violet rings over the explosion.
        const nova = unlockById(this.net.roster.get(f.killer)?.look?.killfx);
        if (nova) {
          this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 190, ms: 900, colour: nova.colour ?? 0xb48cff });
          this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 120, ms: 700, colour: 0xf3e8ff });
          this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 70, ms: 500, colour: nova.colour ?? 0xb48cff, chips: 14 });
        }
      }
      else if (f.kind === 'shieldBreak') {
        // The shield shatters: a bright ring around the ship (placeholder; the break grace is running).
        const at = this.shipAt.get(f.id);
        if (at) {
          this.effects.push({ x: at.x, y: at.y, at: this.time.now, r: 70, ms: 420, colour: 0x9fe8ff, chips: 12 });
          this.effects.push({ x: at.x, y: at.y, at: this.time.now, r: 40, ms: 260, colour: 0xffffff });
        }
      } else if (f.kind === 'shield') {
        // Direction from the ship to the impact, on screen.
        const ship = this.shipAt.get(f.id);
        if (ship) {
          const hit = this.toScreen(f.x, f.y);
          const at = this.toScreen(ship.x, ship.y);
          this.ships.get(f.id)?.shieldHit(Math.atan2(hit.y - at.y, hit.x - at.x));
          this.shieldHitCount++;
        }
      }
      else if (f.kind === 'gold') this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 30, ms: 450, colour: 0xffd23a, chips: 10 });
      else if (f.kind === 'warpout') {
        // A ship launching off the planet: a bright cyan flash and a wide ring.
        this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 150, ms: 700, colour: 0x7fe9ff });
        this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 50, ms: 350, colour: 0xffffff });
      } else if (f.kind === 'blast') {
        // Shot down: a small white pop. Went off: an orange ring the size of the blast.
        if (f.shot) this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: Math.min(24,f.r), ms: 240, colour: 0xffffff, chips: 5 });
        else {
          this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: f.r, ms: f.ordnance === 'mine' ? 480 : 320, colour: 0xff8a3a, chips: 12 });
          this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: f.r * 0.5, ms: 200, colour: 0xfff2c4 });
        }
      } else if (f.kind === 'ram') {
        this.ramCount++;
        this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 70, ms: 380, colour: 0xffa04a });
        this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 34, ms: 200, colour: 0xffffff });
      } else if (f.kind === 'mineral') this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 24, ms: 420, colour: 0xffc14a, chips: 8 });
      else if (f.kind === 'heal') this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: TUNE.asteroid.pickupRadius, ms: 500, colour: 0x7dff9a, heal: true });
      else this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: f.kind === 'burst' ? TUNE.asteroid.radius[f.size] : 9, ms: f.kind === 'burst' ? 420 : 180, colour: 0xffc78a, chips: f.kind === 'burst' ? 10 : 4 });
    }
    this.drawWorld();
    this.drawTouch(w, h);
    this.drawHullBorder(w,h);
    this.drawStatus(own);
    this.drawBoard(w);

    if (this.net.extracted || this.net.status === 'extracted') {
      if (this.deathScreen(w, h, true)) return;
    } else if (this.net.death || this.net.status === 'destroyed') {
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
    // Ship type from the server (it changes when a ship evolves) and palette from the roster look.
    const palette = unlockById(this.net.roster.get(id)?.look?.palette)?.index ?? 0;
    let ship = this.ships.get(id);
    if (ship && (ship.chassis !== s.chassis || ship.palette !== palette)) {
      ship.destroy();
      this.ships.delete(id);
      ship = undefined;
    }
    if (!ship) {
      ship = shipArtStatus === 'ready' ? new RigShip(this, mine, s.chassis, palette) : new PlaceholderShip(this, mine, s.chassis, palette);
      this.ships.set(id, ship);
    }
    this.shipAt.set(id, { x: s.x, y: s.y });
    const at = this.toScreen(s.x, s.y);
    // Power makes ships bigger: drawn at the same growth as their hit radius.
    // (Each ship's art already has its own size; only power growth scales it here.)
    at.scale *= powerGrowth(s.hullMax, TUNE);
    // The hard shadow lies on the ground, away from the sun.
    const sh = shipShadow(this.frame.sun, clientTune.render.shadowReach);
    sh.x+=CALIBRATION.shadow.x-SHADOW_ANCHOR.x;sh.y+=CALIBRATION.shadow.y-SHADOW_ANCHOR.y;
    const shadow = this.toScreen(s.x + sh.x, s.y + sh.y);
    this.placeTag(id, at, mine, chassisStats(s.chassis, TUNE).radius / TUNE.ship.radius);
    ship.setLook(this.net.roster.get(id)?.look ?? {});
    // Ships darken 30% on the night side (owner decision); asteroids and pickups only 10%.
    ship.update({ ...at, brightness: this.objectLight(clientTune.render.nightShipDim), shadowX: shadow.x, shadowY: shadow.y, shadowAlpha: shadow.visible ? this.frame.daylight : 0 }, s, this.time.now);
    this.drawTurrets(id, s, at);
    if (s.dashCharge > 0) this.drawDashCharge(s, at, mine);
  }

  /**
   * Dash wind-up (placeholder effect): energy sparks converge on the ship and a ring tightens as the
   * charge fills. On your own ship an arrow shows where the boost will go (the direction held now).
   */
  private drawDashCharge(s: ShipState, at: { x: number; y: number; scale: number; visible: boolean }, mine: boolean): void {
    if (!at.visible) return;
    this.dashChargeFrames++;
    const g = this.turretGfx;
    const k = 1 - s.dashCharge / TUNE.ship.dashChargeSeconds; // 0 → 1 as it charges
    const now = this.time.now;
    const R = clientTune.render.shipRingRadius * clientTune.render.shipScale * at.scale * chassisStats(s.chassis, TUNE).radius / TUNE.ship.radius;
    g.lineStyle(2 + 2 * k, 0x9fefff, 0.35 + 0.5 * k);
    for(let i=0;i<4;i++){g.beginPath();g.arc(at.x,at.y,R*(2.1-k),i*Math.PI/2+.12,i*Math.PI/2+1.35);g.strokePath();}
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + now / 260;
      const d = R * (2.3 - 1.3 * ((k + i * 0.1) % 1));
      g.fillStyle(0xd6fbff, 0.5 + 0.5 * k);
      const size=2+3*k;g.fillRect(at.x+Math.cos(a)*d-size/2,at.y+Math.sin(a)*d-size/2,size,size*1.4);
    }
    if (mine) {
      const aim = intents.dashAim(s.heading);
      const dir = Number.isFinite(aim) ? aim : s.heading;
      const tip = R * 2.6;
      const bx = at.x + Math.cos(dir) * R * 1.4;
      const by = at.y + Math.sin(dir) * R * 1.4;
      const tx = at.x + Math.cos(dir) * tip;
      const ty = at.y + Math.sin(dir) * tip;
      g.lineStyle(3, 0xffffff, 0.85);
      g.lineBetween(bx, by, tx, ty);
      g.fillStyle(0xffffff, 0.9);
      g.fillTriangle(tx + Math.cos(dir) * 8, ty + Math.sin(dir) * 8, tx + Math.cos(dir + 2.4) * 8, ty + Math.sin(dir + 2.4) * 8, tx + Math.cos(dir - 2.4) * 8, ty + Math.sin(dir - 2.4) * 8);
    }
  }

  /**
   * Placeholder turrets: a small dome with a barrel on each earned mount. A turret points where it last
   * fired and, after a quiet second, swings back to face forward. A short flash marks each shot.
   */
  private drawTurrets(id: number, s: ShipState, at: { x: number; y: number; scale: number; visible: boolean }): void {
    const n = turretCount(s, TUNE);
    const mounts = TURRET_MOUNTS_BY_CHASSIS[s.chassis] ?? TURRET_MOUNTS;
    if (!n || !at.visible) return;
    let aim = this.turretAim.get(id);
    if (!aim) this.turretAim.set(id, (aim = { angle: [], firedAt: [] }));
    const now = this.time.now;
    const g = this.turretGfx;
    const light = this.objectLight(clientTune.render.nightShipDim);
    const c = Math.cos(s.heading);
    const sn = Math.sin(s.heading);
    // at.scale already includes the ship's growth; mounts are in base-size ship units.
    const k = at.scale;
    for (let i = 0; i < n; i++) {
      const m = mounts[i];
      const x = at.x + (c * m.forward - sn * m.right) * k;
      const y = at.y + (sn * m.forward + c * m.right) * k;
      const quiet = now - (aim.firedAt[i] ?? -1e9) > 1000;
      const prev = aim.angle[i] ?? s.heading;
      const want = quiet ? s.heading : prev;
      const d = ((want - prev + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const a = prev + d * 0.15;
      aim.angle[i] = a;
      drawDrone(g,x,y,k,a,now,id+i,light,now-(aim.firedAt[i]??-1e9)<70);
    }
  }

  /**
   * Hot zone (placeholder look): a dashed green ring on the planet while in view, labelled with the
   * bonus and the time until it moves; otherwise a green arrow on the inner screen ellipse.
   */
  private drawHotZone(p: ShipState | null, w: number, h: number): void {
    const z = this.net.hotZone;
    this.hotZoneText.setVisible(false);
    if (!p || !z || z.r <= 0 || this.net.death || this.net.extracted) return;
    const g = this.overlay;
    const now = performance.now();
    const left = Math.max(0, (z.movesAt - now) / 1000);
    const label = `HOT ZONE x${TUNE.hotZone.salvageMultiplier}  ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const centre = this.toScreen(z.x, z.y);
    const dx = wrapDelta(z.x, p.x, W);
    const dy = wrapDelta(z.y, p.y, H);
    const inside = Math.hypot(dx, dy) <= z.r;
    // The ring, through the planet projection (segments on the visible side only).
    const n = 48;
    g.lineStyle(2, 0x7dffc4, 0.55);
    let prev: { x: number; y: number; visible: boolean } | null = null;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const q = this.toScreen(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r);
      if (prev && prev.visible && q.visible && i % 2 === 0) g.lineBetween(prev.x, prev.y, q.x, q.y);
      prev = q;
    }
    if (inside) {
      this.hotZoneText.setVisible(true).setText(label).setPosition(w / 2, h - 66);
      return;
    }
    if (centre.visible && centre.x > 40 && centre.x < w - 40 && centre.y > 40 && centre.y < h - 40) {
      this.hotZoneText.setVisible(true).setText(label).setPosition(centre.x, centre.y);
      return;
    }
    const a = Math.atan2(dy, dx);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = w / 2 + c * w * 0.36;
    const y = h / 2 + s * h * 0.33;
    g.fillStyle(0x7dffc4, 0.85);
    g.fillTriangle(x + c * 14, y + s * 14, x - c * 6 - s * 10, y - s * 6 + c * 10, x - c * 6 + s * 10, y - s * 6 - c * 10);
    this.hotZoneText.setVisible(true).setText(`${label}  ${Math.round(Math.max(0, Math.hypot(dx, dy) - z.r) / 100) * 100}m`).setPosition(x - c * 70, y - s * 34);
  }

  /**
   * Warp button, top centre (touch and mouse; keyboard R). During lockdown it is offline with a
   * countdown; then WARP; while warping it fills with the distance covered and a tap cancels.
   */
  private drawWarp(p: ShipState | null, w: number, h: number): void {
    const g = this.overlay;
    intents.warpButton = null;
    const alive = !!p && !this.net.death && !this.net.extracted && this.net.status === 'open';
    this.warpText.setVisible(alive);
    if (!p || !alive) return;
    const bw = intents.touch ? 176 : 156;
    const bh = intents.touch ? 36 : 28;
    const x = w / 2;
    // Below the shop: on phones the shop is a row across the top, so sit just under its lowest edge.
    const shopBottom = Math.max(0, ...intents.shopZones.map((z) => z.zone.y + z.zone.hh));
    const y = intents.touch ? Math.max(64, shopBottom + 10 + bh / 2) : 50;
    const locked = p.lockdown > 0;
    const accent = p.warping ? 0x7fe9ff : locked ? UI.uiBorder : UI.uiAccent;
    panel(g, x - bw / 2, y - bh / 2, bw, bh, accent, !locked);
    if (p.warping) {
      const f = Math.min(1, p.warpDist / TUNE.warp.distance);
      g.fillStyle(0x7fe9ff, 0.35);
      g.fillRoundedRect(x - bw / 2 + 3, y - bh / 2 + 3, (bw - 6) * f, bh - 6, 4);
    }
    const key = intents.touch ? '' : ' [R]';
    const m = Math.floor(p.lockdown / 60);
    const sec = Math.ceil(p.lockdown % 60);
    const label = p.warping
      ? `WARP ${Math.floor((100 * p.warpDist) / TUNE.warp.distance)}%  CANCEL${key}`
      : locked
        ? `WARP OFFLINE ${sec === 60 ? m + 1 : m}:${String(sec === 60 ? 0 : sec).padStart(2, '0')}`
        : `WARP${key}`;
    this.warpText.setText(label).setPosition(x, y).setColor(locked && !p.warping ? '#8fa2c8' : '#ffffff');
    if (!locked || p.warping) intents.warpButton = { x, y, hw: bw / 2, hh: bh / 2 };
  }

  /** Locked missile crosshair: a red ring with four inward ticks, slowly turning and pulsing. */
  private drawCrosshair(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, now: number): void {
    const pulse=.8+.2*Math.sin(now/130),rot=now/1500;
    g.lineStyle(5,0x182333,.9);g.strokeCircle(x,y,r);
    g.lineStyle(2,0xff7859,pulse);
    for(let i=0;i<4;i++){const a=rot+i*Math.PI/2;g.beginPath();g.arc(x,y,r,a+.12,a+1.15);g.strokePath();
      g.lineBetween(x+Math.cos(a)*r*1.2,y+Math.sin(a)*r*1.2,x+Math.cos(a)*r*.85,y+Math.sin(a)*r*.85);}
    g.fillStyle(0xfff0c7,pulse);g.fillCircle(x,y,Math.max(1.2,r*.035));
  }

  /**
   * Bounty (owner design): the strongest real player is marked with a gold ring and label; other
   * pilots get a gold arrow at the screen edge pointing to them while they are out of view. The
   * holder sees "BOUNTY ON YOU". Also the MISSILE LOCK warning for a pilot being chased.
   */
  private drawBounty(p: ShipState | null, w: number, h: number): void {
    const g = this.overlay;
    const now = this.time.now;
    const warning=!!p && this.lockedOnMe && !this.net.death;
    this.lockText.setVisible(warning).setAlpha(.8+.2*Math.sin(now/120)).setPosition(w / 2, h * 0.3);
    if(warning){g.fillStyle(0x26151e,.92);g.fillRoundedRect(w/2-76,h*.3-12,152,24,5);
      g.lineStyle(1.5,0xff8664,.85);g.strokeRoundedRect(w/2-76,h*.3-12,152,24,5);}
    const b = this.net.bounty;
    this.bountyText.setVisible(false);
    if (!p || !b || this.net.death || this.net.extracted) return;
    const pulse = 0.7 + 0.3 * Math.sin(now / 200);
    if (b.id === this.net.myId) {
      const at = this.toScreen(p.x, p.y);
      const r=46 * at.scale * shipRadius(p.hullMax, TUNE, p.chassis) / TUNE.ship.radius;
      this.bountyRing(g,at.x,at.y,r,pulse);
      g.fillStyle(0xffd36d,1);this.drawStar(g,at.x,at.y-r-10,5);
      this.bountyText.setVisible(true).setText('BOUNTY ON YOU').setPosition(w / 2, h * 0.3 + 32);
      this.bountyPlate(w,h);
      return;
    }
    // Where the holder is: their drawn position when in view range, else the bounty frame's.
    const seen = this.net.remoteRender().find((r) => r.id === b.id)?.s;
    const bx = seen?.x ?? b.x;
    const by = seen?.y ?? b.y;
    const name = this.net.roster.get(b.id)?.name ?? '';
    const at = this.toScreen(bx, by);
    const margin = 28;
    if (at.visible && at.x > margin && at.x < w - margin && at.y > margin && at.y < h - margin) {
      const r = 46 * at.scale * (seen ? shipRadius(seen.hullMax, TUNE, seen.chassis) / TUNE.ship.radius : 1);
      this.bountyRing(g,at.x,at.y,r,pulse);
      g.fillStyle(0x32251f,.95);g.fillCircle(at.x,at.y-r-12,11);
      g.fillStyle(0xffd23a, 0.9);
      this.drawStar(g, at.x, at.y - r - 12, 7);
      this.bountyText.setVisible(true).setText('BOUNTY').setPosition(at.x, at.y - r - 26);
      this.bountyPlate(w,h);
      return;
    }
    // Off screen: an arrow toward the holder (the world wraps; take the short way), on an ellipse
    // just inside the screen edge so it stays clear of the corner HUD (shop, buttons).
    const dx = wrapDelta(bx, p.x, W);
    const dy = wrapDelta(by, p.y, H);
    const a = Math.atan2(dy, dx);
    const c = Math.cos(a);
    const s = Math.sin(a);
    let x = w / 2 + c * w * 0.4;
    const y = h / 2 + s * h * 0.38;
    const boardBottom=Math.max(0,...[...this.board.values()].map(chip=>chip.y+BOARD_CHIP_H/2))+24;
    if(y<260 && x<190)x=190;
    if(y<boardBottom && x>w-Math.min(BOARD_CHIP_W,w*.34)-35)x=w-Math.min(BOARD_CHIP_W,w*.34)-35;
    g.fillStyle(0x211e2d,.95);g.fillCircle(x,y,18);
    g.lineStyle(1,0xffd36d,.7);g.strokeCircle(x,y,18);
    g.fillStyle(0xffd23a, 0.9 * pulse);
    g.fillTriangle(x + c * 16, y + s * 16, x - c * 6 - s * 11, y - s * 6 + c * 11, x - c * 6 + s * 11, y - s * 6 - c * 11);
    g.fillStyle(0x2a1d05, 0.9);
    this.drawStar(g, x, y, 4.5);
    const dist = Math.round(Math.hypot(dx, dy) / 100) * 100;
    this.bountyText
      .setVisible(true)
      .setText(`${name} ${dist}m`)
      .setPosition(x - c * 40, y - s * 24);
    this.bountyPlate(w,h);
  }

  private bountyPlate(w:number,h:number):void {
    const t=this.bountyText,pad=7,bw=t.width+pad*2,bh=t.height+8;
    let x=Math.max(bw/2+4,Math.min(w-bw/2-4,t.x));
    const y=Math.max(bh/2+4,Math.min(h-bh/2-4,t.y));
    const boardBottom=Math.max(0,...[...this.board.values()].map(chip=>chip.y+BOARD_CHIP_H/2))+20;
    if(y<260 && x-bw/2<170)x=170+bw/2+5;
    if(y<boardBottom && x+bw/2>w-Math.min(BOARD_CHIP_W,w*.34)-18)x=w-Math.min(BOARD_CHIP_W,w*.34)-23-bw/2;
    t.setPosition(x,y);
    this.overlay.fillStyle(0x221f2c,.9);this.overlay.fillRoundedRect(x-bw/2,y-bh/2,bw,bh,4);
    this.overlay.lineStyle(1,0xbf9550,.8);this.overlay.strokeRoundedRect(x-bw/2,y-bh/2,bw,bh,4);
  }

  private bountyRing(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,pulse:number):void {
    g.lineStyle(4,0x28212d,.8);g.strokeCircle(x,y,r);
    g.lineStyle(1,0xffefbd,.55);g.strokeCircle(x,y,r-3);
    g.lineStyle(2,0xffca55,.65+.25*pulse);
    for(let i=0;i<4;i++){g.beginPath();g.arc(x,y,r,i*Math.PI/2+.12,i*Math.PI/2+1.35);g.strokePath();}
  }

  private drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
    }
    g.fillPoints(pts, true);
  }

  /**
   * Missile and mine buttons, shown once bought: a symbol, the charges held, and a ring refilling the
   * next charge. Touch: above the fire and dash buttons. Keyboard: small badges (Q, E) by the bars.
   */
  private drawWeapons(p: ShipState | null, w: number, h: number): void {
    const g = this.overlay;
    intents.missileButton = null;
    intents.mineButton = null;
    const show = !!p && !this.net.death;
    this.weaponTexts.forEach((t) => t.setVisible(false));
    if (!p || !show) return;
    const touch = intents.touch;
    const m = clientTune.touch.dashButtonMargin;
    const dr = clientTune.touch.dashButtonRadius;
    const fr = clientTune.touch.fireButtonRadius;
    const slots = [
      { kind: 'missile' as const, tier: p.missileTier, charges: p.missileCharges, cd: p.missileCd, refill: TUNE.missile.refillSeconds, key: 'Q' },
      { kind: 'mine' as const, tier: p.mineTier, charges: p.mineCharges, cd: p.mineCd, refill: TUNE.mine.refillSeconds, key: 'E' },
    ];
    slots.forEach((sl, i) => {
      if (sl.tier <= 0) return;
      const r = touch ? 30 : 15;
      const x = touch ? (i === 0 ? w - m * 2 - dr * 2 - fr : w - m - dr) : w / 2 + Math.min(220, w * 0.5) / 2 + 74 + i * 64;
      const y = touch ? h - m - (i === 0 ? fr * 2 : dr * 2) - 14 - r : h - 30;
      const ready = sl.charges > 0;
      controlFace(g,x,y,r,sl.kind==='missile'?UI.uiAccent:UI.uiGold,ready);
      if (sl.charges < sl.tier && sl.cd > 0) {
        g.lineStyle(3, 0x7fd6ff, 0.9);
        g.beginPath();
        g.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - sl.cd / sl.refill));
        g.strokePath();
      }
      // Symbol: a rocket (missile) or a spiked ball (mine).
      const k = r / 30;
      g.fillStyle(ready ? 0xffffff : 0x9a8f80, 1);
      if (sl.kind === 'missile') {
        g.fillTriangle(x + 13 * k, y - 4 * k, x + 13 * k, y + 4 * k, x + 20 * k, y);
        g.fillRect(x - 12 * k, y - 4 * k, 25 * k, 8 * k);
        g.fillTriangle(x - 12 * k, y - 4 * k, x - 18 * k, y - 9 * k, x - 7 * k, y - 4 * k);
        g.fillTriangle(x - 12 * k, y + 4 * k, x - 18 * k, y + 9 * k, x - 7 * k, y + 4 * k);
      } else {
        g.fillCircle(x, y - 2 * k, 8 * k);
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2;
          g.fillCircle(x + Math.cos(a) * 11 * k, y - 2 * k + Math.sin(a) * 11 * k, 2.4 * k);
        }
      }
      this.weaponTexts[i]
        .setVisible(true)
        .setFontSize(touch ? 18 : 12)
        .setOrigin(0, 0.5)
        .setPosition(x + r + 4, y)
        .setText(touch ? `${sl.charges}` : `${sl.charges} [${sl.key}]`)
        .setColor(ready ? '#ffd27a' : '#8f7f6a');
      const zone = { x, y, hw: r * 1.25, hh: r * 1.25 };
      if (touch) {
        if (sl.kind === 'missile') intents.missileButton = zone;
        else intents.mineButton = zone;
      }
    });
  }

  /**
   * Shop, top left: one-tap buttons (keyboard 1/2/3) for the next tier of each upgrade: its tier n/4,
   * the power it needs and its price in minerals. Bright when you can buy it, dim when you can't.
   */
  private drawShop(p: ShipState | null): void {
    const g = this.overlay;
    const show = !!p && !this.net.death;
    for (const t of this.shopTexts) {
      t.title.setVisible(show);
      t.sub.setVisible(show);
    }
    intents.shopZones = [];
    if (!p || !show) return;
    const labels: Record<string, string> = { turret: 'TURRET', shield: 'SHIELD', damage: 'GUNS', missile: 'MISSILE', mine: 'MINES' };
    const x = 10;
    const mobile = intents.touch;
    const available = window.innerWidth - Math.min(BOARD_CHIP_W, window.innerWidth * .34) - 30;
    const cols = mobile ? Math.max(1, Math.min(6, Math.floor(available / 88))) : 1;
    const bw = mobile ? Math.min(86, (available - (cols - 1) * 4) / cols) : 124;
    const bh = mobile ? 34 : 30;
    SHOP_ITEMS.forEach((item, i) => {
      const bx = x + (i % cols) * (bw + 4);
      const y = (mobile ? 28 : 38) + Math.floor(i / cols) * (bh + 4);
      const offer = shopOffer(p, item, TUNE);
      const can = canBuy(p, item, TUNE);
      panel(g,bx,y,bw,bh,can?UI.uiAccent:UI.uiBorder,can);
      const key = intents.touch ? '' : `[${i + 1}] `;
      const t = this.shopTexts[i];
      t.title.setFontSize(mobile ? 10 : 11).setPosition(bx + 5, y + 9).setText(`${key}${labels[item]} ${shopTier(p, item)}/4`).setColor(css(can?UI.uiText:0x91a5bb));
      t.sub
        .setFontSize(mobile ? 9 : 9)
        .setPosition(bx + 5, y + (mobile ? 24 : 22))
        .setText(offer ? `${offer.cost}c · need ${offer.floor}` : 'maxed')
        .setColor(can ? '#bfffd0' : '#6d7a96');
      intents.shopZones.push({ item: i, zone: { x: bx + bw / 2, y: y + bh / 2, hw: bw / 2, hh: bh / 2 } });
    });
    // Evolve (owner design): the fighters can become the Battlecruiser during a run, once they have
    // enough upgrades and power; it costs minerals. The card shows what is still missing.
    const t = this.shopTexts[EVOLVE_ITEM];
    if (p.chassis === BATTLECRUISER) {
      t.title.setVisible(false);
      t.sub.setVisible(false);
      return;
    }
    const i = EVOLVE_ITEM;
    const bx = x + (i % cols) * (bw + 4);
    const y = (mobile ? 28 : 38) + Math.floor(i / cols) * (bh + 4);
    const b = TUNE.battlecruiser;
    const can = canEvolve(p, TUNE);
    const ups = upgradeTotal(p);
    panel(g, bx, y, bw, bh, can ? UI.uiGold : UI.uiBorder, can);
    t.title.setFontSize(mobile ? 10 : 11).setPosition(bx + 5, y + 9).setText(`${intents.touch ? '' : '[6] '}EVOLVE`).setColor(can ? '#ffd23a' : css(0x91a5bb));
    t.sub
      .setFontSize(9)
      .setPosition(bx + 5, y + (mobile ? 24 : 22))
      .setText(can ? `${b.cost}c · battlecruiser` : ups < b.minUpgrades ? `upgrades ${ups}/${b.minUpgrades}` : `${b.cost}c · need ${b.powerFloor}`)
      .setColor(can ? '#ffe9a8' : '#6d7a96');
    intents.shopZones.push({ item: i, zone: { x: bx + bw / 2, y: y + bh / 2, hw: bw / 2, hh: bh / 2 } });
  }

  private drawTouch(w: number, h: number): void {
    const g = this.overlay;
    g.clear();
    // Shield (blue, taken first) over hull (green), bottom centre. Hull is minerals, so the bar is
    // measured against the most this ship has carried: losing minerals empties it, collecting refills
    // it, and growing past the old best keeps it full. Power (hull points) is written above.
    const p = this.net.predicted;
    this.powerText.setVisible(!!p && !this.net.death);
    this.salvageText.setVisible(false);
    if (p && !this.net.death) {
      const bw = Math.min(220, w * 0.5);
      panel(g,w/2-bw/2-9,h-50,bw+38,46,UI.uiBorder);
      const hull = Math.max(0, Math.min(1, p.hp / Math.max(1, p.hullMax)));
      const shield = Math.max(0, Math.min(1, p.shield / maxShield(p, TUNE)));
      const capped = p.hullMax >= TUNE.ship.powerCap;
      this.powerText.setPosition(w / 2, h - 30).setText(`HULL ${Math.round(p.hp)}/${Math.round(p.hullMax)}${capped ? '  MAX' : ''}`);
      // Salvage carried this run: banked on extraction, dropped as gold on death.
      this.salvageText.setVisible(true).setPosition(w / 2 + bw / 2 + 28, h - 60).setText(`SALVAGE ${Math.floor(p.salvage)}`);
      g.fillStyle(0x000000, 0.45);
      g.fillRect(w / 2 - bw / 2, h - 27, bw, 6);
      g.fillRect(w / 2 - bw / 2, h - 16, bw, 8);
      g.fillStyle(UI.uiAccent, 0.95);
      g.fillRect(w / 2 - bw / 2, h - 27, bw * shield, 6);
      // Shield down (owner request): the bar glows red and fills with flashing red as the recharge
      // cooldown runs out; the blue refill takes over when it starts recharging.
      if (shield <= 0.001 && p.shieldCd > 0) {
        const t = this.time.now;
        const progress = Math.max(0, Math.min(1, 1 - p.shieldCd / TUNE.ship.shieldRegenDelaySeconds));
        const pulse = 0.5 + 0.5 * Math.sin(t / 90);
        g.fillStyle(0xff3a2a, 0.18 + 0.14 * pulse);
        g.fillRoundedRect(w / 2 - bw / 2 - 4, h - 31, bw + 8, 14, 5);
        g.fillStyle(0xff3a2a, 0.45 + 0.45 * pulse);
        g.fillRect(w / 2 - bw / 2, h - 27, bw * progress, 6);
        g.lineStyle(1, 0xff6a5a, 0.5 + 0.4 * pulse);
        g.strokeRect(w / 2 - bw / 2, h - 27, bw, 6);
      }
      g.fillStyle(hull > 0.35 ? 0x7ee0ad : UI.uiDanger, 0.95);
      g.fillRect(w / 2 - bw / 2, h - 16, bw * hull, 8);
      // Gun heat: a short upright bar right of the health bars; red and flashing while locked.
      const hx = w / 2 + bw / 2 + 8;
      g.fillStyle(0x000000, 0.45);
      g.fillRect(hx, h - 27, 6, 19);
      const hot = p.overheated;
      const flash = hot && Math.floor(this.time.now / 150) % 2 === 0;
      g.fillStyle(hot ? (flash ? 0xffffff : 0xff4a3a) : p.heat > 0.7 ? 0xff8a3a : 0xffc14a, 0.95);
      g.fillRect(hx, h - 8 - 19 * p.heat, 6, 19 * p.heat);
      // Dash: a yellow upright bar beside the heat bar. It refills over the cooldown and is full when
      // the dash is ready; while charging it pulses white as the charge fills.
      const dx = hx + 10;
      g.fillStyle(0x000000, 0.45);
      g.fillRect(dx, h - 27, 6, 19);
      const sh = TUNE.ship;
      const charging = p.dashCharge > 0;
      const fill = charging ? 1 - p.dashCharge / sh.dashChargeSeconds : p.dashTime > 0 ? p.dashTime / sh.dashDuration : 1 - Math.max(0, p.dashCd) / sh.dashCooldown;
      const ready = !charging && p.dashTime <= 0 && p.dashCd <= 0;
      const pulse = charging && Math.floor(this.time.now / 100) % 2 === 0;
      g.fillStyle(charging ? (pulse ? 0xffffff : 0xfff07a) : ready ? 0xffe14a : 0xb89a2a, 0.95);
      g.fillRect(dx, h - 8 - 19 * fill, 6, 19 * fill);
    }
    this.drawShop(p);
    this.drawWeapons(p, w, h);
    this.drawBounty(p, w, h);
    this.drawWarp(p, w, h);
    this.drawHotZone(p, w, h);
    this.schemeLabel.setVisible(false);
    if (!intents.touch) {
      intents.dashButton = null;
      intents.schemeButton = null;
      intents.fireButton = null;
      return;
    }
    // Dash button in the bottom-right corner; the fire button, held to shoot, sits to its left.
    const r = clientTune.touch.dashButtonRadius;
    const m = clientTune.touch.dashButtonMargin;
    const b = { x: w - m - r, y: h - m - r, r };
    intents.dashButton = { x: b.x, y: b.y, hw: r * 1.3, hh: r * 1.3 };
    const fr = clientTune.touch.fireButtonRadius;
    const fb = { x: w - m * 2 - r * 2 - fr, y: h - m - fr };
    intents.fireButton = { x: fb.x, y: fb.y, hw: fr * 1.2, hh: fr * 1.2 };
    controlFace(g,fb.x,fb.y,fr,UI.uiDanger,intents.fire);
    g.lineStyle(2,UI.uiDanger,.9);g.strokeCircle(fb.x,fb.y,fr*.22);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;g.lineBetween(fb.x+Math.cos(a)*fr*.32,fb.y+Math.sin(a)*fr*.32,fb.x+Math.cos(a)*fr*.48,fb.y+Math.sin(a)*fr*.48);}
    // No steering toggle on phones (owner, 14 November 2026): the stick is always the direction marker.
    const cd = this.net.predicted?.dashCd ?? 0;
    const ready = cd <= 0;
    controlFace(g,b.x,b.y,r,UI.uiAccent,ready);
    g.lineStyle(3,UI.uiAccent,ready?.95:.4);
    for(let i=0;i<3;i++){const x=b.x-12+i*10;g.lineBetween(x,b.y-10,x+8,b.y);g.lineBetween(x+8,b.y,x,b.y+10);}
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
  private placeTag(id: number, at: { x: number; y: number; scale: number; visible: boolean }, mine: boolean, size = 1): void {
    const entry=this.net.roster.get(id);
    const name=entry?.name;
    const bot=entry?.bot===true;
    let tag = this.tags.get(id);
    if (!name) {
      tag?.setVisible(false);
      return;
    }
    if (!tag) {
      tag = text(this, 0, 0, '', 11, mine ? '#9fefff' : '#ffc9a8').setOrigin(0.5, 0).setDepth(30);
      this.tags.set(id, tag);
    }
    const look=entry?.look??{};
    const badge=unlockById(look.badge)?.glyph;
    const label=bot?`◇ ${name}`:badge?`${badge} ${name}`:name;
    if (tag.text !== label) tag.setText(label);
    const tagColour=unlockById(look.tag)?.colour;
    const colour=tagColour!==undefined?css(tagColour):mine?'#9fefff':bot?'#a9bdcf':'#ffc9a8';
    if(tag.style.color!==colour)tag.setColor(colour);
    const below = (clientTune.render.shipRingRadius * clientTune.render.shipScale * size + 4) * at.scale;
    tag.setPosition(at.x, at.y + below).setVisible(at.visible);
  }

  /**
   * Power leaderboard, top right: one chip per player (rank, name, power = minerals carried). When the
   * order changes the chips slide to their new places; a chip pops orange when that player scores a
   * kill, and one that climbed gets a brief glow while it moves.
   */
  private drawBoard(w: number): void {
    const rows = [...this.net.roster.values()].sort((a, b) => b.power - a.power || a.id - b.id).slice(0, 8);
    const cw = Math.min(BOARD_CHIP_W, w * 0.34);
    const right = w - 10;
    const top = intents.touch ? 12 : 30;
    const ch=intents.touch?17:BOARD_CHIP_H;
    const now = this.time.now;
    this.boardTitle.setPosition(right, top).setVisible(rows.length > 0);
    const keep = new Set(rows.map((r) => r.id));
    for (const [id, chip] of this.board) {
      if (!keep.has(id)) {
        chip.box.destroy();
        this.board.delete(id);
      }
    }
    rows.forEach((r, rank) => {
      const target = top + 15 + ch / 2 + rank * (ch + (intents.touch?2:4));
      let chip = this.board.get(r.id);
      if (!chip) {
        const g = this.add.graphics();
        const rankT = text(this, 0, 0, '', 11, '#8fa2c8').setOrigin(0, 0.5);
        const nameT = text(this, 0, 0, '', 12).setOrigin(0, 0.5);
        const killsT = text(this, 0, 0, '', 12, '#ffffff').setOrigin(0.5);
        const fragsT = text(this, 0, 0, '', 11, '#ffb37a').setOrigin(1, 0.5);
        const levelT = text(this, 0, 0, '', 9, '#9faec1').setOrigin(1, .5);
        const box = this.add.container(right - cw / 2, target, [g, rankT, nameT, levelT, fragsT, killsT]).setDepth(950);
        chip = { box, g, rankT, nameT, killsT, fragsT, levelT, y: target, kills: r.kills, rank, poppedAt: -1e9, climbedAt: -1e9, width: 0 };
        this.board.set(r.id, chip);
      }
      if (r.kills > chip.kills) chip.poppedAt = now;
      if (rank < chip.rank) chip.climbedAt = now;
      chip.kills = r.kills;
      chip.rank = rank;
      chip.y += (target - chip.y) * 0.18;
      if (Math.abs(target - chip.y) < 0.3) chip.y = target;

      const mine = r.id === this.net.myId;
      const pop = Math.max(0, 1 - (now - chip.poppedAt) / 600);
      const glow = Math.max(pop, Math.max(0, 1 - (now - chip.climbedAt) / 700) * 0.6);
      const bounty = this.net.bounty?.id === r.id;
      if (chip.width !== cw || pop > 0 || glow > 0 || chip.mine !== mine || chip.lastGlow !== 0 || chip.bounty !== bounty) {
        const g = chip.g;
        g.clear();
        panel(g,-cw/2,-ch/2,cw,ch,bounty?UI.uiGold:mine?UI.uiAccent:UI.uiBorder,mine);
        if (glow > 0) {
          g.fillStyle(0xffd27a, 0.35 * glow);
          g.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
        }
        g.lineStyle(1.5, bounty ? 0xffd36d : mine ? 0x5fe3ff : 0x3d4a66, bounty || mine ? 0.95 : 0.8);
        g.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, Math.min(UI.uiRadius,ch/3));
        // Power pill on the right.
        const pw = 34;
        g.fillStyle(pop > 0 ? 0xffb34a : mine ? 0x2a7f9c : 0x2a3550, 1);
        g.fillRoundedRect(cw / 2 - pw - 3, -ch / 2 + 3, pw, ch - 6, (ch - 6) / 2);
        chip.killsT.setPosition(cw / 2 - pw / 2 - 3, 0);
        chip.fragsT.setPosition(cw / 2 - pw - 8, 0);
        chip.levelT.setPosition(cw / 2 - pw - 48, 0);
        chip.rankT.setPosition(-cw / 2 + 9, 0);
        chip.nameT.setPosition(-cw / 2 + 26, 0);
        chip.width = cw;
        chip.mine = mine;
        chip.lastGlow = glow;
        chip.bounty = bounty;
      }
      // The bounty holder's rank shows a gold star.
      const rankLabel = bounty ? '★' : `${rank + 1}`;
      if (chip.rankT.text !== rankLabel) chip.rankT.setText(rankLabel).setColor(bounty ? '#ffd23a' : '#8fa2c8');
      const badge=unlockById(r.look?.badge)?.glyph;
      const displayName=r.bot===true?`◇ ${r.name}`:badge?`${badge} ${r.name}`:r.name;
      const nameKey=displayName+':'+cw;
      if (chip.nameKey !== nameKey) {
        chip.nameKey=nameKey;
        chip.nameT.setText(displayName);
        // Long names are cut to fit between the rank and the kills pill.
        const room = cw - 26 - 40 - 34 - 36;
        let n = displayName;
        while (chip.nameT.width > room && n.length > 1) chip.nameT.setText((n = n.slice(0, -1)) + '…');
      }
      const tagColour=unlockById(r.look?.tag)?.colour;
      const colour=tagColour!==undefined?css(tagColour):mine?'#9fefff':r.bot===true?'#a9bdcf':'#dfe8ff';
      if(chip.nameT.style.color!==colour)chip.nameT.setColor(colour);
      if (chip.killsT.text !== `${r.power}`) chip.killsT.setText(`${r.power}`);
      chip.levelT.setText(r.level === undefined ? 'Lv.–' : `Lv.${r.level}`);
      // Player kills only (asteroids never score), next to the power pill.
      const frags = `${r.kills} KO`;
      if (chip.fragsT.text !== frags) chip.fragsT.setText(frags);
      // A chip on the move draws over the one it is passing.
      chip.box.setPosition(right - cw / 2, chip.y).setScale(1 + 0.12 * Math.sin(pop * Math.PI)).setDepth(glow > 0 ? 951 : 950);
    });
  }

  /**
   * After our ship is destroyed: who did it, and Respawn (back onto this planet) or Menu.
   * Keyboard: Space or J respawns, Esc goes to the menu. Returns true if the scene was left.
   */
  private deathScreen(w: number, h: number, extracted = false): boolean {
    if (!this.deathShownAt) {
      this.deathShownAt = this.time.now;
      // Run history (always recorded; shown in the hangar with the Run history unlock).
      recordRun({
        at: Date.now(),
        planet: this.planet,
        outcome: extracted ? 'extracted' : 'destroyed',
        salvage: extracted ? this.net.extracted?.salvage ?? 0 : Math.floor(this.net.predicted?.salvage ?? 0),
        kills: extracted ? this.net.extracted?.kills ?? 0 : this.net.roster.get(this.net.myId)?.kills ?? 0,
        seconds: Math.round((Date.now() - this.runStartedAt) / 1000),
      });
      const by = this.net.death?.killer ? `Destroyed by ${this.net.death.killerName || 'another pilot'}` : 'Your ship was destroyed';
      const x = this.net.extracted;
      // Extracted: the run's result. Banking the haul as currency comes with the bank milestone.
      this.message.setAlign('center').setText(extracted ? `EXTRACTED\nSalvage ${x?.salvage ?? 0}  ·  Power ${x?.power ?? 0}  ·  ${x?.kills ?? 0} KO` : by);
      const bw = 140;
      const bh = 44;
      this.deathButtons = (['respawn', 'menu'] as const).map((id, i) => {
        const x = w / 2 + (i === 0 ? -1 : 1) * (bw / 2 + 10);
        const y = h * 0.3 + 56;
        return { id, x, y, w: bw, h: bh, label: text(this, x, y, id === 'respawn' ? (extracted ? 'DROP IN' : 'RESPAWN') : 'MENU', 16).setOrigin(0.5).setDepth(961) };
      });
    }
    // Extracted: the bank's answer arrives a moment later.
    if (extracted) {
      const x = this.net.extracted;
      const b = this.net.banked;
      const line = !b ? `Salvage ${x?.salvage ?? 0}  ·  banking…` : b.error ? `Salvage ${x?.salvage ?? 0} not banked (${b.error})` : `Banked +${b.amount}  ·  Credits ${b.balance}`;
      const want = `EXTRACTED\n${line}`;
      if (this.message.text !== want) this.message.setText(want);
    }
    // The buttons appear after the explosion has had a moment.
    const ready = this.time.now - this.deathShownAt > 700;
    const g = this.overlay;
    if(ready){g.fillStyle(0x050b15,.55);g.fillRect(0,0,w,h);panel(g,w/2-165,h*.3-28,330,116,extracted?UI.uiAccent:UI.uiDanger);}
    for (const b of this.deathButtons) {
      b.label.setVisible(ready);
      if (!ready) continue;
      panel(g,b.x-b.w/2,b.y-b.h/2,b.w,b.h,b.id==='respawn'?UI.uiAccent:UI.uiBorder,b.id==='respawn');
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
    this.rocks.begin();
    for (const { a, x, y } of this.net.asteroidRender()) {
      const r = TUNE.asteroid.radius[a.size];
      if (!this.toScreen(x, y).visible) continue;
      const flash = now - (this.net.asteroidHitAt.get(a.id) ?? -1e9) < 90;
      this.rocks.draw(a.id,x,y,r,a.hp/TUNE.asteroid.hp[a.size],flash,light,this.frame.sun,(px,py)=>this.toScreen(px,py),a.size,a.family);
    }
    this.rocks.end();
    // Cosmetic bob and sparkle never alter the server's pickup position or collection radius.
    for (const item of this.net.pickups.values()) {
      const at = this.toScreen(item.x, item.y);
      if (!at.visible) continue;
      if (item.kind === 'salvage') {
        // Gold salvage (placeholder): a spinning gold coin with a glow.
        const r = (8 + Math.sqrt(item.value) * 1.6) * at.scale;
        const spin = Math.abs(Math.cos(now / 260 + item.id));
        g.fillStyle(0xffd23a, 0.25 + 0.15 * Math.sin(now / 180 + item.id));
        g.fillCircle(at.x, at.y, r * 1.8);
        g.fillStyle(0xb8860b, 1);
        g.fillEllipse(at.x, at.y, r * 2 * Math.max(0.2, spin), r * 2);
        g.fillStyle(0xffe27a, 1);
        g.fillEllipse(at.x, at.y, r * 1.5 * Math.max(0.15, spin), r * 1.5);
        continue;
      }
      const mineral = item.kind === 'mineral';
      const r = (mineral ? 7 + Math.sqrt(item.value) * 3 : TUNE.asteroid.pickupRadius * .6) * at.scale;
      drawPickup(g, at, r, mineral, item.id, now);
    }
    // Ship explosions.
    const dt = Math.min(0.05, this.game.loop.delta / 1000);
    this.explosions = this.explosions.filter((x) => !x.done);
    for (const x of this.explosions) {
      x.update(dt);
      const at = this.toScreen(x.x, x.y);
      if (!at.visible) continue;
      const t = x.age / Explosion.LIFE;
      drawExplosionCore(g,at,t);
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
      if(e.sparkAngle!==undefined){drawHitSpark(g,at,k,e.sparkAngle,e.x+e.y);continue;}
      g.lineStyle(3, e.colour, (1 - k) * (e.chips ? .4 : 1));
      g.strokeCircle(at.x, at.y, e.r * (0.4 + k) * at.scale);
      if (e.heal) {
        g.fillStyle(e.colour, 1-k);
        for(let i=0;i<3;i++) {const x=at.x+(i-1)*12*at.scale,y=at.y-(10+k*35+i*5)*at.scale,r=3*at.scale;
          g.fillRect(x-r*.35,y-r,r*.7,r*2);g.fillRect(x-r,y-r*.35,r*2,r*.7);}
      }
      for (let i = 0; i < (e.chips ?? 0); i++) {
        const a = i * 2.399 + e.x + e.y;
        const d = e.r * (0.2 + k * 1.5) * at.scale;
        const size = Math.max(1, (3 + i % 3) * at.scale * (1 - k * .4));
        g.fillStyle(i % 3 ? 0xa88b76 : e.colour, 1 - k);
        g.fillRect(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, size, size * .7);
      }
    }
    // Threat silhouettes and lock cues always draw after translucent explosion/collection effects.
    for (const b of this.net.bullets) {
      const len = b.small ? 0.012 : 0.018;
      const head = this.toScreen(b.x, b.y);
      const tail = this.toScreen(b.x - b.vx * len, b.y - b.vy * len);
      if (!head.visible || !tail.visible) continue;
      drawBullet(g,head,tail,b.mine,!!b.small,b.look??0);
    }
    // Missiles and mines. Missiles are carried forward from the last snapshot so they fly smoothly.
    const tNow = performance.now();
    for (const o of this.net.ordnance.values()) {
      const ahead = o.kind === 0 ? Math.min(0.12, (tNow - o.at) / 1000) * TUNE.missile.maxSpeed * 0.85 : 0;
      const at = this.toScreen(o.x + Math.cos(o.heading) * ahead, o.y + Math.sin(o.heading) * ahead);
      if (!at.visible) continue;
      if(o.kind===0){
        let trail=this.missileTrails.get(o.id);
        if(!trail)this.missileTrails.set(o.id,trail=[]);
        if(!trail.length || now-trail[trail.length-1].at>40)trail.push({x:o.x,y:o.y,at:now});
        while(trail.length>8 || (trail.length && now-trail[0].at>360))trail.shift();
        for(let i=0;i<trail.length;i++){const q=this.toScreen(trail[i].x,trail[i].y);if(!q.visible)continue;
          g.fillStyle(0x93b4c5,.18*(i+1)/trail.length);g.fillCircle(q.x,q.y,(2+(trail.length-i)*.65)*q.scale);}
      }
      drawOrdnance(g,o,at,o.owner===this.net.myId,now,TUNE.mine.triggerRadius);
    }
    for(const id of this.missileTrails.keys())if(!this.net.ordnance.has(id))this.missileTrails.delete(id);

    // Warping ships (everyone sees them, so they can give chase): a cyan ring that fills with progress.
    {
      const warping: ShipState[] = this.net.remoteRender().map((r) => r.s);
      const own = this.net.predicted;
      if (own && !this.net.death && !this.net.extracted) warping.push(own);
      for (const s of warping) {
        if (!s.warping) continue;
        const at = this.toScreen(s.x, s.y);
        if (!at.visible) continue;
        const r = 50 * at.scale * shipRadius(s.hullMax, TUNE, s.chassis) / TUNE.ship.radius;
        const f = Math.min(1, s.warpDist / TUNE.warp.distance);
        g.lineStyle(2, 0x7fe9ff, 0.35);
        g.strokeCircle(at.x, at.y, r);
        g.lineStyle(3, 0x7fe9ff, 0.9);
        g.beginPath();
        g.arc(at.x, at.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
        g.strokePath();
      }
    }
    // Missile lock: brackets on the ship a missile would lock onto now.
    const me = this.net.predicted;
    if (me && me.missileCharges > 0 && !this.net.death) {
      const ships = this.net.remoteRender().map((r) => [r.id, r.s] as [number, ShipState]);
      const lock = missileLock(this.net.myId, me, ships, TUNE);
      const tgt = ships.find(([id]) => id === lock)?.[1];
      if (tgt && this.toScreen(tgt.x,tgt.y).visible) {
        const at = this.toScreen(tgt.x, tgt.y);
        const R = 34 * at.scale;
        const L = 10 * at.scale;
        g.lineStyle(2, 0xff5a3a, 0.9);
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          g.lineBetween(at.x + sx * R, at.y + sy * R, at.x + sx * (R - L), at.y + sy * R);
          g.lineBetween(at.x + sx * R, at.y + sy * R, at.x + sx * R, at.y + sy * (R - L));
        }
      }
    }
    // Missiles in flight: a lock crosshair on the target, seen by the pilot who fired and by the
    // pilot it is locked on (owner design); the target also gets a MISSILE LOCK warning.
    let lockedOnMe = false;
    for (const o of this.net.ordnance.values()) {
      if (o.kind !== 0 || !o.target) continue;
      if (o.target === this.net.myId && me && !this.net.death) {
        lockedOnMe = true;
        const at = this.toScreen(me.x, me.y);
        this.drawCrosshair(g, at.x, at.y, 40 * at.scale * shipRadius(me.hullMax, TUNE, me.chassis) / TUNE.ship.radius, now);
      } else if (o.owner === this.net.myId) {
        const tgt = this.net.remoteRender().find((r) => r.id === o.target)?.s;
        if (!tgt) continue;
        const at = this.toScreen(tgt.x, tgt.y);
        if (at.visible) this.drawCrosshair(g, at.x, at.y, 40 * at.scale * shipRadius(tgt.hullMax, TUNE, tgt.chassis) / TUNE.ship.radius, now);
      }
    }
    this.lockedOnMe = lockedOnMe;

  }

  /** Local hull damage only: seven fading border bands, never a centre-screen overlay. */
  private drawHullBorder(w:number,h:number):void {
    const g=this.hullBorder;g.clear();
    const age=this.time.now-this.hullHitAt;
    if(age<0 || age>=140)return;
    const fade=(1-age/140)**2;
    for(let i=0;i<7;i++){const inset=i*4+2;
      g.lineStyle(4,0xffa67d,.075*fade*(1-i/7)**2);g.strokeRect(inset,inset,w-inset*2,h-inset*2);}
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
      extracted: '',
    };
    if (!n.death && n.status !== 'destroyed' && !n.extracted && n.status !== 'extracted') this.message.setText(n.status === 'open' && !own ? 'Dropping in…' : msg[n.status]);
    if (DEBUG && own) {
      this.coords.setText(`x ${own.x.toFixed(0)}  y ${own.y.toFixed(0)}  pending ${n.pendingCount}  corr ${n.lastCorrection.toFixed(1)}`);
    }
  }
}

const BOARD_CHIP_W = 224;
const BOARD_CHIP_H = 22;

interface BoardChip {
  box: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  rankT: Phaser.GameObjects.Text;
  nameT: Phaser.GameObjects.Text;
  killsT: Phaser.GameObjects.Text;
  /** Player kills this life. */
  fragsT: Phaser.GameObjects.Text;
  levelT: Phaser.GameObjects.Text;
  /** Current (gliding) y; the chip eases toward its rank's slot. */
  y: number;
  kills: number;
  rank: number;
  poppedAt: number;
  climbedAt: number;
  width: number;
  mine?: boolean;
  lastGlow?: number;
  bounty?: boolean;
  nameKey?: string;
}

interface DrawnShip {
  /** Ship type and palette it was built for: a change (evolving, a new palette) rebuilds it. */
  readonly chassis: number;
  readonly palette: number;
  /** Wear bought cosmetics (sim/unlocks.ts). */
  setLook(look: Look): void;
  fire(side: number): void;
  shieldHit(angle: number): void;
  update(at: ShipPlacement, s: ShipState, timeMs: number): void;
  destroy(): void;
}

/** The approved Human Nomad rig with its thruster exhaust. */
class RigShip implements DrawnShip {
  private view: ShipView;

  constructor(scene: Phaser.Scene, mine: boolean, readonly chassis = 0, readonly palette = 0) {
    this.view = new ShipView(scene, mine, chassis, palette);
  }

  setLook(look: Look): void {
    const u = (id?: string) => (id ? unlockById(id) : undefined);
    this.view.setLook(u(look.tint)?.colour ?? null, u(look.flame)?.palette ?? null, u(look.shield)?.colour ?? null);
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

  constructor(scene: Phaser.Scene, private mine: boolean, readonly chassis = 0, readonly palette = 0) {
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

  setLook(): void {
    // The placeholder triangle has no art to recolour.
  }

  shieldHit(): void {
    // No shield effect on the placeholder.
  }

  destroy(): void {
    this.g.destroy();
  }
}
