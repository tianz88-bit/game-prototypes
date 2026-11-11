import { newShip, stepShip } from '../steroids-alpha/sim/ship';
import { currentData } from './draft';
let ship = newShip(0,0,-Math.PI/2,260), pitch=0,bank=0,accumulator=0;
export function resetPreview(): void { ship=newShip(0,0,-Math.PI/2,currentData().tune.ship.cruiseSpeed);pitch=bank=accumulator=0; }
export function advancePreview(heading: number,input: Record<string,boolean>,delta: number): { speed:number;pitch:number;bank:number;yawDelta:number } {
 const tune=currentData().tune,dt=1/tune.net.tickHz;accumulator+=Math.min(.1,delta);const start=heading,previous=ship.speed;ship.heading=(heading-90)*Math.PI/180;
 while(accumulator>=dt){stepShip(ship,{seq:0,turn:(input.right?1:0)-(input.left?1:0),aim:NaN,thrust:(input.accelerate?1:0)-(input.brake?1:0),dash:!!input.dash,fire:false},dt,tune);accumulator-=dt;}
 const easing=1-Math.exp(-9*Math.min(.1,delta)),accel=ship.speed-previous;
 pitch+=((accel>0?-13:accel<0?17:0)-pitch)*easing;bank+=(((input.left?1:0)-(input.right?1:0))*22-bank)*easing;
 return {speed:ship.dashTime>0?Math.max(tune.ship.dashSpeed,ship.speed):ship.speed,pitch,bank,yawDelta:((ship.heading*180/Math.PI+90-start+540)%360)-180};
}
