import type {ShipState} from '../steroids-alpha/sim/ship';
import {cornerFactor,topSpeed} from '../steroids-alpha/sim/ship';
import {shipMotion} from '../steroids-alpha/sim/chassis';
import type {Tune} from '../steroids-alpha/sim/tune';
import settings from './duel.tune.json';

export function combatCruise(s:ShipState,t:Tune):number{
 const m=shipMotion(s.chassis,t);return Math.max(m.minSpeed,topSpeed(s.hullMax,t,s.chassis)*m.cruiseSpeed/m.maxSpeed);
}
/** Speed control has explicit targets; neutral input returns to cruise without feathering a key/stick. */
export function combatThrottle(s:ShipState,t:Tune,fast:boolean,brake:boolean):number{
 const m=shipMotion(s.chassis,t),cruise=combatCruise(s,t);
 const target=brake?Math.max(m.minSpeed,cruise*settings.candidate.turnBandLow):fast?topSpeed(s.hullMax,t,s.chassis):cruise;
 const difference=target-s.speed,step=(difference>0?m.acceleration:m.braking)/t.net.tickHz;
 return Math.max(-1,Math.min(1,difference/step));
}
/** A broad cruise band shares one turning radius; lower/higher speeds smoothly open that radius. */
export function combatTurnFactor(s:ShipState,t:Tune):number{
 if(s.dashTime>0||s.dashCharge>0||s.warping)return cornerFactor(s,t);
 const m=shipMotion(s.chassis,t),cruise=combatCruise(s,t),top=topSpeed(s.hullMax,t,s.chassis);
 const low=Math.max(m.minSpeed,cruise*settings.candidate.turnBandLow),high=Math.min(top,cruise*settings.candidate.turnBandHigh),v=s.speed;
 if(v>=low&&v<=high)return v/cruise;
 if(v<low){const f=Math.max(0,(v-m.minSpeed)/Math.max(1,low-m.minSpeed));return t.ship.turnAtMinSpeed+(low/cruise-t.ship.turnAtMinSpeed)*f;}
 const f=Math.min(1,(v-high)/Math.max(1,top-high));return high/cruise+(t.ship.turnAtMaxSpeed-high/cruise)*f;
}
