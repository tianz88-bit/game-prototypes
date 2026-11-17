/** Four lessons: Fly, Fight (rock -> minerals -> upgrade), Dash/Ram, Escape. */
export const tutorialPolicy=(step:number,readyToBuy=false)=>({shop:step===3||(step===1&&readyToBuy),minerals:step===1||step===3,fire:step===1||step===3,warp:step===3});
/** Swept gate entry avoids missing a ring at dash speed, including a wrapped world edge. */
export function crossedTutorialGate(from:{x:number;y:number},to:{x:number;y:number},gate:{x:number;y:number},width:number,height:number,radius=95):boolean {
  const delta=(a:number,b:number,n:number)=>((a-b+n*1.5)%n)-n/2;
  const dx=delta(to.x,from.x,width),dy=delta(to.y,from.y,height),gx=delta(gate.x,from.x,width),gy=delta(gate.y,from.y,height);
  const t=Math.max(0,Math.min(1,(gx*dx+gy*dy)/Math.max(.001,dx*dx+dy*dy)));
  return Math.hypot(gx-dx*t,gy-dy*t)<radius;
}
