import Phaser from 'phaser';
import { logicalSize, serverOrigin } from '../base';
import { intents } from '../input/intents';
import { fitCamera, text, versionStamp } from './common';
import { panel, UI } from '../render/ui';
import { ShipView } from '../render/shipView';
import { BuildingRigs, buildingKey } from '../render/buildingRig';
import { buildingStackLean, towerMuzzle } from '../render/buildingGeometry';
import { CombatSprites } from '../render/combatSprites';
import { profileFor } from '../render/shipArt';
import { applyServerConfig, configVersion } from '../liveConfig';
import { clientTune } from '../clientTune';
import { TUNE } from '../../sim/tune';
import { chassisStats, shipMotion } from '../../sim/chassis';
import { muzzleShot, newShip, stepShip } from '../../sim/ship';
import type { ShipState } from '../../sim/ship';
import { turretPosition } from '../../sim/turrets';
import { wrapDelta } from '../../sim/wrap';
import { baseLayout } from '../../sim/clanBase';
import { drawClanBase } from '../render/clanBaseArt';
import { PlanetGround } from '../render/planetGround';
import { projectOffset, planetFrame, lightingRadius, sunState } from '../render/planet';
import { damageStage } from '../render/buildingCondition';

const SUBJECTS = [
  { id: 'warzone', label: 'Warzone', chassis: -1 },
  { id: 'sparrow', label: 'Sparrow', chassis: 3 },
  { id: 'bat', label: 'Bat', chassis: 1 },
  { id: 'battlecruiser', label: 'Battlecruiser', chassis: 2 },
  { id: 'nexus', label: 'Nexus', chassis: -1 },
  { id: 'turret', label: 'Tower turrets', chassis: -1 },
  { id: 'falcon', label: 'Falcon', chassis: 0 },
] as const;
interface ReviewButton { id: string; x: number; y: number; hw: number; hh: number; }
interface ReviewShot { x: number; y: number; vx: number; vy: number; life: number; small: boolean; tower:boolean; }

/** Production renderers and simulation weapon origins, isolated from accounts and multiplayer.
 * This scene never buys, grants, publishes or sends simulation state to a game room. */
export class RigReviewScene extends Phaser.Scene {
  buttons: ReviewButton[] = [];
  subject = 'sparrow';
  heading = -Math.PI / 2;
  rotating = true;
  firing = true;
  mounts = true;
  palette = 0;
  equipped = 4;
  control = 0;
  buildingPosition=0;
  towerHealth = -1;
  shieldHealth = .55;
  nexusHealth = .55;
  private finalHit:{kind:'turret'|'nexus';at:number}|null=null;
  private warGround:PlanetGround|null=null;
  private baseArt!:Phaser.GameObjects.Graphics;
  private ship: ShipView | null = null;
  private state!: ShipState;
  private buildings!: BuildingRigs;
  private combat!: CombatSprites;
  private guides!: Phaser.GameObjects.Graphics;
  private caption!: Phaser.GameObjects.Text;
  private frame: Phaser.GameObjects.GameObject[] = [];
  private projectiles: ReviewShot[] = [];
  private accumulator = 0;
  private lastTurret = -1e9;
  private turretTimes = [-1e9, -1e9, -1e9, -1e9];
  private shotCount = 0;
  private towerBarrel = 0;
  private abort!: AbortController;
  constructor() { super('rig-review'); }

