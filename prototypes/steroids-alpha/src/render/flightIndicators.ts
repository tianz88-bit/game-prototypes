import type Phaser from 'phaser';
import { panel } from './ui';
import type { Unlock } from '../../sim/unlocks';

type Point = {x:number;y:number;visible:boolean};

/** Small authored canvas emblems: the same cream bevels and navy cuts as the ships. */
export function drawUnlockEmblem(g:Phaser.GameObjects.Graphics,u:Unlock,x:number,y:number,size=42):void {
  const k=size/42,p=(a:number,b:number)=>({x:x+a*k,y:y+b*k});
  g.fillStyle(0x060f1d,.9);g.fillRoundedRect(x-size/2,y-size/2,size,size,7*k);
  g.lineStyle(k,0x52677c,.8);g.strokeRoundedRect(x-size/2,y-size/2,size,size,7*k);
  const colour=u.colour??u.palette?.[Math.max(0,(u.palette?.length??1)-2)]??0xffce73;
  if(u.slot==='flame'){
    const colours=u.palette??[0xff8450,0xffce75,0xfff1d3];
    const plume=[p(-11,13),p(-8,-2),p(-3,3),p(2,-17),p(8,-3),p(11,3),p(10,13)];
    g.fillStyle(0x081426,1);g.fillPoints(plume,true);
    g.lineStyle(3*k,0x081426,1);g.strokePoints(plume,true);
    g.fillStyle(colours[0],1);g.fillPoints(plume,true);
    g.fillStyle(colours[Math.min(1,colours.length-1)],1);g.fillPoints([p(-7,12),p(-5,2),p(0,5),p(3,-9),p(7,6),p(7,12)],true);
    g.fillStyle(colours[colours.length-1]??0xfff5da,1);g.fillPoints([p(-3,12),p(-2,6),p(1,9),p(3,1),p(4,12)],true);
    g.fillStyle(0xdacaa9,1);g.fillRoundedRect(x-10*k,y+12*k,20*k,5*k,k);
    g.lineStyle(k,0x071426,1);g.lineBetween(x-5*k,y+13*k,x-5*k,y+17*k);g.lineBetween(x+5*k,y+13*k,x+5*k,y+17*k);
  }else if(u.slot==='shield'){
    const shape=[p(-13,-12),p(0,-16),p(13,-12),p(11,3),p(0,16),p(-11,3)];
    g.fillStyle(colour,.18);g.fillPoints(shape,true);g.lineStyle(3*k,0x071426,1);g.strokePoints(shape,true);
    g.lineStyle(2*k,colour,1);g.strokePoints(shape,true);
    g.fillStyle(0xf6edcf,.95);g.fillPoints([p(-8,-9),p(0,-11),p(0,10),p(-6,2)],true);
    g.lineStyle(k,colour,.9);g.lineBetween(x,y-11*k,x,y+10*k);g.lineBetween(x-6*k,y-1*k,x+6*k,y-1*k);
    g.fillStyle(0xe6fff5,1);g.fillRect(x-2*k,y-3*k,4*k,4*k);
  }else if(u.slot==='killfx'){
    g.lineStyle(2*k,colour,.7);g.strokeCircle(x,y,13*k);g.lineStyle(k,0xf7e9ca,.8);g.strokeCircle(x,y,8*k);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,c=Math.cos(a),s=Math.sin(a);g.fillStyle(i%2?colour:0xffedc7,1);g.fillTriangle(x+c*18*k,y+s*18*k,x+c*6*k-s*2*k,y+s*6*k+c*2*k,x+c*6*k+s*2*k,y+s*6*k-c*2*k);}
    g.fillStyle(0xeafcff,1);g.fillRect(x-3*k,y-3*k,6*k,6*k);
  }else if(u.slot==='badge'){
    g.fillStyle(0x473b2b,1);g.fillCircle(x,y,15*k);g.lineStyle(k,0xeab56a,.7);g.strokeCircle(x,y,15*k);
    g.fillStyle(0xffdc8b,1);
    if(u.id.endsWith('crown')){
      g.fillPoints([p(-12,-7),p(-6,-2),p(0,-12),p(6,-2),p(12,-7),p(9,8),p(-9,8)],true);
      g.fillStyle(0x8e5d39,1);g.fillRect(x-9*k,y+7*k,18*k,4*k);
      g.fillStyle(0xfff4d1,1);for(const dx of [-8,0,8])g.fillRect(x+(dx-1)*k,y+2*k,2*k,2*k);
    }else if(u.id.endsWith('skull')){
      g.fillRoundedRect(x-10*k,y-10*k,20*k,18*k,7*k);g.fillRect(x-6*k,y+5*k,12*k,8*k);
      g.fillStyle(0x162435,1);g.fillRect(x-7*k,y-4*k,5*k,5*k);g.fillRect(x+2*k,y-4*k,5*k,5*k);g.fillTriangle(x,y+1*k,x-2*k,y+5*k,x+2*k,y+5*k);
      for(const dx of [-3,2])g.fillRect(x+dx*k,y+9*k,k,4*k);
    }else{
      g.fillPoints([p(0,-14),p(4,-4),p(14,0),p(4,4),p(0,14),p(-4,4),p(-14,0),p(-4,-4)],true);
      g.fillStyle(0xf9f4d6,1);g.fillTriangle(x,y-9*k,x+2*k,y-2*k,x-2*k,y+2*k);
    }
  }else if(u.slot==='tag'){
    g.fillStyle(colour,.22);g.fillRoundedRect(x-16*k,y-9*k,32*k,18*k,3*k);
    g.lineStyle(k,colour,1);g.strokeRoundedRect(x-16*k,y-9*k,32*k,18*k,3*k);
    g.fillStyle(colour,1);for(let i=0;i<3;i++)g.fillRect(x+(-11+i*8)*k,y-2*k,(i===1?6:5)*k,4*k);
  }else{
    g.fillStyle(0xe6d7b8,1);g.fillRoundedRect(x-12*k,y-15*k,24*k,30*k,3*k);
    for(let i=0;i<4;i++){g.fillStyle(i===0?0x218da7:0x4b6676,1);g.fillRect(x-7*k,y+(-9+i*6)*k,14*k,2*k);}
  }
}

