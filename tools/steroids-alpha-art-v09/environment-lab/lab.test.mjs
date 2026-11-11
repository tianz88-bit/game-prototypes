import assert from 'node:assert/strict';
import {surfacePoint,radialDerivative} from './projection.mjs';
import {ThrusterVFX} from './thrusters.mjs';
import {sphereSettings,circleSettings,edgeCircleSettings,projectWorld,unprojectScreen} from './projection.mjs';
import {PlanetGround,groundMeshData} from './planet-ground.mjs';
import {cruiseStep} from './travel.mjs';
import {GPUSprites} from './gpu-sprites.mjs';
import {projectPanelPoint} from '../releases/human-nomad-rig-v1-20261110/ffd.mjs';
const origins=[{x:0,y:0,width:30,angle:18},{x:80,y:0,width:30,angle:18}];
const idle={throttle:false,left:false,right:false};
for(const k of [0,.28,.65]){assert.deepEqual(surfacePoint(.5,.5,k),{x:.5,y:.5});for(let r=0;r<2;r+=.05)assert.ok(radialDerivative(r,k)>0,'Projection never folds');}
assert.deepEqual(surfacePoint(.2,.8,0),{x:.2,y:.8});
const v=new ThrusterVFX(()=>.5);for(let i=0;i<60;i++)v.update(1/60,idle,origins);assert.ok(v.particles.length>0);assert.deepEqual(v.bursts,[0,0]);
v.update(1/60,{...idle,left:true},origins);assert.deepEqual(v.strong,[false,true]);assert.deepEqual(v.bursts,[0,1]);for(let i=0;i<120;i++)v.update(1/60,{...idle,left:true},origins);assert.deepEqual(v.bursts,[0,1],'Held turn never retriggers explosion');
v.update(1/60,idle,origins);v.update(1/60,{...idle,throttle:true},origins);assert.deepEqual(v.strong,[true,true]);assert.deepEqual(v.bursts,[1,2]);for(let i=0;i<120;i++)v.update(1/60,{...idle,throttle:true},origins);assert.deepEqual(v.bursts,[1,2],'Held throttle never retriggers explosion');
v.update(1/60,idle,origins);v.update(1/60,{...idle,right:true},origins);assert.deepEqual(v.strong,[true,false]);assert.deepEqual(v.bursts,[2,2]);assert.ok(v.particles.length<=900);assert.ok(v.particles.every(p=>Number.isFinite(p.x)&&p.w>0&&p.h>0));
const burst=new ThrusterVFX(()=>.5);burst.update(1/60,{...idle,throttle:true},origins);assert.ok(burst.particles.length>=172,'Larger burst emits at least 86 per engine');assert.ok(burst.particles.filter(p=>p.w>6).length>=172);
for(const strength of [.1,.28,.65]){const s=sphereSettings(1440,810,strength),centre=projectWorld(0,0,s);assert.ok(Math.abs(centre.x-720)<1e-6&&Math.abs(centre.y-405)<1e-6);for(const [x,y]of [[0,0],[-200,-100],[200,120],[0,-350]]){const p=projectWorld(x,y,s);assert.ok(p.visible);const q=unprojectScreen(p.x,p.y,s);assert.ok(Math.abs(q.x-x)<1e-6&&Math.abs(q.y-y)<1e-6,'GPU inverse and prop projection agree');}const behind=projectWorld(0,(-Math.PI/2-s.latitude-.01)*s.metric,s);assert.equal(behind.visible,false);const near=projectWorld(0,(-Math.PI/2-s.latitude+.01)*s.metric,s);assert.ok(near.visible&&near.scale<.1,'Props rise small above horizon');assert.equal(unprojectScreen(720,s.horizon-1,s),null);}
let speed=0;speed=cruiseStep(speed,false,180,1/60);assert.equal(speed,180);for(let i=0;i<180;i++)speed=cruiseStep(speed,true,180,1/60);assert.ok(speed>809&&speed<=810);for(let i=0;i<300;i++)speed=cruiseStep(speed,false,180,1/60);assert.ok(speed>=180&&speed<181);
console.log('PASS: sphere anchor, forward/inverse projection, hidden hemisphere and horizon emergence; cruise minimum 180 and throttle 810; 86-particle bursts.');
const gpu=Object.create(GPUSprites.prototype);gpu.width=1440;gpu.height=810;gpu.vertices=new Float32Array(100);let submitted=0;gpu.submit=(_key,count)=>submitted=count;
for(const mirror of [false,true]){const m={id:'armour',asset:'armour',mirror},p={x:30,y:-20,rotation:.4},source={width:200,height:300};gpu.part(m,source,p,100,720,390,.48,-13,22,18);assert.equal(submitted,96);const q=projectPanelPoint(m,.22,.2,100,150,p,-13,22,18),i=(1*5+1)*4;assert.ok(Math.abs(gpu.vertices[i]-((720+q.x*.48)/1440*2-1))<1e-6);assert.ok(Math.abs(gpu.vertices[i+1]-(1-(390+q.y*.48)/810*2))<1e-6);assert.ok(Math.abs(gpu.vertices[i+2]-(mirror?.78:.22))<1e-6);}
console.log('PASS: GPU clip-space mesh matches approved per-part FFD projection and mirrored texture coordinates.');
for(const strength of [0,.28,.65]){const s=circleSettings(1440,810,strength);assert.ok(s.radius>Math.hypot(720,405),'Circle rim stays outside every screen corner');const c=projectWorld(0,0,s);assert.equal(c.x,720);assert.equal(c.y,405);assert.equal(c.scale,1);for(const [x,y]of [[0,0],[1440,0],[0,810],[1440,810],[720,405],[1300,405]]){const q=unprojectScreen(x,y,s);assert.ok(q);const p=projectWorld(q.x,q.y,s);assert.ok(p.visible&&p.depth>.5);assert.ok(Math.abs(p.x-x)<1e-7&&Math.abs(p.y-y)<1e-7);}const near=projectWorld(20,0,s);assert.ok(Math.abs(near.x-740)<.002,'Centre stays almost flat');const side=projectWorld(700,0,s);assert.ok(side.x<1420&&side.scale<1,'Outer field compresses');
 const mesh=Object.create(PlanetGround.prototype);mesh.width=1440;mesh.height=810;mesh.gl={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,bindBuffer(){},bufferData(_type,data){assert.ok([...data].every(Number.isFinite),'Circular GPU mesh is finite');}};mesh.build(s,true);assert.equal(mesh.count,64*36*6);}
