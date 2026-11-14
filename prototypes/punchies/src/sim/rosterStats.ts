import {charTune,punchCfg,uppercutStars,type CharId} from './character';
import {tune} from './tune';
export const STAT_RANGES={durability:[.65,1.35],endurance:[.85,1.15],speed:[.8,1.25],power:[.8,1.3],reach:[.7,1.25]} as const;
export type RosterStat=keyof typeof STAT_RANGES;
const types=['jab','cross','hook'] as const;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
/** Stable display bounds: logarithmic 40–100% fill; Power keeps its prior curve. */
export function statFill(stat:RosterStat,score:number):number{
 const [min,max]=STAT_RANGES[stat];
 if(stat!=='power'){const x=Math.max(0,Math.min(1,(score-min)/(max-min)));return .4+.6*Math.log1p(x)/Math.LN2;}
 return Math.max(0,Math.min(1,score<=1?.6*(score-min)/(1-min):.6+.4*(score-1)/(max-1)));
}
export function rosterScores(id:CharId):Record<RosterStat,number>{
 const c=charTune(id);
 const handSpeed=mean(types.map(type=>{const b=tune.punches[type],p=punchCfg(id,type);const active=b.sourEarly+b.sweet+b.sour;return (b.startup+active+b.recovery)/(p.startup+active+p.recovery);}));
 return {durability:.7*c.hp+.3*c.stun,
 endurance:.5*c.stamina+.25*c.regen+.25*mean(types.map(type=>1/c[type].staminaCost)),
 speed:.5*c.speed+.5*handSpeed,
 power:mean(types.map(type=>c[type].damage)),
 reach:mean(types.map(type=>punchCfg(id,type).reach/(tune.punches[type].reach*tune.view.fighterScale)))};
}
export function rosterUppercut(id:CharId){return {stars:uppercutStars(id),damage:tune.punches.cross.damage*tune.punches.uppercut.crossDamageMult*punchCfg(id,'uppercut').damage};}
