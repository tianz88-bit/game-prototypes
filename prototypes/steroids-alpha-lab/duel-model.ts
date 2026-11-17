import {newGripState,stepGrip,repairGripShot} from './speed-grip';
import type {GripState} from './speed-grip';
import {World} from '../steroids-alpha/sim/world';
import type {WorldEvents} from '../steroids-alpha/sim/world';
import {combatCruise,combatThrottle,combatTurnFactor} from './duel-controls';
import {TUNE} from '../steroids-alpha/sim/tune';
import type {Tune} from '../steroids-alpha/sim/tune';
import {copyShip,shipRadius,cornerFactor,maxShield} from '../steroids-alpha/sim/ship';
import type {ShipState,ShipInput} from '../steroids-alpha/sim/ship';
import {shipMotion} from '../steroids-alpha/sim/chassis';
import {wrap,wrapDelta,angleDelta} from '../steroids-alpha/sim/wrap';

/** Preview settings only. No production tune, live record or publishing payload imports this module. */
import duelSettings from './duel.tune.json';
export const DUEL_CANDIDATE=duelSettings.candidate;
export const DUEL_SCENARIO=duelSettings.scenario;
export type DuelStart='tail'|'circle';
export type Handling='candidate'|'baseline';
export const idle=():ShipInput=>({seq:0,turn:0,aim:NaN,thrust:0,dash:false,fire:false,missile:false,mine:false,warp:false});
export function duelTune(base:Tune,handling:Handling):Tune{
 const t=structuredClone(base);t.asteroid.targetMass=0; if(handling==='candidate')t.grip.enabled=0;
 if(handling==='candidate'){t.ship.turnAtMinSpeed=DUEL_CANDIDATE.turnAtMinSpeed;t.ship.knockbackDecayPerSecond=DUEL_CANDIDATE.decay;}
 return t;
}
const mass=(s:ShipState,t:Tune)=>Math.max(DUEL_CANDIDATE.massMin,Math.min(DUEL_CANDIDATE.massMax,(shipRadius(s.hullMax,t,s.chassis)/t.ship.radius)**2));
/** Earliest swept contact normal; retains the original side even if ships cross during a fast step. */
export function contactNormal(a:ShipState,b:ShipState,pa:ShipState,pb:ShipState,t:Tune):{x:number;y:number}{
 const rx=wrapDelta(pb.x,pa.x,t.world.width),ry=wrapDelta(pb.y,pa.y,t.world.height);
 const vx=wrapDelta(b.x,pb.x,t.world.width)-wrapDelta(a.x,pa.x,t.world.width),vy=wrapDelta(b.y,pb.y,t.world.height)-wrapDelta(a.y,pa.y,t.world.height);
 const r=shipRadius(a.hullMax,t,a.chassis)+shipRadius(b.hullMax,t,b.chassis),aa=vx*vx+vy*vy,bb=2*(rx*vx+ry*vy),cc=rx*rx+ry*ry-r*r;
 const disc=bb*bb-4*aa*cc,u=aa>1e-8&&cc>0&&disc>=0?Math.max(0,Math.min(1,(-bb-Math.sqrt(disc))/(2*aa))):0;
 const x=rx+vx*u,y=ry+vy*u,len=Math.hypot(x,y);
 return len>1e-6?{x:x/len,y:y/len}:{x:Math.cos(pa.heading),y:Math.sin(pa.heading)};
}
export function separate(a:ShipState,b:ShipState,n:{x:number;y:number},t:Tune):void{
 const dx=wrapDelta(b.x,a.x,t.world.width),dy=wrapDelta(b.y,a.y,t.world.height),distance=dx*n.x+dy*n.y;
 const penetration=shipRadius(a.hullMax,t,a.chassis)+shipRadius(b.hullMax,t,b.chassis)+DUEL_CANDIDATE.gap-distance;
 if(penetration<=0)return;
 const ia=1/mass(a,t),ib=1/mass(b,t),sum=ia+ib;
 a.x=wrap(a.x-n.x*penetration*ia/sum,t.world.width);a.y=wrap(a.y-n.y*penetration*ia/sum,t.world.height);
 b.x=wrap(b.x+n.x*penetration*ib/sum,t.world.width);b.y=wrap(b.y+n.y*penetration*ib/sum,t.world.height);
}
/** Replace the baseline kick, preserving tangential velocity and tuning damage entirely in World. */
export function pushApart(a:ShipState,b:ShipState,pa:ShipState,pb:ShipState,t:Tune,ram:boolean,bothRam=false,travel?:{a:number;b:number}):void{
 const n=contactNormal(a,b,pa,pb,t);
 if(ram){a.dashTime=0;a.dashCharge=0;a.speed=Math.min(a.speed,shipMotion(a.chassis,t).cruiseSpeed);}
 if(bothRam){b.dashTime=0;b.dashCharge=0;b.speed=Math.min(b.speed,shipMotion(b.chassis,t).cruiseSpeed);}
 const ha=travel?.a??a.heading,hb=travel?.b??b.heading;
 const va=(Math.cos(ha)*a.speed+pa.kx)*n.x+(Math.sin(ha)*a.speed+pa.ky)*n.y;
 const vb=(Math.cos(hb)*b.speed+pb.kx)*n.x+(Math.sin(hb)*b.speed+pb.ky)*n.y;
 const closing=va-vb,desired=Math.max(ram?DUEL_CANDIDATE.ramSeparationSpeed:DUEL_CANDIDATE.bumpSeparationSpeed,Math.max(0,closing)*DUEL_CANDIDATE.restitution);
 const ia=1/mass(a,t),ib=1/mass(b,t),impulse=Math.max(0,desired+closing)/(ia+ib);
 const ka=Math.min(DUEL_CANDIDATE.maxKick,impulse*ia),kb=Math.min(DUEL_CANDIDATE.maxKick,impulse*ib);
 a.kx=pa.kx-n.x*ka;a.ky=pa.ky-n.y*ka;b.kx=pb.kx+n.x*kb;b.ky=pb.ky+n.y*kb;separate(a,b,n,t);
}

