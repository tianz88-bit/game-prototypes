import {superName,superDescription} from './superCopy';
import {fighterSuper} from '../sim/super';
import { rosterHeadFrame } from '../render/portraitHeadshots';

import { portraitScaleFactor } from '../render/portraitScale';
import {controlHint} from './controlHint';
import {inputModality} from '../input/modality';

import Phaser from 'phaser';

import { t } from '../i18n';

import {PALETTES} from '../render/paletteCatalog';

import { skinTexture } from '../render/skins';

import { artKey } from '../render/art';

import { PIXEL_RATIO, VIEW } from '../render/pixelRatio';

import { CHARACTER_IDS, CHARACTER_INFO, type CharId } from '../sim/character';

import { tune } from '../sim/tune';

import { reducedMotion } from './presentation';

import { cartoonPanel, cartoonButton, bindButtonFeedback } from './cartoonChrome';

interface PanelState {

 dummy?:boolean;survival?:boolean;rosterAvailable?:readonly CharId[];id:CharId;label:string;hidden:boolean;locked:boolean;focused:boolean;cursor:boolean;available:boolean;selected:boolean;skin:string;skinName:string;skinIndex:number;skinCount:number;status:string;stats:[string,number,number][];uppercut?:{stars:number};

}

export interface SelectionState {notice?:boolean;training?:boolean;rosterSide?:number;panels:PanelState[];step:number;steps:string[];action:string;level:string|null;hint:string;bestOf:number;formatEditable?:boolean;}

import { rosterSlots, rosterIds, rosterCardGeometry } from './rosterLayout';

interface PanelView {

 normal:Phaser.GameObjects.Container; portrait:Phaser.GameObjects.Container; image:Phaser.GameObjects.Image;

 title:Phaser.GameObjects.Text; archetype:Phaser.GameObjects.Text; upper:Phaser.GameObjects.Text; superDescription:Phaser.GameObjects.Text;

 stats:Phaser.GameObjects.Container; fills:Phaser.GameObjects.Graphics; labels:Phaser.GameObjects.Text[]; scores:Phaser.GameObjects.Text[];

 tray:Phaser.GameObjects.Container; skinName:Phaser.GameObjects.Text; skinIndex:Phaser.GameObjects.Text; skinButtons:Phaser.GameObjects.Rectangle[]; skinDraws:(()=>void)[];

 hidden:Phaser.GameObjects.Container; hiddenLabel:Phaser.GameObjects.Text; hiddenStatus:Phaser.GameObjects.Text;

 survival:Phaser.GameObjects.Container; survivalHeading:Phaser.GameObjects.Text; survivalBody:Phaser.GameObjects.Text;

 textureKey:string; statsKey:string; values:number[]; motion:{progress:number}; fillProgress:number;

}



export class CharacterSelectView {

 private cardGeometry=rosterCardGeometry();

 private root:Phaser.GameObjects.Container;

 private chrome:Phaser.GameObjects.Graphics;

 private content:Phaser.GameObjects.Container[]=[];

 private panelHits:Phaser.GameObjects.Rectangle[]=[];

 private panelKeys=['',''];

 private panelIdentities=['',''];

 private panels:PanelView[]=[];

 private cards:Phaser.GameObjects.Graphics[]=[];
 private cursors:(Phaser.GameObjects.Graphics|null)[]=[];

 private locks:Phaser.GameObjects.Image[][]=[];

 private darkeners:(Phaser.GameObjects.Graphics|null)[]=[];

 private tileLocks:(Phaser.GameObjects.Image|null)[]=[];

 private cardPortraits:(Phaser.GameObjects.Image|null)[]=[];

 private cardSkins:string[]=[];

 private progress:Phaser.GameObjects.Text[]=[];

 private action:Phaser.GameObjects.Text;

 private format:Phaser.GameObjects.Text;

 private formatHint:Phaser.GameObjects.Text;

 private level:Phaser.GameObjects.Text;

