import type {Tune} from '../../sim/tune';
import {chassisStats,shipMotion} from '../../sim/chassis';
import {newShip,maxShield,shotHeat} from '../../sim/ship';

/** Real starting statistics; barrels alternate, so extra barrels do not multiply DPS. */
export function shipStats(chassis:number,t:Tune){
 const s=newShip(0,0,0,0);s.chassis=chassis;s.hullMax=t.ship.maxHp;
 const c=chassisStats(chassis,t),m=shipMotion(chassis,t),heat=shotHeat(s,t),cool=t.weapon.coolPerSecond*c.fireIntervalSteps/t.net.tickHz;
 const shots=heat>=1?1:heat<=cool?Infinity:1+Math.ceil((1-heat-1e-10)/(heat-cool));
 return [
  {label:'SPEED',value:m.maxSpeed,display:String(Math.round(m.maxSpeed))},
  {label:'TURN',value:m.turnRate,display:`${Math.round(m.turnRate*180/Math.PI)}°/s`},
  {label:'SHIELD',value:maxShield(s,t),display:String(Math.round(maxShield(s,t)))},
  {label:'GUN DPS',value:t.weapon.damage*c.damage*t.net.tickHz/c.fireIntervalSteps,display:(t.weapon.damage*c.damage*t.net.tickHz/c.fireIntervalSteps).toFixed(0)},
  {label:'AMMO',value:shots,display:Number.isFinite(shots)?String(shots):'∞'},
 ];
}
export function shipStatBars(chassis:number,t:Tune){
 const all=[0,1,2,3].map(c=>shipStats(c,t));
 return all[chassis].map((row,i)=>({...row,fill:Number.isFinite(row.value)?row.value/Math.max(1,...all.map(r=>Number.isFinite(r[i].value)?r[i].value:0)):1}));
}

/** Four comparison cards fit small landscape screens without removing any ship. */
export function shipCardLayout(w:number,h:number){
 const gap=8,cw=Math.min(250,(w-40-gap*3)/4),ch=Math.min(430,h-158),left=(w-(cw*4+gap*3))/2;
 return {cw,ch,top:104,left,gap,row:ch<240?13:20};
}
