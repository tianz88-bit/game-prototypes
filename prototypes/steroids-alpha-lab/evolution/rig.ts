import Phaser from 'phaser';
import raw from './rig.json';
import {checkCalibration,pose,depth,layerBrightness,rigAngle} from '../../steroids-alpha/src/render/shipRig';
import type {RigModule} from '../../steroids-alpha/src/render/shipRig';
import {PartFFD} from '../../steroids-alpha/src/render/partFFD';
import {advanceTilt,tiltBasis,projectTiltPoint} from '../../steroids-alpha/src/render/shipTilt';
import type {FFDControl} from '../../steroids-alpha/src/render/shipTilt';
import {clientTune} from '../../steroids-alpha/src/clientTune';
import type {Burst} from './model';
import {ThrusterVFX,exhaustSpeedBand} from '../../steroids-alpha/src/render/thrusters';
import {partKey} from '../../steroids-alpha/src/render/shipArt';
export const MODULES=raw.modules as RigModule[],CAL=checkCalibration(raw.calibration,MODULES);
export function queueMissileArt(scene:Phaser.Scene):void{for(const asset of new Set(MODULES.map(m=>m.asset)))if(!asset.startsWith('turret-'))scene.load.image('mc-'+asset,new URL(`ship-art/missile-cruiser-v1-${asset}.png`,location.href).href);}
export class MissileRig{
 container:Phaser.GameObjects.Container;private parts:{m:RigModule;image:Phaser.GameObjects.Image;ffd:PartFFD}[]=[];private tilt={pitch:0,bank:0};private lastSpeed=0;private lastHeading=0;private lastTime=0;private exhaust=new ThrusterVFX();private flames:Phaser.GameObjects.Graphics;
 constructor(private scene:Phaser.Scene){this.container=scene.add.container(0,0).setDepth(20);this.flames=scene.add.graphics().setDepth(19);for(const m of [...MODULES].sort((a,b)=>depth(a,CAL,MODULES)-depth(b,CAL,MODULES))){const key=m.asset.startsWith('turret-')?partKey(m.asset,'human-nomad-battlecruiser-v3'):'mc-'+m.asset;if(!scene.textures.exists(key))throw new Error('Missing review ship part: '+m.asset);const image=scene.add.image(0,0,key).setFlipX(!!m.mirror);this.container.add(image);this.parts.push({m,image,ffd:new PartFFD(scene,this.container,m,image)});}}
 update(x:number,y:number,scale:number,heading:number,now:number,speed:number,control?:FFDControl,turrets:Burst[]=[],motion=true):void{
  const dt=this.lastTime?Math.min(.05,(now-this.lastTime)/1000):1/60,yaw=this.lastTime?Math.atan2(Math.sin(heading-this.lastHeading),Math.cos(heading-this.lastHeading))*180/Math.PI/Math.max(.001,dt):0;
  advanceTilt(this.tilt,control,(speed-this.lastSpeed)/dt,yaw,false,dt,clientTune.render);const basis=tiltBasis(this.tilt.pitch,this.tilt.bank,rigAngle(heading)),angle=rigAngle(heading);
  this.container.setPosition(x,y).setScale(scale*.3);this.container.setVisible(true);
  for(const {m,image,ffd}of this.parts){const index=m.id.startsWith('head')?Number(m.id.slice(4)):-1;if(index>=turrets.length&&index>=0){image.setVisible(false);ffd.show(false);image.setVisible(false);continue;}
   const at=pose(m,angle,CAL,now,motion?1:0,control?.turn??0,0,MODULES),width=CAL.modules[m.id].width,shade=Math.round(255*layerBrightness(m,CAL,MODULES));image.setTint((shade<<16)|(shade<<8)|shade).setVisible(true);
   if(m.asset==='turret-head'&&turrets[index]){at.rotation=turrets[index].angle+Math.PI/2;const kick=Math.max(0,1-(now/1000-turrets[index].firedAt)/.09);at.x-=Math.cos(turrets[index].angle)*kick*8;at.y-=Math.sin(turrets[index].angle)*kick*8;}
   const tilted=!!control&&(Math.abs(this.tilt.pitch)>.02||Math.abs(this.tilt.bank)>.02),webgl=this.scene.game.renderer.type===Phaser.WEBGL;
   if(tilted&&webgl&&clientTune.render.ffdEnabled){try{if(ffd.ensure()){ffd.draw(at,width,1,1,CAL.hoverLift,basis);ffd.show(true);continue;}}catch{}}
   ffd.show(false);const p=projectTiltPoint(at.x,at.y,0,basis);image.setPosition(p.x,p.y-CAL.hoverLift).setRotation(at.rotation).setDisplaySize(width,width*image.height/image.width);
  }
  const origins=[0,1].map(i=>{const part=this.parts.find(p=>p.m.id==='engine'+i)!;const at=pose(part.m,angle,CAL,now,motion?1:0,0,0,MODULES),len=CAL.modules[part.m.id].width*part.image.height/part.image.width;return{x:(at.x-Math.sin(at.rotation)*len*.4)*.3,y:(at.y+Math.cos(at.rotation)*len*.4-CAL.hoverLift)*.3,width:12,angle,particleScale:.3};}) as [import('../../steroids-alpha/src/render/thrusters').NozzleOrigin,import('../../steroids-alpha/src/render/thrusters').NozzleOrigin];
  this.exhaust.update(dt,{throttle:(control?.thrust??0)>0,left:(control?.turn??0)<0,right:(control?.turn??0)>0,off:!motion,speedBand:exhaustSpeedBand(speed,170,225)},origins);this.flames.clear();for(const p of this.exhaust.particles){const a=1-p.age/p.life,c=Math.cos(p.angle),s=Math.sin(p.angle),pts=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([u,v])=>({x:x+(p.x+c*u*p.w-s*v*p.h)*scale,y:y+(p.y+s*u*p.w+c*v*p.h)*scale}));this.flames.fillStyle(p.colour,a*a).fillPoints(pts,true);}
  this.lastSpeed=speed;this.lastHeading=heading;this.lastTime=now;
 }
 hide():void{this.container.setVisible(false);this.flames.clear();}
 destroy():void{this.parts.forEach(p=>p.ffd.destroy());this.container.destroy(true);this.flames.destroy();this.parts=[];}
 snapshot(){return{parts:this.parts.length,tilt:{...this.tilt},bounds:this.container.getBounds()};}
}
