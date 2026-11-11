import assert from 'node:assert/strict';
import {modules,seed,validate,blendOffsets,pose,sector,depth} from './rig.mjs';
const cal=seed(),off={up:{x:1,y:2},right:{x:10,y:20},down:{x:30,y:40},left:{x:50,y:60}};
for(const [angle,d]of [[0,'up'],[90,'right'],[180,'down'],[270,'left'],[360,'up']]){const v=blendOffsets(angle,off);assert.ok(Math.abs(v.x-off[d].x)<1e-10);assert.ok(Math.abs(v.y-off[d].y)<1e-10);}
for(const a of [0,90,180,270,360]){const before=blendOffsets(a-.0001,off),after=blendOffsets(a+.0001,off);assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<.001);}
const oldRight=blendOffsets(90,off);off.left.x+=10;assert.deepEqual(blendOffsets(90,off),oldRight);assert.equal(blendOffsets(270,off).x,60);
const edited={up:{x:0,y:-25.9},right:{x:50,y:-20},down:{x:0,y:46.2},left:{x:-50,y:-20}};
for(const angle of [0,90,180,270,360])for(const axis of ['x','y']){
 const h=.0001,v=blendOffsets(angle,edited)[axis];
 const left=(v-blendOffsets(angle-h,edited)[axis])/h,right=(blendOffsets(angle+h,edited)[axis]-v)/h;
 assert.ok(Math.abs(left-right)<.0001,'Velocity must continue through cardinal/seam');
}
assert.ok(blendOffsets(.01,edited).x/.01>.5,'Sideways motion must not stop at Up');
for(let i=0;i<4;i++)for(let a=0;a<=90;a++)for(const axis of ['x','y']){
 const low=Math.min(edited[['up','right','down','left'][i]][axis],edited[['up','right','down','left'][(i+1)%4]][axis]);
 const high=Math.max(edited[['up','right','down','left'][i]][axis],edited[['up','right','down','left'][(i+1)%4]][axis]);
 const value=blendOffsets(i*90+a,edited)[axis];assert.ok(value>=low-1e-9&&value<=high+1e-9,'No interpolation overshoot');
}
for(const a of [45,135,225,315]){assert.notEqual(sector(a-.01),sector(a+.01));assert.equal(sector(a+.01),sector(a+1));}
const cockpit=modules.find(m=>m.id==='cockpit');assert.deepEqual(pose(cockpit,67,cal,0,0),pose(cockpit,67,cal,12000,0));
const c=structuredClone(cal);c.modules.cockpit.offsets.right.y-=10;assert.ok(Math.abs(pose(cockpit,90,c).y-pose(cockpit,90,cal).y+10)<1e-10);
assert.equal(JSON.stringify(validate(JSON.parse(JSON.stringify(cal)))),JSON.stringify(cal));assert.throws(()=>validate({version:1,modules:{}}));
const bad=structuredClone(cal);bad.modules.cockpit.offsets.left.x=NaN;assert.throws(()=>validate(bad));
const module=id=>modules.find(m=>m.id===id),hull=module('armour'),left=module('engineL'),right=module('engineR');
for(const m of modules.filter(m=>!m.directionalDepth))for(const a of [0,44,46,90,134,136,180,224,226,270,314,316,360])assert.equal(depth(m,a,cal),depth(m,0,cal));
for(const angle of Array.from({length:361},(_,i)=>i))for(const id of ['cockpit','canopy'])for(const capId of ['engineCapL','engineCapR'])assert.ok(depth(module(id),angle,cal)>depth(module(capId),angle,cal));const raised=structuredClone(cal);raised.modules.armour.offsets.right.y-=25;
assert.ok(Math.abs(pose(cockpit,90,raised).y-pose(cockpit,90,cal).y+25)<1e-9);
assert.ok(Math.abs(pose(cockpit,90,raised).x-pose(cockpit,90,cal).x)<1e-9);
raised.modules.chassis.offsets.right.y-=13;
assert.ok(Math.abs(pose(cockpit,90,raised).y-pose(cockpit,90,cal).y+38)<1e-9);
const customZ=structuredClone(cal);for(const d of ['up','right','down','left'])customZ.modules.engineL.order[d]=70;
assert.ok(depth(left,90,customZ)>depth(hull,90,customZ));
assert.ok(depth(left,270,customZ)>depth(hull,270,customZ));
const legacy=JSON.parse(JSON.stringify(cal));legacy.version=1;for(const e of Object.values(legacy.modules))delete e.order;
assert.deepEqual(validate(legacy).modules.engineL.offsets,legacy.modules.engineL.offsets);assert.equal(validate(legacy).version,7);
const invalidZ=structuredClone(cal);invalidZ.modules.cockpit.order.up=Infinity;assert.throws(()=>validate(invalidZ));
const canopy=module('canopy');assert.ok(cal.modules.cockpit.width>cal.modules.armour.width*.7);
for(const m of modules.filter(m=>m.id!=='chassis')){const o=cal.modules[m.id].offsets;assert.ok(Math.abs(o.up.y)>Math.abs(o.right.y));assert.ok(Math.abs(o.right.y)>Math.abs(o.down.y));}
assert.ok(pose(canopy,0,cal).accumulated.y<pose(cockpit,0,cal).accumulated.y);
const cap=module('engineCapL'),core=module('engineL');
const separation=time=>pose(cap,90,cal,time,1).x-pose(core,90,cal,time,1).x;
assert.ok(Math.abs(separation(100)-separation(200))>.01);
for(const angle of [0,90,180,270])for(const time of [0,57,123,340,750]){
 const idle=pose(core,angle,cal,time,1),still=pose(core,angle,cal,time,0),cover=pose(cap,angle,cal,time,1),coverStill=pose(cap,angle,cal,time,0);
 const coreTravel=Math.hypot(idle.x-still.x,idle.y-still.y),coverTravel=Math.hypot(cover.x-coverStill.x,cover.y-coverStill.y);
 assert.ok(coreTravel<2.5);assert.ok(Math.abs(coverTravel-coreTravel*.12)<1e-9);
 assert.equal(idle.depth,still.depth);
}
const legacy2=structuredClone(cal);legacy2.version=2;delete legacy2.shadow;for(const id of ['canopy','engineCapL','engineCapR'])delete legacy2.modules[id];
assert.equal(validate(legacy2).modules.cockpit.width,124);assert.ok(validate(legacy2).modules.canopy);assert.equal(validate(legacy2).shadow.y,38);
const badShadow=structuredClone(cal);badShadow.shadow.opacity=2;assert.throws(()=>validate(badShadow));
const old3=structuredClone(cal);old3.version=3;old3.modules.canopy.offsets.right.y=-18;old3.modules.canopy.offsets.down.y=-30;old3.modules.canopy.offsets.right.x=4;
const migrated=validate(old3);assert.equal(migrated.modules.canopy.offsets.up.y,-12);assert.equal(migrated.modules.canopy.offsets.right.y,-7.5);assert.equal(migrated.modules.canopy.offsets.down.y,-3);assert.equal(migrated.modules.canopy.offsets.right.x,4);assert.equal(migrated.hoverLift,28);
const badLift=structuredClone(cal);badLift.hoverLift=-1;assert.throws(()=>validate(badLift));
const old4=structuredClone(cal);old4.version=4;old4.modules.engineCapL.order.right=19;
assert.equal(validate(old4).modules.engineCapL.order.right,44);assert.ok(!('depthBlendDegrees' in validate(old4)));
console.log('PASS: fixed Z at every heading, cockpit above cowlings, offsets, split motion and migration');




