/** Visual-only thresholds. Simulation remains the authority for durability and repair. */
export function durability(value:number|undefined):number {
  return value===undefined?1:Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
}
export function damageStage(value:number|undefined):'healthy'|'damaged'|'critical'|'destroyed' {
  const h=durability(value);
  return h<=0?'destroyed':h<.3?'critical':h<.65?'damaged':'healthy';
}
/** Stable gaps rather than an entire dome flickering. Broken always suppresses every panel. */
export function shieldPanel(index:number,strength:number,broken:boolean):boolean {
  return !broken&&durability(strength)>0&&((index*7)%24)<Math.ceil(durability(strength)*24);
}
