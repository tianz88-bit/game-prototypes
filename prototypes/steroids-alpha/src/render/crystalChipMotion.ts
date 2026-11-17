import type { Asteroid } from '../../sim/asteroids';
export interface CrystalChipEvent {mode:'hit'|'split';id:number;size:number;x:number;y:number;vx:number;vy:number;}
export function richCrystalHit(previous:Asteroid|undefined,next:Asteroid):boolean {
  return !!previous?.rich&&!!next.rich&&next.hp<previous.hp;
}
export function crystalChipProfile(mode:CrystalChipEvent['mode'],size:number):{chips:number;sparks:number;life:number} {
  return mode==='hit'?{chips:size===0?3:2,sparks:12,life:700}:{chips:12-size*3,sparks:44-size*6,life:1300};
}
/** Outcrops rotate with the painted asteroid; debris inherits drift and has a cosmetic height arc. */
export function crystalChipPose(e:CrystalChipEvent,radius:number,index:number,age:number,seed=0):{dx:number;dy:number;lift:number;angle:number;width:number;alpha:number} {
  const hit=e.mode==='hit',t=Math.max(0,age/1000),site=e.size===0?(index%2? -2.65:-.8):(e.id%2===0?-.65:-2.25);
  const origin=e.id*2.399+site,angle=hit?origin+(index-1)*.55:seed*.37+index*2.399963;
  const speed=(hit?65:130)+(index*31%95),travel=speed*(1-Math.exp(-t*2))/2;
  const life=crystalChipProfile(e.mode,e.size).life,vz=hit?110:160+index%4*22;
  return{dx:Math.cos(origin)*radius*1.03+Math.cos(angle)*travel+e.vx*t*.6,
    dy:Math.sin(origin)*radius*1.03+Math.sin(angle)*travel+e.vy*t*.6,
    lift:Math.max(0,vz*t-220*t*t),angle:angle+(index%2?1:-1)*t*(4+index%3),
    width:Math.max(5,radius*(hit?.11:.16))*(.8+index%3*.2),alpha:Math.max(0,Math.min(1,(life-age)/(life*.38)))};
}