console.log('PASS: oversized circular rim remains offscreen, anchored top-down centre, projection round trips, side compression and finite cached ground mesh.');
const edge=edgeCircleSettings(1440,810);assert.ok(edge.radius>405&&edge.radius<720,'Planet extends above/below but exposes both sides');assert.equal(unprojectScreen(0,405,edge),null);assert.equal(unprojectScreen(1440,405,edge),null);assert.ok(unprojectScreen(720,0,edge));for(const [x,y]of [[0,0],[250,120],[-400,100]]){const p=projectWorld(x,y,edge);const q=unprojectScreen(p.x,p.y,edge);assert.ok(Math.abs(q.x-x)<1e-6&&Math.abs(q.y-y)<1e-6);}const em=groundMeshData(edge,true);assert.ok([...em.vertices].every(Number.isFinite));assert.ok(Math.max(...em.indices)<em.vertices.length/7);assert.equal(em.indices.length,128*48*6);console.log('PASS: visible side rims, top/bottom extension, tighter-circle round trips and finite closed polar surface mesh.');
for(const strength of [0,.28,.65]){const e=edgeCircleSettings(1440,810,strength);assert.ok(e.radius>405&&e.radius<720);}
const normalParticles=new ThrusterVFX(()=>.5),smallParticles=new ThrusterVFX(()=>.5);normalParticles.spawn(origins[0],true);smallParticles.spawn({...origins[0],particleScale:.375},true);assert.ok(Math.abs(smallParticles.particles[0].w/normalParticles.particles[0].w-.375)<1e-12);assert.ok(Math.abs(smallParticles.particles[0].h/normalParticles.particles[0].h-.375)<1e-12);assert.ok(Math.abs(smallParticles.particles[0].vy/normalParticles.particles[0].vy-.375)<1e-12);
console.log('PASS: flat identity, centre anchored, monotone non-folding curvature; idle exhaust, outside-engine yaw, edge-triggered throttle/turn bursts, bounded rectangular particles.');

