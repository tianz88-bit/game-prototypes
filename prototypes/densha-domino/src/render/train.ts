import {LIVERIES} from '../game/levels';
import Phaser from 'phaser';
import type {Dir, TrainDef} from '../game/types';
import {tune} from '../tune';
import {WIDTH, HEIGHT} from '../pixelRatio';
import {bodyCell,hasArt,BODY_BOXES} from './art';
import {eyeFrame} from './expressions';
import {carriagePose,shearTransform,type Reaction} from './carriageMotion';
import {attachSocketLight,updateSocketLight} from './signalPipeline';

export const SIDE_BODY_LIFT=24;

interface Car {holder:Phaser.GameObjects.Container; shear:Phaser.GameObjects.Container;turn:Phaser.GameObjects.Container;food:Phaser.GameObjects.Container; lamps:Phaser.GameObjects.Graphics; index:number; cabs:{end:Dir;head:boolean;eye:Phaser.GameObjects.Image;signal:Phaser.GameObjects.Image|null}[]; pose?:object;}
/** Complete individual cars, permanent head/tail identities, independently delayed presentation. */
export class TrainView {
  readonly container:Phaser.GameObjects.Container;
  private cars:Car[]=[];
  private coupling:Phaser.GameObjects.Graphics;
  private travel:Dir|null=null;
  private ready=false;
  private awake=false;
  private gaze:Dir;
  private reaction:{kind:Reaction;dir:Dir;start:number;duration:number}|null=null;
  private history:{kind:Reaction;dir:Dir;start:number;duration:number}[]=[];
  private foodHistory:{kind:Reaction;dir:Dir;start:number;duration:number}[]=[];
  private alive=true;
  private clock=0;
  private dirty=true;
  constructor(private scene:Phaser.Scene,readonly def:TrainDef,private cs:number){
    this.container=scene.add.container(0,0);this.gaze=def.headDir;

    this.coupling=scene.add.graphics();this.container.add(this.coupling);
    const vertical=def.axis==='v',palette=LIVERIES.indexOf(def.color),key='dd_liveries_'+Math.floor(palette/5);
    for(let i=0;i<def.len;i++){
      const holder=scene.add.container(0,0),cell=bodyCell(vertical,def.headDir,def.len,i);
      const contact=scene.add.graphics();contact.fillStyle(0x75505a,.14);if(vertical)contact.fillRoundedRect(-30,-61,62,118,22);else contact.fillEllipse(2,31,112,17);holder.add(contact);
      if(hasArt(scene,'dd_outline')){const box=BODY_BOXES[cell];holder.add(scene.add.image(0,vertical?-8:4,'dd_outline',String(cell)).setDisplaySize((vertical?64:116)*(box[2]+16)/box[2],(vertical?124:64)*(box[3]+16)/box[3]));}
      if(hasArt(scene,key))holder.add(scene.add.image(0,vertical?-8:4,key,palette+'-'+cell).setDisplaySize(vertical?64:116,vertical?124:64));
      else holder.add(this.fallback(i));
      const headIndex = def.headDir < 0 ? 0 : def.len - 1;
      const deckOffset = i === headIndex ? -def.headDir * (vertical ? 16 : 13) : 0;
      const px = vertical ? 0 : deckOffset;
      const py = vertical ? -10 + deckOffset : -10;
      const food=scene.add.container(px,py+11);
      if(hasArt(scene,'dd_food')){
        holder.add(scene.add.image(px,py+3,'dd_food','0').setDisplaySize(73.5,52.5));
        const f=1+def.id%6,fw=(f===4?32:f===5?34:38)*1.5,fh=(f===4?34:f===5?36:28)*1.5;
        food.add(scene.add.image(0,-fh/2,'dd_food',String(f)).setDisplaySize(fw,fh));
      }else{
        const p=scene.add.graphics();p.fillStyle(0xe4d5bc);p.fillEllipse(px,py+7.5,66,42);p.fillStyle(0xfffaf0);p.fillEllipse(px,py+2,63,37.5);holder.add(p);
        const f=scene.add.graphics();f.fillStyle(0xfff9e9);f.fillRoundedRect(-19,-24,38,23,9);f.fillStyle([0xff9160,0xffd54e,0xf46f96][this.def.id%3]);f.fillRoundedRect(-21,-31,42,17,7);f.lineStyle(2,0xffedd5);for(let n=-13;n<16;n+=8)f.lineBetween(n,-30,n+6,-16);f.setRotation(-.3).setScale(1.08);food.add(f);
      }
      const shadow=scene.add.graphics();shadow.fillStyle(0x8b6952,.14);shadow.fillEllipse(px,py+6,43.5,16.5);holder.add(shadow);holder.add(food);
      const lamps=scene.add.graphics();holder.add(lamps);this.container.add(holder);
      const cabs:Car['cabs']=[];
      for(const end of [-1,1] as Dir[])if(end===def.headDir && (end<0?i===0:i===def.len-1)){
        const head=end===def.headDir,ex=vertical?0:end*(head?40:43),ey=vertical?(end<0?(head?-44:-57):25):(head?5:7),scale=vertical?(head?.95:.6):(head?.85:.63);
        let signal:Phaser.GameObjects.Image|null=null;
        if(head&&hasArt(scene,'dd_signals')){signal=scene.add.image(0,vertical?-8:4,'dd_signals',String(cell)).setDisplaySize(vertical?64:116,vertical?124:64).setVisible(false);const box=BODY_BOXES[cell],half=Math.floor(box[vertical?3:2]/2);if(vertical)signal.setCrop(0,end<0?0:half,box[2],end<0?half:box[3]-half);else signal.setCrop(end<0?0:half,0,end<0?half:box[2]-half,box[3]);holder.add(signal);}
        if(signal)holder.add(attachSocketLight(signal,vertical,end));
        const eyeY = vertical && def.len === 1 ? -8 + end * 42 : ey;
        const eye=scene.add.image(ex,eyeY,'dd_eyes',eyeFrame('sleep',vertical,0,def.headDir)).setDisplaySize(40*scale,32*scale);holder.add(eye);cabs.push({end,head,eye,signal});
      }
      const base=vertical?54:36,content=scene.add.container(0,-base,[...holder.list]),turn=scene.add.container(0,0,[content]),shear=scene.add.container(0,base,[turn]);holder.add(shear);
      this.cars.push({holder,shear,turn,food,lamps,index:i,cabs});
    }
    this.update();
    this.dirty=true; // Re-evaluate visibility after the scene places this root.
  }
  private fallback(i:number):Phaser.GameObjects.Graphics {
    const g=this.scene.add.graphics(),v=this.def.axis==='v',w=v?64:116,h=v?124:64,x=-w/2,y=v?-70:-28;
    g.fillStyle(0x5b3e5e);g.fillRoundedRect(x,y+8,w,h,16);g.fillStyle(this.def.color);g.fillRoundedRect(x,y,w,h-6,18);g.lineStyle(2,0xffe7d8);g.strokeRoundedRect(x+3,y+3,w-6,h-12,15);
    for(const end of [-1,1] as Dir[])if(end===this.def.headDir && (end<0?i===0:i===this.def.len-1)){
      const head=end===this.def.headDir,ex=v?0:end*(head?40:43),ey=v?(end<0?(head?-44:-57):25):(head?5:7);
      if(head){g.fillStyle(0x22b4ac);if(v)g.fillRoundedRect(-30,ey-end*23-5,60,12,4);else g.fillRoundedRect(ex-end*17-6,-26,12,55,4);}
      g.fillStyle(0x543451);g.fillRoundedRect(ex-(head?14:11),ey-13,head?28:22,24,8);
    }return g;
  }
  centre(pos:number,ox:number,oy:number):{x:number;y:number}{const along=(pos+this.def.len/2)*this.cs,across=(this.def.line+.5)*this.cs;return this.def.axis==='h'?{x:ox+along,y:oy+across}:{x:ox+across,y:oy+along};}
  setReady(ready:boolean):void {this.ready=ready;}
  setAwake(awake:boolean,dir:Dir=this.def.headDir):void {this.dirty=true;this.awake=awake;this.gaze=dir;}
  setTravel(dir:Dir|null):void {this.dirty=true;this.travel=dir;if(dir!==null){this.gaze=dir;this.react('startup',dir,tune.feel.spookMs+tune.feel.spookReleaseMs);}}
  react(kind:Reaction,dir:Dir,duration:number):void {this.dirty=true;this.gaze=dir;if(kind!=='blocked')this.awake=true;this.reaction={kind,dir,start:this.clock,duration};this.history.push(this.reaction);if(kind==='brake'||kind==='startup')this.foodHistory.push(this.reaction);}
  brake(dir:Dir=this.gaze):void {this.travel=null;this.react('brake',dir,tune.feel.brakeMs*2);}
  /** Compatibility for externally driven anticipation; no whole-train tilt or hopping. */
  pose(k:number,_stretch:number,_squash:number,_skew:number,_tilt:number):void {if(k>0)this.react('ack',this.gaze,tune.feel.spookMs);}
  rest():void {this.dirty=true;this.travel=null;this.awake=false;this.reaction=null;this.history=[];}
  private band(g:Phaser.GameObjects.Graphics,end:Dir,head:boolean,lit:boolean):void {
    const v=this.def.axis==='v';g.lineStyle(lit?3.5:2.8,lit?0xff8327:0xf5e4c4,1);g.beginPath();
    if(v){for(let i=0;i<=12;i++){const t=i/6-1,x=t*(head?23:21),y=end<0?(head?-52-17*(1-t*t):-60-6*(1-t*t)):38+10*(1-t*t);if(i===0)g.moveTo(x,y);else g.lineTo(x,y);}}
    else {const y=head?24:25;g.moveTo(end*55,head?9:16);g.lineTo(end*51,y-2);g.lineTo(end*40,y);g.lineTo(end*30,y);}
    g.strokePath();
  }
  update(delta=0):void {
    if(!this.alive)return;this.clock+=delta;const now=this.clock,v=this.def.axis==='v',factor=this.cs/116*.94,r=this.reaction;

    if(!this.dirty&&!this.history.length&&!this.foodHistory.length&&this.travel===null){
      // Parked geometry, expression frames, couplings and food are unchanged.
      // Animate only the live signal bands; do not allocate/rebuild every car.
      for(const car of this.cars){if(!hasArt(this.scene,'dd_signals'))car.lamps.clear();for(const cab of car.cabs){const active=cab.head&&this.ready;if(cab.signal)updateSocketLight(cab.signal,active,false,now);else if(cab.head)this.band(car.lamps,cab.end,cab.head,active&&Math.cos(now/tune.feel.lightFlashMs*Math.PI*2)>0);}}
      return;
    }
    const leading=(r?.dir??this.travel??this.def.headDir)>0?this.def.len-1:0;
    const scales=this.cars.map(c=>{
      let selected:typeof this.reaction=null,local=0,scheduled=-Infinity;
      for(const event of this.history){const lead=event.dir>0?this.def.len-1:0,start=event.start+Math.abs(c.index-lead)*tune.feel.carriageDelayMs,t=now-start;if(t>=0&&t<event.duration&&start>=scheduled){selected=event;local=t;scheduled=start;}}
      if(!selected)return {along:1,cross:1,expression:this.travel!==null?'focus':this.awake?'wait':'sleep',eyePhase:.5,spring:0,lean:0,skew:0,gaze:this.travel??this.gaze};
      const pose=carriagePose(selected.kind,local/selected.duration);
      return {...pose,along:pose.scale,gaze:selected.dir};
    });
    const centers=Array<number>(this.cars.length);centers[leading]=(leading-(this.cars.length-1)/2)*this.cs;
    const step=leading===0?1:-1;for(let i=leading+step;i>=0&&i<this.cars.length;i+=step)centers[i]=centers[i-step]+step*this.cs/2*(scales[i].along+scales[i-step].along);
    this.coupling.clear();this.coupling.lineStyle(5*factor,0x604359,1);
    for(let i=1;i<centers.length;i++)this.coupling.lineBetween(v?0:centers[i-1],v?centers[i-1]:(12-SIDE_BODY_LIFT)*factor,v?0:centers[i],v?centers[i]:(12-SIDE_BODY_LIFT)*factor);
    this.cars.forEach((c,i)=>{
      const a=scales[i],sx=factor*(v?a.cross:a.along),sy=factor*(v?a.along:a.cross),base=v?54:36;
      c.holder.setPosition(v?0:centers[i],(v?centers[i]:-SIDE_BODY_LIFT*factor)+base*(factor-sy)).setScale(sx,sy);
      const shear=shearTransform(a.skew);c.shear.setRotation(shear.u).setScale(shear.s1,shear.s2);c.turn.setRotation(-shear.v);
      // A separate seated food envelope outlasts the shorter body reaction.
      let spring=0;
      for(const event of this.foodHistory){
        if(event.kind!=='brake'&&event.kind!=='startup')continue;
        const lead=event.dir>0?this.def.len-1:0,t=(now-event.start-Math.abs(i-lead)*tune.feel.carriageDelayMs)/tune.feel.foodSpringMs;
        if(t>=0&&t<1)spring=-tune.feel.sushiSpring*Math.sin(t*Math.PI*3)*Math.pow(1-t,tune.feel.foodDamping);
      }
      c.food.setScale(1-spring*.45,1+spring).setAngle(0);
      c.holder.setVisible(this.container.x+(v?0:centers[i])+this.cs>0&&this.container.x+(v?0:centers[i])-this.cs<WIDTH&&this.container.y+(v?centers[i]:0)+this.cs>0&&this.container.y+(v?centers[i]:0)-this.cs<HEIGHT);
      c.lamps.clear();c.pose={index:i,expression:a.expression,phase:a.eyePhase,scale:a.along,foodScale:1+spring,gaze:a.gaze};
      for(const cab of c.cabs){
        const active=this.travel!==null?cab.end===this.travel:cab.head&&this.ready;
        if(cab.signal)updateSocketLight(cab.signal,active,this.travel!==null,now);else if(cab.head)this.band(c.lamps,cab.end,cab.head,active&&(this.travel!==null||Math.cos(now/tune.feel.lightFlashMs*Math.PI*2)>0));
        cab.eye.setFrame(eyeFrame(a.expression,v,a.eyePhase,a.gaze));
      }
    });
    this.history=this.history.filter(event=>now-event.start<event.duration+(this.def.len-1)*tune.feel.carriageDelayMs);if(!this.history.length)this.reaction=null;
    this.foodHistory=this.foodHistory.filter(event=>now-event.start<tune.feel.foodSpringMs+(this.def.len-1)*tune.feel.carriageDelayMs);
    this.dirty=false;
  }
  inspect():object {return {headDir:this.def.headDir,travel:this.travel,light:this.travel!==null?(this.travel===this.def.headDir?'solid':'off'):this.ready?'flashing':'off',carriages:this.cars.length,reaction:this.reaction?.kind??null,carriagePoses:this.cars.map(c=>c.pose),socketArt:hasArt(this.scene,'dd_signals')};}
  /** Test-only caller: full, unclipped world bounds, including plate/food/lights. */
  geometry():object {return {id:this.def.id,axis:this.def.axis,travel:this.travel,x:this.container.x,y:this.container.y,cars:this.cars.map(c=>{const b=c.holder.getBounds();return {index:c.index,visible:c.holder.visible,bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};})};}
  destroy():void {this.alive=false;this.scene.tweens.killTweensOf(this.container);this.container.destroy();}
}