/** Same compact segmented meter material as the pilot's own HUD. Coordinates remain caller-owned. */
export function drawTargetMeter(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,share:number,onShield:boolean,fade:number):void {
  const k=Math.max(.6,h/5),f=Math.max(0,Math.min(1,share)),c=onShield?0x6fd6ff:0xffb06c;
  g.fillStyle(0x071323,.9*fade);g.fillRoundedRect(x-2*k,y-2*k,w+4*k,h+4*k,2*k);
  g.lineStyle(k,0x8798a3,.5*fade);g.strokeRoundedRect(x-2*k,y-2*k,w+4*k,h+4*k,2*k);
  g.fillStyle(c,.96*fade);if(f>0)g.fillRect(x,y,w*f,h);
  g.fillStyle(0xfff4d1,.4*fade);if(f>0)g.fillRect(x,y,w*f,Math.max(.7,k));
  g.lineStyle(k,0x071323,.8*fade);for(let i=1;i<6;i++)g.lineBetween(x+w*i/6,y,x+w*i/6,y+h);
  g.fillStyle(c,fade);g.fillRect(x-7*k,y-k,3*k,h+2*k);
}

/** A clear solid nose tip with the same dark outline and cream highlight as the ship panels. */
export function drawNoseMarker(g:Phaser.GameObjects.Graphics,x:number,y:number,dir:number,k:number):void {
  const c=Math.cos(dir),s=Math.sin(dir),p=(u:number,v:number)=>({x:x+(c*u-s*v)*k,y:y+(s*u+c*v)*k});
  const pts=[p(1,0),p(-8,-6),p(-5,0),p(-8,6)];
  g.fillStyle(0x081426,.85);g.fillPoints(pts,true);g.lineStyle(3*k,0x081426,.85);g.strokePoints(pts,true);
  g.lineStyle(1.5*k,0x7edff2,.95);g.strokePoints(pts,true);g.fillStyle(0xffefc8,.95);g.fillTriangle(p(0,0).x,p(0,0).y,p(-5,-3).x,p(-5,-3).y,p(-3,0).x,p(-3,0).y);
  const a=p(-11,-4),b=p(-11,4);g.fillStyle(0x8ee8ef,.65);g.fillRect(a.x-k,a.y-k,2*k,2*k);g.fillRect(b.x-k,b.y-k,2*k,2*k);
}

