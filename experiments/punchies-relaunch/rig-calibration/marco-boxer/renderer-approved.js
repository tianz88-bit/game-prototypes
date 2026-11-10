import {tune} from './geometry-tune.js';
import {WalkMotion,blendedFootStep,bootCollar} from './legMotion.js';
import {armPose} from './armPose.js';
import {punchFist,punchExtension} from './fistPath.js';
import {PlantedFeet} from './plantedFeet.js';
const P=Phaser,$=s=>document.querySelector(s),r=tune.view.puppet,v=tune.view;
const settings={turn:false,walk:false,sequence:false,guard:false,bones:false,legs:false,pause:false,angle:Math.PI/2,lift:2,view:'auto',parts:'head',headMode:'split',breathMode:'slow',zoom:2,
 sideX:{abdomen:0,torso:0,head:0,hair:0},leftX:{abdomen:0,torso:0,head:0,hair:0},offsets:{down:{footAbdomen:4,abdomenTorso:4,torsoHead:5.2,headHair:4.4},side:{footAbdomen:7,abdomenTorso:7,torsoHead:9.1,headHair:7.7},left:{footAbdomen:7,abdomenTorso:7,torsoHead:9.1,headHair:7.7},up:{footAbdomen:10,abdomenTorso:10,torsoHead:13,headHair:11}}};
const offsetFields=[['footAbdomen','Foot → abdomen'],['abdomenTorso','Abdomen → torso'],['torsoHead','Torso → head'],['headHair','Head → hair']];
let draftTimer,saveQueue=Promise.resolve();
function saveDraft(){
 clearTimeout(draftTimer);
 const payload=JSON.stringify({version:1,offsets:settings.offsets,sideX:settings.sideX,leftX:settings.leftX,zoom:settings.zoom,headMode:settings.headMode,breathMode:settings.breathMode});
 $('#saveStatus').textContent='Saving local draft…';
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{
  try{const response=await fetch('/api/tuning',{method:'POST',headers:{'Content-Type':'application/json'},body:payload});if(!response.ok)throw Error('Save failed');$('#saveStatus').textContent='Saved to local draft file';}
  catch{$('#saveStatus').textContent='Save failed — keep this tab open and retry';}
 });
 return saveQueue;
}
function scheduleDraft(){clearTimeout(draftTimer);$('#saveStatus').textContent='Unsaved changes…';draftTimer=setTimeout(saveDraft,600);}
async function loadDraft(){
 try{const response=await fetch('/api/tuning',{cache:'no-store'});if(!response.ok)throw Error('No draft');const draft=await response.json();
  if(draft.version!==1)throw Error('Unknown draft');
  for(const direction of ['down','side','up'])for(const [key]of offsetFields){const value=draft.offsets?.[direction]?.[key];if(typeof value==='number'&&Number.isFinite(value)&&value>=-10&&value<=80)settings.offsets[direction][key]=value;}
  if(['split','merged'].includes(draft.headMode))settings.headMode=draft.headMode;
  if(Number.isFinite(draft.zoom)&&draft.zoom>=1&&draft.zoom<=3)settings.zoom=draft.zoom;
  if(['off','slow','fast'].includes(draft.breathMode))settings.breathMode=draft.breathMode;
  for(const key of ['abdomen','torso','head','hair'])if(Number.isFinite(draft.sideX?.[key])&&Math.abs(draft.sideX[key])<=40)settings.sideX[key]=draft.sideX[key];
  for(const [key]of offsetFields){const value=draft.offsets?.left?.[key];settings.offsets.left[key]=Number.isFinite(value)&&value>=-10&&value<=80?value:settings.offsets.side[key];}
  for(const key of ['abdomen','torso','head','hair'])settings.leftX[key]=Number.isFinite(draft.leftX?.[key])&&Math.abs(draft.leftX[key])<=40?draft.leftX[key]:-settings.sideX[key];
  $('#saveStatus').textContent='Loaded local draft file';
 }catch{$('#saveStatus').textContent='Using defaults — save to create a local draft';}
}
function offsetAt(fx,fy){
 const direction=fy>=0?'down':'up';
 const lateral=fx<0?'left':'side';
 const t=Math.abs(Math.asin(Math.max(-1,Math.min(1,fy))))/(Math.PI/2),weight=t*t*(3-2*t);
 return Object.fromEntries(offsetFields.map(([key])=>[key,settings.offsets[lateral][key]+(settings.offsets[direction][key]-settings.offsets[lateral][key])*weight]));
}
const TAU=Math.PI*2;
const wrap=a=>((a+Math.PI)%TAU+TAU)%TAU-Math.PI;
let lab;
function joint(s,w,minSeg,outward){const dx=w.x-s.x,dy=w.y-s.y,d=Math.hypot(dx,dy)||.001,seg=Math.max(minSeg,d*.51),h=Math.sqrt(Math.max(0,seg*seg-d*d/4));let nx=-dy/d,ny=dx/d;if(nx*outward.x+ny*outward.y<0){nx=-nx;ny=-ny;}return{x:(s.x+w.x)/2+nx*h,y:(s.y+w.y)/2+ny*h};}
function limb(g,a,b,c,width,skin){for(const[w,color]of[[width+3,0x101b32],[width,skin]]){g.lineStyle(w,color,1);g.lineBetween(a.x,a.y,b.x,b.y);g.lineBetween(b.x,b.y,c.x,c.y);g.fillStyle(color);for(const p of[a,b,c])g.fillCircle(p.x,p.y,w/2);}}
// Material comes from Marco's portrait: bare skin on arms and legs.
// Other fighters can supply fabric/skin colours through the same material slot.
const marcoMaterials={leg:0xf0a060,arm:0xf0a060};
function straightLeg(g,thigh,ankle,thighRadius,ankleRadius,colour){
 const dx=ankle.x-thigh.x,dy=ankle.y-thigh.y,d=Math.hypot(dx,dy);
 // Convex hull of unequal circles: straight tangent edges, no knee or seam.
 for(const [extra,tint]of [[1.5,0x101b32],[0,colour]]){
  const ra=thighRadius+extra,rb=ankleRadius+extra;g.fillStyle(tint);
  if(d>Math.abs(ra-rb)+.001){
   const ux=dx/d,uy=dy/d,q=(ra-rb)/d,h=Math.sqrt(1-q*q);
   const nx=ux*q-uy*h,ny=uy*q+ux*h,mx=ux*q+uy*h,my=uy*q-ux*h;
   g.beginPath();g.moveTo(thigh.x+nx*ra,thigh.y+ny*ra);g.lineTo(ankle.x+nx*rb,ankle.y+ny*rb);g.lineTo(ankle.x+mx*rb,ankle.y+my*rb);g.lineTo(thigh.x+mx*ra,thigh.y+my*ra);g.closePath();g.fillPath();
  }
  g.fillCircle(thigh.x,thigh.y,ra);g.fillCircle(ankle.x,ankle.y,rb);
 }
}
function ovalArm(sprites,shoulder,elbow,wrist,width){
 const points=[shoulder,elbow,wrist];
 for(let i=0;i<2;i++){
  const a=points[i],b=points[i+1],length=Math.hypot(b.x-a.x,b.y-a.y)+width*.45;
  sprites[i].setPosition((a.x+b.x)/2,(a.y+b.y)/2).setRotation(Math.atan2(b.y-a.y,b.x-a.x)).setDisplaySize(length+3,width+3).setVisible(!settings.legs);
 }
}
// One front-facing source rotates continuously; no directional frame swaps.
function artView(){return{name:'down',base:Math.PI/2,flip:false};}
function fistDepth(fx,fy,hand){
 // Four fixed sectors; change order only on crossing 45/135/225/315 degrees.
 const sector=(Math.floor((Math.atan2(fy,fx)+Math.PI/4)/(Math.PI/2))+4)%4;
 return [[6,6.4],[8.2,8.2],[6.4,6],[6,6]][sector][hand];
}

