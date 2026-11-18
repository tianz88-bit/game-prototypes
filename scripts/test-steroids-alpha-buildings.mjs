// Ground attachment/material regressions. No browser or screen capture.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(file) {
  const r=await build({entryPoints:[file],bundle:true,platform:'node',format:'esm',write:false});
  return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const G=await load('prototypes/steroids-alpha/src/render/buildingGeometry.ts');
const M=await load('prototypes/steroids-alpha/src/render/buildingMaterials.ts');
const D=await load('prototypes/steroids-alpha/src/render/buildingCondition.ts');
const Rock=await load('prototypes/steroids-alpha/src/render/rockSelection.ts');
const Chips=await load('prototypes/steroids-alpha/src/render/crystalChipMotion.ts');
const rock={id:2,size:0,x:0,y:0,vx:0,vy:0,t0:0,hp:60,family:0,rich:true};
assert(Chips.richCrystalHit(rock,{...rock,hp:50}));
assert(!Chips.richCrystalHit(undefined,rock),'initial rich spawn is not a hit');
assert(!Chips.richCrystalHit(rock,{...rock}),'duplicate HP snapshot cannot shed chips');
assert(!Chips.richCrystalHit(rock,{...rock,hp:70}),'healing does not shed chips');
assert(!Chips.richCrystalHit({...rock,rich:false},{...rock,rich:false,hp:50}),'ordinary rocks do not emit gold');
for(const size of [0,1,2]){
  const hit=Chips.crystalChipProfile('hit',size),split=Chips.crystalChipProfile('split',size);
  assert(split.chips>hit.chips&&split.sparks>hit.sparks&&split.life>hit.life,'splits have a larger scatter than hits');
  for(const mode of ['hit','split']){
    const e={mode,...rock,size},life=Chips.crystalChipProfile(mode,size).life;
    const airborne=Chips.crystalChipPose(e,22,0,150),end=Chips.crystalChipPose(e,22,0,life);
    assert(airborne.lift>0,'chips arc above the ground');assert.equal(end.alpha,0,'chips expire');
    const drifting=Chips.crystalChipPose({...e,vx:100},22,0,150);
    assert(Math.abs(drifting.dx-airborne.dx-9)<1e-7,'chips inherit asteroid velocity');
  }
}
const Reg=await load('prototypes/steroids-alpha/src/render/rockRegistration.ts');
for(const offset of [[0,0],[70,140],[400,300]])for(const radius of [22,42,70]){
  const body={left:20,top:30,width:220,height:180,anchorX:123,anchorY:109,radius:65};
  const trim={left:10,top:18,width:600,height:550},r=Reg.decoratedRockFrame(body,offset,trim);
  const scale=radius*1.04/body.radius,width=radius*1.04/r.inR;
  for(const [x,y] of [[20,30],[123,109],[240,210]]){
    assert(Math.abs(-r.ax*width+(x+offset[0]-trim.left)/trim.width*width-(x-body.anchorX)*scale)<1e-7,'crystals cannot shift/resize the collision body X');
    assert(Math.abs(-r.ay*width*trim.height/trim.width+(y+offset[1]-trim.top)/trim.width*width-(y-body.anchorY)*scale)<1e-7,'crystals cannot shift/resize the collision body Y');
  }
}
for(const [family,name] of ['ochre','lavender','teal'].entries()){
  assert.equal(Rock.paintedRockName(9,0,family,true),`rich-${name}-parent`);
  for(const size of [1,2]){
    const stage=size===1?'medium':'small';
    assert.equal(Rock.paintedRockName(10,size,family,true),`rich-${name}-${stage}-1`);
    assert.equal(Rock.paintedRockName(11,size,family,true),`rich-${name}-${stage}-2`);
    assert.equal(Rock.paintedRockName(11,size,family),`${name}-${stage}-2`,'ordinary rocks retain existing art');
  }
}
const Blast=await load('prototypes/steroids-alpha/src/render/buildingBlast.ts');
assert(Blast.isBuildingFinalHit(.1,0,16),'final visible hit detonates');
assert(!Blast.isBuildingFinalHit(undefined,0,16),'joining a ruin does not replay its destruction');
assert(!Blast.isBuildingFinalHit(0,0,16),'zero-health snapshots do not repeat explosions');
assert(!Blast.isBuildingFinalHit(.1,0,800),'offscreen historical destruction does not replay');
assert(!Blast.isBuildingFinalHit(0,1,16),'repair does not detonate');
for(const kind of ['turret','nexus'])for(let i=0;i<36;i++){
  const launch=Blast.buildingFragment(i,0,kind),air=Blast.buildingFragment(i,250,kind),ground=Blast.buildingFragment(i,2300,kind);
  assert(launch.lift>0&&air.lift>0,'chunks start at raised building height');
  assert(Math.hypot(air.dx,air.dy)>0,'chunks fly radially outward');
  nearNumber(ground.lift,0);
  const later=Blast.buildingFragment(i,2350,kind);
  nearNumber(ground.dx,later.dx);nearNumber(ground.dy,later.dy);
  assert.equal(Blast.buildingFragment(i,Blast.BLAST_LIFE[kind],kind).alpha,0,'effects expire');
}
function nearNumber(a,b){assert(Math.abs(a-b)<1e-7,'landed debris stays grounded');}
assert.equal(D.damageStage(undefined),'healthy');
assert.equal(D.damageStage(.65),'healthy');assert.equal(D.damageStage(.649),'damaged');
assert.equal(D.damageStage(.3),'damaged');assert.equal(D.damageStage(.299),'critical');
assert.equal(D.damageStage(0),'destroyed');assert.equal(D.damageStage(-1),'destroyed');
assert.equal(D.durability(NaN),0);assert.equal(D.durability(2),1);
for(const health of [0,.2,.55,1]){
  const panels=Array.from({length:24},(_,i)=>D.shieldPanel(i,health,false));
  assert.equal(panels.filter(Boolean).length,Math.ceil(health*24),'shield coverage follows strength');
  assert(Array.from({length:24},(_,i)=>D.shieldPanel(i,health,true)).every(v=>!v),'broken shield never reappears at positive health');
}
const P=await load('prototypes/steroids-alpha/src/render/planet.ts');
const R=await load('prototypes/steroids-alpha/src/render/shipProfiles.ts');
const C=await load('prototypes/steroids-alpha/sim/chassis.ts');
const Rig=await load('prototypes/steroids-alpha/src/render/shipRig.ts');
const near=(a,b,label)=>assert(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
const inside=(polygon,p)=>polygon.every((a,i)=>{
  const b=polygon[(i+1)%polygon.length];return(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-1e-7;
});
let shadows=0;
for(const root of [[0,0],[400,320],[-950,80]])for(const angle of [0,45,90,180,270,360]){
  const frame=P.planetFrame(0,0,angle,P.lightingRadius(8000),P.sunState(225,50));
  const project=(dx,dy)=>{const q=P.projectOffset(root[0]+dx,root[1]+dy,1600);return {...q,x:640+q.x,y:360+q.y};};
  const at=project(0,0),p={id:'test',at,clan:1,now:0,sun:frame.sun,projectGround:project};
  const polygon=G.buildingShadowPolygon(p,220,145,100);
  assert(polygon.length>=3&&inside(polygon,at),'directional cast always includes its foundation');
  assert.deepEqual(G.buildingPoint(p,0),{x:at.x,y:at.y},'plate and column share the ground root');
  const texel={x:frame.camera.x+root[0],y:frame.camera.y+root[1]};
  assert.deepEqual(texel,{x:root[0],y:root[1]},'planet rotation cannot slide surface beneath a root');
  shadows++;
}

// Screen-position perspective must never rotate or detach a stack, even beyond the viewport.
for(const view of [{w:1280,h:720},{w:844,h:390},{w:320,h:240}])for(const scale of [.1,1,3]){
  const centre={x:view.w/2,y:view.h/2};
  assert.deepEqual(G.buildingStackLean(centre,view),{x:0,y:0});
  for(const [nx,ny] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[8,-9]]){
    const at={x:centre.x+nx*view.w/2,y:centre.y+ny*view.h/2,scale,visible:true};
    const stackLean=G.buildingStackLean(at,view),pose={id:'stack',at,clan:1,now:0,stackLean};
    assert(Math.hypot(stackLean.x,stackLean.y)<=.55000001,'outward lean is bounded');
    for(const [lo,hi,jointWidth] of [[0,20,19],[20,60,20],[0,45,160],[45,100,92]]){
      const a=G.buildingPoint(pose,lo),b=G.buildingPoint(pose,hi);
      assert(Math.hypot(b.x-a.x,b.y-a.y)<=((hi-lo)*.55+.001)*scale,'connecting column remains bounded');
      assert(Math.hypot(b.x-a.x,b.y-a.y)<((hi-lo)+jointWidth)*scale,'no disconnected extreme stacks');
    }
    for(const angle of [0,.7,2,4])for(const lateral of [-8,8])for(const foreshorten of [.55,.8,1.15]){
      const p={...pose,foreshorten},m=G.towerMuzzle(p,angle,lateral,6),pivot=G.buildingPoint(p,62,4-6,lateral,angle);
      near(m.x,pivot.x+Math.cos(angle)*38*.9*foreshorten*scale,'muzzle is rendered barrel tip X');
      near(m.y,pivot.y+Math.sin(angle)*38*.9*foreshorten*scale,'muzzle is rendered barrel tip Y');
    }
  }
}
near(G.towerLaunchWeight(0),1,'shot begins at barrel');near(G.towerLaunchWeight(180),0,'shot returns to authoritative path');
for(let t=1;t<=180;t++)assert(G.towerLaunchWeight(t)<=G.towerLaunchWeight(t-1),'launch correction never reverses');

for(const lean of [{x:0,y:0},{x:.55,y:0},{x:-.55,y:.2},{x:.2,y:-.5}])for(const [x,y] of [[0,0],[-100,-70],[100,70]]){
 const p=G.buildingTiltPoint(x,y,lean);assert(Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(!lean.x&&!lean.y)assert.deepEqual(p,{x,y},'centre FFD is exact identity');
 assert(Math.hypot(p.x,p.y)<Math.hypot(x,y)*1.3+1e-8,'building plate deformation stays bounded');
}
for(let i=0;i<6;i++)for(let now=0;now<120000;now+=100){assert(Math.abs(G.idleTowerAim(i,now+100)-G.idleTowerAim(i,now))<.007,'idle towers move slowly and continuously');}
assert.notEqual(G.idleTowerAim(0,2000),G.idleTowerAim(1,2000),'tower patrol phases vary');

console.log('Building perspective: centre/edges/corners/extremes connected; dual muzzle tips and bounded launch blend pass.');

const original=new Uint8ClampedArray([0,97,242,220,255,135,0,255,115,217,255,128,5,9,18,255,230,220,200,255,0,0,0,0]);
const red=original.slice(),blue=original.slice();M.remapBuildingPixels(red,1);M.remapBuildingPixels(blue,2);
assert.notDeepEqual(red.slice(0,12),blue.slice(0,12),'clans have distinct enamel/trim/glass');
for(const pixels of [red,blue]){
  for(let i=3;i<original.length;i+=4)assert.equal(pixels[i],original[i],'alpha preserved');
  assert.deepEqual(pixels.slice(12),original.slice(12),'dark lines, cream metal and transparency preserved');
}
const profile=R.SHIP_PROFILES[2],modules=profile.modules,cal=profile.calibration;
assert.equal(modules.filter(m=>m.asset==='shield-emitter').length,0,'forward glass lenses removed');
const guns=modules.filter(m=>m.asset==='gun');assert.equal(guns.length,4);
for(const side of [-1,1]){
  const pair=guns.filter(m=>Math.sign(m.x)===side);assert.equal(pair.length,2);
  assert.equal(pair[0].parent,pair[1].parent,'a flush pair belongs to one side housing');
  for(const angle of [0,45,90,135,180,225,270,315]){
    const a=Rig.pose(pair[0],angle,cal,0,0,0,0,modules),b=Rig.pose(pair[1],angle,cal,0,0,0,0,modules);
    const r=angle*Math.PI/180;near((a.x-b.x)*Math.sin(r)-(a.y-b.y)*Math.cos(r),0,'paired gun tips remain flush through rotation');
  }
}
assert(C.GUNS[2].every(m=>m.forward===C.GUNS[2][0].forward),'all four simulation origins share the bow line');
assert(C.GUNS[2].filter(m=>m.right<0).length===2&&C.GUNS[2].filter(m=>m.right>0).length===2);
assert(cal.modules.armour.offsets.up.y<cal.modules.armour.offsets.right.y&&cal.modules.armour.offsets.right.y<cal.modules.armour.offsets.down.y,'cardinal depth compresses toward down view');
assert(Math.abs(cal.modules.armour.offsets.up.y+cal.modules.cockpit.offsets.up.y+cal.modules.canopy.offsets.up.y)>=90,'bridge depth is exaggerated above the deck');
console.log(`Building grounding: ${shadows} projected sun/root cases; clan materials, flush capital mounts and stronger depth pass.`);

await import('./test-steroids-landing-layout.mjs');