/** Ground-only marked boundary. The bright line stays exactly on the server's zone radius. */
export function drawSalvageZoneRing(g:Phaser.GameObjects.Graphics,zone:{x:number;y:number;r:number},project:(x:number,y:number)=>Point,inside:boolean,now:number):void {
  const colour=inside?0xf5d888:0x9ed7bd,n=64;
  let prev:Point|null=null;
  for(let i=0;i<=n;i++){
    const a=i/n*Math.PI*2,q=project(zone.x+Math.cos(a)*zone.r,zone.y+Math.sin(a)*zone.r);
    if(prev&&prev.visible&&q.visible&&i%4!==0){
      g.lineStyle(4,0x112b2c,.6);g.lineBetween(prev.x,prev.y,q.x,q.y);
      g.lineStyle(1.7,colour,.62);g.lineBetween(prev.x,prev.y,q.x,q.y);
    }
    if(q.visible&&i<n&&i%8===0){
      const pulse=.65+.2*Math.sin(now/800+i),r=4;
      g.fillStyle(0x10252b,.95);g.fillPoints([{x:q.x,y:q.y-r-2},{x:q.x+r+2,y:q.y},{x:q.x,y:q.y+r+2},{x:q.x-r-2,y:q.y}],true);
      g.fillStyle(colour,pulse);g.fillRect(q.x-2,q.y-2,4,4);
      const inner=project(zone.x+Math.cos(a)*(zone.r-15),zone.y+Math.sin(a)*(zone.r-15));
      if(inner.visible){g.lineStyle(1,colour,.4);g.lineBetween(q.x,q.y,inner.x,inner.y);}
    }
    prev=q;
  }
}

/** Style an existing text object; no modal input layer or new text allocation is introduced. */
export function drawConnectionBanner(g:Phaser.GameObjects.Graphics,t:Phaser.GameObjects.Text,w:number,h:number,status:string,touch:boolean):void {
  if(status==='open'){
    t.setFontSize(18).setWordWrapWidth(0).setPosition(w/2,h*.3);return;
  }
  if(!['connecting','reconnecting','closed','lost','full'].includes(status)||!t.text)return;
  const alert=status==='lost'||status==='closed',colour=alert?0xf39872:0x8edbe7;
  // On phones use the space beneath vitals and left of the upgrade drawer/combat controls.
  const width=touch?Math.min(340,w*.44):Math.min(440,w-36);
  const x=touch?12+width/2:w/2,y=touch?Math.max(156,h*.36):Math.max(126,h*.28),size=touch?12:14;
  t.setFontSize(size).setWordWrapWidth(width-62).setAlign('center').setPosition(x+13,y);
  const height=Math.max(56,Math.min(110,t.height+24));
  panel(g,x-width/2,y-height/2,width,height,colour);
  const bx=x-width/2+23;
  g.lineStyle(2,colour,.9);g.beginPath();g.arc(bx,y,9,-Math.PI*.8,Math.PI*.8);g.strokePath();
  g.fillStyle(0xffedc7,.95);g.fillTriangle(bx-3,y-4,bx+3,y,bx-3,y+4);
  if(alert){g.lineStyle(2,colour,1);g.lineBetween(bx-8,y+11,bx+8,y-11);}
}
