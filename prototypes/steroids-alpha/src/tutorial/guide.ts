// Four short tasks in the in-page tutorial room. Progress follows real play; no modal lessons.
import type Phaser from 'phaser';
import type { ShipState } from '../../sim/ship';
import { dashSpeed, maxShield, topSpeed } from '../../sim/ship';
import { BATTLECRUISER, shipMotion, upgradeTotal } from '../../sim/chassis';
import { SHOP_ITEMS } from '../../sim/shop';
import { TUNE } from '../../sim/tune';
import type { WorldEvents } from '../../sim/world';
import { wrap, wrapDelta } from '../../sim/wrap';
import { intents } from '../input/intents';
import { text } from '../scenes/common';
import { panel, UI,controlClearRight } from '../render/ui';
import { tutorialRoom } from './localServer';
import { DEBUG } from '../base';
import { tutorialPolicy,crossedTutorialGate } from './policy';
const W=TUNE.world.width,H=TUNE.world.height;
type Point={x:number;y:number};
export interface GuideView {
 myId:number;predicted:ShipState|null;g:Phaser.GameObjects.Graphics;w:number;h:number;
 toScreen:(x:number,y:number)=>{x:number;y:number;scale:number;visible:boolean};

 targets?:{shop:Point|null;upgrade:(Point&{dir?:'left'|'right'})|null;warp:Point|null};
}
const ahead=(s:ShipState,d:number,turn=0):Point=>({x:wrap(s.x+Math.cos(s.heading+turn)*d,W),y:wrap(s.y+Math.sin(s.heading+turn)*d,H)});
const dist=(a:Point,b:Point)=>Math.hypot(wrapDelta(a.x,b.x,W),wrapDelta(a.y,b.y,H));
function controls() {
 if (intents.touch) return { steer: 'Drag on the left to steer', brake: 'Hold −', thrust: 'Hold +', fire: 'Hold FIRE', dash: 'Tap DASH', buy: 'Open UPGRADES and tap a row', warp: 'Tap WARP' };
 const marker = intents.scheme === 'marker';
 return { steer: marker ? 'Point the mouse to steer' : 'Use A/D to steer', brake: 'Hold S', thrust: 'Hold W', fire: 'Hold SPACE or left click', dash: 'Press SHIFT', buy: 'Press B and pick an upgrade, or press 1–5', warp: 'Press R' };
}

export class TutorialGuide {
 objectiveArrows: { kind: string; x: number; y: number }[] = [];
 private step = 0;
 private count = 0;
 private pilot = 0;
 private title!: Phaser.GameObjects.Text;
 private body!: Phaser.GameObjects.Text;
 private target: Point | null = null;
 private previous: Point | null = null;
 private wasDashing = false;
 private ramConfirmed = false;
 private fightPhase = 0;
 private rock = 0;
 private pickup = 0;
 private upgrades = 0;
 private dashGates: Point[] = [];
 private dashLaunch: Point | null = null;
 private dashHeading = 0;
 private dashGateIndex = 0;
 private dashRetry = false;
 private done = false;

 get policy() { return tutorialPolicy(this.step, this.fightPhase === 2); }

 get finished() { return this.done; }
 private get room() { return tutorialRoom(); }
 private get world() { return this.room.sim; }

 reset() {
  this.step = 0;
  this.count = 0;
  this.pilot = 0;
  this.done = false;
  this.fightPhase = 0;
 }

 syncRules() { this.room.setTutorialRules(this.policy); }

 attach(scene: Phaser.Scene) {
  this.title = text(scene, 0, 0, '', 12, '#ffd27a').setOrigin(.5, 0).setDepth(955);
  this.body = text(scene, 0, 0, '', 11, '#dfe8ff').setOrigin(.5, 0).setDepth(955).setAlign('center');
  this.syncRules();
  this.room.onTutorialTick = (id, ship, events) => this.advance(id, ship, events);
  scene.events.once('shutdown', () => {
   this.syncRules();
  this.room.onTutorialTick = undefined;
   this.world.clearTutorialRock();
   this.room.setTutorialRules({ shop: false, fire: false, warp: false, minerals: false });
   this.clearBots();
   this.pilot = 0;
  });
 }

