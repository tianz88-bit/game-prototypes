import assert from 'node:assert/strict';
import path from 'node:path';
import {build} from 'esbuild';
const files={layout:'src/render/hudLayout',policy:'src/tutorial/policy',tips:'src/tutorial/tipState',death:'src/render/shipDestruction',effects:'src/render/combatEffects',room:'server/src/room',world:'sim/world',protocol:'sim/protocol'};
const contents=Object.entries(files).map(([name,file])=>`export * as ${name} from ${JSON.stringify(path.resolve('prototypes/steroids-alpha',file+'.ts'))};`).join('\n');
const out=await build({stdin:{contents,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const S=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
for(let step=0;step<4;step++)for(const ready of [false,true])assert.deepEqual(S.policy.tutorialPolicy(step,ready),{shop:step===3||(step===1&&ready),minerals:step===1||step===3,fire:step===1||step===3,warp:step===3});
for(const x of [420,570,720])assert(S.policy.crossedTutorialGate({x:0,y:0},{x:800,y:0},{x,y:0},8000,8000));
assert(S.policy.crossedTutorialGate({x:7900,y:100},{x:200,y:100},{x:20,y:100},8000,8000));
assert(!S.policy.crossedTutorialGate({x:0,y:0},{x:800,y:0},{x:420,y:200},8000,8000));
for(const age of [0,200,400,600,799]){const a=S.death.shipDestructionPose(age),b=S.death.shipDestructionPose(age+1);assert(b.scale<=a.scale&&b.brightness<=a.brightness);assert(!a.finished);}
assert.deepEqual(S.death.shipDestructionPose(800),{progress:1,scale:.8200000000000001,brightness:.06000000000000005,finished:true});
assert.equal(S.death.SHIP_SMALL_BLASTS.length,5);
// This is the actual local room input path, not only the lesson's hidden buttons.
class Sock{sent=[];accept(){}send(x){this.sent.push(x)}close(){}addEventListener(){}}
for(const planet of ['tutorial','alpha']){
 const room=new S.room.Room();room.setPlanet(planet);room.setManualBots(true);room.setLockstep(true);
 const sock=new Sock();room.join(sock,'TEST');room.stop();const p=[...room.players.values()][0];
 room.setTutorialRules({shop:false,fire:false,minerals:false,warp:false});
 room.handleBuffer(p,S.protocol.encodeBuy(3,0));assert.equal(room.buys.length,planet==='tutorial'?0:1);room.buys=[];
 p.last={...p.last,fire:true,missile:true,mine:true,warp:true};p.queue=[{...p.last}];p.owedWarp=true;
 room.setTutorialRules({shop:false,fire:false,minerals:false,warp:false});
 assert.equal(p.last.fire,planet!=='tutorial');assert.equal(p.queue[0].missile,planet!=='tutorial');
 assert.equal(p.last.warp,planet!=='tutorial');assert.equal(p.owedWarp,planet!=='tutorial');assert.equal(room.sim.quiet.has(p.id),planet==='tutorial');
 room.sim.spillMinerals(100,100,20,10);assert.equal(room.sim.pickups.size>0,planet!=='tutorial');
 room.setTutorialRules({shop:true,fire:true,minerals:true});room.sim.spillMinerals(100,100,20,10);assert(room.sim.pickups.size>0);
 room.handleBuffer(p,S.protocol.encodeBuy(3,0));assert.equal(room.buys.length,1,'buy message allowed after the upgrade lesson');
}
// A collision still bounces the pilot, but only a gun hit mines the authored practice rock.
{
 const room=new S.room.Room();
 room.setPlanet('tutorial');
 const w=room.sim;
 const pilot=w.addShipNear(1,1000,1000,0);
 Object.assign(pilot,{heading:0,travelHeading:0,arrival:0,speed:220});
 const rockId=w.setTutorialRock(1050,1000,5);
 w.step();
 assert(w.asteroids.has(rockId),'collision cannot mine the practice rock');
 assert.equal(w.pickups.size,0);
 Object.assign(pilot,{x:750,y:1000,kx:0,ky:0});
 w.drain();
 for(let tick=0;tick<18&&w.asteroids.has(rockId);tick++){
  w.stepShip(1,{seq:tick,turn:0,aim:0,thrust:-1,dash:false,fire:true,missile:false,mine:false,warp:false});
  w.step();
 }
 assert(!w.asteroids.has(rockId),'a real gun shot mines the practice rock');
 assert.deepEqual([...w.pickups.values()].map(p=>[p.kind,p.value,p.x,p.y]),[['mineral',5,1050,1000]]);
 assert.equal(w.asteroids.size,0,'practice rock has no stray fragments');
}
const model=new S.tips.TipState(),state={hp:50,hullMax:50,shieldCd:0,overheated:false,missileTier:0,mineTier:0};
assert.equal(model.update(state,0,false),null);
assert.equal(model.update({...state,overheated:true},10,false,false),null,'hidden hints are not consumed');
assert.equal(model.update({...state,overheated:true},20,false),'overheat');
assert.equal(model.update({...state,missileTier:1},100,false),'overheat','one active hint at a time');
assert.equal(model.update(state,6000,false),null);assert.equal(model.update({...state,missileTier:1},7000,false),null,'reading gap');
assert.equal(model.update({...state,missileTier:1},10000,false),'missile');
const restored=new S.tips.TipState([...model.seen]);assert.equal(restored.update({...state,overheated:true,missileTier:1},0,false),null,'seen hints stay quiet across runs');
const calls=[],g=new Proxy({},{get:(_,name)=>(...args)=>{calls.push({name,args});return g}});
S.effects.drawRamAttack(g,{x:0,y:0,scale:1},0,100,25,0);
assert(calls.filter(c=>c.name==='fillPoints').length>=20,'thick pressure ribbons and swept fragments');
assert(!calls.some(c=>c.name==='fillTriangle'||c.name==='lineBetween'),'ram VFX has no HUD arrow or chevron');
for(const [w,h] of [[844,390],[640,360],[568,320],[480,600]]){
 const controls=S.layout.flightControls(w,h,34,46,46),boxes=Object.values(controls);
 for(const b of boxes){assert(b.hw*2>=44&&b.hh*2>=44);assert(b.x-b.hw>=0&&b.x+b.hw<=w&&b.y-b.hh>=0&&b.y+b.hh<=h);}
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(Math.abs(a.x-b.x)>=a.hw+b.hw||Math.abs(a.y-b.y)>=a.hh+b.hh,'independent combat hit areas');}
}
console.log('PASS: tutorial stage gates, room-held weapon suppression, online isolation, staged mineral drops, swept multi-ring/wrapped crossing, orange bow cue and 800ms collapse');
