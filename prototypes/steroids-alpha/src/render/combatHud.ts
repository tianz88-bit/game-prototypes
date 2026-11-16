import type Phaser from 'phaser';
import type { ShipState } from '../../sim/ship';
import { maxShield } from '../../sim/ship';
import { TUNE } from '../../sim/tune';
import { text } from '../scenes/common';
import { panel, css, UI } from './ui';
import { mobileHeader } from './mobileFlightUi';

/** Screen-space silhouette clearance, supplied by the existing projected ship rig. */
export interface CombatHudAnchor {x:number;y:number;radius:number;visible:boolean;}
const clamp=(v:number):number=>Math.max(0,Math.min(1,v));

/** Two quiet instrument halves around the pilot; informational only, with no touch hit area. */
export class CombatHud {
  private labels: Phaser.GameObjects.Text[];
  constructor(scene: Phaser.Scene){
    this.labels=Array.from({length:4},()=>text(scene,0,0,'',11).setDepth(953).setVisible(false));
  }
  draw(g:Phaser.GameObjects.Graphics,p:ShipState|null,w:number,h:number,touch:boolean,now:number,anchor?:CombatHudAnchor):void{
    this.labels.forEach(t=>t.setVisible(false));if(!p)return;
    const label=(i:number,x:number,y:number,s:string,c=UI.uiText,size=10,origin=.5)=>{
      this.labels[i].setVisible(true).setPosition(x,y).setOrigin(origin,0).setFontSize(size).setText(s).setColor(css(c)).setStroke('#071321',3);
    };
    if(anchor?.visible){
      const {x,y,radius:r}=anchor,k=touch?1:1.1,gap=.24;
      const shield=clamp(p.shield/Math.max(1,maxShield(p,TUNE))),hull=clamp(p.hp/Math.max(1,p.hullMax));
      const down=p.shield<=.001,critical=hull<=.35;
      const arc=(radius:number,start:number,end:number,width:number,colour:number,alpha=1)=>{
        if(end-start<=.001)return;
        g.lineStyle(width,colour,alpha);g.beginPath();g.arc(x,y,radius,start,end,false);g.strokePath();
      };
      // Wide navy recess, cream bevel and a coloured inset: the same materials as the panel UI.
      const meter=(start:number,end:number,value:number,colour:number)=>{
        arc(r,start,end,8*k,0x071321,.9);
        arc(r+.8*k,start,end,5.2*k,0x4b5e6a,.72);
        arc(r,start,end,3.8*k,0x142735,.95);
        arc(r,start,start+(end-start)*clamp(value),3.8*k,colour,.94);
        arc(r-1.1*k,start,start+(end-start)*clamp(value),.8*k,0xf3e5c9,.62);
        // Subtle separators make small changes readable against detailed terrain.
        for(let i=1;i<6;i++){
          const a=start+(end-start)*i/6,c=Math.cos(a),s=Math.sin(a);
          g.lineStyle(.8*k,0x081522,.72);g.lineBetween(x+c*(r-2.3*k),y+s*(r-2.3*k),x+c*(r+2.3*k),y+s*(r+2.3*k));
        }
        for(const a of [start,end]){const c=Math.cos(a),s=Math.sin(a);g.lineStyle(1.2*k,0xded1b6,.68);g.lineBetween(x+c*(r-2*k),y+s*(r-2*k),x+c*(r+2*k),y+s*(r+2*k));}
      };
      const leftStart=Math.PI/2+gap,leftEnd=Math.PI*1.5-gap;
      meter(leftStart,leftEnd,down?hull:shield,down?(critical?0xf17d68:0xf2bc6c):0x61d7ed);
      if(down && p.shieldCd>0){
        const recovery=clamp(1-p.shieldCd/TUNE.ship.shieldRegenDelaySeconds);
        arc(r-6*k,leftStart,leftEnd,1.5*k,0x173d4e,.9);
        arc(r-6*k,leftStart,leftStart+(leftEnd-leftStart)*recovery,1.5*k,0x82deeb,.65+.2*Math.sin(now/230));
      }
      const rightStart=-Math.PI/2+gap,rightEnd=Math.PI/2-gap,split=rightStart+(rightEnd-rightStart)*.57;
      meter(rightStart,split-.065,1-clamp(p.heat),p.overheated?0xf18d73:0xf2bc6c);
      const charging=p.dashCharge>0,active=p.dashTime>0;
      const dash=charging?1-p.dashCharge/TUNE.ship.dashChargeSeconds:active?1:1-p.dashCd/TUNE.ship.dashCooldown;
      meter(split+.065,rightEnd,dash,charging?0xffdfaa:active?0xedfff2:0x83d6cf);
      // Small material emblems, rather than extra text and boxes around the cockpit.
      const ix=x-r-9*k,iy=y;
      g.fillStyle(down?0xf2bc6c:0x90e5ef,.9);g.fillPoints([{x:ix-3*k,y:iy-4*k},{x:ix+3*k,y:iy-4*k},{x:ix+2*k,y:iy+1*k},{x:ix,y:iy+4*k},{x:ix-2*k,y:iy+1*k}],true);
      if(down){g.lineStyle(k,0x071321,1);g.lineBetween(ix-3*k,iy+3*k,ix+3*k,iy-3*k);}
      const wx=x+r+9*k,wy=y-r*.46;
      g.fillStyle(p.overheated?0xf18d73:0xf2bc6c,.9);for(const dx of [-2,2])g.fillRect(wx+(dx-1)*k,wy-3*k,2*k,6*k);
      if(p.overheated){label(1,wx+2*k,wy-16*k,'LOCK',0xffad8f,8);arc(r-6*k,rightStart,split-.065,1.4*k,0xffb183,.5+.25*Math.sin(now/180));}
      const dy=y+r*.5;
      g.lineStyle(1.4*k,active?0xf0ffe9:0x9fddd4,.9);
      for(const dx of [-2,2]){g.beginPath();g.moveTo(wx+(dx-2)*k,dy-3*k);g.lineTo(wx+(dx+1)*k,dy);g.lineTo(wx+(dx-2)*k,dy+3*k);g.strokePath();}
      if(charging||active){const a=.35+.25*Math.sin(now/95);arc(r+3*k,split+.065,rightEnd,1.2*k,0xf0dfba,a);}
      label(0,x,y+r+8*k,`${Math.round(p.hp)} / ${Math.round(p.hullMax)}`,critical?0xffa28d:0xf0e5cd,touch?10:11);
    }
    // Cargo stays in a corner, outside the centred flight instruments and phone controls.
    const cargo=TUNE.salvage.cargoMax,full=p.salvage>=cargo-.5,x=12,y=touch?18:h-30;
    panel(g,x,y,132,19,full?0xf39872:UI.uiGold);
    g.fillStyle(0xe3a248,1);g.fillPoints([{x:x+11,y:y+4},{x:x+16,y:y+4},{x:x+19,y:y+9},{x:x+16,y:y+14},{x:x+11,y:y+14},{x:x+8,y:y+9}],true);
    label(2,x+123,y+3,`SALVAGE ${Math.floor(p.salvage)}/${cargo}`,full?0xffb394:0xffdd95,10,1);
    if(full){
      const warp=mobileHeader(w).warp,cx=touch?warp.x:w/2,cy=touch?52:69,bw=touch?warp.w:142;
      g.fillStyle(0x261a23,.92);g.fillRoundedRect(cx-bw/2,cy,bw,15,3);
      g.lineStyle(1,0xf39872,.7);g.lineBetween(cx-bw/2+4,cy+14,cx+bw/2-4,cy+14);
      label(3,cx,cy+1,'FULL · WARP OUT',0xffbd91,touch?9:10);
    }
  }
}