class PuppetStudy{
 constructor(scene,candidate){this.scene=scene;this.candidate=candidate;this.lines=[];this.shadow=scene.add.ellipse(0,0,60,38,0x081320,.3).setDepth(1);this.legs=scene.add.graphics().setDepth(candidate?3:2);this.arms=scene.add.graphics().setDepth(4);const img=(key,d)=>scene.add.image(0,0,key).setDepth(d);this.boots=[img('foot',candidate?2:3),img('foot',candidate?2:3).setFlipY(true)];this.abdomen=img('abdomen',3.5).setFrame('__BASE_TRIM').setVisible(candidate);this.torso=img('torsoOld',5);this.hands=[img('hand',6).setFlipX(true),img('hand',6)];this.head=img('headOld',7);this.hair=img('headOld',7.1).setVisible(false);}
 draw(origin,f,now,walk,stride,velocity,punch){
  const k=1.65*settings.zoom,fx=f.fx,fy=f.fy,lx=fy,ly=-fx,th=Math.atan2(fy,fx),view=artView(th);
  // Every layer gap has independent up/down endpoints in actual 1x scene pixels.
  const gaps=offsetAt(fx,fy),height=settings.lift;
  this.gaps=gaps;
  const ground=(u,vv,dy=0)=>({x:origin.x+f.x+fx*u+lx*vv,y:origin.y+f.y+fy*u+ly*vv+dy*settings.zoom});
  const abdomenRise=gaps.footAbdomen*settings.zoom,torsoRise=(gaps.footAbdomen+gaps.abdomenTorso)*settings.zoom;
  // Horizontal corrections are relative to the preceding layer. Cosine mirrors
  // the side preset for left-facing and fades it to zero at up/down.
  const sx=fx<0?settings.leftX:settings.sideX,sideFactor=this.candidate?Math.abs(fx)*settings.zoom:0;
  const abdomenShift=sx.abdomen*sideFactor,torsoShift=(sx.abdomen+sx.torso)*sideFactor;
  const point=(u,vv,dy=0)=>({x:origin.x+f.x+fx*u+lx*vv+torsoShift,y:origin.y+f.y+fy*u+ly*vv+(this.candidate?-torsoRise+(dy-v.bodyOffsetY)*settings.zoom:dy*height*settings.zoom)});
  this.lines.length=0;
  this.shadow.setPosition(origin.x+f.x,origin.y+f.y+(this.candidate?0:v.shadowOffsetY*height*settings.zoom)).setDisplaySize(57*k,34*k);
  const speed=Math.hypot(velocity.x,velocity.y),mu=speed>.001?velocity.x*fx+velocity.y*fy:0,mv=speed>.001?velocity.x*lx+velocity.y*ly:0;
  if(this.candidate&&!this.plantedFeet)this.plantedFeet=new PlantedFeet();
  const planted=this.candidate?this.plantedFeet.update([0,1].map(i=>{
   const side=i===0?1:-1,u=(i===0?r.leadBootForward:r.rearBootForward)*k,p=ground(u,(r.bootSpread+1.25)*k*side);
   return {x:p.x,y:p.y,yaw:th-side*20*Math.PI/180};
  }),now,k,th,{x:f.moveX||0,y:f.moveY||0}):null;
  const gaitLift=planted?Math.max(planted[0].lift,planted[1].lift):0;
  const breathing=this.candidate&&settings.breathMode!=='off'?(1-Math.cos(now*TAU/(settings.breathMode==='fast'?1100:2800)))/2:0;
  const bodyBob=this.candidate?-(breathing*.5+gaitLift*.3)*k:0;
  const legKey=[f.x,f.y,fx,fy,walk,stride,mu,mv,k,abdomenRise,abdomenShift,planted?.map(p=>[p.x,p.y,p.yaw,p.lift].join(',')).join(';')].join(','),redrawLegs=legKey!==this.legKey;
  if(redrawLegs){this.legKey=legKey;this.legs.clear();}
  const armKey=[f.x,f.y,fx,fy,k,torsoRise,torsoShift,settings.guard,punch?.frame??-1,punch?.type??''].join(','),redrawArms=armKey!==this.armKey;
  if(redrawArms){this.armKey=armKey;this.arms.clear();}
  for(let i=0;i<2;i++){
   const side=i===0?1:-1,ph=walk+(i===0?0:Math.PI),step=blendedFootStep(ph,mu,mv,stride),u0=(i===0?r.leadBootForward:r.rearBootForward)*k;
   const poseFoot=planted?.[i],foot=poseFoot?{x:poseFoot.x,y:poseFoot.y-poseFoot.lift*3.5*k}:point(u0+step.u*k,r.bootSpread*k*side,v.feetOffsetY-step.lift*2),yaw=poseFoot?poseFoot.yaw:th+step.yaw,boot=this.boots[i],scale=r.bootWidth*k/boot.width*(1+(poseFoot?.lift??step.lift)*(this.candidate?.045:.14));
   boot.setPosition(foot.x,foot.y).setRotation(yaw).setScale(scale).setDepth((this.candidate?2:3)+.01*step.lift);
   const hip=this.candidate?ground(-2*k,(r.hipSpread+1.25)*k*side):point(-2*k,r.hipSpread*k*side,v.bodyOffsetY);
   if(this.candidate){hip.y-=abdomenRise;hip.x+=abdomenShift;}
   const ankle=bootCollar(foot.x,foot.y,yaw,boot.displayWidth,.2);
   if(this.candidate){if(redrawLegs)straightLeg(this.legs,hip,ankle,3.8*k,1.45*k,marcoMaterials.leg);this.lines.push([hip,ankle]);}
   else{const length=Math.hypot(ankle.x-hip.x,ankle.y-hip.y),knee=joint(hip,ankle,length*.51,{x:lx*side,y:ly*side});if(redrawLegs)limb(this.legs,hip,knee,ankle,5.5*k,marcoMaterials.leg);this.lines.push([hip,knee],[knee,ankle]);}
  }
  const twist=punch?(punch.hand===0?1:-1)*r.torsoTwistDegrees*Math.PI/180*punchExtension(punch):0,tth=th+twist,tfx=Math.cos(tth),tfy=Math.sin(tth),tlx=tfy,tly=-tfx;
  const tp=point(0,0,v.bodyOffsetY),hp=point(r.headForward*k,0,v.headOffsetY+Math.sin(now/520)*.25);
  if(this.candidate){hp.y=tp.y+fy*r.headForward*k-gaps.torsoHead*settings.zoom;hp.x+=sx.head*sideFactor;}
  if(this.candidate){tp.y+=bodyBob;hp.y+=bodyBob-breathing*.15*k;}
  if(this.candidate){const ap=ground(-5*k,0),hipSpan=r.torsoHeight*k*.65;this.abdomen.setPosition(ap.x+abdomenShift,ap.y-abdomenRise).setRotation(th+twist*.3).setDisplaySize(hipSpan*.54,hipSpan).setVisible(!settings.legs);}
  const drawBody=(obj,kind,pos,height,angle)=>{const directional=this.candidate&&(settings.parts==='both'||settings.parts===kind);
   const lean=this.candidate&&kind==='torso';
   const key=lean?'torsoLean':directional?'directions':kind==='head'?'headOld':'torsoOld',frame=lean?'__BASE_TRIM':directional?kind+'-'+view.name:undefined;
   if(obj.texture.key!==key||(directional&&obj.frame.name!==frame))obj.setTexture(key,frame);
   obj.setFlipX(directional&&view.flip).setRotation(directional?wrap(angle-view.base):angle);
   // Up/down views put the shoulder span along image X, side views along Y.
   // Candidate frames are trimmed; original textures retain transparent padding.
   const sourceKey=kind==='head'?'headOld':'torsoOld';
   const across=directional&&view.name!=='side'?obj.width:obj.height;
   const span=directional?height*k*this.scene.visibleSpan[sourceKey]:height*k;
   obj.setPosition(pos.x,pos.y).setScale(span/(directional?across:obj.height)).setVisible(!settings.legs);
  };
  const split=this.candidate&&settings.headMode==='split'&&settings.parts!=='torso';
  drawBody(this.torso,'torso',tp,r.torsoHeight,tth);
  if(this.candidate)this.torso.setScale(r.torsoHeight*k*.78/this.torso.height*(1+breathing*.018));
  if(!split)drawBody(this.head,'head',hp,r.headHeight,th+twist*.4);
  this.head.setVisible(!settings.legs);
  this.hair.setVisible(split&&!settings.legs);
  if(split){
   const angle=wrap(th+twist*.4-view.base),frame='face-'+view.name,hairFrame='hair-'+view.name;
   if(this.head.texture.key!=='split'||this.head.frame.name!==frame)this.head.setTexture('split',frame);
   if(this.hair.texture.key!=='split'||this.hair.frame.name!==hairFrame)this.hair.setTexture('split',hairFrame);
   const across=view.name==='side'?this.head.height:this.head.width;
   const span=r.headHeight*k*this.scene.visibleSpan.headOld,scale=span/across;
   this.head.setPosition(hp.x,hp.y).setScale(scale).setRotation(angle).setFlipX(view.flip);
   const hairAcross=view.name==='side'?this.hair.height:this.hair.width,hairScale=span*.80/hairAcross;
   // Register hair over the crown, then apply height in screen coordinates.
   const dx=view.name==='side'?-this.head.width*scale*.10*(view.flip?-1:1):0;
   const dy=view.name==='down'?-this.head.height*scale*.10:view.name==='up'?this.head.height*scale*.04:0;
   this.hair.setPosition(hp.x+dx*Math.cos(angle)-dy*Math.sin(angle)+sx.hair*sideFactor,hp.y+dx*Math.sin(angle)+dy*Math.cos(angle)-gaps.headHair*settings.zoom).setScale(hairScale).setRotation(angle).setFlipX(view.flip);
  }
  if(this.candidate){this.head.setScale(this.head.scaleX*(1+breathing*.008));if(split)this.hair.setScale(this.hair.scaleX*(1+breathing*.008));}
  for(let i=0;i<2;i++){
   const side=i===0?1:-1,rest=point((settings.guard?11:15)*k,(settings.guard?9:15)*side*k*(this.candidate?.85:1),settings.guard?-6:0);
   if(this.candidate)rest.y+=bodyBob;
   let fist=rest;if(punch&&punch.hand===i){const visualPunch=this.candidate&&punch.type==='hook'?{...punch,reach:punch.reach*.72}:punch,raw=punchFist({...f,x:0,y:0},visualPunch,k),handPlane=point(0,0,0);fist={x:handPlane.x+raw.x,y:handPlane.y+raw.y+(this.candidate?bodyBob:0)};}
   const shoulderSpan=r.shoulderSpread*(this.candidate?.90*(1+breathing*.022):1);
   const shoulderPlane=point(0,0,v.bodyOffsetY);
   if(this.candidate)shoulderPlane.y+=bodyBob;
   const shoulder={x:shoulderPlane.x+tfx*k+tlx*shoulderSpan*k*side,y:shoulderPlane.y+tfy*k+tly*shoulderSpan*k*side};
   const straight=punch&&punch.hand===i&&punch.type!=='hook'?punchExtension(punch):0,minSegment=punch&&punch.hand===i&&punch.type==='hook'?Math.max(9*k,Math.hypot(fist.x-shoulder.x,fist.y-shoulder.y)*r.hookElbowRatio):9*k;
   const pose=armPose(shoulder,fist,r.gloveHeight*k*.4,minSegment,{x:lx*side,y:ly*side},straight);
   if(this.candidate)ovalArm(this.ovalSegments[i],shoulder,pose.elbow,pose.wrist,5.5*k);
   else if(redrawArms)limb(this.arms,shoulder,pose.elbow,pose.wrist,6*k,marcoMaterials.arm);
   const hand=this.hands[i],dx=fist.x-pose.elbow.x,dy=fist.y-pose.elbow.y;
   const depth=this.candidate?fistDepth(fx,fy,i):(settings.guard?7.5:6);
   hand.setPosition(fist.x,fist.y).setRotation(Math.atan2(dy,dx)+Math.PI/2).setScale(r.gloveHeight*k/hand.height).setDepth(depth).setVisible(!settings.legs);
   this.lines.push([shoulder,pose.elbow],[pose.elbow,pose.wrist]);
  }
  this.arms.setVisible(!settings.legs);
  if(settings.bones){const g=this.scene.bones;g.lineStyle(1.4,0x7afce0,.9);for(const[a,b]of this.lines){g.lineBetween(a.x,a.y,b.x,b.y);g.fillStyle(0xffcf6a);g.fillCircle(a.x,a.y,2);}}
  return view;
 }
}

