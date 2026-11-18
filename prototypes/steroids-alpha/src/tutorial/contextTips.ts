import type Phaser from 'phaser';
import type {ShipState} from '../../sim/ship';
import {canEvolve} from '../../sim/shop';
import {TUNE} from '../../sim/tune';
import {intents} from '../input/intents';
import {loadSave,writeSave} from '../save';
import {text} from '../scenes/common';
import {panel,UI} from '../render/ui';
import {hintBox} from '../render/hudLayout';
import {TipState,TIP_IDS} from './tipState';
import type {TipId} from './tipState';
/** Seen hints persist across runs in the existing save blob; layout rebuilds share the model. */
export class ContextTips {
 readonly model:TipState;
 private label:Phaser.GameObjects.Text;
 constructor(scene:Phaser.Scene,model?:TipState){
  const saved=loadSave().tipsSeen;
  this.model=model??new TipState(Array.isArray(saved)?saved.filter((s):s is TipId=>TIP_IDS.includes(s as TipId)):[],()=>writeSave({tipsSeen:[...this.model.seen]}));
  this.label=text(scene,0,0,'',12,'#dfe8ff').setOrigin(.5,0).setAlign('center').setDepth(955).setVisible(false);
 }
 update(g:Phaser.GameObjects.Graphics,s:ShipState|null,w:number,h:number,now:number,enabled:boolean,inline=false,evolution:0|1|null=null):string|null{
  this.label.setVisible(false);if(!s||s.hp<=0)return null;
  const id=this.model.update(s,now,evolution!==null&&canEvolve(s,TUNE,evolution),enabled);if(!id)return null;
  const missile=intents.touch?'MISSILE':intents.scheme==='marker'?'RIGHT CLICK / Q':'Q',mine=intents.touch?'MINE':'E';
  const messages:Record<TipId,string>={hull:'Hull damaged: collect a green repair pod.',overheat:'Guns overheated: release fire to cool.',shield:'Avoid hits to recharge shields; the thin arc is hull.',missile:`${missile}: face a target until it locks, then launch.`,mine:`${mine}: drop a mine for enemies on your tail.`,evolve:'Evolution ready: evolve in UPGRADES.'};
  const message=messages[id];if(inline)return message;
  const touch=intents.touch,box=hintBox(w,h,touch),pw=box.w;
  this.label.setFontSize(touch?10:12).setWordWrapWidth(pw-20).setText(message).setVisible(true);
  const ph=this.label.height+16,px=box.x,py=box.bottom-ph;
  this.label.setPosition(px,py+8);panel(g,px-pw/2,py,pw,ph,UI.uiAccent);return message;
 }
}
