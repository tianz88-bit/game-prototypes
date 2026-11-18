// Missile lock (owner design: missiles lock ships only). Shared by the server (which launches) and the
// client (which shows the lock marker before you fire).
import type { Tune } from './tune';
import type { ShipState } from './ship';
import {MISSILE_CRUISER} from './chassis';
import { angleDelta, wrapDelta } from './wrap';

/** The ship a missile from s would lock onto: inside lockConeDeg of the nose and lockRange, the one
 * nearest the nose direction. Returns its id, or 0 for none. */
export function missileLock(id: number, s: ShipState, ships: Iterable<[number, ShipState]>, tune: Tune): number {
  const m = tune.missile;
  const cone = (m.lockConeDeg * Math.PI) / 180,range=m.lockRange*(s.chassis===MISSILE_CRUISER?tune.missileCruiser.rangeFactor:1);
  let best = 0;
  let bestOff = Infinity;
  for (const [oid, o] of ships) {
    if (oid === id || o.hp <= 0) continue;
    const dx = wrapDelta(o.x, s.x, tune.world.width);
    const dy = wrapDelta(o.y, s.y, tune.world.height);
    if (dx * dx + dy * dy > range * range) continue;
    const off = Math.abs(angleDelta(Math.atan2(dy, dx), s.heading));
    if (off <= cone && off < bestOff) {
      best = oid;
      bestOff = off;
    }
  }
  return best;
}

/** Deterministic siege-lock preview shared by authority and HUD; never accepts client target IDs. */
export function missileStructureLock(s:ShipState,base:{treasury:{x:number;y:number};turrets:readonly{x:number;y:number}[]}|null,state:{phase:string;treasury:number;turretHp:readonly number[]}|null,tune:Tune):{id:number;x:number;y:number}|undefined{
 if(s.chassis!==MISSILE_CRUISER||!base||state?.phase!=='war')return;let best:{id:number;x:number;y:number}|undefined,offBest=Infinity;
 const candidates=[{id:-1,...base.treasury,alive:state.treasury>0},...base.turrets.map((p,i)=>({...p,id:-2-i,alive:state.turretHp[i]>0}))];
 for(const p of candidates){if(!p.alive)continue;const dx=wrapDelta(p.x,s.x,tune.world.width),dy=wrapDelta(p.y,s.y,tune.world.height),off=Math.abs(angleDelta(Math.atan2(dy,dx),s.heading));if(Math.hypot(dx,dy)<=tune.missile.lockRange*tune.missileCruiser.rangeFactor&&off<=tune.missile.lockConeDeg*Math.PI/180&&off<offBest){best=p;offBest=off;}}return best;
}
