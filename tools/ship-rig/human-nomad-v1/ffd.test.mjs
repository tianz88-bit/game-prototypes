import assert from 'node:assert/strict';
import {tiltPoint,relief,projectPanelPoint} from './ffd.mjs';
import {modules,seed,pose} from './rig.mjs';
assert.deepEqual(tiltPoint(15,-27,0,0,0),{x:15,y:-27});
for(const m of modules.filter(m=>['gun','cockpit-canopy','booster-core'].includes(m.asset)))assert.equal(relief(m,.5,.5),0);
const us=[0,.22,.5,.78,1],vs=[0,.2,.45,.75,1],cal=seed();
const area=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
for(const heading of [0,45,90,135,180,225,270,315])for(const pitch of [-45,-24,0,24,45])for(const bank of [-45,0,45])for(const m of modules){
 const p=pose(m,heading,cal),points=vs.map(v=>us.map(u=>projectPanelPoint(m,u,v,m.width,m.width*1.8,p,pitch,bank)));
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
  const a=points[y][x],b=points[y][x+1],c=points[y+1][x],d=points[y+1][x+1];
  assert.ok(area(a,b,d)>0&&area(a,d,c)>0,'No folded mesh triangles over control range');
 }
}
console.log('PASS: level identity, rigid glass/guns/cores, finite unfolded tilt meshes at all headings and control extremes');
