import { rankPilots, mineralCount } from '../../sim/leaderboard';
import { drawCombatImpact, drawShieldShatter,drawRamAttack } from '../render/combatEffects';
import { shipDestructionPose,SHIP_SMALL_BLASTS,SHIP_DESTRUCTION_MS } from '../render/shipDestruction';
import type { CombatImpact } from '../render/combatEffects';
import {drawEvolve,drawWarpCharge,drawWarpLaunch,drawCapitalEscort,shipTagClearance,EVOLVE_ART_MS,WARP_LAUNCH_ART_MS} from '../render/progressionArt';
import { CombatHud } from '../render/combatHud';
import type { CombatHudAnchor } from '../render/combatHud';
import { drawTargetMeter, drawNoseMarker, drawSalvageZoneRing, drawConnectionBanner } from '../render/flightIndicators';
import { CombatSprites } from '../render/combatSprites';
import { CrystalChips } from '../render/crystalChips';
import { BuildingRigs } from '../render/buildingRig';
import { OrbitalTransition, remoteArrivalPose } from '../render/orbitalTransition';
import type { OrbitalPose } from '../render/orbitalTransition';
import { drawOrbitalEffects, drawArrivalTrail, drawLandingSpark, LANDING_SPARK_MS } from '../render/orbitalEffects';
import { mobileHeader } from '../render/mobileFlightUi';
import { shipPreview } from '../render/shipPreview';
import type { FFDControl } from '../render/shipTilt';
import {configVersion} from '../liveConfig';
// On a planet. The view is centred on your ship. Gameplay is a flat wrapping map; everything is
// drawn through the planet projection (render/planet.ts) so the map reads as a ball seen from above,
// lit by one fixed sun as the planet turns and you travel over it.
import Phaser from 'phaser';
import { TUNE } from '../../sim/tune';
import { PLANETS } from '../../sim/planets';
import type { PlanetId } from '../../sim/planets';
import { TUTORIAL } from '../../sim/planets';
import { CLOSE } from '../../sim/protocol';
import { guide } from '../tutorial/guide';
import { localTransport } from '../tutorial/localServer';
import { maxShield, shipRadius, powerGrowth, topSpeed } from '../../sim/ship';
import { TURRET_MOUNTS, turretCount } from '../../sim/turrets';
import { BATTLECRUISER, TURRET_MOUNTS_BY_CHASSIS, chassisStats, upgradeTotal,GUNS } from '../../sim/chassis';
import { SHOP_ITEMS, canBuy, shopOffer, shopTier, EVOLVE_ITEM, canEvolve } from '../../sim/shop';
import type { ShipState } from '../../sim/ship';
import { wrapDelta } from '../../sim/wrap';
import { DEBUG, DEBUG_ROTATION, logicalSize } from '../base';
import { clientTune } from '../clientTune';
import { intents } from '../input/intents';
import { NetClient, closeReason } from '../net/client';
import type { NetFx } from '../net/client';
import { CLANS, clanName, planetClan, isWarPlanet } from '../../sim/planets';
import { isDocked, padUnder } from '../../sim/clanBase';
import { fitCamera, text, versionStamp } from './common';
import { ShipView } from '../render/shipView';
import { shipArtStatus,buildShadow,CALIBRATION,SHADOW_ANCHOR } from '../render/shipArt';
import { lightingRadius, planetFrame, projectOffset, shipShadow, sunState } from '../render/planet';
import type { PlanetFrame } from '../render/planet';
import { PlanetGround } from '../render/planetGround';
import { drawClanBase, styleClanBanner } from '../render/clanBaseArt';
import { Explosion } from '../render/explosion';
import { loadSave, recordRun } from '../save';
import type { ShipPlacement } from '../render/shipView';
import { missileLock } from '../../sim/ordnance';
import { UI, css, panel, controlFace, controlClearRight } from '../render/ui';
import { unlockById } from '../../sim/unlocks';
import type { Look } from '../../sim/unlocks';
import { drawPickup, drawOrdnance, drawExplosionCore, drawBullet, drawDrone, drawHitSpark } from '../render/worldArt';
import { PixelRocks } from '../render/rockPixels';
import { PaintedRocks, paintedRocksReady } from '../render/rockPainted';

const W = TUNE.world.width;
const H = TUNE.world.height;
const SPACE = 0x060b17;

/** How long a target's health bar stays after your last hit on it. */
const TARGET_BAR_MS = 5000;