export class DuelModel{
 gripStates:GripState[]=[];
 readonly tune:Tune;readonly world:World;readonly pilots:ShipState[];elapsed=0;ramHits=0;bumpHits=0;chasing=false;private nextBumpTick=0;private observations:{x:number;y:number;at:number}[]=[];private seen:{x:number;y:number}|null=null;private nextObserve=0;
 constructor(public start:DuelStart,public handling:Handling,public chassis=0,public swap=false,base:Tune=TUNE,public gripEnabled=false){
  if(handling==='baseline')this.gripEnabled=false;
  this.tune=duelTune(base,handling);this.world=new World(this.tune,()=>.37);this.world.asteroids.clear();this.world.drain();
  this.pilots=[this.world.addShip(1),this.world.addShip(2)];
  const m=shipMotion(chassis,this.tune),r=m.cruiseSpeed/(m.turnRate*cornerFactor({...this.pilots[0],chassis,speed:m.cruiseSpeed},this.tune));
  this.pilots.forEach((s,i)=>{Object.assign(s,{chassis,x:2000,y:2000,hp:this.tune.ship.maxHp,hullMax:this.tune.ship.maxHp,shield:this.tune.ship.maxShield,arrival:0,speed:m.cruiseSpeed,heading:-Math.PI/2,lockdown:0,turrets:0});
   if(start==='tail'){s.y=2000+(i===Number(!swap)?DUEL_SCENARIO.tailGap:0);}
   else{s.x=2000+(i===Number(swap)?-r:r);s.heading=i===Number(swap)?Math.PI/2:-Math.PI/2;}
  s.shield=maxShield(s,this.tune);});this.resetGrip();this.world.drain();
 }
 /** Visible, deterministic sparring policy: pursue the pilot, or hold a cruise-speed left circle. */
 opponent():ShipInput{
  const s=this.pilots[1],p=this.pilots[0],m=shipMotion(s.chassis,this.tune),i=idle();
  this.observations.push({x:p.x,y:p.y,at:this.elapsed});const cutoff=this.elapsed-DUEL_SCENARIO.reactionSeconds;while(this.observations.length>1&&this.observations[1].at<=cutoff)this.observations.shift();
  if(!this.seen||this.elapsed>=this.nextObserve){this.seen=this.observations[0];this.nextObserve=this.elapsed+DUEL_SCENARIO.perceptionSeconds;}
  const dx=wrapDelta(this.seen.x,s.x,this.tune.world.width),dy=wrapDelta(this.seen.y,s.y,this.tune.world.height),d=Math.hypot(dx,dy);
  const aim=Math.atan2(dy,dx);i.thrust=this.handling==='candidate'?combatThrottle(s,this.tune,false,false):Math.abs(s.speed-m.cruiseSpeed)<DUEL_SCENARIO.cruiseDeadband?0:s.speed<m.cruiseSpeed?1:-1;
  const orbit=m.cruiseSpeed/m.turnRate;if(this.start==='circle'&&d>orbit*DUEL_SCENARIO.orbitBreakRatio)this.chasing=true;
  if(this.start==='circle'&&!this.chasing){i.turn=-1;}
  else if(this.swap&&this.start==='tail'){i.turn=Math.sin(this.elapsed*.65)>.45?.75:0;}
  else{i.aim=aim; i.thrust=d>DUEL_SCENARIO.chaseAccelerateDistance?1:i.thrust;}
  const burst=(Math.max(0,this.elapsed-DUEL_SCENARIO.openingFireDelay)%(DUEL_SCENARIO.fireBurstSeconds+DUEL_SCENARIO.firePauseSeconds))<DUEL_SCENARIO.fireBurstSeconds;
  i.fire=burst&&this.elapsed>DUEL_SCENARIO.openingFireDelay&&d<DUEL_SCENARIO.fireRange&&Math.abs(angleDelta(aim,s.heading))<DUEL_SCENARIO.fireAimRadians;
  return i;
 }
 step(input:ShipInput,enemy=this.opponent()):WorldEvents{
  const before=this.pilots.map(copyShip);this.elapsed+=1/this.tune.net.tickHz;
  this.advance(1,input);this.advance(2,enemy);
  const moved=this.pilots.map(copyShip);this.world.step();const e=this.world.drain();
  const a=this.pilots[0],b=this.pilots[1],d=Math.hypot(wrapDelta(b.x,a.x,this.tune.world.width),wrapDelta(b.y,a.y,this.tune.world.height));
  const touching=d<shipRadius(a.hullMax,this.tune,a.chassis)+shipRadius(b.hullMax,this.tune,b.chassis);
  const bump=touching&&a.hp>0&&b.hp>0&&this.world.tick>=this.nextBumpTick&&moved.every(s=>s.dashTime<=0)&&e.hits.some(h=>h.id===1&&h.by===2)&&e.hits.some(h=>h.id===2&&h.by===1);
  this.ramHits+=e.rams.length;if(bump){this.bumpHits++;this.nextBumpTick=this.world.tick+Math.round(this.tune.ship.contactGraceSeconds*this.tune.net.tickHz);}
  if(this.handling==='candidate'){
   if(e.rams.length){const rammer=e.rams[0].id-1,other=1-rammer;pushApart(this.pilots[rammer],this.pilots[other],moved[rammer],moved[other],this.tune,true,e.rams.length>1,this.gripEnabled?{a:this.gripStates[rammer].travel,b:this.gripStates[other].travel}:undefined);}
   else if(bump)pushApart(a,b,moved[0],moved[1],this.tune,false,false,this.gripEnabled?{a:this.gripStates[0].travel,b:this.gripStates[1].travel}:undefined);
   else if(touching)separate(a,b,contactNormal(a,b,before[0],before[1],this.tune),this.tune);
  }
  this.world.asteroids.clear();return e;
 }
 /** The travel state is rebuilt only on a full scenario reset, not every frame. */
 resetGrip():void{this.gripStates=this.pilots.map(s=>{s.travelHeading=s.heading;return newGripState(s);});}
 /** Preview gyro multiplier is restored synchronously; production movement/weapons still step once. */
 private advance(id:number,input:ShipInput):void{
  const pilot=this.pilots[id-1],before=copyShip(pilot),i={...input,warp:false,missile:false,mine:false};
  if(this.handling==='baseline'||pilot.dashTime>0||pilot.dashCharge>0)this.world.stepShip(id,i);
  else{const group=pilot.chassis===1?this.tune.interceptor:pilot.chassis===2?this.tune.battlecruiser:this.tune.ship,rate=group.turnRate;
   group.turnRate=rate*combatTurnFactor(pilot,this.tune)/cornerFactor(pilot,this.tune);
   try{this.world.stepShip(id,i);}finally{group.turnRate=rate;}
  }
  if(this.gripEnabled){stepGrip(this.gripStates[id-1],pilot,before,this.tune);repairGripShot(this.world,id,pilot,before,this.tune,this.gripStates);}
  else this.gripStates[id-1]=newGripState(pilot);
 }
 /** Read-only adapter to the existing authoritative projectile list; no second projectile simulation. */
 bullets():readonly {x:number;y:number;vx:number;vy:number;owner:number}[]{return (this.world as unknown as {bullets:{x:number;y:number;vx:number;vy:number;owner:number}[]}).bullets;}
}
