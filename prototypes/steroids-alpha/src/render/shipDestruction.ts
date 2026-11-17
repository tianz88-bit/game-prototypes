export const SHIP_DESTRUCTION_MS=800;
export const SHIP_SMALL_BLASTS=[70,220,370,530,650] as const;
/** Universal visual landing/collapse, independent of gameplay death or respawn timing. */
export function shipDestructionPose(age:number):{progress:number;scale:number;brightness:number;finished:boolean} {
  const t=Math.max(0,Math.min(1,age/SHIP_DESTRUCTION_MS)),ease=t*t*(3-2*t);
  return{progress:ease,scale:1-.18*ease,brightness:1-.94*ease,finished:age>=SHIP_DESTRUCTION_MS};
}