/** Placeholder clan planet skins (owner, Clan planets v0): the ground tinted in the clan's hue. */
const PLANET_TINT: Record<number, [number, number, number]> = { 1: [1.35, 0.72, 0.74], 2: [0.55, 0.82, 1.55] };

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
  private ordnanceCues!: Phaser.GameObjects.Graphics;
  /** Painted rocks (owner art); the pixel rocks only if that art failed to load. */
  private rocks!: PixelRocks | PaintedRocks;
  private hullBorder!: Phaser.GameObjects.Graphics;
  private hullHitAt=-1e9;
  private missileTrails = new Map<number, {x:number;y:number;at:number}[]>();
  private mineMotion = new Map<number,{x:number;y:number;movedAt:number}>();
  private effects: { x: number; y: number; at: number; r: number; ms: number; colour: number; chips?: number; heal?: boolean; sparkAngle?: number; shatter?: boolean; combat?:CombatImpact; progression?:'evolve'|'warp'; palette?:number; followId?:number }[] = [];
  private explosions: Explosion[] = [];
  private dyingShips=new Map<number,{ship:DrawnShip;state:ShipState;at:number;blasts:number;killer:number}>();
  private deathSeen=new Map<number,number>();
  shipDeathSmall=0;shipDeathFinals=0;ramAttackFrames=0;
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
  private combatHud!: CombatHud;
  private hudAnchor:CombatHudAnchor={x:0,y:0,radius:40,visible:false};
  private combatSprites!: CombatSprites;
  private crystalChips!:CrystalChips;
  private buildingRigs!:BuildingRigs;
  private orbital=new OrbitalTransition();
  private orbit:OrbitalPose=this.orbital.update(0,false,false,false);
  private remoteArrivals=new Map<number,{settledAt:number}>();
  private orbitalUi=new Map<Phaser.GameObjects.GameObject & {alpha:number;setAlpha(v:number):unknown},number>();
  private orbitGfx!:Phaser.GameObjects.Graphics;
  private landingGfx!:Phaser.GameObjects.Graphics;
  private landingSparks:{x:number;y:number;heading:number;at:number}[]=[];
  private lastOwn:ShipState|null=null;
  private mobilePanel: 'shop' | 'board' | null = null;
  private mobileButtons: { action: 'shop' | 'board'; x: number; y: number; w: number }[] = [];
  private mobileNavLabels: Phaser.GameObjects.Text[] = [];
  private evolvePreview!: Phaser.GameObjects.Container;
  /** Charge counts on the missile and mine buttons. */
  private weaponTexts: Phaser.GameObjects.Text[] = [];
  /** Bounty label: over the holder's ship, at the edge tracker, or "BOUNTY ON YOU". */
  private bountyText!: Phaser.GameObjects.Text;
  /** Label on the warp button: lockdown countdown, WARP, or warp progress and CANCEL. */
  private warpText!: Phaser.GameObjects.Text;
  /** Hot zone label: on the zone when in view, else on its edge tracker. */
  private hotZoneText!: Phaser.GameObjects.Text;
  /** Edge markers for clan base landmarks (treasury, gate). */
  private baseMarkerTexts: Phaser.GameObjects.Text[] = [];
  /** PC key hints, bottom left (owner, 16 November 2026; menu setting KEY HINTS). */
  private keyHints!: Phaser.GameObjects.Text;
  private keyHintsOn = true;
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
    this.hudAnchor.visible=false;
    this.orbital.reset();
    this.remoteArrivals.clear();
    this.landingSparks=[];
    this.orbitalUi.clear();
    this.lastOwn=null;
    this.deathSeen.clear();
    this.runStartedAt = Date.now();
    this.mobilePanel = null;
    this.ships.clear();
    // The tutorial planet plays against a room running in this page (src/tutorial).
    this.net = this.planet === TUTORIAL ? new NetClient(this.planet, loadSave().name ?? '', 0, localTransport) : new NetClient(this.planet, loadSave().name ?? '', loadSave().clan ?? 0);
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
      this.combatSprites?.destroy();
      this.crystalChips?.destroy();
      this.buildingRigs?.destroy();
      for(const d of this.dyingShips.values())d.ship.destroy();this.dyingShips.clear();
      for(const ship of this.ships.values())ship.destroy();
      this.ships.clear();this.orbitalUi.clear();
      intents.dashButton = null;
      intents.schemeButton = null;
      intents.fireButton = null;
      intents.missileButton = null;
      intents.mineButton = null;
      intents.warpButton = null;
      intents.shopZones = [];
      intents.uiZones = [];
    });
    intents.drainTaps();
  }

  private build(): void {
    const falling=[...this.dyingShips.entries()];
    this.combatSprites?.destroy();
    this.crystalChips?.destroy();
    this.buildingRigs?.destroy();
    for(const d of this.dyingShips.values())d.ship.destroy();this.dyingShips.clear();
    for(const ship of this.ships.values())ship.destroy();
    this.children.getAll().forEach(child=>child.destroy());
    this.orbitalUi.clear();
    this.ships.clear();
    this.tags.clear();
    this.board.clear();
    this.deathButtons = [];
    fitCamera(this);
    this.cameras.main.setBackgroundColor(SPACE);
    this.ground = new PlanetGround(this, 1, PLANET_TINT[planetClan(this.planet)] ?? [1, 1, 1], isWarPlanet(this.planet)?'warzone':undefined);
    this.world = this.add.graphics().setDepth(15);
    this.ordnanceCues = this.add.graphics().setDepth(27);
    this.rocks = paintedRocksReady() ? new PaintedRocks(this) : new PixelRocks(this);
    this.turretGfx = this.add.graphics().setDepth(23);
    this.orbitGfx=this.add.graphics().setDepth(899);
    this.landingGfx=this.add.graphics().setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    this.overlay = this.add.graphics().setDepth(900);
    if (this.planet === TUTORIAL) guide.attach(this);
    this.hullBorder=this.add.graphics().setDepth(940);
    const { w } = logicalSize();
    this.status = text(this, w / 2, 6, '', 12, '#b8c6e6').setOrigin(0.5, 0).setDepth(950);
    this.coords = text(this, 8, 16, '', 10, '#7d8db0').setDepth(950).setVisible(DEBUG);
    this.schemeLabel = text(this, 0, 0, '', 11, '#dfe8ff').setOrigin(0.5).setDepth(951).setVisible(false);
    this.message = text(this, w / 2, logicalSize().h * 0.3, '', 18, '#ffffff').setOrigin(0.5).setDepth(950);
    // Clan planets v0 labels: treasury, gate, and the arrival / docking banner.
    this.treasuryText = text(this, 0, 0, '', 12, '#ffe7b0').setOrigin(0.5).setDepth(31).setAlign('center').setVisible(false);
    this.gateText = text(this, 0, 0, 'GATE', 12, '#ffb4a2').setOrigin(0.5).setDepth(31).setVisible(false);
    this.banner = text(this, w / 2, 86, '', 14, '#ffe2b8').setOrigin(0.5).setDepth(951).setAlign('center').setVisible(false);
    this.arrivedAt = performance.now();
    this.baseAim = [];
    this.baseFiredAt = [];
    this.boardTitle = text(this, 0, 0, 'LEVEL · KO · MINERALS', 10, '#8fa2c8').setOrigin(1, 0).setDepth(950);

    this.hotZoneText = text(this, 0, 0, '', 11, '#7dffc4').setOrigin(0.5).setDepth(953).setVisible(false);
    this.keyHintsOn = loadSave().keyHints !== false;
    this.keyHints = text(this, 0, 0, '', 10, '#8fa2c8').setOrigin(0, 1).setDepth(950).setAlpha(0.75).setVisible(false);
    this.baseMarkerTexts = [0, 1].map(() => text(this, 0, 0, '', 10, '#ffffff').setOrigin(0.5).setDepth(953).setVisible(false));
    this.warpText = text(this, 0, 0, '', 12, '#ffffff').setOrigin(0.5).setDepth(953).setVisible(false);
    this.bountyText = text(this, 0, 0, '', 11, '#ffd23a').setOrigin(0.5).setDepth(953).setVisible(false);
    this.lockText = text(this, 0, 0, 'MISSILE LOCK', 13, '#ff5a3a').setOrigin(0.5).setDepth(953).setVisible(false);
    this.weaponTexts = [0, 1].map(() => text(this, 0, 0, '', 12, '#ffffff').setOrigin(0.5).setDepth(952).setVisible(false));
    this.combatHud = new CombatHud(this);
    this.combatSprites = new CombatSprites(this);
    this.crystalChips=new CrystalChips(this);
    this.buildingRigs=new BuildingRigs(this);
    this.mobileNavLabels = [0,1].map(() => text(this,0,0,'',11).setOrigin(.5).setDepth(954).setVisible(false));
    this.evolvePreview = shipPreview(this,2,0,0,0,18,16).setDepth(952).setVisible(false);
    this.shopTexts = [...SHOP_ITEMS, 'evolve'].map(() => ({
      title: text(this, 0, 0, '', 12, '#ffffff').setOrigin(0, 0.5).setDepth(951).setVisible(false),
      sub: text(this, 0, 0, '', 10, '#c9d6f2').setOrigin(0, 0.5).setDepth(951).setVisible(false),
    }));
    versionStamp(this);
    for(const [id,d] of falling){
      const ship=shipArtStatus==='ready'?new RigShip(this,id===this.net.myId,d.state.chassis,d.ship.palette):new PlaceholderShip(this,id===this.net.myId,d.state.chassis,d.ship.palette);
      ship.setLook(this.net.roster.get(id)?.look??{});
      this.dyingShips.set(id,{...d,ship});
    }
  }

  private lastConfigVersion='';
  update(): void {
    if(this.planet===TUTORIAL){guide.syncRules();if(!guide.policy.shop&&this.mobilePanel==='shop')this.mobilePanel=null;}
    if(this.lastConfigVersion!==configVersion){for(const ship of this.ships.values())ship.destroy();this.ships.clear();if(shipArtStatus==='ready')buildShadow(this);this.lastConfigVersion=configVersion;}
    const dead = !!this.net.death || this.net.status === 'destroyed';
    const dash = intents.consume('secondary');
    const missile = intents.consume('missile');
    const mine = intents.consume('mine');
    const over = dead || !!this.net.extracted || this.net.status === 'extracted' || this.net.status === 'lost';
    // R is Warp in flight and Respawn on the death screen, which reads it itself.
    const warp = !over && intents.consume('warp');
    if (!over) {
      intents.consume('primary');
      // No menu exit mid-run: leave by warping out (lockdown, then Warp). The tutorial lets Esc leave.
      if (intents.consume('pause') && this.planet === TUTORIAL) {
        this.net.close();
        this.scene.start('menu');
        return;
      }
    }
    if (intents.consume('scheme')) intents.toggleScheme();
    const heading = this.net.predicted?.heading ?? 0;
    // The mouse marker steers from where our ship is on screen (last frame's projection).
    const shipAt = this.net.predicted && !over ? this.toScreen(this.net.predicted.x, this.net.predicted.y) : null;
    intents.mouseOrigin = shipAt && shipAt.visible ? { x: shipAt.x, y: shipAt.y } : null;
    const move = intents.flight(this.net.predicted?.speed ?? TUNE.ship.cruiseSpeed, this.net.speedFloorNow);
    const lessonFire=this.planet!==TUTORIAL||guide.policy.fire;
    this.net.update({ ...move, dash, fire: lessonFire&&intents.fire, missile:lessonFire&&missile, mine:lessonFire&&mine, warp });
    // Shop: each tap asks the server for the tier on offer now; the server checks power and price.
    for (const item of intents.consumeBuys()) {
      if(this.planet===TUTORIAL&&!guide.policy.shop)continue;
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
    if(own&&!dead&&!this.net.warDown&&!this.dyingShips.has(this.net.myId))this.deathSeen.delete(this.net.myId);
    const extracted=!!this.net.extracted || this.net.status==='extracted';
    if(own && !extracted && !dead)this.lastOwn={...own};
    const previousOrbit=this.orbit.phase;
    this.orbit=this.orbital.update(this.time.now,!!own,extracted,dead,own?.arrival);
    if(previousOrbit==='entry'&&this.orbit.phase==='flight'&&own&&!dead&&!extracted)this.landingSpark(own);
    const leaving=extracted && !dead && this.orbit.phase==='exit';
    const cameraShip=leaving?this.lastOwn:own;
    // After our ship is destroyed the view stays on the wreck.
    const bearing=(extracted?this.lastOwn:cameraShip)?.heading??0;
    const cx = ((extracted?this.lastOwn:cameraShip)?.x ?? this.net.death?.x ?? W / 2)+Math.cos(bearing)*this.orbit.travel;
    const cy = ((extracted?this.lastOwn:cameraShip)?.y ?? this.net.death?.y ?? H / 2)+Math.sin(bearing)*this.orbit.travel;
    // One frame for everything drawn this tick: where the view is on the ball and how the sun falls.
    // The planet's turn comes from the server's clock, so players in the same place see the same light.
    // Travel is measured from the middle of the map, so the drop zone starts in daylight.
    const rotationDeg = DEBUG_ROTATION ?? (this.net.asteroidTick() / TUNE.net.tickHz) * TUNE.planet.rotationDegPerSec;
    this.rotationDeg = rotationDeg;
    this.frame = planetFrame(cx - W / 2, cy - H / 2, rotationDeg, lightingRadius(W), sunState(TUNE.planet.sunAzimuthDeg, TUNE.planet.sunElevationDeg));
    this.view = { cx, cy, w, h, k: h / clientTune.render.referenceHeight * this.orbit.zoom };
    this.ground.update(w, h, this.view.k, this.frame);

    this.turretGfx.clear();
    const alive = new Set<number>();
    // Live ships follow snapshots; departure briefly retains only a cached visual after extraction.
    if (own && !dead && !this.net.extracted && this.net.status !== 'extracted' && !this.net.warDown) {
      alive.add(this.net.myId);
      this.placeShip(this.net.myId, own, true, move);
    }
    if(leaving && this.lastOwn){alive.add(this.net.myId);this.placeShip(this.net.myId,this.lastOwn,true);}
    for (const r of this.net.remoteRender()) {
      alive.add(r.id);
      this.placeShip(r.id, r.s, false);
    }
    const fx=this.net.drainFx();
    for(const f of fx)if(f.kind==='explosion')this.startShipDeath(f);
    if((dead||this.net.warDown)&&this.lastOwn&&!this.deathSeen.has(this.net.myId))this.startShipDeath({kind:'explosion',id:this.net.myId,ship:this.lastOwn,x:this.lastOwn.x,y:this.lastOwn.y,killer:0});
    for (const [id, ship] of this.ships) {
      if (!alive.has(id)) {
        ship.destroy();
        this.ships.delete(id);
        this.tags.get(id)?.destroy();
        this.tags.delete(id);
        this.turretAim.delete(id);
        this.remoteArrivals.delete(id);
      }
    }

    for (const f of fx) {
      if(f.kind==='crystal'){
        if(this.toScreen(f.x,f.y).visible)this.crystalChips.emit(f,this.time.now,TUNE.asteroid.radius[f.size]);
        continue;
      }
      if (f.kind === 'shot') this.ships.get(f.id)?.fire(f.side);
      else if (f.kind === 'baseTurret') {
        this.baseAim[f.index] = f.angle;
        this.baseFiredAt[f.index] = this.time.now;
      }
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
        continue; // Staged collapse owns the small blasts and final explosion.
      }
      else if (f.kind === 'shieldBreak') {
        // Broken shield cells drift outward rather than using the brown debris chips.
        const at = this.shipAt.get(f.id);
        if (at) {
          const s=f.id===this.net.myId?this.net.predicted:this.net.remoteRender().find(r=>r.id===f.id)?.s;
          const size=chassisStats(s?.chassis??0,TUNE).radius/TUNE.ship.radius;
          this.effects.push({ x: at.x, y: at.y, at: this.time.now, r: 70*size, ms: 420, colour: 0x9fe8ff, shatter: true });
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
        this.effects.push({ x:f.x,y:f.y,at:this.time.now,r:150,ms:WARP_LAUNCH_ART_MS,colour:0x7fe9ff,progression:'warp' });
      } else if (f.kind === 'blast') {
        // Shot down: a small white pop. Went off: an orange ring the size of the blast.
        if (f.shot) this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: Math.min(24,f.r), ms: 240, colour: 0xffffff, combat:'shot' });
        else {
          this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: f.r, ms: f.ordnance === 'mine' ? 480 : 320, colour: 0xff8a3a, combat:f.ordnance==='mine'?'mine':'missile' });
        }
      } else if (f.kind === 'ram') {
        this.ramCount++;
        this.effects.push({ x:f.x,y:f.y,at:this.time.now,r:70,ms:380,colour:0xffa04a,combat:'ram' });
      } else if (f.kind === 'mineral') this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: 24, ms: 420, colour: 0xffc14a, chips: 8 });
      else if (f.kind === 'heal') this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: TUNE.asteroid.pickupRadius, ms: 500, colour: 0x7dff9a, heal: true });
      else this.effects.push({ x: f.x, y: f.y, at: this.time.now, r: f.kind === 'burst' ? TUNE.asteroid.radius[f.size] : 9, ms: f.kind === 'burst' ? 420 : 180, colour: 0xffc78a, chips: f.kind === 'burst' ? 10 : 4, combat:f.kind==='burst'?'asteroid':undefined });
    }
    this.drawShipDeaths();
    this.drawWorld();
    this.landingGfx.clear();
    this.landingSparks=this.landingSparks.filter(s=>this.time.now-s.at<LANDING_SPARK_MS);
    for(const spark of this.landingSparks){const at=this.toScreen(spark.x,spark.y);if(at.visible)drawLandingSpark(this.landingGfx,at.x,at.y,at.scale,this.time.now-spark.at,spark.heading);}
    drawOrbitalEffects(this.orbitGfx,this.orbit,w,h,bearing,this.time.now);
    this.drawTouch(w, h);
    this.drawHullBorder(w,h);
    this.drawStatus(own);
    this.drawBoard(w);
    // A refused or closed connection (planet full, war lockdown) must show its message, never an endless hyperspace.
    const refused=this.net.status==='closed'||this.net.status==='full'||this.net.status==='lost';
    this.maskOrbitalUi(!refused&&(this.orbit.phase==='entry'||this.orbit.phase==='exit'||this.orbit.phase==='waiting'));

    if ((this.net.extracted || this.net.status === 'extracted') && !dead) {
      if (this.orbit.phase==='complete' && this.deathScreen(w, h, true)) return;
    } else if (this.net.death || this.net.status === 'destroyed') {
      if (this.deathScreen(w, h)) return;
    } else if (this.net.status === 'lost') {
      // The ship was lost while the connection was down (or the server restarted): drop in again.
      if (intents.consume('primary') || intents.consume('warp') || intents.drainTaps().length) {
        this.scene.restart({ planet: this.planet });
        return;
      }
    } else if (this.net.status === 'closed' || this.net.status === 'full') {
      for (const _ of intents.drainTaps()) {
        this.scene.start('menu');
        return;
      }
    } else {
      for (const tap of intents.drainTaps()) {
        const button = this.mobileButtons.find(b => Math.abs(tap.x-b.x)<=b.w/2 && Math.abs(tap.y-b.y)<=22);
        if (button) this.mobilePanel = this.mobilePanel === button.action ? null : button.action;
      }
    }
  }

  /** How far each ship has come down onto a landing pad (0 flying, 1 landed), eased per frame. */
  private landedLevel = new Map<number, number>();
  private treasuryText!: Phaser.GameObjects.Text;
  private gateText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private arrivedAt = 0;

  private landingSpark(s:ShipState):void {
    this.landingSparks.push({x:s.x,y:s.y,heading:s.heading,at:this.time.now});
    if(this.landingSparks.length>32)this.landingSparks.shift();
  }

  /** Let the pilot and travel read clearly; restore each UI object's original opacity on release. */
  private maskOrbitalUi(active:boolean):void {
    if(active){
      for(const child of this.children.getAll()){
        const o=child as Phaser.GameObjects.GameObject & {depth:number;alpha:number;setAlpha(v:number):unknown};
        if(o.depth<900||o.depth>=1000||typeof o.setAlpha!=='function')continue;
        if(!this.orbitalUi.has(o))this.orbitalUi.set(o,o.alpha);
        o.setAlpha(0);
      }
    }else{
      for(const [o,alpha] of this.orbitalUi)if(o.scene)o.setAlpha(alpha);
      this.orbitalUi.clear();
    }
  }
  private baseAim: number[] = [];
  private baseFiredAt: number[] = [];

  /** Warzone HUD texts (siege v0). */
  private siegeTexts: Phaser.GameObjects.Text[] = [];

  /**
   * Warzone (owner, 16 November 2026, placeholder look): the round panel at the top (phase,
   * countdowns, tickets, timer, tower/shield/Nexus health), destroyed towers and the shield's
   * strength drawn over the base, and the respawn countdown while destroyed at war. Display only.
   */
  private drawSiege(w: number, h: number): void {
    if (!this.siegeTexts.length) this.siegeTexts = [0, 1, 2].map(() => text(this, 0, 0, '', 11, '#ffffff').setOrigin(0.5, 0).setDepth(955).setVisible(false));
    const [t1, t2, t3] = this.siegeTexts;
    this.siegeTexts.forEach((t) => t.setVisible(false));
    const sg = this.net.siege, L = this.net.layout;
    if (!sg || !L || this.net.status !== 'open' || this.net.extracted) return;
    const g = this.overlay, tune = TUNE.siege;
    const crimson = CLANS[0], azure = CLANS[1];
    const clanCss = (id: number): string => css(CLANS.find((c) => c.id === id)?.colour ?? 0xffffff);
    const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const pw = Math.min(380, w - 24), px = w / 2, py = intents.touch ? 96 : 76;
    const atWar = sg.phase === 'war' || sg.phase === 'release';
    const ph = atWar ? 64 : 42;
    panel(g, px - pw / 2, py, pw, ph, sg.phase === 'over' ? UI.uiGold : atWar ? UI.uiDanger : UI.uiBorder);
    const line = (t: Phaser.GameObjects.Text, y: number, s: string, colour = '#ffffff', size = 11): void => {
      t.setVisible(true).setPosition(px, y).setFontSize(size).setText(s);
      if (t.style.color !== colour) t.setColor(colour);
    };
    if (sg.phase === 'peace') {
      line(t1, py + 6, 'WARZONE  ·  AZURE DEFENDS, CRIMSON ATTACKS', '#ffd27a');
      line(t2, py + 23, `Waiting for both clans  ·  Crimson ${sg.crimson}  ·  Azure ${sg.azure}`, '#c9d6f2', 10);
    } else if (sg.phase === 'countdown') {
      line(t1, py + 6, `WAR BEGINS IN ${sg.left}`, '#ff9b81', 13);
      line(t2, py + 24, `Crimson ${sg.crimson}  ·  Azure ${sg.azure}  ·  the planet locks when it starts`, '#c9d6f2', 10);
    } else if (sg.phase === 'over') {
      const who = sg.winner === crimson.id ? 'CRIMSON' : 'AZURE';
      const why = sg.reason === 'treasury' ? 'Nexus destroyed' : sg.reason === 'tickets' ? 'attackers out of tickets' : 'the defence held until time ran out';
      line(t1, py + 5, `${who} WINS`, clanCss(sg.winner), 14);
      line(t2, py + 24, `${why}  ·  next round in ${sg.left}`, '#c9d6f2', 10);
    } else {
      const left = sg.phase === 'release' ? `  ·  A SIDE LEFT: WAR ENDS IN ${sg.left}` : '';
      line(t1, py + 5, `TICKETS ${sg.tickets}  ·  ${mmss(sg.phase === 'war' ? sg.left : sg.left)}${left}`, sg.tickets <= 5 ? '#ff9b81' : '#ffffff');
      // Towers (pips), shield and Nexus bars.
      const bx = px - pw / 2 + 14, bw = pw - 28, y = py + 26;
      const pip = Math.min(18, (bw * 0.28) / sg.turrets.length);
      sg.turrets.forEach((hp, i) => {
        const f = Math.max(0, hp / tune.turretHp);
        g.fillStyle(0x0a1424, 1);
        g.fillRect(bx + i * (pip + 3), y, pip, 8);
        if (f > 0) { g.fillStyle(0xff9a6a, 1); g.fillRect(bx + i * (pip + 3), y, pip * f, 8); }
      });
      const bar = (x: number, wid: number, f: number, colour: number): void => {
        g.fillStyle(0x0a1424, 1); g.fillRect(x, y, wid, 8);
        if (f > 0) { g.fillStyle(colour, 1); g.fillRect(x, y, wid * Math.min(1, f), 8); }
      };
      const sx = bx + sg.turrets.length * (pip + 3) + 10, rest = bx + bw - sx, half = (rest - 10) / 2;
      bar(sx, half, sg.shield / tune.shieldHp, sg.broken ? 0x6b6f7a : 0x5ad3ff);
      bar(sx + half + 10, half, sg.treasury / tune.treasuryHp, 0xffd27a);
      line(t2, y + 11, `TOWERS ${sg.turrets.filter((v) => v > 0).length}/${sg.turrets.length}        SHIELD ${sg.broken ? 'BROKEN' : Math.round(sg.shield)}        NEXUS ${Math.round(sg.treasury)}`, '#c9d6f2', 9);

    }
    // Destroyed at war: back at your side's spawn soon (not a menu: the pilot stays on the planet).
    if (this.net.warDown) {
      const s = Math.max(0, Math.ceil((this.net.warDown.until - performance.now()) / 1000));
      line(t3, h * 0.42, s > 0 ? `DESTROYED  ·  RESPAWNING IN ${s}` : 'RESPAWNING…', '#ffbd91', 16);
    }
    void azure;
  }

  /** Arrival warning (owner): what kind of planet this is and what to expect. */
  private arrivalNote(): string {
    const home = planetClan(this.planet);
    if (this.planet === TUTORIAL) return '';
    if (isWarPlanet(this.planet)) return this.net.clan === home ? 'WARZONE · YOU DEFEND\nKeep the Nexus alive; you cannot fire from inside your shield' : 'WARZONE · YOU ATTACK\nDestroy the towers, break the shield, destroy the Nexus';
    if (this.planet === 'alpha') return 'LAWLESS SPACE\nBots will hunt you down';
    if (!home) return 'SATELLITE\nFarm and fight; no turrets, no shields';
    const owner = clanName(home).toUpperCase();
    return this.net.clan === home ? `${owner} HOME\nMine fuel for the Nexus; stop over a landing pad to dock and unload it` : `${owner} TERRITORY\nTheir turrets fire on sight. Their shield keeps you out`;
  }

  /**
   * Clan home planet: the shield
   * dome over the treasury and pads, the landing pads, the treasury with the clan's total, the base
   * turrets, and the gate where non-members arrive. Arrival warning and the docked banner.
   */
  private drawBase(p: ShipState | null, w: number, h: number): void {
    const layout = this.net.layout;
    const now = this.time.now;
    // Banner: arrival note for 6 s, then docking status at home.
    let note = '';
    if (performance.now() - this.arrivedAt < 6000) note = this.arrivalNote();
    if (this.net.docked) {
      const d = this.net.deposited;
      note = 'DOCKED · REPAIRING' + (d && performance.now() - d.at < 3000 ? `\n+${d.amount} fuel to the ${clanName(this.net.clan)} Nexus` : '');
    }
    this.banner.setVisible(!!note && this.net.status==='open' && !this.net.death && !this.net.extracted).setText(note).setPosition(w / 2, intents.touch ? 118 : 86);
    styleClanBanner(this.banner,layout?.clan??0,this.net.clan===layout?.clan,!!this.net.docked,w,intents.touch);
    this.treasuryText.setVisible(false);
    this.gateText.setVisible(false);
    if (!layout || !p) return;
    const labels=drawClanBase(this.world,{layout,own:p,member:this.net.clan===layout.clan,docked:!!this.net.docked,now,tune:TUNE,
      project:(x,y)=>this.toScreen(x,y),aim:this.baseAim,firedAt:this.baseFiredAt,impacts:this.effects,
      rigs:this.buildingRigs,sun:this.frame.sun,daylight:this.frame.daylight,brightness:this.objectLight(),
      siege:this.net.siege?{towers:this.net.siege.turrets.map(h=>h/TUNE.siege.turretHp),shield:this.net.siege.shield/TUNE.siege.shieldHp,nexus:this.net.siege.treasury/TUNE.siege.treasuryHp,broken:this.net.siege.broken}:undefined});
    if(labels.treasury){
      const at=labels.treasury,total=this.net.treasury?.total??0;
      const below=at.labelY??at.y+78*at.scale,labelY=!intents.touch&&below>h-138?at.y-220*at.scale:below;
      this.treasuryText.setVisible(true).setText(`${clanName(layout.clan).toUpperCase()} NEXUS\n${this.net.siege?`HEALTH ${Math.round(this.net.siege.treasury)} / ${TUNE.siege.treasuryHp}`:`FUEL ${total.toLocaleString('en-US')}`}`)
        .setPosition(at.x,labelY).setStroke('#102035',3);
    }
    if(labels.gate)this.gateText.setVisible(true).setPosition(labels.gate.x,labels.gate.y+145*labels.gate.scale).setStroke('#102035',3);
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

  private startShipDeath(f:Extract<NetFx,{kind:'explosion'}>):void {
    const now=this.time.now,last=this.deathSeen.get(f.id);
    if(last!==undefined&&now-last<3000)return;
    this.deathSeen.set(f.id,now);
    if(this.deathSeen.size>128)this.deathSeen.delete(this.deathSeen.keys().next().value!);
    const state=f.ship??(f.id===this.net.myId?this.lastOwn:null);
    if(!state){this.explosions.push(new Explosion(f.x,f.y));return;}
    const palette=unlockById(this.net.roster.get(f.id)?.look?.palette)?.index??0;
    const ship=this.ships.get(f.id)??(shipArtStatus==='ready'?new RigShip(this,f.id===this.net.myId,state.chassis,palette):new PlaceholderShip(this,f.id===this.net.myId,state.chassis,palette));
    this.ships.delete(f.id);
    this.tags.get(f.id)?.destroy();this.tags.delete(f.id);
    this.turretAim.delete(f.id);this.remoteArrivals.delete(f.id);
    this.dyingShips.get(f.id)?.ship.destroy();
    this.dyingShips.set(f.id,{ship,state:{...state,x:f.x,y:f.y,speed:0,dashTime:0,dashCharge:0,shield:0},at:now,blasts:0,killer:f.killer});
  }

  private drawShipDeaths():void {
    for(const [id,d] of this.dyingShips){
      const age=this.time.now-d.at,pose=shipDestructionPose(age),s=d.state;
      const at=this.toScreen(s.x,s.y),r=shipRadius(s.hullMax,TUNE,s.chassis);
      at.scale*=powerGrowth(s.hullMax,TUNE)*pose.scale;
      d.ship.update({...at,brightness:this.objectLight(clientTune.render.nightShipDim)*pose.brightness,shadowX:at.x,shadowY:at.y,shadowAlpha:this.frame.daylight,landed:pose.progress,destroying:true},s,this.time.now,{thrust:0,turn:0,aim:s.heading});
      while(d.blasts<SHIP_SMALL_BLASTS.length&&age>=SHIP_SMALL_BLASTS[d.blasts]){
        const n=d.blasts++,angle=n*2.4+id,spread=r*.65*(1-pose.progress*.4);
        if(age-SHIP_SMALL_BLASTS[n]<200)this.effects.push({x:s.x+Math.cos(angle)*spread,y:s.y+Math.sin(angle)*spread,at:this.time.now,r:Math.max(12,r*.3),ms:300,colour:0xffad65,combat:'missile'});
        this.shipDeathSmall++;
      }
      if(pose.finished){
        this.explosions.push(new Explosion(s.x,s.y,Math.random,Math.min(3,Math.max(1,Math.sqrt(chassisStats(s.chassis,TUNE).radius/TUNE.ship.radius)*powerGrowth(s.hullMax,TUNE)))));
        if(this.net.roster.get(d.killer)?.look?.killfx==='nova')this.effects.push({x:s.x,y:s.y,at:this.time.now,r:180,ms:800,colour:0xc68aff});
        d.ship.destroy();this.dyingShips.delete(id);this.shipDeathFinals++;
      }
    }
  }

  private placeShip(id: number, s: ShipState, mine: boolean, control?: FFDControl): void {
    // Ship type from the server (it changes when a ship evolves) and palette from the roster look.
    const palette = unlockById(this.net.roster.get(id)?.look?.palette)?.index ?? 0;
    let ship = this.ships.get(id);
    if(ship && ship.chassis!==s.chassis && s.chassis===BATTLECRUISER)this.effects.push({x:s.x,y:s.y,at:this.time.now,r:shipRadius(s.hullMax,TUNE,s.chassis),ms:EVOLVE_ART_MS,colour:0,progression:'evolve',palette,followId:id});
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
    const orbital=mine && (this.orbit.phase==='entry' || this.orbit.phase==='exit');
    // Hyperspace stays behind a level, full-speed pilot. The globe, not the ship, approaches.
    if(orbital){at.x=this.view.w/2;at.y=this.view.h/2;at.visible=true;at.scale=this.view.h/clientTune.render.referenceHeight*powerGrowth(s.hullMax,TUNE);}
    let opacity=1,trail=0;
    if(!mine){
      if((s.arrival??0)>0){
        if(!this.remoteArrivals.has(id))this.remoteArrivals.set(id,{settledAt:-1});
        const arrival=remoteArrivalPose(s.arrival??0);opacity=arrival.alpha;trail=arrival.alpha*arrival.trail;
        const ahead=this.toScreen(s.x+Math.cos(s.heading)*30,s.y+Math.sin(s.heading)*30);
        const angle=Math.atan2(ahead.y-at.y,ahead.x-at.x);
        at.x+=Math.cos(angle)*arrival.offset*at.scale;at.y+=Math.sin(angle)*arrival.offset*at.scale;
      }else{
        const arrival=this.remoteArrivals.get(id);
        if(arrival){if(arrival.settledAt<0){arrival.settledAt=this.time.now;this.landingSpark(s);}trail=Math.max(0,1-(this.time.now-arrival.settledAt)/650);if(!trail)this.remoteArrivals.delete(id);}
      }
      if(trail&&at.visible)drawArrivalTrail(this.turretGfx,at.x,at.y,s.heading,at.scale,trail,this.time.now,id);
    }
    if(mine){
      const size=chassisStats(s.chassis,TUNE).radius/TUNE.ship.radius;
      this.hudAnchor={x:at.x,y:at.y-4*at.scale,radius:Math.max(intents.touch?32:42,clientTune.render.shipRingRadius*clientTune.render.shipScale*size*at.scale+14*size),visible:at.visible&&!orbital};
    }
    // The hard shadow lies on the ground, away from the sun.
    const sh = shipShadow(this.frame.sun, clientTune.render.shadowReach);
    sh.x+=CALIBRATION.shadow.x-SHADOW_ANCHOR.x;sh.y+=CALIBRATION.shadow.y-SHADOW_ANCHOR.y;
    const shadow = this.toScreen(s.x + sh.x, s.y + sh.y);
    this.placeTag(id, at, mine, chassisStats(s.chassis, TUNE).radius / TUNE.ship.radius);
    this.tags.get(id)?.setAlpha(opacity);
    if(orbital)this.tags.get(id)?.setVisible(false);
    if (!mine && !(s.arrival??0)) this.drawTargetBar(id, s, at, chassisStats(s.chassis, TUNE).radius / TUNE.ship.radius);
    ship.setLook(this.net.roster.get(id)?.look ?? {});
    // Ships darken 30% on the night side (owner decision); asteroids and pickups only 10%.
    // Docked ships come down onto their pad (owner): eased so landing and take-off read smoothly.
    const docked = !orbital && isDocked(this.net.layout, mine ? this.net.clan : this.net.roster.get(id)?.clan ?? 0, s, TUNE);
    const was = this.landedLevel.get(id) ?? 0;
    const landed = was + ((docked ? 1 : 0) - was) * Math.min(1, this.game.loop.delta / 250);
    this.landedLevel.set(id, landed);
    ship.update({ ...at, brightness: orbital?1:this.objectLight(clientTune.render.nightShipDim), shadowX: shadow.x, shadowY: shadow.y, shadowAlpha: shadow.visible ? this.frame.daylight : 0, landed,opacity,warpForeground:orbital,
      orbitalLift:0,orbitalGroundAlpha:orbital?this.orbit.groundAlpha:opacity }, orbital?{...s,speed:topSpeed(s.hullMax,TUNE,s.chassis)}:s, this.time.now, orbital?{thrust:1,turn:0,aim:s.heading}:control);
    if(orbital || (s.arrival??0)>0)return;
    if(s.dashTime>0){
      const q=this.toScreen(s.x+Math.cos(s.heading)*30,s.y+Math.sin(s.heading)*30),angle=Math.atan2(q.y-at.y,q.x-at.x);
      const guns=GUNS[s.chassis],reach=guns?Math.max(...guns.map(g=>g.forward)):TUNE.weapon.muzzleForward;
      drawRamAttack(this.turretGfx,at,angle,reach+12,chassisStats(s.chassis,TUNE).radius*.95,this.time.now);this.ramAttackFrames++;
    }
    this.drawTurrets(id, s, at);
    if (s.dashCharge > 0) this.drawDashCharge(s, at, mine);
    else if (mine && at.visible) this.drawNose(s, at);
  }

  /**
   * Nose marker (owner, 15 November 2026): a small chevron just past your own ship's ring, where the
   * guns point, for aiming and orientation. The direction is projected through the planet view.
   */
  private drawNose(s: ShipState, at: { x: number; y: number; scale: number; visible: boolean }): void {
    const ahead = this.toScreen(s.x + Math.cos(s.heading) * 40, s.y + Math.sin(s.heading) * 40);
    if (!ahead.visible) return;
    const dir = Math.atan2(ahead.y - at.y, ahead.x - at.x);
    const R = clientTune.render.shipRingRadius * clientTune.render.shipScale * at.scale * chassisStats(s.chassis, TUNE).radius / TUNE.ship.radius * 1.3 + 6;
    const k = Math.max(0.8, at.scale);
    const c = Math.cos(dir), n = Math.sin(dir);
    const x = at.x + c * R, y = at.y + n * R;
    drawNoseMarker(this.turretGfx,x,y,dir,k);
  }

  /**
   * Dash wind-up (placeholder effect): energy sparks converge on the ship and a ring tightens as the
   * charge fills. On your own ship an arrow shows where the boost will go (the direction held now).
   */
  private drawDashCharge(s:ShipState,at:{x:number;y:number;scale:number;visible:boolean},mine:boolean):void {
    if(!at.visible)return;this.dashChargeFrames++;
    const g=this.turretGfx,k=at.scale,f=1-s.dashCharge/TUNE.ship.dashChargeSeconds,r=(46-18*f)*k*chassisStats(s.chassis,TUNE).radius/TUNE.ship.radius,c=Math.cos(s.heading),sn=Math.sin(s.heading);
    g.lineStyle(Math.max(1,2*k),0x88e5ed,.4+.5*f);
    for(let i=0;i<4;i++){const a=s.heading+i*Math.PI/2;g.beginPath();g.arc(at.x,at.y,r,a+.15,a+.9);g.strokePath();}
    for(let i=0;i<8;i++){const a=i*Math.PI/4+this.time.now*.001,d=r+(1-f)*28*k;g.fillStyle(i%2?0xffc778:0xa5f1fa,.5+.5*f);g.fillRect(at.x+Math.cos(a)*d-1.5*k,at.y+Math.sin(a)*d-1.5*k,3*k,3*k);}
    if(mine){const x=at.x+c*(r+13*k),y=at.y+sn*(r+13*k);g.lineStyle(Math.max(1,3*k),0xe4faff,.9);g.lineBetween(x-c*7*k-sn*6*k,y-sn*7*k+c*6*k,x,y);g.lineBetween(x,y,x-c*7*k+sn*6*k,y-sn*7*k-c*6*k);}
  }

  /**
   * Earned turrets: capital heads use their deck rig; fighters retain carrier-coloured drones. Each points where it last
   * fired and, after a quiet second, swings back to face forward. A short flash marks each shot.
   */
  private drawTurrets(id: number, s: ShipState, at: { x: number; y: number; scale: number; visible: boolean }): void {
    const n = turretCount(s, TUNE);
    const mounts = TURRET_MOUNTS_BY_CHASSIS[s.chassis] ?? TURRET_MOUNTS;
    if (!n || !at.visible) return;
    let aim = this.turretAim.get(id);
    if (!aim) this.turretAim.set(id, (aim = { angle: [], firedAt: [] }));
    const now = this.time.now;
    const mounted = s.chassis === BATTLECRUISER && !!this.ships.get(id)?.setTurrets?.(n, aim.angle, aim.firedAt);
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
      if (!mounted) (s.chassis===BATTLECRUISER?drawCapitalEscort:drawDrone)(g,x,y,k,a,now,id+i,light,now-(aim.firedAt[i]??-1e9)<70,unlockById(this.net.roster.get(id)?.look?.palette)?.index??0);
    }
  }

  /**
   * Hot zone (placeholder look): a dashed green ring on the planet while in view, labelled with the
   * bonus and the time until it moves; otherwise a green arrow on the inner screen ellipse.
   */
  private drawHotZone(p: ShipState | null, w: number, h: number): void {
    const z = this.net.hotZone;
    this.hotZoneText.setVisible(false);
    if (!p || !z || z.r <= 0 || this.net.status!=='open' || this.net.death || this.net.extracted || this.planet === TUTORIAL) return;
    const g = this.overlay;
    const now = performance.now();
    const left = Math.max(0, (z.movesAt - now) / 1000);
    // On one's own home planet minerals give fuel, not salvage; the zone doubles that instead.
    // Visitors mine nothing on someone else's home planet, so the zone is not shown to them.
    if (this.net.layout && this.net.clan !== this.net.layout.clan) return;
    const zoneOf = this.net.layout ? 'FUEL' : 'SALVAGE';
    const label = `${zoneOf} ZONE ×${TUNE.hotZone.salvageMultiplier}  ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const centre = this.toScreen(z.x, z.y);
    const dx = wrapDelta(z.x, p.x, W);
    const dy = wrapDelta(z.y, p.y, H);
    const inside = Math.hypot(dx, dy) <= z.r;
    const badge=(x:number,y:number,s:string)=>{
      this.hotZoneText.setVisible(true).setText(s);
      const colour=inside?'#c9f4c9':'#a8dcca';
      if(this.hotZoneText.style.color!==colour)this.hotZoneText.setColor(colour);
      const bw=this.hotZoneText.width+20;
      const right=intents.touch&&y>h*.4?controlClearRight(w):w-10;
      x=Math.max(bw/2+10,Math.min(right-bw/2,x));
      const shopBottom=Math.max(0,...intents.shopZones.map(z=>z.zone.y+z.zone.hh));
      const top=intents.touch?Math.max(112,shopBottom+64):112;
      y=Math.max(top,Math.min(h-126,y));
      panel(g,x-bw/2,y-11,bw,22,inside?0x9edbaa:0x567e78,inside);
      this.hotZoneText.setPosition(x,y);
    };
    // Ground-only boundary retains the exact server radius and projection.
    drawSalvageZoneRing(this.world,z,(x,y)=>this.toScreen(x,y),inside,now);
    if (intents.touch) {
      if(inside){this.hotZoneText.setVisible(true).setText('ZONE ×'+TUNE.hotZone.salvageMultiplier).setPosition(w<600?280:304,90);return;}
      if(centre.visible && centre.x>40 && centre.x<w-40 && centre.y>94 && centre.y<h-60)return;
      const a=Math.atan2(dy,dx),c=Math.cos(a),s=Math.sin(a);
      const x=w/2+c*w*.3,y=Math.max(100,Math.min(h-110,h/2+s*h*.25));
      g.fillStyle(0x9edbaa,.8);g.fillTriangle(x+c*7,y+s*7,x-c*4-s*5,y-s*4+c*5,x-c*4+s*5,y-s*4-c*5);return;
    }
    if (inside) {
      badge(w/2,h-124,label);
      return;
    }
    if (centre.visible && centre.x > 40 && centre.x < w - 40 && centre.y > 40 && centre.y < h - 40) {
      badge(centre.x,centre.y,label);
      return;
    }
    const a = Math.atan2(dy, dx);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = w / 2 + c * w * 0.36;
    const y = h / 2 + s * h * 0.33;
    g.fillStyle(0x7dffc4, 0.85);
    g.fillTriangle(x + c * 14, y + s * 14, x - c * 6 - s * 10, y - s * 6 + c * 10, x - c * 6 + s * 10, y - s * 6 - c * 10);
    badge(x-c*70,y-s*34,`${label}  ${Math.round(Math.max(0, Math.hypot(dx, dy) - z.r) / 100) * 100}m`);
  }

  /** Key hints for the PC control scheme in use, bottom left; off in the menu (KEY HINTS). */
  private drawKeyHints(p: ShipState | null, _w: number, h: number): void {
    const show = !intents.touch && !!p && !this.net.death && !this.net.extracted && this.keyHintsOn;
    this.keyHints.setVisible(show);
    if (!show) return;
    const lines = intents.scheme === 'marker'
      ? ['MOUSE  steer', 'LEFT CLICK  fire', 'RIGHT CLICK  missile', 'W  accelerate   S  brake', 'SHIFT  dash   E  mine', 'R  warp   1-6  upgrades']
      : ['A / D  turn', 'W / S  throttle', 'SPACE  fire   SHIFT  dash', 'Q  missile   E  mine', 'R  warp   1-6  upgrades'];
    const hints=this.planet===TUTORIAL&&!guide.policy.shop?lines.map(line=>line.replace('   1-6  upgrades','')):lines;
    const t = hints.join('\n');
    if (this.keyHints.text !== t) this.keyHints.setText(t);
    this.keyHints.setPosition(12, h - 12);
  }

  /**
   * Clan base landmarks (owner, 15 November 2026): while off screen, an arrow on the screen edge with
   * a label and distance. Members always see their treasury; visitors see the gate and the treasury.
   */
  private drawBaseMarkers(p: ShipState | null, w: number, h: number): void {
    this.baseMarkerTexts.forEach((t) => t.setVisible(false));
    const L = this.net.layout;
    if (!p || !L || this.net.status !== 'open' || this.net.death || this.net.extracted) return;
    const member = this.net.clan === L.clan;
    const owner = clanName(L.clan).toUpperCase();
    const marks = member
      ? [{ at: L.treasury, label: 'NEXUS', colour: 0xffd27a }]
      : [{ at: L.gate, label: 'GATE', colour: 0x8fe3ff }, { at: L.treasury, label: `${owner} NEXUS`, colour: 0xff8f73 }];
    const g = this.overlay;
    const touch = intents.touch;
    marks.forEach((m, i) => {
      const dx = wrapDelta(m.at.x, p.x, W), dy = wrapDelta(m.at.y, p.y, H);
      const c0 = this.toScreen(m.at.x, m.at.y);
      if (c0.visible && c0.x > 30 && c0.x < w - 30 && c0.y > 30 && c0.y < h - 30) return;
      const a = Math.atan2(dy, dx), c = Math.cos(a), s = Math.sin(a);
      // An outer ring of its own (the hot-zone and bounty arrows sit further in), kept clear of the
      // touch buttons, the bottom HUD and the top bar.
      let x = w / 2 + c * w * 0.45, y = h / 2 + s * h * 0.42;
      if (touch && y > h * 0.4) x = Math.min(x, controlClearRight(w) - 30);
      const hudTop = Math.abs(x - w / 2) < (touch ? 0 : 220) ? h - 160 : h - 40;
      y = Math.max(touch ? 120 : 80, Math.min(hudTop, y));
      const k = touch ? 0.7 : 1;
      g.fillStyle(m.colour, 0.9);
      g.fillTriangle(x + c * 12 * k, y + s * 12 * k, x - c * 5 * k - s * 8 * k, y - s * 5 * k + c * 8 * k, x - c * 5 * k + s * 8 * k, y - s * 5 * k - c * 8 * k);
      const d = Math.hypot(dx, dy);
      const t = this.baseMarkerTexts[i];
      t.setVisible(true).setFontSize(touch ? 9 : 10).setText(`${m.label} ${d >= 1000 ? (d / 1000).toFixed(1) + 'k' : Math.round(d / 100) * 100}`);
      const css = '#' + m.colour.toString(16).padStart(6, '0');
      if (t.style.color !== css) t.setColor(css);
      const tx = Math.max(t.width / 2 + 6, Math.min(w - t.width / 2 - 6, x - c * 22 * k));
      const ty = Math.max(10, Math.min(h - 10, y - s * 22 * k + (Math.abs(s) < 0.5 ? 14 * k : 0)));
      t.setPosition(tx, ty);
    });
  }

  /**
   * Warp button, mobile header or desktop top centre (keyboard R). During lockdown it is offline with a
   * countdown; then WARP; while warping it fills with the distance covered and a tap cancels.
   */
  private drawWarp(p: ShipState | null, w: number, h: number): void {
    const g = this.overlay;
    intents.warpButton = null;
    const alive = !!p && !this.net.death && !this.net.extracted && this.net.status === 'open';
    this.warpText.setVisible(alive);
    if (!p || !alive) return;
    const header = mobileHeader(w);
    const bw = intents.touch ? header.warp.w : 156;
    const bh = intents.touch ? 36 : 28;
    const x = intents.touch ? header.warp.x : w / 2;
    const y = intents.touch ? header.warp.y : 50;
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
    this.warpText.setFontSize(intents.touch ? (header.tight ? 9 : 11) : 12).setText(intents.touch ? label.replace(" OFFLINE", "").replace("  CANCEL", " ×") : label).setPosition(x, y).setColor(locked && !p.warping ? '#8fa2c8' : '#ffffff');
    if (!locked || p.warping) intents.warpButton = { x, y, hw: bw / 2, hh: intents.touch ? 22 : bh / 2 };
  }

  /** Locked missile crosshair: a red ring with four inward ticks, slowly turning and pulsing. */
  private drawCrosshair(g:Phaser.GameObjects.Graphics,x:number,y:number,r:number,now:number):void {
    const pulse=.8+.2*Math.sin(now/130),len=Math.max(5,r*.28);
    for(const dx of [-1,1])for(const dy of [-1,1]){const px=x+dx*r,py=y+dy*r;g.lineStyle(5,0x112234,.9);g.lineBetween(px-dx*len,py,px,py);g.lineBetween(px,py,px,py-dy*len);g.lineStyle(2,0xff8c65,pulse);g.lineBetween(px-dx*len,py,px,py);g.lineBetween(px,py,px,py-dy*len);}
    g.lineStyle(1.5,0xffd9a0,.7);g.beginPath();g.arc(x,y,r*.83,now*.002,now*.002+.75);g.strokePath();
  }

  /**
   * Bounty (owner design): the strongest real player is marked with a gold ring and label; other
   * pilots get a gold arrow at the screen edge pointing to them while they are out of view. The
   * holder sees "BOUNTY ON YOU". Also the MISSILE LOCK warning for a pilot being chased.
   */
  private drawBounty(p: ShipState | null, w: number, h: number): void {
    const g = this.overlay;
    const now = this.time.now;
    const warning=!!p && this.lockedOnMe && this.net.status==='open' && !this.net.death;
    this.lockText.setVisible(warning).setAlpha(.8+.2*Math.sin(now/120)).setPosition(w / 2, h * 0.3);
    if(warning){g.fillStyle(0x26151e,.92);g.fillRoundedRect(w/2-76,h*.3-12,152,24,5);
      g.lineStyle(1.5,0xff8664,.85);g.strokeRoundedRect(w/2-76,h*.3-12,152,24,5);}
    const b = this.net.bounty;
    this.bountyText.setVisible(false);
    if (!p || !b || this.net.status!=='open' || this.net.death || this.net.extracted) return;
    const pulse = 0.7 + 0.3 * Math.sin(now / 200);
    if (b.id === this.net.myId) {
      const at = this.toScreen(p.x, p.y);
      const r=this.hudAnchor.visible?this.hudAnchor.radius+6:46 * at.scale * shipRadius(p.hullMax, TUNE, p.chassis) / TUNE.ship.radius;
      g.fillStyle(0xffd36d,1);this.drawStar(g,at.x,at.y-r-10,5);
      if(intents.touch)return;
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
    let y=Math.max(bh/2+4,Math.min(h-bh/2-4,t.y));
    const boardBottom=Math.max(0,...[...this.board.values()].map(chip=>chip.y+BOARD_CHIP_H/2))+20;
    if(y<260 && x-bw/2<170)x=170+bw/2+5;
    if(y<boardBottom && x+bw/2>w-Math.min(BOARD_CHIP_W,w*.34)-18)x=w-Math.min(BOARD_CHIP_W,w*.34)-23-bw/2;
    if(intents.touch&&y>h*.4)x=Math.max(bw/2+4,Math.min(controlClearRight(w)-bw/2,x));
    const a=this.hudAnchor;
    if(a.visible && Math.abs(x-a.x)<a.radius+bw/2+22 && Math.abs(y-a.y)<a.radius+bh/2+26){
      const left=a.x-a.radius-bw/2-24;
      if(left>bw/2+4)x=left;
      else y=Math.max(bh/2+4,a.y-a.radius-bh/2-26);
    }
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
    const show = !!p && !this.net.death && !this.net.extracted;
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
    const show = !!p && !this.net.death && !this.net.extracted && (this.planet!==TUTORIAL||guide.policy.shop) && (!intents.touch || this.mobilePanel === 'shop');
    this.evolvePreview.setVisible(false);
    for (const t of this.shopTexts) {
      t.title.setVisible(show);
      t.sub.setVisible(show);
    }
    intents.shopZones = [];
    if (!p || !show) return;
    const labels: Record<string, string> = { turret: 'TURRET', shield: 'SHIELD', damage: 'GUNS', missile: 'MISSILE', mine: 'MINES' };
    const mobile = intents.touch, drawer = mobileHeader(logicalSize().w).drawer;
    const x = mobile ? drawer.x : 10, cols = mobile ? 3 : 1;
    const bw = mobile ? (drawer.w-12)/3 : 124, bh = mobile ? 44 : 30;
    if (mobile) intents.uiZones.push({x:x+drawer.w/2,y:drawer.y+47,hw:drawer.w/2,hh:47});
    SHOP_ITEMS.forEach((item, i) => {
      const bx = x + (i % cols) * (bw + (mobile ? 6 : 4));
      const y = (mobile ? drawer.y : 38) + Math.floor(i / cols) * (bh + (mobile ? 6 : 4));
      const offer = shopOffer(p, item, TUNE);
      const can = canBuy(p, item, TUNE);
      panel(g,bx,y,bw,bh,can?UI.uiAccent:UI.uiBorder,can);
      const key = intents.touch ? '' : `[${i + 1}] `;
      const t = this.shopTexts[i];
      t.title.setFontSize(mobile ? 10 : 11).setPosition(bx + 5, y + (mobile ? 13 : 9)).setText(`${key}${labels[item]} ${shopTier(p, item)}/4`).setColor(css(can?UI.uiText:0x91a5bb));
      t.sub
        .setFontSize(mobile ? 9 : 9)
        .setPosition(bx + 5, y + (mobile ? 31 : 22))
        .setText(offer ? `${offer.cost} MIN · ${offer.floor}PWR` : 'MAXED')
        .setColor(can ? '#c7f1dd' : '#a1afbf');
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
    const bx = x + (i % cols) * (bw + (mobile ? 6 : 4));
    const y = (mobile ? drawer.y : 38) + Math.floor(i / cols) * (bh + (mobile ? 6 : 4));
    const b = TUNE.battlecruiser;
    const can = canEvolve(p, TUNE);
    const ups = upgradeTotal(p);
    panel(g, bx, y, bw, bh, can ? UI.uiGold : 0x80664b, can);
    this.evolvePreview.setPosition(bx+bw-15,y+10).setAlpha(can?1:.5).setVisible(true);
    t.title.setFontSize(mobile ? 10 : 11).setPosition(bx + 5, y + (mobile ? 13 : 9)).setText(`${intents.touch ? '' : '[6] '}EVOLVE`).setColor(can ? '#ffd23a' : css(0x91a5bb));
    t.sub
      .setFontSize(9)
      .setPosition(bx + 5, y + (mobile ? 31 : 22))
      .setText(can ? `${b.cost} MIN` : ups < b.minUpgrades ? `upgrades ${ups}/${b.minUpgrades}` : p.hullMax < b.powerFloor ? `NEED ${b.powerFloor} PWR` : `NEED ${b.cost} MIN`)
      .setColor(can ? '#ffe9a8' : '#b5a48f');
    intents.shopZones.push({ item: i, zone: { x: bx + bw / 2, y: y + bh / 2, hw: bw / 2, hh: bh / 2 } });
  }

  /** Secondary mobile information stays behind a single shallow drawer. */
  private drawMobileNav(p: ShipState | null,w:number):void {
    this.mobileButtons=[];this.mobileNavLabels.forEach(t=>t.setVisible(false));
    if(!intents.touch || !p || this.net.death || this.net.extracted)return;
    const header=mobileHeader(w),ranked=rankPilots(this.net.roster.values());
    const rank=ranked.findIndex(r=>r.id===this.net.myId)+1;
    const offers=SHOP_ITEMS.filter(item=>canBuy(p,item,TUNE)).length+(canEvolve(p,TUNE)?1:0);
    const entries = [
      {action:'shop' as const,rect:header.shop,label:`${header.tight?'UPG':'UPGRADES'}${offers?' +'+offers:''}`},
      {action:'board' as const,rect:header.board,label:`${header.tight?'':'RANK '}#${rank||'–'}`},
    ].filter(e=>e.action!=='shop'||this.planet!==TUTORIAL||guide.policy.shop);
    entries.forEach(({action,rect,label},i)=>{
      const open=this.mobilePanel===action;
      panel(this.overlay,rect.x-rect.w/2,rect.y-18,rect.w,36,open?UI.uiAccent:UI.uiBorder,open);
      this.mobileNavLabels[i].setVisible(true).setPosition(rect.x,rect.y).setFontSize(header.tight?10:11).setText(open?(header.tight?'×':'CLOSE ×'):label);
      this.mobileButtons.push({action,x:rect.x,y:rect.y,w:rect.w});
      intents.uiZones.push({x:rect.x,y:rect.y,hw:rect.w/2,hh:22});
    });
  }

  private drawTouch(w: number, h: number): void {
    const g = this.overlay;
    g.clear();
    intents.uiZones = [];
    const p = this.net.predicted;
    this.combatHud.draw(g, this.net.death || this.net.extracted ? null : p, w, h, intents.touch, this.time.now,this.hudAnchor, this.planet === TUTORIAL || isWarPlanet(this.planet) ? 'none' : !this.net.layout ? 'salvage' : this.net.clan === this.net.layout.clan ? 'fuel' : 'none');
    this.drawMobileNav(p,w);
    this.drawShop(p);
    this.drawWeapons(p, w, h);
    this.drawBounty(p, w, h);
    this.drawWarp(p, w, h);
    this.drawHotZone(p, w, h);
    this.drawBaseMarkers(p, w, h);
    this.drawSiege(w, h);
    if (this.planet === TUTORIAL && (this.net.death || this.net.extracted)) guide.hide();
    else if (this.planet === TUTORIAL) guide.update({ myId: this.net.myId, predicted: this.net.predicted, g: this.overlay, w, h, toScreen: (x, y) => this.toScreen(x, y) });
    this.drawKeyHints(p, w, h);
    this.buildingRigs.begin();
    this.drawBase(p, w, h);
    this.buildingRigs.end();
    this.schemeLabel.setVisible(false);
    if (!intents.touch && intents.scheme === 'marker' && intents.mouse && p && !this.net.death && !this.net.extracted) {
      // Mouse aim reticle (placeholder look): a ring at the cursor, a faint line from the ship while
      // it steers; dim when the cursor rests on the ship or a button (no steering then).
      const m = intents.mouse, o = intents.mouseOrigin, on = intents.mouseSteering;
      if (on && o) { g.lineStyle(1, 0xffffff, 0.12); g.lineBetween(o.x, o.y, m.x, m.y); }
      g.lineStyle(2, UI.uiAccent, on ? 0.8 : 0.3);
      g.strokeCircle(m.x, m.y, 10);
      if (intents.fire) { g.fillStyle(UI.uiDanger, 0.6); g.fillCircle(m.x, m.y, 4); }
    }
    if (!intents.touch) {
      intents.dashButton = null;
      intents.schemeButton = null;
      intents.fireButton = null;
      return;
    }
    // Dash button in the bottom-right corner; the fire button, held to shoot, sits to its left.
    const anchorR = clientTune.touch.dashButtonRadius, r = anchorR * .74;
    const m = clientTune.touch.dashButtonMargin;
    const b = { x: w - m - anchorR, y: h - m - anchorR, r };
    intents.dashButton = { x: b.x, y: b.y, hw: r * 1.3, hh: r * 1.3 };
    const anchorF = clientTune.touch.fireButtonRadius, fr = anchorF * .74;
    const fb = { x: w - m * 2 - anchorR * 2 - anchorF, y: h - m - anchorF };
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
    const below = (Math.max(clientTune.render.shipRingRadius * clientTune.render.shipScale * size, shipTagClearance(size)) + 10) * at.scale;
    tag.setStroke('#081426', 3).setPosition(at.x, at.y + below).setVisible(at.visible && !mine);
  }

  /**
   * Target health (owner, 15 November 2026): a small bar under the name of a ship you have hit, for
   * a few seconds after your last hit. Shield and hull share it: blue while the shield holds, then
   * the hull once the shield is gone.
   */
  private drawTargetBar(id: number, s: ShipState, at: { x: number; y: number; scale: number; visible: boolean }, size: number): void {
    const hitAt = this.net.engaged.get(id);
    if (hitAt === undefined || !at.visible) return;
    const age = performance.now() - hitAt;
    if (age > TARGET_BAR_MS) {
      this.net.engaged.delete(id);
      return;
    }
    const fade = Math.min(1, (TARGET_BAR_MS - age) / 800);
    const below = (Math.max(clientTune.render.shipRingRadius * clientTune.render.shipScale * size, shipTagClearance(size)) + 10) * at.scale;
    const k = Math.max(0.8, at.scale);
    const w = 46 * k, h = 5 * k;
    const x = at.x - w / 2, y = at.y + below + 16 * k;
    const shieldMax = maxShield(s, TUNE);
    const onShield = s.shield > 0.5 && shieldMax > 0;
    const share = onShield ? s.shield / shieldMax : Math.max(0, s.hp) / Math.max(1, s.hullMax);
    drawTargetMeter(this.turretGfx,x,y,w,h,share,onShield,fade);
  }

  /**
   * Level / kills / minerals leaderboard, top right: one chip per player. When the
   * order changes the chips slide to their new places; a chip pops orange when that player scores a
   * kill, and one that climbed gets a brief glow while it moves.
   */
  private drawBoard(w: number): void {
    if (intents.touch && (this.mobilePanel !== 'board' || this.net.death || this.net.extracted)) {
      this.boardTitle.setVisible(false);for(const chip of this.board.values())chip.box.setVisible(false);return;
    }
    const ranked = rankPilots(this.net.roster.values());
    const rows = ranked.slice(0,intents.touch?4:8);
    const own = ranked.find(r=>r.id===this.net.myId);
    if(intents.touch && own && !rows.includes(own))rows.push(own);
    const cw = Math.min(BOARD_CHIP_W, w * 0.34);
    const right = w - 10;
    const top = intents.touch ? 62 : 30;
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
    if(intents.touch && rows.length)intents.uiZones.push({x:right-cw/2,y:top+15+rows.length*19/2,hw:cw/2,hh:15+rows.length*19/2});
    rows.forEach((r, row) => {
      const rank=ranked.indexOf(r);
      const target = top + 15 + ch / 2 + row * (ch + (intents.touch?2:4));
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
      chip.box.setVisible(true);
      chip.y += (target - chip.y) * (intents.touch ? 1 : .18);
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
        // Mineral balance pill on the right.
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
      const minerals = `${mineralCount(r)}`;
      if (chip.killsT.text !== minerals) chip.killsT.setText(minerals);
      chip.levelT.setText(r.level === undefined ? 'Lv.–' : `Lv.${r.level}`);
      // Player kills only (asteroids never score), next to the minerals pill.
      const frags = `${r.kills} KO`;
      if (chip.fragsT.text !== frags) chip.fragsT.setText(frags);
      // A chip on the move draws over the one it is passing.
      chip.box.setPosition(right - cw / 2, chip.y).setScale(1 + 0.12 * Math.sin(pop * Math.PI)).setDepth(glow > 0 ? 951 : 950);
    });
  }

  /**
   * After our ship is destroyed: who did it, and Respawn (back onto this planet) or Menu.
   * Keyboard: R, Space or J respawns, Esc goes to the menu. Returns true if the scene was left.
   */
  private deathScreen(w: number, h: number, extracted = false): boolean {
    if(!extracted){const began=this.deathSeen.get(this.net.myId);if(began!==undefined&&this.time.now-began<SHIP_DESTRUCTION_MS+200)return false;}
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
      this.message.setAlign('center').setText(extracted && this.planet === TUTORIAL ? 'TUTORIAL COMPLETE\nPick a planet from the menu' : extracted ? `EXTRACTED\nSalvage ${x?.salvage ?? 0}  ·  Power ${x?.power ?? 0}  ·  ${x?.kills ?? 0} KO` : by);
      this.message.setFontSize(18).setWordWrapWidth(0);
      const bw = 140;
      const bh = 44;
      // After warping out there is no drop-in again (owner, 16 November 2026): the menu only.
      const ids = extracted ? (['menu'] as const) : (['respawn', 'menu'] as const);
      this.deathButtons = ids.map((id, i) => {
        const x = ids.length === 1 ? w / 2 : w / 2 + (i === 0 ? -1 : 1) * (bw / 2 + 10);
        const y = h * 0.3 + 56;
        // Keyboard shortcuts shown on the buttons (owner): R respawns, Esc goes to the menu. Not on touch.
        const key = intents.touch ? '' : id === 'respawn' ? ' (R)' : ' (Esc)';
        return { id, x, y, w: bw, h: bh, label: text(this, x, y, (id === 'respawn' ? (extracted ? 'DROP IN' : 'RESPAWN') : 'MENU') + key, 16).setOrigin(0.5).setDepth(961) };
      });
    }
    // Extracted: the bank's answer arrives a moment later (not in the tutorial, which banks nothing).
    if (extracted && this.planet !== TUTORIAL) {
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
    // R (the warp key in flight) and Space respawn; Esc goes to the menu. Presses before the buttons
    // show are dropped, so a key hit in the fight that ended does not skip the screen.
    if (!ready) for (const p of ['primary', 'warp', 'pause'] as const) intents.consume(p);
    if (ready && (intents.consume('primary') || intents.consume('warp'))) choice = extracted ? 'menu' : 'respawn';
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
    this.ordnanceCues.clear();
    const now = performance.now();
    const light = this.objectLight();
    this.rocks.begin();
    for (const { a, x, y } of this.net.asteroidRender()) {
      const r = TUNE.asteroid.radius[a.size];
      if (!this.toScreen(x, y).visible) continue;
      const flash = now - (this.net.asteroidHitAt.get(a.id) ?? -1e9) < 90;
      const full = TUNE.asteroid.hp[a.size] * (a.rich ? TUNE.asteroid.richHpFactor : 1);
      if (a.rich&&this.rocks instanceof PixelRocks) {
        // Missing-art compatibility only; painted rich rocks carry the ore on their actual faces.
        const s = this.toScreen(x, y), rr = r * s.scale, pulse = 0.5 + 0.5 * Math.sin(now / 260 + a.id);
        g.fillStyle(0xffc94a, 0.12 + 0.1 * pulse); g.fillCircle(s.x, s.y, rr * 1.6);
        g.lineStyle(3, 0xffd76a, 0.45 + 0.35 * pulse); g.strokeCircle(s.x, s.y, rr * 1.25);
        for (let i = 0; i < 4; i++) {
          const ang = now / 900 + a.id + i * 1.57, gx = s.x + Math.cos(ang) * rr * 1.25, gy = s.y + Math.sin(ang) * rr * 1.25;
          g.fillStyle(0xfff3c2, 0.8); g.fillCircle(gx, gy, 2.5);
        }
      }
      this.rocks.draw(a.id,x,y,r,Math.min(1,a.hp/full),flash,light,this.frame.sun,(px,py)=>this.toScreen(px,py),a.size,a.family,a.rich);
    }
    this.rocks.end();
    this.crystalChips.draw(this.time.now,(x,y)=>this.toScreen(x,y),light);
    this.combatSprites.begin();
    // Cosmetic bob and sparkle never alter the server's pickup position or collection radius.
    for (const item of this.net.pickups.values()) {
      const at = this.toScreen(item.x, item.y);
      if (!at.visible) continue;
      {
        // Repair pods are drawn near their collection size (owner, 16 November 2026: readable).
        const radius=(item.kind==='salvage'?8+Math.sqrt(item.value)*1.6:item.kind==='heal'?TUNE.asteroid.pickupRadius*clientTune.render.healDropScale:7+Math.sqrt(item.value)*3)*at.scale;
        if(this.combatSprites.pickup(at,radius,item.kind,item.id,now))continue;
      }
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
      const r = (mineral ? 7 + Math.sqrt(item.value) * 3 : TUNE.asteroid.pickupRadius * clientTune.render.healDropScale) * at.scale;
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
      g.lineStyle(Math.max(1,1.6*at.scale),0xffd18b,Math.max(0,.45-t));
      for(let i=0;i<6;i++){g.beginPath();g.arc(at.x,at.y,(20+220*t)*at.scale*x.scale,i*Math.PI/3,i*Math.PI/3+.5);g.strokePath();}
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
      drawExplosionCore(g,{...at,scale:at.scale*x.scale},t);
    }
    this.effects = this.effects.filter((e) => this.time.now - e.at < e.ms);
    for (const e of this.effects) {
      const follow=e.followId?this.shipAt.get(e.followId):undefined;
      const at = this.toScreen(follow?.x??e.x, follow?.y??e.y);
      if (!at.visible) continue;
      const k = (this.time.now - e.at) / e.ms;
      if(e.progression==='evolve'){drawEvolve(g,at,k,e.r,e.palette);continue;}
      if(e.progression==='warp'){drawWarpLaunch(g,at,k,e.r,e.palette);continue;}
      if(e.combat){drawCombatImpact(g,at,k,e.combat,e.r,e.colour);continue;}
      if(e.shatter){drawShieldShatter(g,at,k,e.r);continue;}
      if(e.sparkAngle!==undefined){drawHitSpark(g,{...at,scale:at.scale*clientTune.render.hitSparkScale},k,e.sparkAngle,e.x+e.y);continue;}
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
    // Drawn bulletScale times bigger (owner); the hit radius is the server's and does not change.
    const bulletScale = clientTune.render.bulletScale;
    for (const b of this.net.bullets) {
      const len = (b.small ? 0.012 : 0.018) * bulletScale;
      const head = this.toScreen(b.x, b.y);
      const tail = this.toScreen(b.x - b.vx * len, b.y - b.vy * len);
      if (!head.visible || !tail.visible) continue;
      if(!this.combatSprites.bullet({...head,scale:head.scale*bulletScale},tail,b.mine,!!b.small,b.look??0))
        drawBullet(g,{...head,scale:head.scale*bulletScale},tail,b.mine,!!b.small,b.look??0);
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
          const age=(now-trail[i].at)/360,pr=(2+age*8)*q.scale;
          g.fillStyle(0x283648,(1-age)*.38);g.fillCircle(q.x,q.y+pr*.25,pr);
          g.fillStyle(0xa4acb6,(1-age)*.18);g.fillCircle(q.x-pr*.2,q.y-pr*.3,pr*.7);}
      }
      const painted=this.combatSprites.ordnance(o,at);
      let seeking=false;
      if(o.kind===1){
        const prev=this.mineMotion.get(o.id),moved=prev&&Math.hypot(wrapDelta(o.x,prev.x,W),wrapDelta(o.y,prev.y,H))>.1;
        const movedAt=moved?now:prev?.movedAt??-1e9;
        this.mineMotion.set(o.id,{x:o.x,y:o.y,movedAt});seeking=o.armed&&now-movedAt<160;
      }
      drawOrdnance(this.ordnanceCues,o,at,o.owner===this.net.myId,now,TUNE.mine.triggerRadius,painted,seeking);
    }
    this.combatSprites.end();
    for(const id of this.missileTrails.keys())if(!this.net.ordnance.has(id))this.missileTrails.delete(id);
    for(const id of this.mineMotion.keys())if(!this.net.ordnance.has(id))this.mineMotion.delete(id);

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
        drawWarpCharge(g,at,r,f,now);
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

  /** Local hull damage only (owner, 16 November 2026: a subtle red flash): fading red border bands,
   *  never a centre-screen overlay and never blocking input. */
  private drawHullBorder(w:number,h:number):void {
    const g=this.hullBorder;g.clear();
    const age=this.time.now-this.hullHitAt,ms=280;
    if(age<0 || age>=ms)return;
    const fade=(1-age/ms)**2;
    g.lineStyle(3,0xff6a5c,.22*fade);for(const x of [8,w-8])for(const y of [8,h-8]){const dx=x<w/2?1:-1,dy=y<h/2?1:-1;g.lineBetween(x,y,x+dx*28,y);g.lineBetween(x,y,x,y+dy*28);}
    for(let i=0;i<9;i++){const inset=i*5+2;
      g.lineStyle(5,0xff4a3d,.11*fade*(1-i/9)**2);g.strokeRect(inset,inset,w-inset*2,h-inset*2);}
  }

  private drawStatus(own: ShipState | null): void {
    const planet = this.planet === TUTORIAL ? 'Tutorial' : PLANETS.find((p) => p.id === this.planet)?.label ?? this.planet;
    const n = this.net;
    const ships = (own ? 1 : 0) + n.remoteCount;
    this.status.setVisible(!intents.touch).setText(`${planet}  ·  ${ships} nearby  ·  SPEED ${Math.round(own?.speed ?? 0)}${DEBUG?`  ·  ${Math.round(n.rttMs)} ms`:n.rttMs>250?'  ·  POOR SIGNAL':''}`);
    const msg: Record<string, string> = {
      connecting: 'Connecting…',
      open: '',
      reconnecting: `Connection lost. Reconnecting… ${n.resumeSecondsLeft}s`,
      lost: `Your ship was lost while disconnected\n(${n.closeInfo ? closeReason(n.closeInfo.code, n.closeInfo.reason) : ''})\nTap or press R to drop in again`,
      full: 'Planet is full. Tap to go back',
      closed: n.closeInfo?.code === CLOSE.WAR_LOCKED ? 'A war is on in the Warzone.\nTry again when it ends. Tap to go back' : n.closeInfo?.code === CLOSE.NEED_CLAN ? 'Pick Crimson or Azure in the menu to fight here.\nTap to go back' : `Disconnected${n.closeInfo ? ` (${closeReason(n.closeInfo.code, n.closeInfo.reason)})` : ''}\nTap to go back`,
      destroyed: '',
      extracted: '',
    };
    if (!n.death && n.status !== 'destroyed' && !n.extracted && n.status !== 'extracted') {
      this.message.setAlign('center').setText(n.status === 'open' && !own ? 'Dropping in…' : msg[n.status]);
      const {w,h}=logicalSize();
      drawConnectionBanner(this.overlay,this.message,w,h,n.status,intents.touch);
    }
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
  setTurrets?(count: number, angles: readonly number[], firedAt: readonly number[]): boolean;
  update(at: ShipPlacement, s: ShipState, timeMs: number, control?: FFDControl): void;
  destroy(): void;
}

