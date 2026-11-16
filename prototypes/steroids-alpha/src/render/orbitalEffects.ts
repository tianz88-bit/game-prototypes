import type Phaser from 'phaser';
import type { OrbitalPose } from './orbitalTransition';

/** Heading-aligned hyperspace behind the foreground ship. No textures or growing particle pool. */
export function drawOrbitalEffects(g:Phaser.GameObjects.Graphics,pose:OrbitalPose,w:number,h:number,heading=0,time=0):void {
  g.clear();if(pose.phase==='flight')return;
  const strength=pose.speedlines;
  g.fillStyle(0x020916,pose.spaceAlpha);g.fillRect(0,0,w,h);
  const dx=Math.cos(heading),dy=Math.sin(heading),span=Math.hypot(w,h),k=Math.max(.9,h/720);
  const hash=(n:number):number=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  for(let i=0;i<80;i++){
    const lateral=(hash(i)-.5)*span;
    const t=((hash(i+97)+time*.0011)%1-.5)*span;
    const x=w/2-dx*t-dy*lateral,y=h/2-dy*t+dx*lateral;
    if(Math.hypot(x-w/2,y-h/2)<60*k)continue;
    const length=(45+(i%7)*22)*k*(.2+strength),alpha=strength*(.18+(i%5)*.13);
    g.lineStyle((i%9===0?2:1)*k,i%11===0?0xffba7c:i%3===0?0xe8fbff:0x68d4f3,alpha);
    g.lineBetween(x,y,x-dx*length,y-dy*length);
  }
}

/** Sparse square residuals follow the visitor's bearing and expire with a bounded presentation window. */
export function drawArrivalTrail(g:Phaser.GameObjects.Graphics,x:number,y:number,angle:number,scale:number,strength:number,time:number,seed:number):void {
  if(strength<=0)return;
  const dx=Math.cos(angle),dy=Math.sin(angle);
  for(let i=0;i<18;i++){
    const p=(i*.618+time*.0005)%1,behind=(18+p*110)*scale,side=Math.sin(i*17+seed)*14*scale;
    const size=(i%3===0?4:2)*scale;
    g.fillStyle(i%7===0?0xffb278:i%3===0?0xedfcff:0x76dfff,strength*(1-p)*.75);
    g.fillRect(x-dx*behind-dy*side,y-dy*behind+dx*side,size*(i%2?2:1),size);
  }
}