// A large prop must emerge while its centre and trailing corners remain hidden.
{
 const {groundSpriteTriangles,groundSpriteBounds}=await import('./surface-props.mjs');
 const s=edgeCircleSettings(),limit=s.radius*Math.PI/2;
 assert.equal(projectWorld(limit+20,0,s).visible,false);
 assert.equal(groundSpriteBounds(limit+20,0,400,200,s).visible,true);
 assert.ok(groundSpriteTriangles(limit+20,0,400,200,0,s).length>0);
 assert.ok(groundSpriteTriangles(limit-30,0,400,200,0,s).length>0);
 assert.equal(groundSpriteTriangles(limit+300,0,400,200,0,s).length,0);
 const areas=[];for(const offset of [201,199,195,180,100,20,-30,-200,-400]){
  const data=groundSpriteTriangles(limit+offset,0,400,200,0,s);let area=0;
  for(let i=0;i<data.length;i+=4){assert.ok(Number.isFinite(data[i])&&Number.isFinite(data[i+1]));assert.ok(data[i+2]>=0&&data[i+2]<=1&&data[i+3]>=0&&data[i+3]<=1);assert.ok(Math.hypot(data[i]-720,data[i+1]-405)<=s.radius+.001);}
  for(let i=0;i<data.length;i+=12)area+=Math.abs((data[i+4]-data[i])*(data[i+9]-data[i+1])-(data[i+8]-data[i])*(data[i+5]-data[i+1]))/2;
  areas.push(area);
 }
 assert.equal(areas[0],0);assert.ok(areas[1]>0&&areas[1]<areas.at(-1)*.001);for(let i=1;i<areas.length;i++)assert.ok(areas[i]>=areas[i-1]);
 console.log('PASS: large props emerge progressively before their centres; bounded UVs and limb geometry; visible area grows smoothly through rim.');
}

{
 const {sunState,shipShadow,advanceRotation}=await import('./lighting.mjs');
 for(const angle of [0,90,180,238,270,359]){const sun=sunState(angle),sh=shipShadow(sun);assert.ok(Math.abs(Math.hypot(sun.x,sun.y,sun.z)-1)<1e-12);assert.ok(sh.x*sun.x+sh.y*sun.y<0);assert.ok(Math.hypot(sh.x,sh.y)<33);}
 const a=shipShadow(sunState(0)),b=shipShadow(sunState(180));assert.ok(Math.abs(a.x+b.x)<1e-10&&Math.abs(a.y+b.y)<1e-10);assert.ok(Math.abs(advanceRotation(359,.25)-360)<1e-12);assert.equal(advanceRotation(238,0),238);
 console.log('PASS: linked sun/shadow opposition, short bounded default offset, reversed sun reverses shadow, continuous lighting cycle.');
}

{
 const {planetFrame,advanceRotation,shipShadow}=await import('./lighting.mjs');const R=608.2476923076923,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10);
 const initial=planetFrame(),turned=planetFrame(0,0,90),travelled=planetFrame(Math.PI*R/2,0,0);
 for(const k of ['x','y','z'])near(turned.sun[k],travelled.sun[k]);near(turned.camera.x,travelled.camera.x);
 const loop=planetFrame(0,0,360);for(const k of ['x','y','z'])near(initial.sun[k],loop.sun[k]);
 const night=planetFrame(0,0,180);assert.equal(night.daylight,0);assert.ok(night.brightness<initial.brightness);
 assert.notDeepEqual(planetFrame(0,400).sun,initial.sun);assert.deepEqual(planetFrame(0,0,advanceRotation(0,0)).sun,initial.sun);
 for(let r=0;r<360;r+=5){const f=planetFrame(300,-100,r),sh=shipShadow(f.sun);near(Math.hypot(f.sun.x,f.sun.y,f.sun.z),1);assert.ok(Math.hypot(sh.x,sh.y)<=140+1e-10);}
 console.log('PASS: rotation and equivalent travel share one sun frame; north/south travel changes local sun; full rotation returns lighting; nights suppress shadows; paused state is deterministic.');
}