 private levelButtons:Phaser.GameObjects.Text[];

 private hint:Phaser.GameObjects.Text;
 private hintRows:Phaser.GameObjects.Container[]=[];
 private noticeActive=false;
 private difficultyHint!:Phaser.GameObjects.Container;
 private formatControlHint!:Phaser.GameObjects.Container;

 private previous='';

 private bounds=new Map<string,{left:number;top:number;right:number;bottom:number}>();

 constructor(private scene:Phaser.Scene,private callbacks:{skin(s:number,d:number):void;card(i:number):void;panel(i:number):void;action():void;back():void;level(d:number):void;format():void;}){

  const scale=Math.min(VIEW.width/844,VIEW.height/390);

  this.root=scene.add.container(VIEW.cx-422*scale,VIEW.cy-195*scale).setScale(scale);

  this.chrome=this.graphics(this.root);

  this.text(this.root,422,27,t('charselect.choose_your_boxer'),31).setStroke('#071024',5);

  this.button(45,29,80,30,t('charselect.back'),callbacks.back);

  this.format=this.button(80,75,136,27,t('charselect.best_of_3'),callbacks.format,false,0x8b57c9);

  this.formatHint=this.text(this.root,80,97,'',11,'#dbe9fa').setWordWrapWidth(155);

  [290,422,554].forEach((x,i)=>{this.progress.push(this.text(this.root,x,76,'',11));if(i<2)this.text(this.root,x+66,76,'›',20,'#a8bad5');});

  for(let s=0;s<2;s++){

   const hit=scene.add.rectangle(s===0?111:733,237,214,224,0,0).setInteractive({useHandCursor:true});

   hit.on('pointerdown',()=>callbacks.panel(s));this.root.add(hit);this.panelHits.push(hit);

   const c=scene.add.container();this.root.add(c);this.content.push(c);

  }

  const cg=this.cardGeometry;
  rosterSlots().forEach((pos,i)=>{

   const card=scene.add.container(pos.x,pos.y);this.root.add(card);const frame=this.graphics(card);this.cards.push(frame);

   const id=rosterIds()[i] as CharId|null;cartoonPanel(frame,-cg.width/2,-cg.height/2,cg.width,cg.height,id?0x354665:0x161d2b,5);

   if(id){const key=artKey(scene,'portrait_'+id);this.cardSkins.push('default');

    const portrait=key?scene.add.image(0,cg.portraitY,key,rosterHeadFrame(scene,key,id,cg.portraitWidth/cg.portraitHeight)).setDisplaySize(cg.portraitWidth,cg.portraitHeight).setFlipX(id==='tyke'):null;this.cardPortraits.push(portrait);if(portrait)card.add(portrait);

   this.text(card,0,cg.labelY,id.toUpperCase(),cg.labelSize);

   const darkener=this.graphics(card).fillStyle(0x000000,.5).fillRect(-22,cg.darkY,44,cg.darkHeight).setVisible(false);this.darkeners.push(darkener);this.cursors.push(this.graphics(card));

   const tileLock=scene.add.image(0,cg.portraitY,artKey(scene,'locked_icon')??'__DEFAULT').setDisplaySize(16,18).setVisible(false);card.add(tileLock);this.tileLocks.push(tileLock);

   const hit=scene.add.rectangle(0,0,cg.hitWidth,cg.hitHeight,0,0).setInteractive({useHandCursor:true});hit.on('pointerdown',()=>callbacks.card(CHARACTER_IDS.indexOf(id)));card.add(hit);

   hit.on('pointerover',()=>card.setScale(1.06)).on('pointerout',()=>card.setScale(1)).on('pointerup',()=>card.setScale(1));

   }else{

    this.cursors.push(null);this.darkeners.push(null);this.tileLocks.push(null);this.cardPortraits.push(null);this.cardSkins.push('default');

    // Neutral black bust: intentionally reveals no future character artwork.

    const silhouette=this.graphics(card);silhouette.fillStyle(0x02050b).fillCircle(0,-8,6).fillEllipse(0,7,25,17).fillCircle(-14,4,4).fillCircle(14,4,4);

   }

   this.locks.push([0,1].map(side=>{const lock=scene.add.image(side===0?-cg.lockX:cg.lockX,cg.lockY,artKey(scene,'locked_icon')??'__DEFAULT').setDisplaySize(13,15).setVisible(false);card.add(lock);return lock;}));

  });

  this.action=this.button(422,366,238,36,t('common.confirm_boxer'),callbacks.action,true);

  this.level=this.button(744,75,105,27,'',()=>callbacks.level(1));

  this.levelButtons=[this.level,this.button(672,75,27,27,'‹',()=>callbacks.level(-1)),this.button(816,75,27,27,'›',()=>callbacks.level(1))];

  this.hint=this.text(this.root,422,334,'',11,'#bbcce3').setWordWrapWidth(408);
  this.hintRows=[controlHint(scene,258,334,0,'navigate',this.root,100),controlHint(scene,368,334,0,'skins',this.root,100),controlHint(scene,478,334,0,'confirm',this.root,100),controlHint(scene,588,334,0,'back',this.root,100)];
  const refreshHints=()=>{const controls=inputModality.kind!=='touch'&&!this.noticeActive;this.hint.setVisible(!controls);this.hintRows.forEach(row=>row.setVisible(controls));};
  scene.events.on('update',refreshHints);scene.events.once('shutdown',()=>scene.events.off('update',refreshHints));refreshHints();
  this.formatControlHint=controlHint(scene,80,97,0,'format',this.root);
  this.difficultyHint=controlHint(scene,744,97,0,'difficulty',this.root);

 }

