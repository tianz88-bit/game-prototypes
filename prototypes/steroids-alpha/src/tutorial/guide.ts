// Four short tasks in the in-page tutorial room. Progress follows real play; no modal lessons.
import type Phaser from 'phaser';
import type { ShipState } from '../../sim/ship';
import { dashSpeed, mineralBalance } from '../../sim/ship';
import { upgradeTotal } from '../../sim/chassis';
import { canBuy,SHOP_ITEMS } from '../../sim/shop';
import { TUNE } from '../../sim/tune';
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
 tip?:string|null;
 targets?:{shop:Point|null;upgrade:(Point&{dir?:'left'|'right'})|null;warp:Point|null};
}
const ahead=(s:ShipState,d:number,turn=0):Point=>({x:wrap(s.x+Math.cos(s.heading+turn)*d,W),y:wrap(s.y+Math.sin(s.heading+turn)*d,H)});
const dist=(a:Point,b:Point)=>Math.hypot(wrapDelta(a.x,b.x,W),wrapDelta(a.y,b.y,H));
function controls(){
 if(intents.touch)return{steer:'Drag left to steer. Hold + / − to change speed.',fire:'Hold FIRE',dash:'Tap DASH',buy:'Open UPGRADES',warp:'Tap WARP'};
 if(intents.scheme==='marker')return{steer:'Mouse to steer; W faster, S slower.',fire:'Hold LEFT CLICK',dash:'Press SHIFT',buy:'Choose an upgrade (1–5)',warp:'Press R'};
 return{steer:'A/D to steer; W faster, S slower.',fire:'Hold SPACE',dash:'Press SHIFT',buy:'Choose an upgrade (1–5)',warp:'Press R'};
}
export class TutorialGuide {
 objectiveArrows:{kind:string;x:number;y:number}[]=[];
 private step=0;private count=0;private enteredFor=-1;
 private title!:Phaser.GameObjects.Text;private body!:Phaser.GameObjects.Text;
 private target:Point|null=null;private previous:Point|null=null;private wasDashing=false;
 private fightPhase=0;private rock=0;private pickup=0;private ramTarget=0;
 private startHull=0;private startSalvage=0;private upgrades=0;
 private dashGates:Point[]=[];
 get policy(){return tutorialPolicy(this.step,this.fightPhase===2);}
 get tipsAllowed(){return this.step===1&&this.fightPhase===0;}
 get finished(){return this.done;}
 private done=false;
 private get room(){return tutorialRoom();}
 private get world(){return this.room.sim;}
 reset(){this.step=0;this.count=0;this.enteredFor=-1;this.done=false;this.fightPhase=0;this.previous=null;this.wasDashing=false;}
 syncRules(){this.room.setTutorialRules(this.policy);}
 attach(scene:Phaser.Scene){
  this.title=text(scene,0,0,'',12,'#ffd27a').setOrigin(.5,0).setDepth(955);
  this.body=text(scene,0,0,'',11,'#dfe8ff').setOrigin(.5,0).setDepth(955).setAlign('center');
 }
 hide(){this.title?.setVisible(false);this.body?.setVisible(false);}
 complete(){this.done=true;this.objectiveArrows=[];this.hide();}
 private clearBots(){for(const id of this.room.tutorialBots)this.room.removeTutorialBot(id);}
 private next(){this.step=Math.min(3,this.step+1);this.count=0;this.enteredFor=-1;this.previous=null;this.wasDashing=false;this.syncRules();}
 private enter(s:ShipState){
  this.target=null;this.previous={x:s.x,y:s.y};this.wasDashing=false;
  this.clearBots();
  if(this.step===0)this.target=ahead(s,320);
  if(this.step===1){
   // A respawn retries only the unfinished portion; bought upgrades stay session-local.
   this.fightPhase=0;this.startHull=s.hullMax;this.startSalvage=s.salvage;this.upgrades=upgradeTotal(s);
   const p=ahead(s,360);this.rock=this.world.spawnAsteroid(2,p.x,p.y);
  }
  if(this.step===2){
   // One aligned dash passes both gates and hits one stationary, already-weakened target.
   const p=this.ramCourse(s);this.ramTarget=this.room.addTutorialBot('target',p.x,p.y,'RAM TARGET');
   const b=this.world.ships.get(this.ramTarget)!;
   b.chassis=2;b.hullMax=TUNE.battlecruiser.powerFloor;b.hp=b.hullMax*.1;b.shield=0;
   s.dashCd=0;s.dashCharge=0;s.dashTime=0;
  }
  if(this.step===3)s.lockdown=0;
 }
 private updateTask(s:ShipState){
  if(this.step===0){
   if(!this.target||dist(s,this.target)>1200)this.target=ahead(s,320,this.count?-.45:0);
   if(crossedTutorialGate(this.previous??s,s,this.target,W,H,80)){
    if(++this.count>=2){this.next();return;}
    this.target=ahead(s,350,-.45);
   }
  }else if(this.step===1){
   if(this.fightPhase===0&&!this.world.asteroids.has(this.rock)){
    this.fightPhase=1;this.pickup=this.mineralBundle(s);
   }else if(this.fightPhase===1){
    if((s.hullMax>this.startHull+.5||s.salvage>this.startSalvage+.01)&&SHOP_ITEMS.some(item=>canBuy(s,item,TUNE))){this.fightPhase=2;this.syncRules();}
    else{const p=this.world.pickups.get(this.pickup);if(!p||dist(s,p)>1200)this.pickup=this.mineralBundle(s);}
   }else if(this.fightPhase===2&&upgradeTotal(s)>this.upgrades){this.next();return;}
  }else if(this.step===2){
   if(s.dashTime>0||this.wasDashing)while(this.dashGates.length&&crossedTutorialGate(this.previous??s,s,this.dashGates[0],W,H))this.dashGates.shift();
   const b=this.world.ships.get(this.ramTarget);
   if(!b||b.hp<=0){if(s.dashTime>0)return;this.clearBots();this.next();return;}
   // Missed far behind: lay out the same short course ahead again; no extra kills/repetitions.
   if(dist(s,b)>1400){const p=this.ramCourse(s);b.x=p.x;b.y=p.y;}
  }else s.lockdown=0;
  this.previous={x:s.x,y:s.y};this.wasDashing=s.dashTime>0;
 }
 private ramCourse(s:ShipState){
  const reach=Math.max(320,dashSpeed(s.hullMax,TUNE,s.chassis)*TUNE.ship.dashDuration*.8+s.speed*TUNE.ship.dashChargeSeconds);
  this.dashGates=[ahead(s,reach*.42),ahead(s,reach*.7)];return ahead(s,reach);
 }
 private mineralBundle(s:ShipState){
  const p=ahead(s,180),floor=Math.max(...SHOP_ITEMS.map(item=>TUNE.shop[`${item}Floors`][0]));
  return this.world.spawnPickup('mineral',p.x,p.y,Math.max(5,floor-mineralBalance(s,TUNE)+1));
 }
 update(v:GuideView){
  this.objectiveArrows=[];this.hide();if(this.done)return;this.syncRules();
  const s=this.world.ships.get(v.myId);if(!s||s.hp<=0)return;
  if(this.enteredFor!==v.myId){this.enteredFor=v.myId;this.enter(s);}
  const old=this.step;this.updateTask(s);
  if(old!==this.step){this.enteredFor=v.myId;this.enter(s);}
  const k=controls(),titles=['FLY','FIGHT','DASH / RAM','ESCAPE'];
  const prompt=this.step===0?`${k.steer} Fly through two rings.`:this.step===1?
   this.fightPhase===0?`${k.fire} to break the marked rock.`:this.fightPhase===1?'Fly over the marked minerals to collect them.':`${k.buy}; buy one with minerals.`:
   this.step===2?`${k.dash} through the gates into the target; rams bypass shields.`:s.warping?'Warping out… keep flying.':`${k.warp} to leave; salvage is banked in real runs.`;
  const touch=intents.touch,pw=touch?Math.min(300,v.w*.42):Math.min(460,v.w-40);
  this.title.setVisible(true).setFontSize(touch?10:12).setText(`${this.step+1}/4 · ${titles[this.step]}${this.step===0?`  ${this.count}/2`:''}`);
  this.body.setVisible(true).setFontSize(touch?10:12).setWordWrapWidth(pw-20).setText(v.tip??prompt);
  const ph=(touch?27:31)+this.body.height,px=touch?8+pw/2:v.w/2,py=touch?v.h-ph-8:84;
  this.title.setPosition(px,py+6);this.body.setPosition(px,py+(touch?20:24));panel(v.g,px-pw/2,py,pw,ph,UI.uiGold);
  if(this.step===0&&this.target)this.drawMark(v,this.target,80,0x7dffc4,'ring');
  if(this.step===1){const p=this.fightPhase===0?this.world.asteroids.get(this.rock):this.fightPhase===1?this.world.pickups.get(this.pickup):null;if(p)this.drawMark(v,p,55,0xffd27a,this.fightPhase===0?'rock':'minerals');}
  if(this.step===1&&this.fightPhase===2){const p=v.targets?.upgrade??v.targets?.shop;if(p)this.drawUiArrow(v,p,v.targets?.upgrade?'upgrade':'shop');}
  if(this.step===2){for(const p of this.dashGates)this.drawMark(v,p,80,0x87d6cf,'gate');const b=this.world.ships.get(this.ramTarget);if(b)this.drawMark(v,b,85,0xff9b54,'ram');}
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
