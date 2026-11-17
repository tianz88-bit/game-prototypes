import type {ShipState} from '../../sim/ship';
export const TIP_IDS=['hull','overheat','shield','missile','mine','evolve'] as const;
export type TipId=typeof TIP_IDS[number];
/** One contextual hint at a time; never takes input or gates play. */
export class TipState {
 readonly seen:Set<TipId>;
 private active:{id:TipId;until:number}|null=null;
 private gapUntil=0;
 constructor(seen:TipId[]=[],private onShow:(id:TipId)=>void=()=>{}){this.seen=new Set(seen);}
 update(s:ShipState,now:number,evolve:boolean,enabled=true):TipId|null{
  if(!enabled)return null;
  if(this.active){if(now<this.active.until)return this.active.id;this.active=null;this.gapUntil=now+3500;return null;}
  if(now<this.gapUntil)return null;
  const ready:Record<TipId,boolean>={hull:s.hp<s.hullMax*.85,overheat:s.overheated,shield:s.shieldCd>0,missile:s.missileTier>0,mine:s.mineTier>0,evolve};
  const id=TIP_IDS.find(id=>ready[id]&&!this.seen.has(id));if(!id)return null;
  this.seen.add(id);this.active={id,until:now+5500};this.onShow(id);return id;
 }
}