class Study extends P.Scene{
 preload(){this.load.image('headOld','assets/head-original.webp');this.load.image('torsoOld','assets/torso-original.webp');this.load.image('torsoLean','assets/torso-lean-v3.png');this.load.image('hand','assets/hand.webp');this.load.image('foot','assets/foot.webp');this.load.image('directions','assets/head-torso-directions.png');this.load.image('split','assets/head-split-v1.png');this.load.image('abdomen','assets/abdomen-v7.png');}
 create(){
  lab=this;this.clock=0;this.walkMotion=new WalkMotion();this.f={x:0,y:0,fx:1,fy:0};this.punch=null;this.punchTime=0;this.lastAuto=-1;this.fpsSum=0;this.count=0;this.lastMetrics=0;this.workMs=0;this.lastTick=performance.now();this.realMs=0;
  const tex=this.textures.get('directions'),source=tex.getSourceImage(),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const cx=canvas.getContext('2d',{willReadFrequently:true});cx.drawImage(source,0,0);const pixels=cx.getImageData(0,0,canvas.width,canvas.height).data;
  this.visibleSpan={};
  for(const key of ['headOld','torsoOld','abdomen','torsoLean']){
   const image=this.textures.get(key).getSourceImage(),probe=document.createElement('canvas');
   probe.width=image.width;probe.height=image.height;
   const context=probe.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
   const data=context.getImageData(0,0,image.width,image.height).data;
   let top=image.height,bottom=-1,left=image.width,right=-1;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(data[(y*image.width+x)*4+3]>45){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
   this.visibleSpan[key]=(bottom-top+1)/image.height;
   if(key==='abdomen'||key==='torsoLean'){left=Math.max(0,left-2);top=Math.max(0,top-2);this.textures.get(key).add('__BASE_TRIM',0,left,top,Math.min(image.width-left,right-left+3),Math.min(image.height-top,bottom-top+3));}
  }
  const frames={};
  ['head-up','head-down','head-side','torso-up','torso-down','torso-side'].forEach((name,i)=>{const x0=Math.round(i%3*canvas.width/3),x1=Math.round((i%3+1)*canvas.width/3),y0=Math.round(Math.floor(i/3)*canvas.height/2),y1=Math.round((Math.floor(i/3)+1)*canvas.height/2);let l=x1,t=y1,r=x0,b=y0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*canvas.width+x)*4+3]>45){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r<l)throw Error('Empty directional frame '+name);tex.add(name,0,l,t,r-l+1,b-t+1);frames[name]={x:l,y:t,width:r-l+1,height:b-t+1};});
  const splitTex=this.textures.get('split'),splitSource=splitTex.getSourceImage();canvas.width=splitSource.width;canvas.height=splitSource.height;cx.drawImage(splitSource,0,0);
  const splitPixels=cx.getImageData(0,0,canvas.width,canvas.height).data;
  ['face-up','face-down','face-side','hair-up','hair-down','hair-side'].forEach((name,i)=>{
   const x0=Math.round(i%3*canvas.width/3),x1=Math.round((i%3+1)*canvas.width/3),y0=Math.round(Math.floor(i/3)*canvas.height/2),y1=Math.min(canvas.height,Math.round((Math.floor(i/3)+1)*canvas.height/2)+(i<3?32:0));let l=x1,t=y1,right=x0,bottom=y0;
   // The generated face/chin extends past the nominal half-sheet cell boundary.
   // Include its full outline and a transparent gutter instead of cutting at 512.
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(splitPixels[(y*canvas.width+x)*4+3]>8){l=Math.min(l,x);right=Math.max(right,x);t=Math.min(t,y);bottom=Math.max(bottom,y);}
   l=Math.max(x0,l-2);t=Math.max(y0,t-2);right=Math.min(x1-1,right+2);bottom=Math.min(y1-1,bottom+2);
   splitTex.add(name,0,l,t,right-l+1,bottom-t+1);
  });
  const floor=this.add.graphics();floor.fillStyle(0x263e4c);floor.fillRect(0,0,900,560);floor.lineStyle(1,0x405866,.6);for(let x=0;x<900;x+=45)floor.lineBetween(x,95,x,560);for(let y=110;y<560;y+=45)floor.lineBetween(0,y,900,y);floor.lineStyle(2,0x8aa9b3,.3);floor.lineBetween(450,100,450,490);
  const text=(x,y,t,color='#eceddf',size='15px')=>this.add.text(x,y,t,{fontFamily:'Arial',fontSize:size,fontStyle:'bold',color}).setOrigin(.5,0).setDepth(30);
  text(240,32,'PUNCHIES / ORIGINAL');text(660,32,'MARCO / LEANER BUILD','#7fe0e8');text(450,59,'Single front-facing head · continuous rotation · separate face and hair','#a8bfcc','11px');
  // Rasterize once; arm animation only changes four sprite transforms, rather
  // than rebuilding and triangulating ellipse paths on every frame.
  const oval=this.make.graphics({x:0,y:0,add:false});oval.fillStyle(0x101b32);oval.fillEllipse(128,32,252,60,32);oval.fillStyle(marcoMaterials.arm);oval.fillEllipse(128,32,246,54,32);oval.generateTexture('armOval',256,64);oval.destroy();
  this.left=new PuppetStudy(this,false);this.right=new PuppetStudy(this,true);this.bones=this.add.graphics().setDepth(20);this.status=text(450,490,'');text(450,519,'One head source · slimmer chest, shoulders and arms · no view switching.','#a8bfcc','11px');
  this.right.ovalSegments=Array.from({length:2},()=>Array.from({length:2},()=>this.add.image(0,0,'armOval').setDepth(4)));
  this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,L,G');for(const[name,key]of[['jab','J'],['cross','K'],['hook','L']])this.keys[key].on('down',()=>this.attack(name));this.keys.G.on('down',()=>{$('#guard').click();});this.input.keyboard.addCapture(['UP','DOWN','LEFT','RIGHT']);
  window.addEventListener('blur',()=>this.input.keyboard.resetKeys());this.ready=true;this.frames=frames;
  $('#turn').setAttribute('aria-pressed','false');$('#angle').value=90;
  this.renderMs=0;this.renderCount=0;
  this.game.events.on(P.Core.Events.PRE_RENDER,()=>this.renderStart=performance.now());
  this.game.events.on(P.Core.Events.POST_RENDER,()=>{this.renderMs+=performance.now()-this.renderStart;this.renderCount++;});
 }
 attack(type){if(this.punch)return;this.punch={type,hand:type==='cross'?1:0,frame:0,startup:type==='hook'?9:6,sourEarly:2,sweet:3,sour:3,recovery:12,reach:(type==='hook'?42:type==='cross'?48:42)*1.65*settings.zoom};this.punchTime=0;}
 startBenchmark(){
  if(this.benchmark)return;
  this.benchmark={start:performance.now(),last:performance.now(),visible:{frames:0,ms:0},empty:{frames:0,ms:0},pose:{x:this.f.x,y:this.f.y,angle:settings.angle},restore:{turn:settings.turn,walk:settings.walk,pause:settings.pause}};
  settings.turn=true;settings.walk=true;settings.pause=false;
  $('#benchmarkStatus').textContent='Measuring animated rigs for 2 seconds…';
 }
 update(_,delta){
  if(!this.ready)return;const start=performance.now();this.realMs+=start-this.lastTick;this.lastTick=start;
  if(this.benchmark){
   const b=this.benchmark,elapsed=start-b.start,lastElapsed=b.last-b.start;
   const phase=elapsed<2000?'visible':elapsed<4000?'empty':null;
   if(phase&&Math.floor(lastElapsed/2000)===Math.floor(elapsed/2000)){b[phase].frames++;b[phase].ms+=start-b.last;}
   b.last=start;
   if(phase==='empty'){this.scene.setVisible(false);$('#benchmarkStatus').textContent='Measuring empty canvas for 2 seconds…';}
   if(!phase){this.scene.setVisible(true);Object.assign(settings,b.restore);this.f.x=b.pose.x;this.f.y=b.pose.y;settings.angle=b.pose.angle;$('#angle').value=settings.angle*180/Math.PI;for(const key of ['turn','walk','pause'])$('#'+key).setAttribute('aria-pressed',String(settings[key]));
    const fps=p=>(p.frames*1000/Math.max(1,p.ms)).toFixed(1);
    $('#benchmarkStatus').textContent=`Animated rigs: ${fps(b.visible)} FPS · empty canvas: ${fps(b.empty)} FPS`;this.benchmark=null;
   }
  }
  const dt=settings.pause?0:Math.min(delta,100);this.clock+=dt;
  if(settings.turn)settings.angle=wrap(settings.angle+dt*.00065);
  const previousX=this.f.x,previousY=this.f.y;
  let vx=(this.keys.D.isDown||this.keys.RIGHT.isDown?1:0)-(this.keys.A.isDown||this.keys.LEFT.isDown?1:0),vy=(this.keys.S.isDown||this.keys.DOWN.isDown?1:0)-(this.keys.W.isDown||this.keys.UP.isDown?1:0);
  if(settings.walk&&!vx&&!vy){vx=Math.cos(this.clock*.0007);vy=Math.sin(this.clock*.0007);}
  const d=Math.hypot(vx,vy);if(d){vx/=d;vy/=d;this.f.x+=vx*dt*.04;this.f.y+=vy*dt*.04;this.f.x=Math.max(-90,Math.min(90,this.f.x));this.f.y=Math.max(-85,Math.min(85,this.f.y));}
  if(settings.walk){this.f.x=Math.sin(this.clock*.0007)*55;this.f.y=Math.cos(this.clock*.0007)*40;}
  this.f.moveX=dt?(this.f.x-previousX)*1000/dt:0;this.f.moveY=dt?(this.f.y-previousY)*1000/dt:0;
  this.f.fx=Math.cos(settings.angle);this.f.fy=Math.sin(settings.angle);
  this.walkMotion.update(this.f,this.clock,r.walkPhasePerPixel);
  if(settings.sequence){const step=Math.floor(this.clock/1100);if(step!==this.lastAuto){this.lastAuto=step;this.attack(['jab','cross','hook'][step%3]);}}
  if(this.punch){this.punchTime+=dt;this.punch.frame=this.punchTime/16.6667;if(this.punch.frame>this.punch.startup+this.punch.sourEarly+this.punch.sweet+this.punch.sour+this.punch.recovery)this.punch=null;}
  this.bones.clear();const args=[this.f,this.clock,this.walkMotion.phase,this.walkMotion.stride,this.walkMotion.direction,this.punch];this.left.draw({x:240,y:280},...args);const art=this.right.draw({x:660,y:280},...args);
  // Text rasterization and DOM controls only need a 10 Hz refresh.
  if(start-(this.lastUi||0)>100){this.lastUi=start;
   const deg=Math.round(settings.angle*180/Math.PI),status=`${deg}°     ${this.punch?.type.toUpperCase()|| (settings.guard?'GUARD':'IDLE')}     FOOT → TORSO ${(this.right.gaps.footAbdomen+this.right.gaps.abdomenTorso).toFixed(1)} px`;
   if(this.status.text!==status)this.status.setText(status);
   $('#angleText').textContent=deg+'°';if(settings.turn)$('#angle').value=deg;
  }
  this.workMs+=performance.now()-start;this.count++;
  if(start-this.lastMetrics>1000){this.lastMetrics=start;
   $('#metrics').textContent=`${(1000*this.count/this.realMs).toFixed(0)} FPS · frame delivery\n${(this.workMs/this.count).toFixed(2)} ms · update CPU\n${(this.renderMs/Math.max(1,this.renderCount)).toFixed(2)} ms · render CPU\n${this.game.renderer.type===P.WEBGL?'WebGL':'Canvas'} · ${document.visibilityState} · ${document.hasFocus()?'focused':'unfocused'}\nTwo rigs in this comparison\nCached oval arm sprites; idle limbs reuse paths`;
   this.count=this.workMs=this.realMs=this.renderMs=this.renderCount=0;
  }
 }
}
await loadDraft();
$('#zoom').value=settings.zoom;$('#zoomText').textContent=settings.zoom+'×';$('#headMode').value=settings.headMode;$('#breathMode').value=settings.breathMode;
new P.Game({type:P.AUTO,parent:'stage',width:900,height:560,backgroundColor:'#263e4c',antialias:true,scale:{mode:P.Scale.FIT,autoCenter:P.Scale.CENTER_BOTH},scene:Study,audio:{noAudio:true},banner:false});
for(const id of['turn','walk','sequence','guard','bones','legs','pause'])$('#'+id).onclick=e=>{settings[id]=!settings[id];e.currentTarget.setAttribute('aria-pressed',String(settings[id]));};
document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>lab?.attack(b.dataset.act));
document.querySelectorAll('[data-face]').forEach(b=>b.onclick=()=>{settings.turn=false;$('#turn').setAttribute('aria-pressed','false');settings.angle=Number(b.dataset.face)*Math.PI/180;$('#angle').value=b.dataset.face;});
$('#angle').oninput=e=>{settings.turn=false;$('#turn').setAttribute('aria-pressed','false');settings.angle=Number(e.target.value)*Math.PI/180;};
$('#headMode').onchange=e=>{settings.headMode=e.target.value;saveDraft();};
$('#breathMode').onchange=e=>{settings.breathMode=e.target.value;saveDraft();};
$('#zoom').oninput=e=>{settings.zoom=Number(e.target.value);$('#zoomText').textContent=settings.zoom+'×';scheduleDraft();};
$('#zoom').onchange=saveDraft;
for(const direction of ['down','side','left','up'])for(const [key,label]of offsetFields){
 const id=direction+'-'+key,row=document.createElement('label');row.textContent=label+' ';
 const value=document.createElement('span');value.textContent=settings.offsets[direction][key]+' px';row.append(value);
 const input=document.createElement('input');input.type='range';input.min='-10';input.max=key==='footAbdomen'?'60':'35';input.step='.1';input.value=settings.offsets[direction][key];input.id=id;input.setAttribute('aria-label',direction+' '+label+' offset');row.append(input);$('#offset-'+direction).append(row);
 input.oninput=()=>{settings.offsets[direction][key]=Number(input.value);value.textContent=input.value+' px';scheduleDraft();};input.onchange=saveDraft;
}
$('#saveDraft').onclick=saveDraft;
$('#benchmark').onclick=()=>lab?.startBenchmark();
document.querySelectorAll('[data-tune]').forEach(button=>button.onclick=()=>{settings.turn=false;$('#turn').setAttribute('aria-pressed','false');settings.angle={down:Math.PI/2,side:0,left:Math.PI,up:-Math.PI/2}[button.dataset.tune];$('#angle').value=settings.angle*180/Math.PI;for(const direction of ['down','side','left','up'])$('#offset-'+direction).hidden=direction!==button.dataset.tune;document.querySelectorAll('[data-tune]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
for(const direction of ['side','left']){
const horizontal=direction==='left'?settings.leftX:settings.sideX,sideName=direction==='left'?'Left':'Right';
const sideNote=document.createElement('small');sideNote.className='divider';sideNote.textContent=sideName+'-only X shifts, relative to previous layer. Positive moves screen-right; negative moves screen-left. Feet stay anchored.';$('#offset-'+direction).append(sideNote);
for(const [key,label]of [['abdomen','Abdomen'],['torso','Torso'],['head','Head'],['hair','Hair']]){
 const row=document.createElement('label');row.textContent=label+' left/right ';const value=document.createElement('span');value.textContent=horizontal[key]+' px';row.append(value);
 const input=document.createElement('input');input.type='range';input.min='-40';input.max='40';input.step='.1';input.value=horizontal[key];input.id=direction+'X-'+key;input.setAttribute('aria-label',sideName+' '+label+' X shift');row.append(input);$('#offset-'+direction).append(row);
 input.oninput=()=>{horizontal[key]=Number(input.value);value.textContent=input.value+' px';scheduleDraft();};input.onchange=saveDraft;
}
}
// Range controls keep their native arrow-key behavior instead of moving the rig.
document.addEventListener('keydown',e=>{if(e.target.matches('input,select'))e.stopPropagation();},true);
document.addEventListener('keyup',e=>{if(e.target.matches('input,select'))e.stopPropagation();},true);