/** The approved Human Nomad rig with its thruster exhaust. */
class RigShip implements DrawnShip {
  private view: ShipView;
  setTurrets(count: number, angles: readonly number[], firedAt: readonly number[]): boolean {
    return this.view.setTurrets(count, angles, firedAt);
  }

  constructor(scene: Phaser.Scene, mine: boolean, readonly chassis = 0, readonly palette = 0) {
    this.view = new ShipView(scene, mine, chassis, palette);
  }

  setLook(look: Look): void {
    const u = (id?: string) => (id ? unlockById(id) : undefined);
    this.view.setLook(u(look.tint)?.colour ?? null, u(look.flame)?.palette ?? null, u(look.shield)?.colour ?? null);
  }

  update(at: ShipPlacement, s: ShipState, timeMs: number, control?: FFDControl): void {
    // A dash counts as full throttle for the exhaust.
    this.view.update(at, s.heading, timeMs, s.speed, s.dashTime > 0, control ?? 'observed', topSpeed(s.hullMax, TUNE, s.chassis));
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
    g.setVisible(at.visible).setAlpha(at.opacity??1).setDepth(at.warpForeground?899.2:this.mine?20:10);
    if (s.dashTime > 0) {
      g.fillStyle(0xffd27a, 0.85);
      g.fillTriangle(-size * 0.5, -size * 0.3, -size * 0.5, size * 0.3, -size * 1.4, 0);
    }
    const colour=this.mine?0x5fe3ff:0xff8a4a,b=at.brightness;
    g.fillStyle((Math.round((colour>>16)*b)<<16)|(Math.round(((colour>>8)&255)*b)<<8)|Math.round((colour&255)*b), 1);
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