 hide() { this.title?.setVisible(false); this.body?.setVisible(false); }
 complete() { this.done = true; this.objectiveArrows = []; this.hide(); }
 private clearBots() { for (const id of this.room.tutorialBots) this.room.removeTutorialBot(id); }

 private enter(s: ShipState) {
  this.target = null;
  this.previous = { x: s.x, y: s.y };
  this.wasDashing = false;
  this.clearBots();
  if (this.step === 0) this.target = ahead(s, 300, this.count ? -.48 : .45);
  if (this.step === 1) {
   this.fightPhase = 0;
   this.upgrades = upgradeTotal(s);
   this.placeRock(s);
  }
  if (this.step === 2) {
   this.dashRetry = false;
   this.ramConfirmed = false;
   s.dashCd = s.dashCharge = s.dashTime = 0;
   this.placeRamCourse(s);
  }
  if (this.step === 3) s.lockdown = 0;
  this.syncRules();
 }

 private next(s: ShipState) {
  this.step++;
  this.count = 0;
  this.enter(s);
 }

 private oreReward() {
  return Math.max(...SHOP_ITEMS.flatMap(item => [TUNE.shop[`${item}Floors`][0], TUNE.shop[`${item}Costs`][0]]));
 }

 private placeRock(s: ShipState) {
  const p = ahead(s, 350);
  this.rock = this.world.setTutorialRock(p.x, p.y, this.oreReward());
 }

 private placeRamCourse(s: ShipState) {
  this.clearBots();
  // Use cruise distance for the charge; leave room between the final gate and contact.
  const motion = shipMotion(s.chassis, TUNE);
  const cruise = topSpeed(s.hullMax, TUNE, s.chassis) * motion.cruiseSpeed / motion.maxSpeed;
  const charge = cruise * TUNE.ship.dashChargeSeconds;
  const boost = dashSpeed(s.hullMax, TUNE, s.chassis) * TUNE.ship.dashDuration;
  const runway = 245;
  this.dashLaunch = ahead(s, runway);
  this.dashHeading = s.heading;
  this.dashGates = [ahead(s, runway + charge + boost * .25), ahead(s, runway + charge + boost * .53)];
  this.dashGateIndex = 0;
  const p = ahead(s, runway + charge + boost * .88);
  const id = this.room.addTutorialBot('target', p.x, p.y, 'RAM TARGET');
  this.ramTarget = id;
  const target = this.world.ships.get(id)!;
  target.chassis = BATTLECRUISER;
  target.shield = maxShield(target, TUNE);
 }
 private ramTarget = 0;

