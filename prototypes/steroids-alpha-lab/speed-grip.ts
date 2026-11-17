import type {ShipState} from '../steroids-alpha/sim/ship';
import {muzzleShot,topSpeed} from '../steroids-alpha/sim/ship';
import type {AssistTarget} from '../steroids-alpha/sim/ship';
import type {Tune} from '../steroids-alpha/sim/tune';
import type {World,WorldEvents} from '../steroids-alpha/sim/world';
import {shipMotion} from '../steroids-alpha/sim/chassis';
import {angleDelta,wrap} from '../steroids-alpha/sim/wrap';
import {combatCruise} from './duel-controls';
import settings from './duel.tune.json';

export interface GripState {travel:number;speed:number;tau:number;slip:number;slowing:boolean;fast:number;}
export const newGripState=(s:ShipState):GripState=>({travel:s.heading,speed:s.speed,tau:0,slip:0,slowing:false,fast:0});
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const mix=(a:number,b:number,f:number)=>a+(b-a)*clamp(f);
/** Directional grip only: no random steering, nose lag, speed loss or cancellation of knockback. */
export function stepGrip(state:GripState,s:ShipState,before:ShipState,t:Tune):void{
 const g=settings.grip,cruise=combatCruise(s,t),min=shipMotion(s.chassis,t).minSpeed,top=topSpeed(s.hullMax,t,s.chassis),dt=1/t.net.tickHz;
 const fast=clamp((s.speed-cruise)/Math.max(1,top-cruise)),dash=s.dashTime>0;
 const slowing=!dash&&s.speed<Math.max(before.speed,state.speed)-g.decelerationEpsilon;
 let tau=s.speed<=cruise?mix(g.slowTau,g.cruiseTau,(s.speed-min)/Math.max(1,cruise-min)):mix(g.cruiseTau,g.fastTau,fast);
 if(dash)tau=g.dashTau;
 if(slowing)tau=Math.min(tau,g.brakeTau);
 const eased=angleDelta(state.travel+angleDelta(s.heading,state.travel)*(1-Math.exp(-dt/tau)),0);
 const cap=g.maxSlipDeg*Math.PI/180,slip=Math.max(-cap,Math.min(cap,angleDelta(s.heading,eased)));
 const travel=angleDelta(s.heading-slip,0);
 // Shared movement already advanced speed/nose/knockback once. Replace only its forward displacement.
 s.x=wrap(s.x+(Math.cos(travel)-Math.cos(s.heading))*s.speed*dt,t.world.width);
 s.y=wrap(s.y+(Math.sin(travel)-Math.sin(s.heading))*s.speed*dt,t.world.height);
 Object.assign(state,{travel,speed:s.speed,tau,slip,slowing,fast});
}

/** Actual travel velocity for the existing main-gun aim assist; targets retain their original positions. */
export function gripTargets(world:World,owner:number,states:readonly GripState[]):AssistTarget[]{
 return [...world.ships].filter(([id,s])=>id!==owner&&s.hp>0&&!(s.arrival??0)).map(([id,s])=>{
  const h=states[id-1]?.travel??s.heading;return{x:s.x,y:s.y,ship:true,vx:Math.cos(h)*s.speed+s.kx,vy:Math.sin(h)*s.speed+s.ky};
 });
}
/**
 * Lab-only bridge until an approved port can place grip before muzzleShot inside shared movement.
 * Rebuild only the newly emitted main shot after its ship position changes. Damage/life/count stay intact.
 * World.prev still contains the true pre-step position, so subsequent swept collisions use the new path.
 */
export function repairGripShot(world:World,id:number,s:ShipState,before:ShipState,t:Tune,states:readonly GripState[]):void{
 if(s.shots===before.shots)return;
 const bridge=world as unknown as {bullets:{owner:number;x:number;y:number;vx:number;vy:number}[];events:WorldEvents};
 const bullet=bridge.bullets[bridge.bullets.length-1],event=bridge.events.shots[bridge.events.shots.length-1];
 if(!bullet||bullet.owner!==id||!event||event.owner!==id)throw new Error('Lab grip projectile seam changed; inspect World.stepShip');
 const shot=muzzleShot(s,t,gripTargets(world,id,states));
 Object.assign(bullet,{x:shot.x,y:shot.y,vx:shot.vx,vy:shot.vy});Object.assign(event,shot);
}
