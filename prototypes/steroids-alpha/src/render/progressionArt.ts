import type Phaser from 'phaser';
import { PALETTES } from './palette';

/** Visual-only timings. The server has already evolved/removed the ship when these play. */
export const EVOLVE_ART_MS = 1100;
export const WARP_LAUNCH_ART_MS = 700;
export interface ProgressionPlacement { x:number; y:number; scale:number }
const TAU=Math.PI*2;
const colours=PALETTES.map(p=>({primary:parseInt(p.primary.slice(1),16),accent:parseInt(p.accent.slice(1),16),glow:parseInt(p.glow.slice(1),16)}));
const paletteAt=(index:number)=>colours[index]??colours[0];
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const shade=(colour:number,n:number)=>((Math.round((colour>>16)*n)<<16)|(Math.round(((colour>>8)&255)*n)<<8)|Math.round((colour&255)*n));

/** Six assembly plates converge, then the larger hull's shield lattice locks into place. */
export function drawEvolve(g:Phaser.GameObjects.Graphics,at:ProgressionPlacement,t:number,radius:number,palette=0):void {
  t=clamp(t);if(t>=1)return;
  const {x,y}=at,k=at.scale,p=paletteAt(palette),r=Math.max(20,radius)*k*1.45,fade=1-t;
  const settle=1-(1-Math.min(1,t/.62))**3;
  const ring=r*(.82+.4*Math.sin(Math.min(1,t/.7)*Math.PI/2));
  g.lineStyle(Math.max(1,2*k),0x0a192b,.85*fade);
  g.strokeEllipse(x,y,ring*2,ring*1.64);
  g.lineStyle(Math.max(1,1.5*k),p.glow,.8*fade);
  for(let i=0;i<12;i++){
    const a=i*TAU/12+t*.5;
    const b=a+.21;
    g.lineBetween(x+Math.cos(a)*ring,y+Math.sin(a)*ring*.82,x+Math.cos(b)*ring,y+Math.sin(b)*ring*.82);
  }
  if(t<.72)for(let i=0;i<6;i++){
    const a=i*TAU/6-.25,ca=Math.cos(a),sa=Math.sin(a),d=r*(1.6-.76*settle),len=r*.13,w=r*.045;
    const px=x+ca*d,py=y+sa*d*.67;
    const points=[{x:px-ca*len-sa*w,y:py-sa*len+ca*w},{x:px+ca*len-sa*w*.65,y:py+sa*len+ca*w*.65},{x:px+ca*len+sa*w*.65,y:py+sa*len-ca*w*.65},{x:px-ca*len+sa*w,y:py-sa*len-ca*w}];
    g.fillStyle(i%2?p.primary:0xf4ddb5,.85*(1-t/.9));g.fillPoints(points,true);
    g.lineStyle(Math.max(1,k),0x102239,.9*fade);g.strokePoints(points,true);
    g.fillStyle(p.accent,.9*fade);g.fillRect(px-2*k,py-2*k,4*k,4*k);
  }
  if(t>.34){
    const reveal=clamp((t-.34)/.3),rr=r*(.72+.4*reveal);
    g.lineStyle(Math.max(1,2*k),p.glow,.55*fade);
    const points=Array.from({length:7},(_,i)=>({x:x+Math.cos(i*TAU/6)*rr,y:y+Math.sin(i*TAU/6)*rr*.88}));
    g.strokePoints(points,false);
    for(let i=0;i<6;i++){
      const a=i*TAU/6;g.fillStyle(i%2?0xffedc7:p.glow,.7*fade);
      g.fillRect(x+Math.cos(a)*rr-2*k,y+Math.sin(a)*rr*.88-2*k,4*k,4*k);
    }
  }
}

/** Segmented aperture stays on the ship; progress changes light only, never the gameplay pose. */
export function drawWarpCharge(g:Phaser.GameObjects.Graphics,at:ProgressionPlacement,radius:number,progress:number,now:number,palette=0):void {
  const p=paletteAt(palette),f=clamp(progress),r=radius,k=at.scale,rot=now/1800;
  g.lineStyle(Math.max(1,3*k),0x0a1b2c,.8);g.strokeEllipse(at.x,at.y,r*2,r*1.45);
  for(let i=0;i<12;i++){
    const a=i*TAU/12+rot,b=a+.32,on=i<Math.ceil(f*12);
    g.lineStyle(Math.max(1,(on?3:1.2)*k),on?p.glow:0x548097,on?.92:.34);
    g.lineBetween(at.x+Math.cos(a)*r,at.y+Math.sin(a)*r*.725,at.x+Math.cos(b)*r,at.y+Math.sin(b)*r*.725);
    if(on){const x=at.x+Math.cos(a+.16)*(r+5*k),y=at.y+Math.sin(a+.16)*(r+5*k)*.725;
      g.fillStyle(i%3?p.glow:0xffedc7,.72);g.fillRect(x-1.5*k,y-1.5*k,3*k,3*k);}
  }
  for(let i=0;i<3;i++){
    const phase=(now/650+i/3)%1,y=at.y-r*.2-phase*r*.72;
    g.fillStyle(p.glow,.22*f*(1-phase));g.fillRect(at.x+(i-1)*r*.2-1.5*k,y,3*k,8*k);
  }
}

