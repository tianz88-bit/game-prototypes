import type {Zone} from '../steroids-alpha/src/input/intents';
/** Hold controls respect enlarged hitboxes, including the tall-screen Fire/Dash column. */
export function duelHoldZones(w:number,h:number,touch:boolean,c:{fire:Zone;dash:Zone}):{brake:Zone;thrust:Zone}{
 const hw=32,hh=26,gap=8;
 if(!touch)return{brake:{x:w-72,y:h-52,hw,hh},thrust:{x:w-144,y:h-52,hw,hh}};
 const column=Math.abs(c.fire.x-c.dash.x)<1;
 const left=c.fire.x-Math.max(c.fire.hw,c.dash.hw)-hw-gap;
 return{brake:{x:left,y:c.fire.y,hw,hh},thrust:column?{x:left,y:c.dash.y,hw,hh}:{x:c.fire.x,y:c.fire.y-c.fire.hh-hh-gap,hw,hh}};
}