 private graphics(parent:Phaser.GameObjects.Container):Phaser.GameObjects.Graphics{const g=this.scene.add.graphics();parent.add(g);return g;}

 private text(parent:Phaser.GameObjects.Container,x:number,y:number,value:string,size:number,color='#fff7e6'):Phaser.GameObjects.Text{

  const text=this.scene.add.text(x,y,value,{fontFamily:'Arial, sans-serif',fontSize:size+'px',fontStyle:'bold',color,stroke:'#0b1731',strokeThickness:1,resolution:PIXEL_RATIO}).setOrigin(.5);parent.add(text);return text;

 }

 private button(x:number,y:number,w:number,h:number,label:string,tap:()=>void,primary=false,tint=0x397dc2):Phaser.GameObjects.Text{

  const g=this.graphics(this.root),color=primary?0xf3bc35:tint;

  const hit=this.scene.add.rectangle(x,y,w,h,0,0).setInteractive({useHandCursor:true});this.root.add(hit);

  const text=this.text(this.root,x,y,label,primary?17:12).setStroke('#23415a',0).setShadow(0,2,'#23415a',1,true,true);

  bindButtonFeedback(hit,state=>{g.clear();cartoonButton(g,x-w/2,y-h/2+(state==='pressed'?2:0),w,h,color,8);if(state==='hover')g.fillStyle(0xffffff,.12).fillRoundedRect(x-w/2,y-h/2,w,h,8);text.y=y+(state==='pressed'?2:0);});

  hit.on('pointerup',()=>{if(hit.getData('buttonReleasedInside'))tap();});text.setData('chrome',g).setData('hit',hit);return text;

 }

