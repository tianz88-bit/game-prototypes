/** Shared screen-space HUD geometry; independent of world projection and input. */
export function flightHeader(w:number,touch:boolean){
 const compact=touch||w<700,gap=8,right=w-12,warpW=compact?90:124,shopW=compact?88:148,boardW=compact?44:148,y=w<520?66:30;
 return{tight:w<700,warp:{x:right-warpW/2,y,w:warpW,h:36},shop:{x:right-warpW-gap-shopW/2,y,w:shopW,h:36},board:{x:right-warpW-gap-shopW-gap-boardW/2,y,w:boardW,h:36},drawer:{x:w-12-Math.min(330,w-24),y:y+46,w:Math.min(330,w-24)}};
}
export function objectiveBox(w:number,touch:boolean,open:'shop'|'board'|null){
 const drawer=flightHeader(w,touch).drawer,leftShop=Math.min(330,w*.5-32);
 const pw=touch&&open==='shop'?Math.min(380,w-leftShop-36):open?Math.max(120,Math.min(380,drawer.x-24)):Math.min(380,w-24);
 return{x:touch&&open==='shop'?w-12-pw/2:open?12+pw/2:w/2,y:w<520?90:54,w:pw,compact:touch||w<1000};
}
export function hintBox(w:number,h:number,touch:boolean){
 const pw=touch?Math.min(300,w*.42):Math.min(440,w-40);
 return{x:touch?12+pw/2:w/2,w:pw,bottom:h-12};
}
export function combatNotice(w:number,h:number,touch:boolean,anchor:{x:number;y:number;radius:number},safeRight=w-12){
 const above=anchor.y-anchor.radius-17,below=above<108;
 const right=touch?safeRight:w-12;
 return{x:below?Math.min(anchor.x,right-90):anchor.x,y:below?Math.min(h-42,anchor.y+anchor.radius+20):above};
}
export function flightControls(w:number,h:number,m:number,dr:number,fr:number){
 const right=w-m-dr,base=h-m-Math.max(dr,fr),column=w<600&&h>=500,gap=w<600?88:104;
 const at=(x:number,y:number,r:number,hit:number)=>({x,y,r,hw:r*hit,hh:r*hit});
 return{fire:at(column?right:right-gap,base,fr*.74,1.2),dash:at(right,column?base-90:base,dr*.74,1.3),missile:at(column?right:right-gap,column?base-180:base-90,30,1.25),mine:at(right,column?base-270:base-180,30,1.25),
  // Max speed (owner, 21 November 2026): held, right beside Dash.
  boost:at(column?right-gap:right,base-90,32,1.25)};
}

/** Keep touch cards and the right-side board apart on the narrower unfolded layouts. */
export function levelStrip(w: number, h: number, touch: boolean) {
 const compactTouch = touch && (w < 660 || h > w * 1.08);
 const width = compactTouch ? Math.min(330, w - Math.min(224, w * .34) - 36)
   : Math.min(touch ? 330 : 408, w * .5 - 32);
 return { x: 12, y: touch ? flightHeader(w, touch).drawer.y : 86,
   width, cardWidth: (width - 12) / 3, cardHeight: 52, gap: 6 };
}
