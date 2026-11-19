import Phaser from 'phaser';
import type {Level} from '../game/types';
import {hasArt} from './art';
import {WIDTH,HEIGHT} from '../pixelRatio';
import {channelSurface} from './channels';
import {channelRuns} from './channelRuns';
import {TUNNEL_FRAME,planTunnelTexture} from './tunnelArt';
export interface YardGeo {cs:number;ox:number;oy:number;}

/** Countertop and recessed guide channels; all objects are owned by this level. */
export function drawYard(g:Phaser.GameObjects.Graphics,level:Level,geo:YardGeo):Phaser.GameObjects.GameObject[] {
  const {cs,ox,oy}=geo,scene=g.scene,w=level.cols*cs,h=level.rows*cs,objects:Phaser.GameObjects.GameObject[]=[];
  for(const key of ['dd_active_plan_up','dd_active_plan_down'])if(scene.textures.exists(key))scene.textures.remove(key);
  g.fillStyle(0xffe7cb);g.fillRoundedRect(ox-8,oy-8,w+16,h+16,15);
  g.fillStyle(0xfff0dc);g.fillRect(ox,oy,w,h);
  for(let r=0;r<level.rows;r++)for(let c=0;c<level.cols;c++){
    const noise=((r+3)*73856093^(c+7)*19349663^(level.rows*level.cols*83492791))>>>0;
    if(noise%7<2){g.fillStyle([0xfbedda,0xfff3e0,0xf9ebd8][noise%3]);g.fillRect(ox+c*cs,oy+r*cs,cs,cs);}
  }
  for(let r=0;r<=level.rows;r++){g.lineStyle(.85,0xdbb292,.5);g.lineBetween(ox,oy+r*cs,ox+w,oy+r*cs);g.lineStyle(.6,0xfffaf0,.8);g.lineBetween(ox,oy+r*cs+1,ox+w,oy+r*cs+1);}
  for(let c=0;c<=level.cols;c++){g.lineStyle(.85,0xdbb292,.5);g.lineBetween(ox+c*cs,oy,ox+c*cs,oy+h);g.lineStyle(.6,0xfffaf0,.8);g.lineBetween(ox+c*cs+1,oy,ox+c*cs+1,oy+h);}
  const cols=new Set(level.trains.filter(t=>t.axis==='v').map(t=>t.line));
  objects.push(channelSurface(scene,level,cs).setPosition(ox,oy));
  const prop=(frame:number,x:number,y:number,size=1)=>{
    const boxes=[[132,46,278,288],[602,35,338,295],[1159,44,232,283],[163,366,221,299],[549,423,441,205],[1135,429,268,191],[1182,693,176,300]],widths=[68,75,57,49,132,60,36];
    if(!hasArt(scene,'dd_props'))return;
    const box=boxes[frame],pw=widths[frame],ph=pw*box[3]/box[2],scale=cs/92*size;
    const image=scene.add.image(x,y+(28-ph/2)*scale,'dd_props',String(frame)).setDisplaySize(pw*scale,ph*scale).setDepth(5).setName('restaurant-prop-'+frame);objects.push(image);
  };
  for(const [cell,kind]of level.obstacles){
    const x=ox+(cell%level.cols+.5)*cs,y=oy+(Math.floor(cell/level.cols)+.5)*cs;
    const frame={concrete:1,kiosk:0,signal:3,tree:2,machine:3,buffer:0}[kind];
    if(kind==='concrete'){
      // Overhead projection: a broad square section with only its south lip visible.
      const size=cs*.84,left=x-size/2,top=y-size/2,lip=cs*.075;
      g.fillStyle(0xb79f97);g.fillRoundedRect(left,top+lip,size,size,cs*.09);
      g.fillStyle(0xc4d4bd);g.fillRoundedRect(left,top+lip*.45,size,size,cs*.09);
      g.fillStyle(0xffefd7);g.fillRoundedRect(left,top,size,size,cs*.09);
      g.lineStyle(1,0xc4a49b);g.strokeRoundedRect(left,top,size,size,cs*.09);
      g.fillStyle(0xe9cdb6);g.fillRoundedRect(left+lip,top+lip,size-2*lip,size-2*lip,cs*.07);
      g.fillStyle(0xfff7e8);g.fillRoundedRect(left+lip,top+lip*.55,size-2*lip,size-2*lip,cs*.07);
    }
    else if(hasArt(scene,'dd_props'))prop(frame,x,y);
    else{g.fillStyle(0x8e708e);g.fillRoundedRect(x-cs*.3,y-cs*.28,cs*.6,cs*.56,8);g.fillStyle(0xfff5dd);g.fillEllipse(x,y-cs*.18,cs*.6,cs*.24);}
  }
  // Flush caps end only at fixed blocked boundaries, never at exits.
  const stops=scene.add.graphics().setDepth(2);objects.push(stops);
  for(const run of channelRuns(level))for(const end of [run.start,run.end]){
    const length=run.axis==='h'?level.cols:level.rows;if(end===0||end===length)continue;
    const x=ox+(run.axis==='h'?end:run.line+.5)*cs,y=oy+(run.axis==='v'?end:run.line+.5)*cs;
    stops.fillStyle(0xfff4df);stops.lineStyle(1,0xc3a2a7,.7);
    const rw=cs*(run.axis==='h'?.12:.55),rh=cs*(run.axis==='h'?.55:.12);
    stops.fillRoundedRect(x-rw/2,y-rh/2,rw,rh,2);stops.strokeRoundedRect(x-rw/2,y-rh/2,rw,rh,2);
    stops.fillStyle(0x9c7a8e);stops.fillRect(x-rw*.26,y-rh*.26,rw*.52,rh*.52);
  }
  // Quiet restaurant details are outside the legal cell field and never block input.
  g.fillStyle(0xf8e2c7);g.fillRect(ox,oy-23,w,14);g.lineStyle(1,0xd4ac85,.7);g.lineBetween(ox,oy-9,ox+w,oy-9);
  for(let x=ox+12;x<ox+w;x+=12){g.lineStyle(.7,0xfff6e6,.8);g.lineBetween(x,oy-22,x,oy-11);}
  const gaps:[number,number][]=[];let edge=ox;
  for(const col of [...cols].sort((a,b)=>a-b)){const left=ox+(col+.5)*cs-cs*.55;if(left>edge)gaps.push([edge,left]);edge=ox+(col+.5)*cs+cs*.55;}if(edge<ox+w)gaps.push([edge,ox+w]);
  const stickGap=gaps.find(([a,b])=>b-a>132*cs/92*.72+8),dishGap=[...gaps].reverse().find(([a,b])=>b-a>60*cs/92*.65+8);
  const shared=stickGap&&dishGap&&stickGap===dishGap,space=shared?stickGap[1]-stickGap[0]:0;
  const bothFit=!shared||space>(132*.72+60*.65)*cs/92+14;
  if(stickGap)prop(4,shared&&bothFit?stickGap[0]+space*.3:(stickGap[0]+stickGap[1])/2,oy+h+34,.72);
  if(dishGap&&bothFit)prop(5,shared?dishGap[0]+space*.7:(dishGap[0]+dishGap[1])/2,oy+h+34,.65);
  const portal=(x:number,y:number,dir:'up'|'down'|'left'|'right')=>{
    const vertical=dir==='up'||dir==='down',sign=dir==='up'||dir==='left'?-1:1,s=cs/116*.94;
    const angle=vertical?sign*Math.PI/2:sign<0?Math.PI:0;
    const badge=scene.add.graphics().setPosition(vertical?x:Phaser.Math.Clamp(x+sign*cs*.33,7,WIDTH-7),vertical?y+sign*cs*.52:y-cs*.34).setRotation(angle).setDepth(92);
    // Recessed chevron stamped into the roof plastic.
    for(const [offset,colour] of [[1,0xfffaf0],[0,0xb4978d]]){
      badge.lineStyle(cs*.041,colour);badge.beginPath();badge.moveTo(-cs*.053,-cs*.085+offset);badge.lineTo(cs*.045,offset);badge.lineTo(-cs*.053,cs*.085+offset);badge.strokePath();
    }
    const glow=scene.add.graphics().setPosition(x,y).setRotation(angle).setDepth(91).setAlpha(0).setName('goal-'+dir+'-'+(vertical?Math.floor((x-ox)/cs):Math.floor((y-oy)/cs)));
    for(const [width,color,alpha] of [[.18,0xff7826,.28],[.09,0xffb15f,.85],[.035,0xfffae0,1]]){
      glow.lineStyle(cs*width,color,alpha);glow.beginPath();glow.moveTo(cs*.14,-cs*.39);glow.lineTo(0,-cs*.32);glow.lineTo(0,cs*.32);glow.lineTo(cs*.14,cs*.39);glow.strokePath();
    }
    glow.once('destroy',()=>scene.tweens.killTweensOf(glow));objects.push(badge,glow);
    if(vertical){
      // Plan view: north/south covers have parallel sides and no visible arch face.
      // Render at constant width through the full fade, never tapering into depth.
      const extent=sign<0?y:HEIGHT-y,halfWidth=cs*.51;
      const key=planTunnelTexture(scene,dir,cs,extent);
      // Both covers must occlude an entering carriage. A north roof behind the
      // train exposed its final pixels on top of the mouth before the clip plane.
      const roof=scene.add.image(x,sign<0?0:y,key).setOrigin(.5,0).setDisplaySize(halfWidth*2,extent).setDepth(90).setName('serving-tunnel-'+dir);
      roof.setData({projection:'orthographic-plan',direction:dir,width:halfWidth*2,sourceSet:'plastic-tunnel-atlas',entrance:sign<0});objects.push(roof);
      return;
    }
    const extent=sign<0?x:WIDTH-x;
    // Extend to the screen edge with a soft plastic fade; trains are separately occluded.
    const cover=scene.add.graphics().setDepth(85);objects.push(cover);
    for(let i=0;i<16;i++){
      const start=extent*i/16,len=extent/16+1;cover.fillStyle(0xfff1de,1-i/16);
      cover.fillRect(x+sign*start-(sign<0?len:0),y-cs*.57,len,cs*1.02);
    }
    if(hasArt(scene,'dd_tunnel_set')){
      const frame=dir==='right'?0:1,height=cs*1.05,width=height*TUNNEL_FRAME.width/TUNNEL_FRAME.height,split=width*TUNNEL_FRAME.split/TUNNEL_FRAME.width;
      const left=dir==='right'?x-split:x+split-width,top=y+cs*.3-height;
      for(const part of ['back','front'])objects.push(scene.add.image(left,top,'dd_tunnel_set',frame+'-'+part).setOrigin(0).setDisplaySize(width,height).setDepth(part==='back'?6:90).setName('serving-tunnel-'+dir+'-'+part).setData('sourceSet','plastic-tunnel-atlas'));
    }else if(hasArt(scene,'dd_tunnels')){
      const frame=dir==='left'?2:3;
      const ix=x+sign*110*s,iy=y-19*s;
      const back=scene.add.image(ix,iy,'dd_tunnels',String(frame)).setDisplaySize(240*s,138*s).setDepth(6);
      const front=scene.add.image(ix,iy,'dd_tunnels',String(frame)).setDisplaySize(240*s,138*s).setDepth(90);
      const mask=scene.make.graphics({x:0,y:0},false);mask.fillStyle(0xffffff);
      if(dir==='right')mask.fillRect(x,0,WIDTH-x,HEIGHT);else mask.fillRect(0,0,x,HEIGHT);
      const geometry=mask.createGeometryMask();front.setMask(geometry);objects.push(back,front,mask);front.once('destroy',()=>geometry.destroy());
    }else {cover.fillStyle(0xffefd6);cover.fillRoundedRect(x-cs*.2,y-cs*.5,cs*.4,cs,8);}
  };
  for(const run of channelRuns(level)){
    if(run.axis==='h'){if(run.start===0)portal(ox,oy+(run.line+.5)*cs,'left');if(run.end===level.cols)portal(ox+w,oy+(run.line+.5)*cs,'right');}
    else{if(run.start===0)portal(ox+(run.line+.5)*cs,oy,'up');if(run.end===level.rows)portal(ox+(run.line+.5)*cs,oy+h,'down');}
  }
  // Floor/grout/wall details are static. Render their vector commands once at
  // the existing 2x resolution, then draw one cropped sprite each frame.
  const floorKey='dd_floor_cached';if(scene.textures.exists(floorKey))scene.textures.remove(floorKey);
  const staging=document.createElement('canvas');staging.width=WIDTH*2;staging.height=HEIGHT*2;
  g.setScale(2);g.generateTexture(staging,staging.width,staging.height);g.setScale(1);g.clear();
  const left=Math.max(0,ox-8),top=Math.max(0,oy-23),fw=Math.min(WIDTH-left,w+16),fh=Math.min(HEIGHT-top,h+31);
  const floor=scene.textures.createCanvas(floorKey,fw*2,fh*2)!;
  floor.context.drawImage(staging,left*2,top*2,fw*2,fh*2,0,0,fw*2,fh*2);floor.refresh();
  objects.push(scene.add.image(left,top,floorKey).setOrigin(0).setDisplaySize(fw,fh).setDepth(0));
  return objects;
}