 render(state:SelectionState):void{
  this.noticeActive=!!state.notice;

  const signature=JSON.stringify(state);if(signature===this.previous)return;this.previous=signature;

  const g=this.chrome;g.clear();g.lineStyle(5,0x167cff).lineBetween(260,51,422,51);g.lineStyle(5,0xef3545).lineBetween(422,51,586,51);

  this.progress.forEach((text,i)=>{const active=state.step===i,complete=i<state.step;g.lineStyle(active?3:1,active?0x5bd8ff:complete?0x6bcba5:0x526078).lineBetween(242+i*132,89,338+i*132,89);text.setText((complete?'✓':i+1)+'  '+state.steps[i]).setColor(active?'#77ddff':complete?'#9dddc3':'#9fb0ca');});

  this.format.setText(t('charselect.best_of',{n:state.bestOf}));this.setButtonVisible(this.format,!state.training);

  const editable=state.formatEditable!==false;

  (this.format.getData('hit') as Phaser.GameObjects.Rectangle).input!.enabled=!state.training&&editable;

  this.formatHint.setVisible(!state.training&&!editable).setText(t('charselect.host_sets_format'));
  this.formatControlHint.setVisible(!state.training&&editable);this.difficultyHint.setVisible(state.level!==null);

  // Dark central well gives future slots room without competing with the portraits.

  g.fillStyle(0x080d20,.78).fillRoundedRect(218,98,408,233,12);

  state.panels.forEach((p,s)=>{

   this.panelHits[s].input!.enabled=!p.dummy&&!p.survival;

   const key=JSON.stringify([!!p.dummy,!!p.survival,p.id,p.hidden,p.stats,p.uppercut,p.skin,p.selected,p.skinIndex,p.skinCount,p.status,p.label,p.skinName,p.available,p.focused,p.locked]);

   if(key!==this.panelKeys[s]){

    const identity=JSON.stringify([!!p.dummy,!!p.survival,p.id,p.hidden]);

    const changed=!!this.panelIdentities[s]&&identity!==this.panelIdentities[s];

    this.panelIdentities[s]=identity;this.panelKeys[s]=key;this.buildPanel(s,p);

    if(changed)this.animatePanel(s,!p.survival&&(!p.hidden||!!p.dummy));

   }

  });

  const rosterPanel=state.panels[state.rosterSide??0],rosterAvailable=rosterPanel?.rosterAvailable;

  this.cards.forEach((_frame,i)=>{const cursor=this.cursors[i];cursor?.clear();this.locks[i].forEach(lock=>lock.setVisible(false));const id=rosterIds()[i],real=!!id;const locked=!!id&&!!rosterAvailable&&!rosterAvailable.includes(id as CharId);this.darkeners[i]?.setVisible(locked);this.tileLocks[i]?.setVisible(locked);

   const skin=id===rosterPanel?.id&&!rosterPanel.hidden?rosterPanel.skin:'default',portrait=this.cardPortraits[i];if(id&&portrait&&skin!==this.cardSkins[i]){this.cardSkins[i]=skin;const key=skinTexture(this.scene,id,skin,'portrait_'+id);if(this.scene.textures.exists(key))portrait.setTexture(key,rosterHeadFrame(this.scene,key,id,this.cardGeometry.portraitWidth/this.cardGeometry.portraitHeight)).setDisplaySize(this.cardGeometry.portraitWidth,this.cardGeometry.portraitHeight);}



   state.panels.forEach((p,side)=>{if(!real||p.dummy||p.hidden||!p.cursor||p.id!==id)return;

    const color=side===0?0x65d9ff:0xff8593;cursor!.lineStyle(2,color).strokeRoundedRect(-this.cardGeometry.cursorWidth/2,-this.cardGeometry.cursorHeight/2,this.cardGeometry.cursorWidth,this.cardGeometry.cursorHeight,6);

    const x=side===0?-this.cardGeometry.lockX:this.cardGeometry.lockX,y=this.cardGeometry.lockY;cursor!.fillStyle(color).fillCircle(x,y,6);cursor!.lineStyle(1,0xffffff);

    if(!p.available){this.locks[i][side].setVisible(true);}else cursor!.beginPath().moveTo(x-3,y).lineTo(x-1,y+2).lineTo(x+3,y-2).strokePath();

   });

  });

  this.action.setText(state.action).setScale(Math.min(1,218/this.action.width));this.level.setText(state.level??t('common.versus'));this.levelButtons.forEach(b=>this.setButtonVisible(b,state.level!==null));this.hint.setText(state.hint);

 }