 private advance(id: number, s: ShipState, events: WorldEvents) {
  if (this.done || s.hp <= 0 || (s.arrival ?? 0) > 0) return;
  if (this.pilot !== id) {
   this.pilot = id;
   this.enter(s);
   return;
  }
  const previous = this.previous ?? s;
  this.previous = { x: s.x, y: s.y };
  const dashing = s.dashTime > 0;
  const dashEnded = this.wasDashing && !dashing;
  this.wasDashing = dashing;
  if (this.step === 0) {
   if (!this.target || dist(s, this.target) > 850) this.target = ahead(s, 300, this.count ? -.48 : .45);
   const motion = shipMotion(s.chassis, TUNE);
   const cruise = topSpeed(s.hullMax, TUNE, s.chassis) * motion.cruiseSpeed / motion.maxSpeed;
   const correctSpeed = this.count ? s.speed >= cruise + 24 : s.speed <= cruise - 24;
   if (!dashing && !s.dashCharge && correctSpeed && crossedTutorialGate(previous, s, this.target, W, H, 75)) {
    if (++this.count === 2) this.next(s);
    else this.target = ahead(s, 330, -.48);
   }
  } else if (this.step === 1) {
   if (this.fightPhase === 0) {
    const loot = events.gone.some(rock => rock.id === this.rock) && events.pickups.find(p => p.kind === 'mineral');
    if (loot) {
     this.pickup = loot.id;
     this.fightPhase = 1;
    } else if (!this.world.asteroids.has(this.rock) || dist(s, this.world.asteroids.get(this.rock)!) > 900) {
     this.placeRock(s);
    }
   }
   if (this.fightPhase === 1) {
    if (events.pickupsGone.some(p => p.id === this.pickup && p.by === id)) {
     this.fightPhase = 2;
     this.syncRules();
    } else if (!this.world.pickups.has(this.pickup)) {
     const p = ahead(s, 200);
     this.pickup = this.world.spawnPickup('mineral', p.x, p.y, this.oreReward());
    }
   } else if (this.fightPhase === 2 && upgradeTotal(s) > this.upgrades) this.next(s);
  } else if (this.step === 2) {
   if (dashing) {
    while (this.dashGateIndex < this.dashGates.length &&
      crossedTutorialGate(previous, s, this.dashGates[this.dashGateIndex], W, H, 58)) {
     this.dashGateIndex++;
    }
    const ram = events.rams.find(r => r.id === id && r.target === this.ramTarget);
    if (ram && this.dashGateIndex === this.dashGates.length) this.ramConfirmed = true;
   }
   if (dashEnded && this.ramConfirmed) {
    this.next(s);
    return;
   }
   const target = this.world.ships.get(this.ramTarget);
   if (dashEnded || (!dashing && !s.dashCharge && (!target || target.hp <= 0 || dist(s, target) > 1100 || this.pastRamTarget(s, target)))) {
    this.dashRetry = true;
    s.dashCd = 0;
    this.placeRamCourse(s);
   }
  } else s.lockdown = 0;
 }
 private pastRamTarget(s: Point, target: Point) {
  return wrapDelta(s.x, target.x, W) * Math.cos(this.dashHeading) +
    wrapDelta(s.y, target.y, H) * Math.sin(this.dashHeading) > 120;
 }

