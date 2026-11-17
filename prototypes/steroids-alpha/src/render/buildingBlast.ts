/** Pure final-hit/ballistic contract shared by the building renderer and regressions. */
export type BuildingKind='nexus'|'turret';
export const BLAST_LIFE={turret:2400,nexus:3200} as const;
export function isBuildingFinalHit(previous:number|undefined,health:number,elapsed:number):boolean {
  return previous!==undefined&&previous>0&&health<=0&&elapsed>=0&&elapsed<500;
}
export function buildingFragment(index:number,age:number,kind:BuildingKind):{dx:number;dy:number;lift:number;angle:number;width:number;alpha:number} {
  const big=kind==='nexus',t=Math.max(0,age/1000),lift=big?100:60,vz=100+index%5*23,gravity=400;
  const landing=(vz+Math.sqrt(vz*vz+2*gravity*lift))/gravity,flight=Math.min(t,landing);
  const a=index*2.399963+(big?.37:0),speed=(big?150:75)+(index*37%110),distance=speed*(1-Math.exp(-flight*.8))/.8;
  const after=Math.max(0,t-landing),bounce=after<.2?Math.sin(after/.2*Math.PI)*6*(1-after/.2):0;
  return{dx:Math.cos(a)*distance,dy:Math.sin(a)*distance,lift:Math.max(0,lift+vz*flight-gravity*flight*flight/2)+bounce,
    angle:a+flight*(index%2?1:-1)*(2+index%4),width:(big?17:9)+index%4*(big?6:3),
    alpha:Math.max(0,Math.min(1,(BLAST_LIFE[kind]-age)/(BLAST_LIFE[kind]*.28)))};
}
