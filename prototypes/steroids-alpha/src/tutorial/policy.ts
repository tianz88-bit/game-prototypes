/** Lesson order: minerals are introduced at5, purchases at8, RAM is3. */
export const tutorialPolicy=(step:number)=>({shop:step>=8,minerals:step>=5,fire:step!==3});
/** Swept gate entry avoids missing a ring at dash speed, including a wrapped world edge. */
export function crossedTutorialGate(from:{x:number;y:number},to:{x:number;y:number},gate:{x:number;y:number},width:number,height:number,radius=95):boolean {
  const delta=(a:number,b:number,n:number)=>((a-b+n*1.5)%n)-n/2;
  const dx=delta(to.x,from.x,width),dy=delta(to.y,from.y,height),gx=delta(gate.x,from.x,width),gy=delta(gate.y,from.y,height);
  const t=Math.max(0,Math.min(1,(gx*dx+gy*dy)/Math.max(.001,dx*dx+dy*dy)));
  return Math.hypot(gx-dx*t,gy-dy*t)<radius;
}