 private setButtonVisible(text:Phaser.GameObjects.Text,show:boolean):void{text.setVisible(show);(text.getData('chrome')as Phaser.GameObjects.Graphics).setVisible(show);const hit=text.getData('hit')as Phaser.GameObjects.Rectangle;hit.setVisible(show);hit.input!.enabled=show;}

 private createPanel(s:number):PanelView {

  const parent=this.content[s],x=s===0?6:640,centre=x+99;

  const panel=this.graphics(parent);panel.fillStyle(0x081022,.88).fillRoundedRect(x,103,198,122,7).fillStyle(s===0?0x173b65:0x4e233c,.7).fillRoundedRect(x,225,198,111,8);

  const container=()=>{const c=this.scene.add.container();parent.add(c);return c;};

  const normal=container(),portrait=this.scene.add.container();normal.add(portrait);

  const image=this.scene.add.image(centre,315,'__DEFAULT').setOrigin(.5,1).setVisible(false);portrait.add(image);

  const title=this.text(normal,centre,321,'',16),archetype=this.text(normal,centre,339,'',9,s===0?'#8ddaff':'#ff9eae').setAlign('center').setWordWrapWidth(186,true);

  const stats=this.scene.add.container();normal.add(stats);const bars=this.graphics(stats),fills=this.graphics(stats),labels:Phaser.GameObjects.Text[]=[],scores:Phaser.GameObjects.Text[]=[];

  for(let i=0;i<5;i++){const y=108+i*13;labels.push(this.text(stats,x+5,y+5,'',9).setOrigin(0,.5));bars.fillStyle(0x050a18).fillRoundedRect(x+89,y,102,10,3).lineStyle(1,0x8ba0c8).strokeRoundedRect(x+89,y,102,10,3);}

  // Percentage text is above the animated fill graphics, and never rerasterized by a tween.

  for(let i=0;i<5;i++)scores.push(this.text(stats,x+140,113+i*13,'',8,'#ffffff').setStroke('#050a18',2));

  const upper=this.text(normal,centre,180,'',9,'#ffdf83');
  const superDescription=this.text(normal,centre,202,'',9,'#d4dff0').setAlign('center').setWordWrapWidth(184,true);
  const tray=this.scene.add.container();normal.add(tray);

  this.graphics(tray).fillStyle(0x09182b,.95).fillRoundedRect(x,350,198,40,8);

  const skinName=this.text(tray,centre,362,'',10,'#fff1a8'),skinIndex=this.text(tray,centre,379,'',11),skinButtons:Phaser.GameObjects.Rectangle[]=[],skinDraws:(()=>void)[]=[];

  for(const d of [-1,1]){

   const bx=centre+d*74,g=this.graphics(tray),hit=this.scene.add.rectangle(bx,370,48,40,0,0).setInteractive({useHandCursor:true});tray.add(hit);skinButtons.push(hit);

   const arrow=this.text(tray,bx,368,d<0?'‹':'›',29).setStroke('#23415a',0);

   const draw=(state='idle')=>{const enabled=hit.input?.enabled!==false,pressed=enabled&&state==='pressed';g.clear();cartoonButton(g,bx-24,350+(pressed?2:0),48,40,enabled?0x397dc2:0x28374d,8);if(enabled&&state==='hover')g.fillStyle(0xffffff,.12).fillRoundedRect(bx-24,350,48,40,8);arrow.y=368+(pressed?2:0);arrow.setColor(enabled?'#ffffff':'#8896ac');};skinDraws.push(()=>draw());bindButtonFeedback(hit,draw);

   hit.on('pointerup',()=>{if(hit.input?.enabled&&hit.getData('buttonReleasedInside'))this.callbacks.skin(s,d);});

  }

  const hidden=container(),hiddenLabel=this.text(hidden,centre,251,'',17),hiddenStatus=this.text(hidden,centre,276,'',9,'#aebbd0');

  const survival=container(),survivalHeading=this.text(survival,centre,135,t('survival.heading'),16,'#9ee7b5').setWordWrapWidth(182,true),survivalBody=this.text(survival,centre,224,t('survival.selection_hint').replace(/\\n/g,'\n'),14,'#dbe9fa').setWordWrapWidth(178,true);

  survivalHeading.setScale(Math.min(1,42/survivalHeading.height));survivalBody.setScale(Math.min(1,126/survivalBody.height));

  return {normal,portrait,image,title,archetype,upper,superDescription,stats,fills,labels,scores,tray,skinName,skinIndex,skinButtons,skinDraws,hidden,hiddenLabel,hiddenStatus,survival,survivalHeading,survivalBody,textureKey:'',statsKey:'',values:[],motion:{progress:1},fillProgress:-1};

 }

