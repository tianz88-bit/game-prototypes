import type {Tune} from './tune';
import type {ShipState} from './ship';
import {hullCapacity} from './ship';
export type PickupKind='mineral'|'salvage'|'fuel'|'heal';
export interface PickupAccess {bot:boolean;clan:number;homeClan:number;warzone:boolean;}
/** Resource-specific capacity/ownership. Minerals never implicitly pay either cargo balance. */
export function pickupHasRoom(k:{kind:PickupKind;mined?:boolean},s:ShipState,t:Tune,a:PickupAccess):boolean {
 if(k.kind==='heal')return s.hp<hullCapacity(s,t);
 if(k.kind==='mineral')return s.hullMax<t.ship.powerCap;
 if(k.kind==='fuel')return !a.warzone&&a.homeClan>0&&a.clan===a.homeClan&&s.fuel<t.salvage.cargoMax;
 return !(k.mined&&a.bot)&&s.salvage<t.salvage.cargoMax;
}
