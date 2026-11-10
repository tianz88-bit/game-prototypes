import assert from 'node:assert/strict';
import {flightSeed,advanceFlight,recoilPose} from './flight-motion.mjs';
import {bodyTiltPoint} from './ffd.mjs';
const run=(s,input,seconds)=>{for(let t=0;t<seconds;t+=1/60)s=advanceFlight(s,input,1/60);return s;};
assert.deepEqual(run(flightSeed(),{},2),{speed:0,pitch:0,bank:0,yawDelta:0});
let state=run(flightSeed(),{accelerate:true},1);assert.ok(state.speed>150&&state.pitch< -12);
state=run(state,{brake:true},.3);assert.ok(state.speed<100&&state.pitch>14);
assert.equal(run(state,{brake:true},3).speed,0);
state=run(flightSeed(),{right:true},.5);assert.ok(state.bank< -21&&state.yawDelta>0);
const left=run(flightSeed(),{left:true},.5);assert.ok(left.bank>21&&left.yawDelta<0);
state=run(state,{},1);assert.ok(Math.abs(state.bank)<.01&&Math.abs(state.pitch)<.01);
assert.equal(run(flightSeed(),{accelerate:true},10).speed,300);
// Heading-relative tilt is rotation-equivariant.
const q=bodyTiltPoint(50,100,0,-13,22,0),r=bodyTiltPoint(-100,50,0,-13,22,90);
assert.ok(Math.abs(q.x-r.y)<1e-9&&Math.abs(q.y+r.x)<1e-9);
assert.deepEqual(recoilPose(-1),{kick:0,scaleX:1,scaleY:1});
assert.deepEqual(recoilPose(600),{kick:0,scaleX:1,scaleY:1});
assert.ok(recoilPose(25).kick>20&&recoilPose(25).scaleX>1.15&&recoilPose(25).scaleY<.8);
assert.ok(Array.from({length:600},(_,i)=>recoilPose(i).scaleY).some(v=>v>1),'Return must stretch');
for(let i=0;i<600;i++){const r=recoilPose(i);assert.ok(r.scaleX>.7&&r.scaleY>.6&&r.scaleX<1.4&&r.scaleY<1.4);}
console.log('PASS: level idle, thrust/brake pitch, yaw bank and release, speed bounds, heading-relative tilt and exaggerated recoil');
