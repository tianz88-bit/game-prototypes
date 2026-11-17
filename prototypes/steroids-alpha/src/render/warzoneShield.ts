import type Phaser from 'phaser';
import { durability, shieldPanel } from './buildingCondition';
import type { BuildingAt } from './buildingGeometry';

/** World-projected plated field: strength changes coverage, brightness and colour together. */
export function drawWarzoneShield(g:Phaser.GameObjects.Graphics,o:{x:number;y:number;radius:number;strength:number;broken:boolean;now:number;colour:number;project:(x:number,y:number)=>BuildingAt}):void {
  const h=durability(o.strength);if(o.broken||h<=0)return;
  const colour=h<.3?0xffb87d:o.colour,alpha=.18+h*.38;
  const point=(a:number,r:number,lift=0)=>{const p=o.project(o.x+Math.cos(a)*r,o.y+Math.sin(a)*r);return{...p,y:p.y-lift*p.scale};};
  for(let i=0;i<24;i++){
    if(!shieldPanel(i,h,false))continue;
    const a=i*Math.PI/12+.025,b=(i+1)*Math.PI/12-.025;
    const p=point(a,o.radius),q=point(b,o.radius),u=point(a,o.radius*.82,42),v=point(b,o.radius*.82,42);
    if(!p.visible||!q.visible||!u.visible||!v.visible)continue;
    const pulse=h<.3?.75+.25*Math.sin(o.now/210+i*2.4):1;
    g.fillStyle(colour,.018*h*pulse);g.fillPoints([p,q,v,u],true);
    g.lineStyle(Math.max(.7,2*p.scale),colour,alpha*pulse);g.lineBetween(p.x,p.y,q.x,q.y);
    g.lineStyle(Math.max(.6,p.scale),0xd7f6ff,alpha*.48*pulse);g.lineBetween(u.x,u.y,v.x,v.y);
    g.lineStyle(Math.max(.6,p.scale),colour,.10*h);g.lineBetween(p.x,p.y,u.x,u.y);
    // One little paired square on each live generator, on the real ground boundary.
    g.fillStyle(colour,alpha);g.fillRect(p.x-2*p.scale,p.y-2*p.scale,4*p.scale,4*p.scale);
  }
}
