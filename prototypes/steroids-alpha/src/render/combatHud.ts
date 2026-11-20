import {RESOURCE_ART,resourceGlyph} from './resources';
import type {PickupKind} from '../../sim/pickups';
import type Phaser from 'phaser';
import type { ShipState } from '../../sim/ship';
import { maxShield, hullCapacity, mineralBalance } from '../../sim/ship';
import { TUNE } from '../../sim/tune';
import { text } from '../scenes/common';
import { panel, css, UI } from './ui';
import { upgradeTotal } from '../../sim/chassis';

/** Screen-space silhouette clearance, supplied by the existing projected ship rig. */
export interface CombatHudAnchor {x:number;y:number;radius:number;visible:boolean;}
const clamp=(v:number):number=>Math.max(0,Math.min(1,v));

/** Two quiet instrument halves around the pilot; informational only, with no touch hit area. */
export class CombatHud {
  private labels: Phaser.GameObjects.Text[];
  private icons:Phaser.GameObjects.Image[];
  constructor(scene: Phaser.Scene){
    this.icons=Array.from({length:2},()=>scene.add.image(0,0,'__WHITE').setDepth(953).setVisible(false));
    this.labels=Array.from({length:4},()=>text(scene,0,0,'',11).setDepth(953).setVisible(false));
  }
  draw(g:Phaser.GameObjects.Graphics,p:ShipState|null,w:number,h:number,touch:boolean,now:number,anchor?:CombatHudAnchor,hold:'salvage'|'fuel'|'none'='salvage'):void{
    this.labels.forEach(t=>t.setVisible(false));this.icons.forEach(i=>i.setVisible(false));if(!p)return;
    const label=(i:number,x:number,y:number,s:string,c=UI.uiText,size=10,origin=.5)=>{
      this.labels[i].setVisible(true).setPosition(x,y).setOrigin(origin,0).setFontSize(size).setText(s).setColor(css(c)).setStroke('#071321',3);
    };
    if(anchor?.visible){
      const {x,y,radius:r}=anchor,k=touch?1:1.1,gap=.24;
      const shield=clamp(p.shield/Math.max(1,maxShield(p,TUNE))),hull=clamp(p.hp/Math.max(1,hullCapacity(p,TUNE)));
      // Owner, 16 November 2026: hull below 50% flashes red.
      const down=p.shield<=.001,critical=hull<=.5,flash=critical&&Math.sin(now/140)>0;
      const arc=(radius:number,start:number,end:number,width:number,colour:number,alpha=1)=>{
        if(end-start<=.001)return;
        g.lineStyle(width,colour,alpha);g.beginPath();g.arc(x,y,radius,start,end,false);g.strokePath();
      };
      // Light segmented arcs borrow the quiet instrument feel of the original GoldenEye HUD.
      // Each right-hand instrument has its own full semicircle, thinner than the shield/hull.
      const meter=(radius:number,start:number,end:number,value:number,colour:number,width:number,fromBottom=false,notchCapacity=0)=>{
        const f=clamp(value),a=fromBottom?end-(end-start)*f:start,b=fromBottom?end:start+(end-start)*f;
        arc(radius,start,end,width+2*k,0x071321,.4);
        arc(radius,start,end,width,0x7a929b,.2);
        arc(radius,a,b,width,colour,.68);
        arc(radius-width*.3,a,b,.55*k,0xf3e5c9,.3);
        for(let capacity=10;capacity<=notchCapacity;capacity+=10){
          const angle=start+(end-start)*capacity/notchCapacity,c=Math.cos(angle),sn=Math.sin(angle);
          g.lineStyle(.85*k,0x081522,.58);g.lineBetween(x+c*(radius-width*.65),y+sn*(radius-width*.65),x+c*(radius+width*.65),y+sn*(radius+width*.65));
        }
      };
      // Shield keeps its base socket. Dash/weapon symbols sit directly at their staggered arc tips.
      const baseSymbol=(radius:number,a:number,colour:number,kind:'shield'|'weapon'|'dash')=>{
        const cx=x+Math.cos(a)*radius,cy=y+Math.sin(a)*radius;
        if(kind==='shield'){g.fillStyle(0x0c1b29,.55);g.fillPoints([{x:cx-3.8*k,y:cy-4*k},{x:cx+3.8*k,y:cy-4*k},{x:cx+3.2*k,y:cy+3*k},{x:cx,y:cy+4*k},{x:cx-3.2*k,y:cy+3*k}],true);
        g.lineStyle(.7*k,colour,.5);g.lineBetween(cx-3.8*k,cy-3.5*k,cx+3.8*k,cy-3.5*k);}
        if(kind==='shield'){
          g.fillStyle(colour,.8);g.fillPoints([{x:cx-2*k,y:cy-2.5*k},{x:cx+2*k,y:cy-2.5*k},{x:cx+1.5*k,y:cy+.5*k},{x:cx,y:cy+2.5*k},{x:cx-1.5*k,y:cy+.5*k}],true);
          if(down){g.lineStyle(.8*k,0x0c1b29,.9);g.lineBetween(cx-2*k,cy+2*k,cx+2*k,cy-2*k);}
        }else if(kind==='weapon'){
          g.fillStyle(colour,.8);for(const dx of [-1.5,1.5]){g.fillRect(cx+(dx-.55)*k,cy-1.5*k,1.1*k,3.5*k);g.fillTriangle(cx+(dx-.55)*k,cy-1.5*k,cx+(dx+.55)*k,cy-1.5*k,cx+dx*k,cy-2.8*k);}
        }else{
          g.lineStyle(.9*k,colour,.85);for(const dx of [-1.5,1.5]){g.beginPath();g.moveTo(cx+(dx-1)*k,cy-2*k);g.lineTo(cx+(dx+1)*k,cy);g.lineTo(cx+(dx-1)*k,cy+2*k);g.strokePath();}
        }
      };
      const leftBase=Math.PI/2+gap,leftStart=leftBase+.15,leftEnd=Math.PI*1.5-gap;
      const shieldColour=down?(critical?(flash?0xff4a3d:0xf17d68):0xf2bc6c):0x61d7ed;
      meter(r,leftStart,leftEnd,down?hull:shield,shieldColour,4.5*k,false,down?hullCapacity(p,TUNE):maxShield(p,TUNE));
      const hullColour=critical?(flash?0xff4a3d:0xf17d68):0xf2bc6c;
      meter(r-4.8*k,leftStart,leftEnd,hull,hullColour,1.15*k);
      baseSymbol(r,leftBase+.07,shieldColour,'shield');
      if(down && p.shieldCd>0){
        const recovery=clamp(1-p.shieldCd/TUNE.ship.shieldRegenDelaySeconds);
        arc(r-8*k,leftStart,leftEnd,1.1*k,0x173d4e,.45);
        arc(r-8*k,leftStart,leftStart+(leftEnd-leftStart)*recovery,1.1*k,0x82deeb,.45+.15*Math.sin(now/230));
      }
      const rightStart=-Math.PI/2+gap,rightBase=Math.PI/2-gap,rightEnd=rightBase-.15;
      const dashRadius=r,weaponRadius=r+2.3*k,weaponEnd=rightEnd-.24;
      const weaponColour=p.overheated?0xf18d73:0xf2bc6c;
      meter(weaponRadius,rightStart,weaponEnd,1-clamp(p.heat),weaponColour,2.3*k,true);
      baseSymbol(weaponRadius,weaponEnd+.08,weaponColour,'weapon');
      const charging=p.dashCharge>0,active=p.dashTime>0;
      const dash=charging?1-p.dashCharge/TUNE.ship.dashChargeSeconds:active?1:1-p.dashCd/TUNE.ship.dashCooldown;
      const dashColour=charging?0xffdfaa:active?0xedfff2:0x83d6cf;
      meter(dashRadius,rightStart,rightEnd,dash,dashColour,2.3*k,true);
      baseSymbol(dashRadius,rightEnd+.08,dashColour,'dash');
      if(p.overheated){arc(weaponRadius+2*k,rightStart,weaponEnd,.8*k,0xffb183,.3+.2*Math.sin(now/180));}
      if(charging||active){arc(dashRadius-2*k,rightStart,rightEnd,.8*k,0xf0dfba,.25+.18*Math.sin(now/95));}

    }
    const icon=(slot:number,kind:PickupKind,x:number,y:number,height:number)=>{const i=this.icons[slot],key='combat-'+RESOURCE_ART[kind].asset;if(i.scene.textures.exists(key)){i.setTexture(key,'body').setPosition(x,y).setDisplaySize(height*i.frame.width/i.frame.height,height).setVisible(true);}else resourceGlyph(g,kind,x,y,height);};
    // Minerals are spendable; salvage/fuel is a separate carry-out balance.
    const home=hold==='fuel',held=home?p.fuel:p.salvage,cargo=TUNE.salvage.cargoMax,full=held>=cargo-.5;
    panel(g,12,12,196,36,UI.uiBorder);
    icon(0,'mineral',25,24,18);
    label(0,40,16,`MIN ${mineralBalance(p,TUNE)}`,UI.uiGold,touch?13:14,0);
    label(1,198,18,`Lv.${upgradeTotal(p)}`,UI.uiText,11,1);
    if(hold!=='none'){icon(1,home?'fuel':'salvage',25,40,13);label(2,38,34,`${home?'FUEL':'SALVAGE'} ${Math.floor(held)}/${cargo} · ${home?'UNLOAD AT HOME':'BANK ON WARP'}`,full?0xffb394:0xcfc8b7,9,0);}
    if(full&&hold!=='none')label(3,22,52,home?'FULL · DOCK TO UNLOAD':'FULL · WARP TO BANK',0xffbd91,10,0);
  }
}
