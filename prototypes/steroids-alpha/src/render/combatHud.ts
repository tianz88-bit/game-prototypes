import type Phaser from 'phaser';
import type { ShipState } from '../../sim/ship';
import { maxShield } from '../../sim/ship';
import { TUNE } from '../../sim/tune';
import { text } from '../scenes/common';
import { panel, css, UI } from './ui';
import { mobileHeader } from './mobileFlightUi';

/** One bounded instrument cluster. Touch targets stay outside it. */
export class CombatHud {
  private labels: Phaser.GameObjects.Text[];
  constructor(scene: Phaser.Scene){
    this.labels=Array.from({length:8},()=>text(scene,0,0,'',11).setDepth(953).setVisible(false));
  }
  /** hold: 'fuel' on one's own clan home planet (owner); 'none' on another clan's, where visitors
   *  can mine nothing, so the cargo readout is hidden. */
  draw(g:Phaser.GameObjects.Graphics,p:ShipState|null,w:number,h:number,touch:boolean,now:number,hold:'salvage'|'fuel'|'none'='salvage'):void{
    this.labels.forEach(t=>t.setVisible(false));if(!p)return;
    const width=touch?Math.min(240,w*.4):312;
    const right=touch?12+width:w/2+width/2;
    const x=right-width,y=touch?12:h-88;
    panel(g,x,y,width,touch?64:80,UI.uiBorder);
    const label=(i:number,px:number,py:number,s:string,c:number=UI.uiText,size=11,origin=0)=>{
      const t=this.labels[i],colour=css(c);
      t.setVisible(true).setPosition(px,py).setOrigin(origin,0).setFontSize(size).setText(s);
      if(t.style.color!==colour)t.setColor(colour);
    };
    const max=maxShield(p,TUNE),shield=Math.max(0,Math.min(1,p.shield/Math.max(1,max)));
    const hull=Math.max(0,Math.min(1,p.hp/Math.max(1,p.hullMax)));
    const down=p.shield<=.001, critical=hull<=.35;
    const row=(py:number,f:number,c:number)=>{
      g.fillStyle(0x060e20,1);g.fillRoundedRect(x+12,py,width-24,8,2);
      if(f>0){g.fillStyle(c,1);g.fillRoundedRect(x+12,py,(width-24)*f,8,Math.min(2,(width-24)*f/2));
        g.fillStyle(0xfff4dc,.3);g.fillRect(x+13,py+1,Math.max(0,(width-24)*f-2),2);}
      g.lineStyle(1,0x081426,.65);for(let i=1;i<8;i++)g.lineBetween(x+12+(width-24)*i/8,py,x+12+(width-24)*i/8,py+8);
    };
    label(0,x+12,y+7,down?'SHIELD DOWN':'SHIELD',down?0xff9270:0x9beaff,10);
    label(1,right-12,y+7,down&&p.shieldCd>0?`REBOOT ${p.shieldCd.toFixed(1)}s`:`${Math.ceil(p.shield)} / ${Math.ceil(max)}`,down?0xffba8c:0xe4f6ff,10,1);
    row(y+22,down?0:shield,0x55cded);
    if(down&&p.shieldCd>0){
      const f=Math.max(0,Math.min(1,1-p.shieldCd/TUNE.ship.shieldRegenDelaySeconds));
      g.fillStyle(0xff9868,.55);g.fillRect(x+12,y+24,(width-24)*f,4);
    }
    label(2,x+12,y+34,critical?'HULL !':p.hullMax>=TUNE.ship.powerCap?'HULL MAX':'HULL',critical?0xff9270:0xffe2b0,10);
    label(3,right-12,y+34,`${Math.round(p.hp)} / ${Math.round(p.hullMax)}`,critical?0xff9270:0xffedc7,10,1);
    row(y+49,hull,critical?0xf37562:0xf2bc6c);
    if(!touch){
    const half=(width-30)/2;
    const chip=(cx:number,f:number,c:number)=>{g.fillStyle(0x081426,1);g.fillRoundedRect(cx,y+63,half,12,3);const fill=half*Math.max(0,Math.min(1,f));if(fill>0){g.fillStyle(c,.25);g.fillRoundedRect(cx,y+63,fill,12,Math.min(3,fill/2));}};
    chip(x+12,p.heat,p.overheated?0xff6c59:0xffae5e);
    const charging=p.dashCharge>0;
    const ready=!charging&&p.dashCd<=0&&p.dashTime<=0;
    const dash=charging?1-p.dashCharge/TUNE.ship.dashChargeSeconds:p.dashTime>0?1:1-p.dashCd/TUNE.ship.dashCooldown;
    chip(x+18+half,dash,0x87d6cf);
    label(4,x+16,y+62,p.overheated?'HEAT · LOCKED':`HEAT ${Math.round(p.heat*100)}%`,p.overheated?0xff9b81:0xffd7a7,9);
    label(5,x+22+half,y+62,charging?'DASH · CHARGING':p.dashTime>0?'DASH · ACTIVE':ready?'DASH · READY':`DASH ${Math.max(0,p.dashCd).toFixed(1)}s`,0xb0e8e3,9);
    }else{
      const heat=this.labels[4];heat.setVisible(p.overheated).setOrigin(.5);
      if(p.overheated){heat.setFontSize(9).setText('HOT');if(heat.style.color!=='#ffb09a')heat.setColor('#ffb09a');}
    }
    if(hold!=='none'){
    const home=hold==='fuel';
    const cargo=TUNE.salvage.cargoMax,held=home?p.fuel:p.salvage,full=held>=cargo-.5;
    const sy=touch?y+70:y-23;
    panel(g,right-132,sy,132,19,full?0xf39872:UI.uiGold);
    // A faceted salvage coin, repeated on pickups and the carried balance.
    g.fillStyle(0xe3a248,1);g.fillPoints([{x:right-119,y:sy+4},{x:right-114,y:sy+4},{x:right-111,y:sy+9},{x:right-114,y:sy+14},{x:right-119,y:sy+14},{x:right-122,y:sy+9}],true);
    // Cargo hold (owner): carried / max; when full, the cue is to warp out and bank it.
    label(6,right-9,sy+3,`${home?'FUEL':'SALVAGE'} ${Math.floor(held)}/${cargo}`,full?0xffb394:0xffdd95,10,1);
    if(full){
      const warp=mobileHeader(w).warp,cx=touch?warp.x:w/2,cy=touch?52:69,bw=touch?warp.w:142;
      g.fillStyle(0x261a23,.92);g.fillRoundedRect(cx-bw/2,cy,bw,15,3);
      g.lineStyle(1,0xf39872,.7);g.lineBetween(cx-bw/2+4,cy+14,cx+bw/2-4,cy+14);
      label(7,cx,cy+1,home?'FULL · DOCK TO UNLOAD':'FULL · WARP OUT',0xffbd91,touch?9:10,.5);
    }
    }
    // Slow warning beat only; no full-screen pulse while the shield recovers.
    if(down){g.lineStyle(2,0xff9868,.45+.2*Math.sin(now/230));g.lineBetween(x+12,y+21,x+42,y+21);}
  }

  heatWarning(x:number,y:number):void { this.labels[4].setPosition(x,y); }
}