 private buildPanel(s:number,p:PanelState):void {

  const ui=this.panels[s]??(this.panels[s]=this.createPanel(s)),x=s===0?6:640,centre=x+99;

  ui.normal.setVisible(!p.survival&&(!p.hidden||!!p.dummy));ui.hidden.setVisible(!p.survival&&p.hidden&&!p.dummy);ui.survival.setVisible(!!p.survival);

  ui.hiddenLabel.setText(p.label);ui.hiddenStatus.setText(p.status);

  const showTray=!!(p.available&&!p.dummy&&!p.survival&&!p.hidden);ui.tray.setVisible(showTray);

  ui.skinButtons.forEach((hit,i)=>{hit.input!.enabled=showTray&&!p.locked&&p.focused&&p.skinCount>1;ui.skinDraws[i]();});

  if(p.survival||(p.hidden&&!p.dummy))return;

  const textureKey=JSON.stringify([p.dummy,p.id,p.skin]);

  if(textureKey!==ui.textureKey){

   ui.textureKey=textureKey;const texture=p.dummy?artKey(this.scene,'portrait_training_dummy'):skinTexture(this.scene,p.id,p.skin,'portrait_'+p.id);

   ui.image.setVisible(!!texture&&this.scene.textures.exists(texture));

   if(texture&&this.scene.textures.exists(texture)){

    const image=ui.image.setTexture(texture).setPosition(centre,315),boundsKey=PALETTES[p.skin]?.boxer===p.id?'punchies:portrait_'+p.id:texture;let b=this.bounds.get(boundsKey);

    if(!b){const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(this.scene.textures.get(texture).getSourceImage()as HTMLImageElement,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;b={left:image.width,top:image.height,right:0,bottom:0};for(let y=0;y<canvas.height;y++)for(let px=0;px<canvas.width;px++)if(pixels[(y*canvas.width+px)*4+3]>=16){b.left=Math.min(b.left,px);b.top=Math.min(b.top,y);b.right=Math.max(b.right,px+1);b.bottom=Math.max(b.bottom,y+1);}if(b.right<=b.left)b={left:0,top:0,right:image.width,bottom:image.height};this.bounds.set(boundsKey,b);}

    const scale=Math.min((p.dummy?90:82)/(b.bottom-b.top),198/(b.right-b.left))*(p.dummy?1:portraitScaleFactor(p.id)),flip=(s===1)!==(!p.dummy&&p.id==='tyke');image.setScale(scale).setFlipX(flip);image.x-=(flip?-1:1)*((b.left+b.right)/2-image.width/2)*scale;image.y+=(image.height-b.bottom)*scale;

   }

  }

  ui.title.setText(p.dummy?t('common.dummy'):CHARACTER_INFO[p.id].name.toUpperCase()).setScale(1);ui.title.setScale(Math.min(1,186/ui.title.width));

  const description=p.dummy?t('training.practice_target'):t('char.'+p.id+'.nick')+' · '+p.label;

  if(ui.archetype.text!==description){ui.archetype.setText(description);for(let size=9;size>=1;size-=.5){ui.archetype.setFontSize(size);if(ui.archetype.getWrappedText().length<=2&&ui.archetype.width<=186&&ui.archetype.height<=20)break;}}

  ui.stats.setVisible(!p.dummy);const currentFill=ui.fillProgress<0?1:ui.fillProgress,statsKey=JSON.stringify(p.stats);

  if(statsKey!==ui.statsKey){ui.statsKey=statsKey;ui.values=p.stats.slice(0,5).map(([,value])=>Math.max(0,Math.min(1,value)));ui.fillProgress=-1;for(let i=0;i<5;i++){const row=p.stats[i];ui.labels[i].setText(row?.[0]??'');ui.scores[i].setText('').setVisible(false);}}

  const superMove=fighterSuper(p.id);
  ui.upper.setText(!p.dummy&&p.uppercut?t('charselect.super_cost',{name:superName(superMove.nameKey),stars:superMove.starCost}):'').setScale(1);
  ui.upper.setScale(Math.min(1,186/Math.max(1,ui.upper.width),16/Math.max(1,ui.upper.height)));
  ui.superDescription.setText(!p.dummy?superDescription(superMove.descriptionKey):'').setScale(1);
  ui.superDescription.setScale(Math.min(1,184/Math.max(1,ui.superDescription.width),30/Math.max(1,ui.superDescription.height)));

  ui.skinName.setText(p.skinName).setScale(1);ui.skinName.setScale(Math.min(1,88/ui.skinName.width));ui.skinIndex.setText(p.skinIndex+'/'+p.skinCount);

  if(ui.fillProgress<0)this.drawStatFills(s,currentFill);

 }

 private drawStatFills(s:number,progress:number):void {

  const ui=this.panels[s];if(ui.fillProgress===progress)return;ui.fillProgress=progress;const x=s===0?6:640,colors=[0xf451b8,0x5ce38b,0x37d4ee,0xffc449,0xb583f5];ui.fills.clear();

  ui.values.forEach((value,i)=>{const y=108+i*13,width=value*98*progress;if(width>0){ui.fills.fillStyle(colors[i]).fillRoundedRect(x+91,y+1,width,8,Math.min(3,width/2));ui.fills.fillStyle(0xffffff,.25).fillRoundedRect(x+92,y+2,Math.max(0,width-2),2,1);}});

 }

 private animatePanel(s:number,show:boolean):void {

  const ui=this.panels[s],cfg=tune.view.menu;this.scene.tweens.killTweensOf(ui.motion);ui.portrait.setPosition(0,0).setAlpha(1).setScale(1);

  if(!show||reducedMotion()){ui.motion.progress=1;this.drawStatFills(s,1);return;}

  ui.motion.progress=0;this.drawStatFills(s,0);const ease=Phaser.Tweens.Builders.GetEaseFunction(cfg.characterSlideEase),total=cfg.characterSlideMs+cfg.characterImpactMs,direction=s===0?-1:1;

  const update=()=>{const elapsed=ui.motion.progress*total,slide=Math.min(1,elapsed/cfg.characterSlideMs),impact=Math.max(0,(elapsed-cfg.characterSlideMs)/cfg.characterImpactMs);this.drawStatFills(s,ease(slide));ui.portrait.x=slide<1?direction*cfg.characterSlideDistance*(1-ease(slide)):-direction*Math.sin(impact*Math.PI*4)*(1-impact)*cfg.characterImpactPixels;ui.portrait.setAlpha(.25+.75*slide).setScale(1+(slide===1?.018*Math.sin(impact*Math.PI):0));};

  update();this.scene.tweens.add({targets:ui.motion,progress:1,duration:total,ease:'Linear',onUpdate:update,onComplete:()=>{ui.portrait.setPosition(0,0).setAlpha(1).setScale(1);this.drawStatFills(s,1);}});

 }

}
