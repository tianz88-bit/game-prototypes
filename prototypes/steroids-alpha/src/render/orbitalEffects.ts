import type Phaser from 'phaser';
import type { OrbitalPose } from './orbitalTransition';

/** Brief atmosphere streak and surface arrival pulse; no full-screen flash or extra textures. */
export function drawOrbitalEffects(g:Phaser.GameObjects.Graphics,pose:OrbitalPose,w:number,h:number):void {
  g.clear();
  if(pose.phase!=='entry' && pose.phase!=='exit')return;
  const x=w/2,y=h/2-pose.lift*h;
  const strength=pose.phase==='entry'?Math.sin(Math.PI*Math.min(1,pose.progress/.86)):Math.sin(Math.PI*pose.progress);
  const direction=pose.phase==='entry'?-1:1;
  const k=Math.min(1,h/720),length=(55+130*strength)*k;
  if(strength>.01){
    g.fillStyle(0x68cbe4,.11*strength);g.fillTriangle(x-13*k,y,x+13*k,y,x,y+direction*length);
    g.fillStyle(0xd4faff,.65*strength);g.fillRect(x-1.5*k,y+(direction<0?-length*.8:0),3*k,length*.8);
    for(let i=0;i<5;i++){
      const yy=y+direction*(22+i*23)*k;
      g.fillStyle(i%2?0xffad70:0x8cecff,.5*strength);g.fillRect(x+(i%2?10:-14)*k,yy,3*k,8*k);
    }
  }
  if(pose.arrivalPulse>=0){
    const p=pose.arrivalPulse,r=(18+90*p)*h/900;
    g.lineStyle(Math.max(1,3*(1-p)*h/900),0xaff5ff,.55*(1-p));
    g.strokeEllipse(x,h/2+17*h/900,r*2,r*.7);
  }
}