/** A low ground aperture opens and thin bright streaks rise into space; no opaque blast disk. */
export function drawWarpLaunch(g:Phaser.GameObjects.Graphics,at:ProgressionPlacement,t:number,radius=150,palette=0):void {
  t=clamp(t);if(t>=1)return;
  const p=paletteAt(palette),k=at.scale,fade=(1-t)**2,r=radius*k*(.28+.72*Math.sqrt(t));
  g.lineStyle(Math.max(1,5*k*(1-t)),0x0b2d48,.8*fade);g.strokeEllipse(at.x,at.y,r*2,r*.7);
  g.lineStyle(Math.max(1,2.5*k*(1-t)),p.glow,.9*fade);g.strokeEllipse(at.x,at.y,r*2,r*.7);
  g.lineStyle(Math.max(1,k),0xe8ffff,.65*fade);g.strokeEllipse(at.x,at.y,r*1.65,r*.55);
  const lift=radius*k*(.1+1.9*t*t),tipY=at.y-lift;
  for(let i=-2;i<=2;i++){
    const px=at.x+i*8*k,len=radius*k*(.35+.65*t)*(i%2?.65:1);
    g.fillStyle(i===0?0xf3fff2:p.glow,(i===0?.85:.5)*fade);
    g.fillRect(px-(i===0?2:1)*k,tipY,Math.max(1,(i===0?4:2)*k),len);
  }
  if(t<.28){
    g.fillStyle(0xf3fff2,.55*(1-t/.28));g.fillEllipse(at.x,at.y,40*k,12*k);
    g.fillStyle(p.glow,.24*(1-t/.28));g.fillEllipse(at.x,at.y,88*k,28*k);
  }
}

/** Capital escorts share their carrier's material channels and earned authoritative mount/aim. */
export function drawCapitalEscort(g:Phaser.GameObjects.Graphics,x:number,y:number,k:number,a:number,now:number,seed:number,light:number,firing:boolean,palette=0):void {
  const p=paletteAt(palette),c=Math.cos(a),s=Math.sin(a),bob=Math.sin(now/250+seed)*.8;
  const point=(u:number,v:number)=>({x:x+(c*u-s*v)*k,y:y+(s*u+c*v)*k});
  const hull=[point(8,0),point(4,-6),point(-6,-6),point(-11,0),point(-6,6),point(4,6)];
  g.fillStyle(shade(p.primary,light),1);g.fillPoints(hull,true);
  g.lineStyle(Math.max(1,2*k),0x15253c,1);g.strokePoints(hull,true);
  // Cream shoulder plates, bright trim and a dark lower lip read as the same painted ship material.
  for(const side of [-1,1]){
    const offset=side*(8+bob),plate=[point(-5,offset-2.5),point(2,offset-2.5),point(4,offset),point(2,offset+2.5),point(-5,offset+2.5)];
    g.fillStyle(shade(0xe7d2ad,light),1);g.fillPoints(plate,true);
    const l=point(-4,offset),r=point(2,offset);
    g.lineStyle(Math.max(.8,k),shade(p.accent,light),1);g.lineBetween(l.x,l.y,r.x,r.y);
  }
  const barrel=point(15,0);
  g.lineStyle(Math.max(2,5*k),0x102239,1);g.lineBetween(x,y,barrel.x,barrel.y);
  g.lineStyle(Math.max(1,2.5*k),shade(0xf1dfbc,light),1);g.lineBetween(x,y,barrel.x,barrel.y);
  const aft=point(-11,0);
  g.fillStyle(p.glow,.75);g.fillEllipse(aft.x,aft.y,4*k,7*k);
  g.fillStyle(0x11263f,1);g.fillCircle(x,y,3.8*k);g.fillStyle(p.glow,1);g.fillCircle(x,y,2.1*k);
  if(firing){const l=point(13,-4),r=point(13,4),front=point(25,0),innerL=point(17,-2),innerR=point(17,2);
    g.fillStyle(p.glow,.45);g.fillTriangle(l.x,l.y,front.x,front.y,r.x,r.y);
    g.fillStyle(0xffffe1,1);g.fillTriangle(innerL.x,innerL.y,front.x,front.y,innerR.x,innerR.y);}
}

/** Ship-size-specific spacing, shared by the name and its target health indicator. */
export function shipTagClearance(size:number):number {
  return size>2?Math.max(88,38*size+14):Math.max(38,38*size);
}