  create(): void {
    const requested = new URLSearchParams(location.search).get('asset');
    this.subject = SUBJECTS.some(s => s.id === requested) ? requested! : 'sparrow';
    this.rotating = this.firing = this.mounts = true;
    this.projectiles = []; this.frame = []; this.accumulator = this.shotCount = 0;
    this.buildings = new BuildingRigs(this); this.combat = new CombatSprites(this);
    this.guides = this.add.graphics().setDepth(30);
    this.baseArt = this.add.graphics().setDepth(10);
    this.caption = text(this, 0, 0, '', 11, '#9ab8c8').setOrigin(.5).setDepth(101);
    this.select(this.subject);
    this.game.events.on('dpr', this.layout, this);
    this.abort = new AbortController();
    // One read on entry; no publisher, polling or gameplay connection.
    void fetch(serverOrigin().replace(/^ws/, 'http') + '/config', { cache: 'no-store', signal: this.abort.signal })
      .then(r => { if (!r.ok) throw Error('Settings unavailable'); return r.json(); })
      .then(record => { if (this.scene.isActive()) { applyServerConfig(record); this.select(this.subject); } })
      .catch(() => { /* Bundled settings remain usable offline. */ });
    intents.drainTaps();
    const selectFromLab = (event: MessageEvent): void => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'steroids-rig-subject') return;
      if (SUBJECTS.some(s => s.id === event.data.subject)) this.select(event.data.subject);
    };
    window.addEventListener('message', selectFromLab);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('message', selectFromLab);
      this.abort.abort(); this.game.events.off('dpr', this.layout, this);
      this.ship?.destroy(); this.ship = null; this.warGround?.destroy();this.warGround=null;this.buildings.destroy(); this.combat.destroy();
      intents.uiZones = []; this.projectiles = [];
    });
  }

  private select(id: string): void {
    this.subject = id;
    if(id==='nexus')this.rotating=false;
    this.ship?.destroy(); this.ship = null;
    this.finalHit=null;this.buildings.clearDestruction();
    this.warGround?.destroy();this.warGround=id==='warzone'?new PlanetGround(this,-8,[1,1,1],'warzone'):null;
    this.state = newShip(TUNE.world.width / 2, TUNE.world.height / 2, this.heading, 140);
    this.state.chassis = SUBJECTS.find(s => s.id === id)!.chassis;
    this.state.hp = this.state.hullMax = TUNE.ship.maxHp;
    this.state.speed = shipMotion(this.state.chassis, TUNE).minSpeed;
    if (this.state.chassis >= 0) this.ship = new ShipView(this, false, this.state.chassis, this.palette);
    this.projectiles = []; this.accumulator = this.shotCount = 0; this.towerBarrel = 0;
    this.turretTimes.fill(-1e9); this.lastTurret = -1e9;
    this.layout();
  }

  private layout(): void {
    for (const child of this.frame) child.destroy(); this.frame = []; this.buttons = [];
    const before = new Set(this.children.list);
    fitCamera(this); const { w, h } = logicalSize();
    this.add.rectangle(w / 2, h / 2, w, h, 0x0b1724).setDepth(-10);
    const grid = this.add.graphics().setDepth(-9).lineStyle(1, 0x254052, .35);
    for (let x = 0; x < w; x += 40) grid.lineBetween(x, 90, x, h - 105);
    for (let y = 100; y < h - 100; y += 40) grid.lineBetween(0, y, w, y);
    text(this, w / 2, 23, this.subject==='warzone'?'WARZONE · ART PREVIEW':'LIVE RIG REVIEW', 18).setOrigin(.5).setDepth(100);
    const button = (id: string, label: string, x: number, y: number, width: number, active = false): void => {
      panel(this.add.graphics().setDepth(100), x - width / 2, y - 15, width, 30, active ? UI.uiAccent : UI.uiBorder, active);
      text(this, x, y, label, width < 90 ? 10 : 12).setOrigin(.5).setDepth(101);
      this.buttons.push({ id, x, y, hw: width / 2, hh: 16 });
    };
    button('back', 'BACK', 43, 24, 70);
    const width = Math.min(150, (w - 28) / SUBJECTS.length);
    SUBJECTS.forEach((s, i) => button(s.id, s.label, w / 2 + (i - (SUBJECTS.length-1)/2) * width, 65, width - 5, s.id === this.subject));
    const building=this.subject==='warzone'||this.subject==='nexus'||this.subject==='turret';
    const controls = this.subject==='warzone'?[
      ['rotate',this.rotating?'Orbit: ON':'Orbit: PAUSED'],['fire',this.firing?'Firing: ON':'Firing: OFF'],
      ['tower-health',this.towerHealth<0?'Towers: MIXED':`Towers: ${Math.round(this.towerHealth*100)}%`],
      ['shield-health',`Shield: ${Math.round(this.shieldHealth*100)}%`],['nexus-health',`Nexus: ${Math.round(this.nexusHealth*100)}%`],
      ['palette',`Clan: ${this.palette%2?'Crimson':'Azure'}`],
    ]:building?[
      ['rotate',this.subject==='turret'?(this.rotating?'Aim: ON':'Aim: PAUSED'):(this.rotating?'Sweep: ON':'Sweep: PAUSED')],['fire',this.firing?'Firing: ON':'Firing: OFF'],
      ['tower-health',`Tower: ${Math.round((this.towerHealth<0?1:this.towerHealth)*100)}%`],['nexus-health',`Nexus: ${Math.round(this.nexusHealth*100)}%`],
      ['palette',`Clan: ${this.palette%2?'Crimson':'Azure'}`],['position',`Position: ${['CENTRE','RIGHT','BOTTOM','LEFT','TOP'][this.buildingPosition]}`],
    ]:[
      ['rotate', this.rotating ? 'Rotation: ON' : 'Rotation: PAUSED'],
      ['fire', this.firing ? 'Firing: ON' : 'Firing: OFF'],
      ['mounts', this.mounts ? 'Origins: ON' : 'Origins: OFF'],
      ['palette', `Palette: ${this.palette + 1}`],
      ['control', ['Level', 'Accelerate', 'Brake', 'Yaw left', 'Yaw right'][this.control]],
      ['turrets', `Deck turrets: ${this.equipped}`],
    ];
    const cw = Math.min(142, (w - 24) / controls.length);
    controls.forEach(([id, label], i) => button(id, label, w / 2 + (i - 2.5) * cw, h - 66, cw - 5));
    if(building){
      const actions=this.subject==='warzone'?[['destroy-turret','DETONATE TOWERS'],['destroy-nexus','DETONATE NEXUS'],['repair','REPAIR ALL']]:[[`destroy-${this.subject==='nexus'?'nexus':'turret'}`,'FINAL HIT'],['repair','REPAIR']];
      const aw=Math.min(155,(w-24)/actions.length);
      actions.forEach(([id,label],i)=>button(id,label,w/2+(i-(actions.length-1)/2)*aw,h-28,aw-6));
    }else ['Up', 'Right', 'Down', 'Left'].forEach((s, i) => button(`angle${i}`, s, w / 2 + (i - 1.5) * 65, h - 28, 60));
    this.caption.setPosition(w / 2, h - 104);
    versionStamp(this);
    this.frame = this.children.list.filter(c => !before.has(c));
    intents.uiZones = this.buttons;
  }

  private act(id: string): void {
    if (SUBJECTS.some(s => s.id === id)) { this.select(id); return; }
    if (id === 'back') {
      if (new URLSearchParams(location.search).get('embedded') === '1') window.parent.postMessage({ type: 'steroids-rig-exit' }, location.origin);
      else this.scene.start('hangar');
      return;
    }
    if (id === 'rotate') this.rotating = !this.rotating;
    if (id === 'fire') this.firing = !this.firing;
    if (id === 'position') this.buildingPosition=(this.buildingPosition+1)%5;
    if (id === 'mounts') this.mounts = !this.mounts;
    if (id === 'palette') { this.palette = (this.palette + 1) % 4; this.select(this.subject); return; }
    if (id === 'control') this.control = (this.control + 1) % 5;
    if (id === 'turrets') this.equipped = this.equipped === 4 ? 2 : this.equipped === 2 ? 0 : 4;
    const next=(value:number,values:number[])=>values[(values.indexOf(value)+1)%values.length];
    if(id==='tower-health')this.towerHealth=next(this.towerHealth,[-1,1,.55,.2,0]);
    if(id==='shield-health')this.shieldHealth=next(this.shieldHealth,[1,.55,.2,0]);
    if(id==='nexus-health')this.nexusHealth=next(this.nexusHealth,[1,.55,.2,0]);
    if(id==='repair'){this.towerHealth=this.shieldHealth=this.nexusHealth=1;this.finalHit=null;}
    if(id==='destroy-turret'||id==='destroy-nexus'){
      const kind=id==='destroy-nexus'?'nexus':'turret';
      if(kind==='nexus')this.nexusHealth=.2;else this.towerHealth=.2;
      this.finalHit={kind,at:this.time.now+180};
    }
    if (id.startsWith('angle')) { this.heading = (Number(id.slice(5)) - 1) * Math.PI / 2; this.rotating = false; }
    this.layout();
  }

  private shot(x: number, y: number, vx: number, vy: number, small = false,tower=false): void {
    this.projectiles.push({ x, y, vx, vy, life: .65, small,tower }); this.shotCount++;
  }

  snapshot(): Record<string, unknown> {
    return { subject: this.subject, buildingPosition:this.buildingPosition, heading: this.heading, firing: this.firing, rotating: this.rotating,
      profile: this.ship?.profile.shipId, modules: this.ship?.profile.modules.length ?? (this.subject === 'nexus' ? 3 : 5),
      shots: this.shotCount, heat: this.state.heat, projectiles: this.projectiles.length, settings: configVersion,
      buildingsReady: this.textures.exists(buildingKey('nexus-crown', 2)) && this.textures.exists(buildingKey('tower-barrel', 2)),
      warzone:this.subject==='warzone'?{terrain:'scorched-basalt',towerHealth:this.towerHealth<0?[1,.55,.2,0,1,.55]:Array(6).fill(this.towerHealth),shield:this.shieldHealth,nexus:this.nexusHealth,broken:this.shieldHealth===0}:undefined,
      damageArtReady:['tower-head-damaged','tower-wreck','nexus-reactor-damaged','nexus-crown-damaged'].every(name=>this.textures.exists(buildingKey(name,2))),
      destruction:this.buildings.destructionSnapshot(),
      buttons: this.buttons, network: 'isolated review' };
  }

  update(now: number, delta: number): void {
    for (const tap of intents.drainTaps()) {
      const b = this.buttons.find(b => Math.abs(tap.x - b.x) <= b.hw && Math.abs(tap.y - b.y) <= b.hh);
      if (b) this.act(b.id);
      if (!this.scene.isActive()) return;
    }
    if (intents.consume('pause')) { this.scene.start('hangar'); return; }
    const dt = Math.min(.05, delta / 1000), { w, h } = logicalSize();
    if(this.finalHit&&now>=this.finalHit.at){if(this.finalHit.kind==='nexus')this.nexusHealth=0;else this.towerHealth=0;this.finalHit=null;this.layout();}
    if (this.rotating) this.heading += dt * Math.PI / 4;
    const x = w / 2, y = (92 + h - 122) / 2, area = Math.max(60, Math.min(w * .36, (h - 210) / 2));
    const control = this.control === 0 ? undefined : { thrust: this.control === 1 ? 1 : this.control === 2 ? -1 : 0, turn: this.control === 3 ? -1 : this.control === 4 ? 1 : 0, aim: NaN };
    this.guides.clear();this.baseArt.clear(); this.buildings.begin(); this.combat.begin();
    let scale = 1;
    const project = (px: number, py: number): { x: number; y: number; scale: number } => ({ x: x + px * scale, y: y + py * scale, scale });
    if (this.ship) {
      const p = profileFor(this.state.chassis), cal = p.calibration;
      const reach = Math.max(...p.modules.map(m => Math.hypot(m.x, m.y) + cal.modules[m.id].width * .85));
      scale = area / (reach * clientTune.render.shipScale);
      this.accumulator += dt;
      const step = 1 / TUNE.net.tickHz;
      while (this.accumulator >= step) {
        this.accumulator -= step;
        this.state.x = TUNE.world.width / 2; this.state.y = TUNE.world.height / 2; this.state.heading = this.heading;
        const before = this.state.shots;
        stepShip(this.state, { seq: 0, turn: 0, aim: NaN, thrust: control?.thrust ?? 0, fire: this.firing, dash: false, missile: false, mine: false, warp: false }, step, TUNE);
        if (this.state.shots !== before) {
          const s = muzzleShot(this.state, TUNE); this.ship.fire(s.side);
          this.shot(wrapDelta(s.x, this.state.x, TUNE.world.width), wrapDelta(s.y, this.state.y, TUNE.world.height), s.vx, s.vy);
        }
      }
      this.state.x = TUNE.world.width / 2; this.state.y = TUNE.world.height / 2; this.state.heading = this.heading;
      const angles = this.turretTimes.map((_, i) => this.heading + Math.sin(now / 1800 + i) * 1.4);
      const volley = this.firing && now - this.lastTurret > TUNE.turret.fireIntervalSteps * 1000 / TUNE.net.tickHz;
      if (volley && this.state.chassis === 2) {
        this.lastTurret = now;
        for (let i = 0; i < this.equipped; i++) {
          this.turretTimes[i] = now; const origin = turretPosition(this.state, i, TUNE);
          this.shot(wrapDelta(origin.x, this.state.x, TUNE.world.width), wrapDelta(origin.y, this.state.y, TUNE.world.height), Math.cos(angles[i]) * TUNE.turret.bulletSpeed, Math.sin(angles[i]) * TUNE.turret.bulletSpeed, true);
        }
      }
      this.ship.setTurrets(this.equipped, angles, this.turretTimes);
      this.ship.update({ x, y, scale, visible: true, brightness: 1, shadowX: x + 2 * scale, shadowY: y + 35 * scale, shadowAlpha: 1 }, this.heading, now, this.state.speed, false, control);
      if (this.mounts) {
        const guns = this.state.chassis === 2 ? 4 : this.state.chassis === 3 ? 1 : 2;
        for (let i = 0; i < guns; i++) {
          const s = muzzleShot({ ...this.state, shots: i }, TUNE);
          const q = project(wrapDelta(s.x, this.state.x, TUNE.world.width), wrapDelta(s.y, this.state.y, TUNE.world.height));
          this.guides.lineStyle(1, 0xffdc7a, .85).strokeCircle(q.x, q.y, 4);
          this.guides.lineBetween(q.x - 7, q.y, q.x + 7, q.y).lineBetween(q.x, q.y - 7, q.x, q.y + 7);
        }
      }
    } else if(this.subject==='warzone') {
      const layout=baseLayout('warzone',TUNE)!;layout.clan=this.palette%2?1:2;
      const dx=Math.sin(this.heading)*95,dy=Math.cos(this.heading)*65;
      const groundFrame=planetFrame(dx,dy,(this.heading+Math.PI/2)*180/Math.PI,lightingRadius(TUNE.world.width),sunState(TUNE.planet.sunAzimuthDeg,TUNE.planet.sunElevationDeg));
      scale=Math.max(.04,Math.min((w-30)/(clientTune.render.planetRadius*2.2),(h-215)/(clientTune.render.planetRadius*2.2)));
      this.warGround!.update(w,h,scale,groundFrame);
      const projectGround=(wx:number,wy:number)=>{const p=projectOffset(wx-TUNE.world.width/2-dx,wy-TUNE.world.height/2-dy,clientTune.render.planetRadius);return {...p,x:w/2+p.x*scale,y:h/2+p.y*scale,scale:p.scale*scale};};
      const towers=this.towerHealth<0?[1,.55,.2,0,1,.55]:Array(6).fill(this.towerHealth);
      const fired=this.firing?Math.floor(now/450)*450:-1e9;
      drawClanBase(this.baseArt,{layout,own:null,member:true,docked:false,now,tune:TUNE,project:projectGround,
        viewport:{w,h},aim:layout.turrets.map((_,i)=>this.heading+i*Math.PI/3),firedAt:towers.map(h=>h>0?fired:-1e9),rigs:this.buildings,
        sun:groundFrame.sun,daylight:groundFrame.daylight,brightness:groundFrame.brightness,
        siege:{towers,shield:this.shieldHealth,nexus:this.nexusHealth,broken:this.shieldHealth===0}});
    } else {
      scale = area / (this.subject === 'nexus' ? 185 : 82);
      const clan = this.palette % 2 ? 1 : 2;
      const positions=[[0,0],[1,0],[0,1],[-1,0],[0,-1]],position=positions[this.buildingPosition];
      const nx=this.subject==='nexus'&&this.rotating?Math.sin(this.heading):position[0];
      const ny=this.subject==='nexus'&&this.rotating?Math.cos(this.heading)*.5:position[1];
      const at={x:x+nx*Math.max(20,w/2-area*.85-20),y:h/2+ny*Math.max(20,(h-235)/2-area*.55),scale,visible:true};
      const pose = { id: 'review-building', at, clan, now, basisAngle:0,stackLean:buildingStackLean(at,{w,h}), foreshorten: .8,health:this.subject==='nexus'?this.nexusHealth:this.towerHealth<0?1:this.towerHealth };
      if (this.subject === 'nexus') this.buildings.drawTreasury(pose);
      else {
        const aim = this.heading;
        if (pose.health>0&&this.firing && now - this.lastTurret > (this.towerBarrel===1?TUNE.heavyTower.intervalSeconds:TUNE.heavyTower.pauseSeconds)*1000) {
          this.lastTurret = now; this.towerBarrel = 1 - this.towerBarrel;
          const lateral = this.towerBarrel === 0 ? -8 : 8;
          const muzzle=towerMuzzle(pose,aim,lateral,6);
          this.shot((muzzle.x-x)/scale,(muzzle.y-y)/scale,
            Math.cos(aim)*TUNE.heavyTower.speed,Math.sin(aim)*TUNE.heavyTower.speed,false,true);
        }
        this.buildings.drawTurret({ ...pose, angle: aim, firedAt: this.lastTurret,barrel:this.towerBarrel });
      }
    }
    const alive: ReviewShot[] = [];
    for (const b of this.projectiles) {
      b.life -= dt; if (b.life <= 0) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; alive.push(b);
      const head=project(b.x,b.y),tail=project(b.x-b.vx*(b.tower?.006:.012),b.y-b.vy*(b.tower?.006:.012));
      this.combat.bullet({...head,scale:head.scale*(b.tower?clientTune.render.bulletScale*.45:1)},tail,true,b.small,b.tower?1:this.state.chassis===2?1:0);
    }
    this.projectiles = alive; this.buildings.end(); this.combat.end();
    const poseLabel=this.ship||this.subject==='turret'?`${this.subject==='turret'?'Aim ':''}${Math.round((this.heading*180/Math.PI+450)%360)}°`:`Position ${['CENTRE','RIGHT','BOTTOM','LEFT','TOP'][this.buildingPosition]}`;
    this.caption.setText(this.subject==='warzone'?`PREVIEW ONLY · Towers ${this.towerHealth<0?'healthy / damaged / critical / wreck':damageStage(this.towerHealth)} · Shield ${this.shieldHealth===0?'BROKEN':Math.round(this.shieldHealth*100)+'%'} · Nexus ${damageStage(this.nexusHealth)}\nTap health controls to cycle states · Orbit moves across the same anchored ground`:`${SUBJECTS.find(s => s.id === this.subject)!.label} · ${poseLabel} · ${this.subject === 'nexus' ? 'Position-driven stack · '+damageStage(this.nexusHealth) : this.subject === 'turret' ? 'Fixed tower · aiming head · '+damageStage(this.towerHealth<0?1:this.towerHealth) : 'Gold crosses = simulation gun origins'} · ${configVersion === 'bundled' ? 'Bundled settings' : 'Live settings'}`);
  }
}