 update(v:GuideView){
  this.objectiveArrows=[];this.hide();if(this.done)return;
  const s = this.world.ships.get(v.myId);
  if (!s || s.hp <= 0 || this.pilot !== v.myId) return;
  const k = controls();
  const nearLaunch = this.dashLaunch && dist(s, this.dashLaunch) < 70;
  const titles = ['FLIGHT CONTROLS', 'MINE & UPGRADE', 'DASH & RAM', 'WARP OUT'];
  const prompt = this.step === 0
   ? this.count ? `${k.thrust} to accelerate through the ring.` : `${k.steer}. ${k.brake} to brake through the ring.`
   : this.step === 1
    ? this.fightPhase === 0 ? `Aim at the marked rock. ${k.fire} to shoot it.`
      : this.fightPhase === 1 ? 'Fly to the gold crystals to collect minerals.'
      : `${k.buy}. Minerals pay for this run’s upgrades.`
    : this.step === 2
     ? this.ramConfirmed ? 'Ram landed. A dash hits the hull through shields.'
       : s.dashTime > 0 || s.dashCharge > 0 ? 'Stay lined up through both rings.'
       : nearLaunch ? `${k.dash} now. Aim through both rings at the target.`
         : `${this.dashRetry ? 'Try again. ' : ''}Line up with the rings. ${k.dash} at the gold marker.`
     : s.warping ? 'Keep flying until warp completes.' : `${k.warp} to extract. In a real run, this banks your salvage.`;
  const touch=intents.touch,pw=touch?Math.min(300,v.w*.42):Math.min(460,v.w-40);
  this.title.setVisible(true).setFontSize(touch?10:12).setText(`${this.step+1}/4 · ${titles[this.step]}${this.step===0?`  ${this.count}/2`:''}`);
  this.body.setVisible(true).setFontSize(touch?10:12).setWordWrapWidth(pw-20).setText(prompt);
  const ph=(touch?27:31)+this.body.height,px=touch?8+pw/2:v.w/2,py=touch?v.h-ph-8:84;
  this.title.setPosition(px,py+6);this.body.setPosition(px,py+(touch?20:24));panel(v.g,px-pw/2,py,pw,ph,UI.uiGold);
  if(this.step===0&&this.target)this.drawMark(v,this.target,80,0x7dffc4,'ring');
  if(this.step===1){const p=this.fightPhase===0?this.world.asteroids.get(this.rock):this.fightPhase===1?this.world.pickups.get(this.pickup):null;if(p)this.drawMark(v,p,55,0xffd27a,this.fightPhase===0?'rock':'minerals');}
  if(this.step===1&&this.fightPhase===2){const p=v.targets?.upgrade??v.targets?.shop;if(p)this.drawUiArrow(v,p,v.targets?.upgrade?'upgrade':'shop');}
  if(this.step===2&&!this.ramConfirmed){if(this.dashLaunch&&!s.dashTime&&!s.dashCharge)this.drawMark(v,this.dashLaunch,48,0xffd27a,'dash-start');for(const p of this.dashGates.slice(this.dashGateIndex))this.drawMark(v,p,80,0x87d6cf,'gate');const b=this.world.ships.get(this.ramTarget);if(b)this.drawMark(v,b,85,0xff9b54,'ram');}
  if(this.step===3&&!s.warping&&v.targets?.warp)this.drawUiArrow(v,v.targets.warp,'warp');
 }
 private drawUiArrow(v:GuideView,at:Point&{dir?:'left'|'right'},kind:string){
  if(at.dir){const d=at.dir==='right'?1:-1,g=v.g;g.lineStyle(3,0x101e31,1).lineBetween(at.x-d*16,at.y,at.x,at.y);g.lineStyle(2,0xffdb87,1).lineBetween(at.x-d*16,at.y,at.x,at.y);g.fillStyle(0xffdb87,1).fillTriangle(at.x+d*7,at.y,at.x-d*3,at.y-7,at.x-d*3,at.y+7);this.objectiveArrows.push({kind,x:at.x,y:at.y});return;}
  const g=v.g,y=at.y+28;g.lineStyle(3,0x101e31,1).lineBetween(at.x,y+16,at.x,y);
  g.lineStyle(2,0xffdb87,1).lineBetween(at.x,y+16,at.x,y);
  g.fillStyle(0xffdb87,1).fillTriangle(at.x,y-7,at.x-7,y+3,at.x+7,y+3);
  this.objectiveArrows.push({kind,x:at.x,y});
 }
 private drawMark(v:GuideView,at:Point,r:number,colour:number,kind:string){
  const p=v.toScreen(at.x,at.y),g=v.g;
  if(p.visible&&p.x>20&&p.x<v.w-20&&p.y>20&&p.y<v.h-20){
   g.lineStyle(2,colour,.8).strokeCircle(p.x,p.y,r*p.scale);
   const a=Math.atan2(p.y-v.h/2,p.x-v.w/2),c=Math.cos(a),s=Math.sin(a),x=p.x-c*(r*p.scale+14),y=p.y-s*(r*p.scale+14);
   g.lineStyle(3,0x101e31,1).lineBetween(x-c*16,y-s*16,x,y);g.lineStyle(2,colour,1).lineBetween(x-c*16,y-s*16,x,y);
   g.fillStyle(colour,1).fillTriangle(x+c*8,y+s*8,x-c*5-s*7,y-s*5+c*7,x-c*5+s*7,y-s*5-c*7);this.objectiveArrows.push({kind,x,y});return;
  }
  const me=v.predicted;if(!me)return;
  const a=Math.atan2(wrapDelta(at.y,me.y,H),wrapDelta(at.x,me.x,W)),c=Math.cos(a),s=Math.sin(a);let x=v.w/2+c*v.w*.38,y=Math.max(108,Math.min(v.h-32,v.h/2+s*v.h*.34));
  if(intents.touch&&y>v.h*.4)x=Math.min(x,controlClearRight(v.w,v.h)-16);
  g.fillStyle(colour,.9);g.fillTriangle(x+c*12,y+s*12,x-c*5-s*8,y-s*5+c*8,x-c*5+s*8,y-s*5-c*8);
  this.objectiveArrows.push({kind,x,y});
 }
}
export const guide=new TutorialGuide();
if(DEBUG)(window as unknown as {__tutorial:unknown}).__tutorial={guide,room:tutorialRoom};
