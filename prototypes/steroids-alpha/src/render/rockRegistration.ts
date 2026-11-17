export interface RockBodyFrame {left:number;top:number;width:number;height:number;anchorX:number;anchorY:number;radius:number;}
/** Decorative crystals may extend the texture but never move/resize its original collision body. */
export function decoratedRockFrame(body:RockBodyFrame,offset:readonly number[],trim:{left:number;top:number;width:number;height:number}):{ax:number;ay:number;inR:number} {
  return{ax:(body.anchorX+offset[0]-trim.left)/trim.width,ay:(body.anchorY+offset[1]-trim.top)/trim.height,inR:body.radius/trim.width};
}
