import assert from 'node:assert/strict';
import path from 'node:path';
import {build} from 'esbuild';
const files={policy:'src/tutorial/policy',death:'src/render/shipDestruction',effects:'src/render/combatEffects',room:'server/src/room',world:'sim/world',protocol:'sim/protocol'};
const contents=Object.entries(files).map(([name,file])=>`export * as ${name} from ${JSON.stringify(path.resolve('prototypes/steroids-alpha',file+'.ts'))};`).join('\n');
const out=await build({stdin:{contents,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const S=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
for(let step=0;step<14;step++)assert.deepEqual(S.policy.tutorialPolicy(step),{shop:step>=8,minerals:step>=5,fire:step!==3});
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
 room.setTutorialRules({shop:false,fire:false,minerals:false});
 room.handleBuffer(p,S.protocol.encodeBuy(3,0));assert.equal(room.buys.length,planet==='tutorial'?0:1);room.buys=[];
 p.last={...p.last,fire:true,missile:true,mine:true};p.queue=[{...p.last}];
 room.setTutorialRules({shop:false,fire:false,minerals:false});
 assert.equal(p.last.fire,planet!=='tutorial');assert.equal(p.queue[0].missile,planet!=='tutorial');
 room.sim.spillMinerals(100,100,20,10);assert.equal(room.sim.pickups.size>0,planet!=='tutorial');
 room.setTutorialRules({shop:true,fire:true,minerals:true});room.sim.spillMinerals(100,100,20,10);assert(room.sim.pickups.size>0);
 room.handleBuffer(p,S.protocol.encodeBuy(3,0));assert.equal(room.buys.length,1,'buy message allowed after the upgrade lesson');
}
const calls=[],g=new Proxy({},{get:(_,name)=>(...args)=>{calls.push({name,args});return g}});
S.effects.drawRamAttack(g,{x:0,y:0,scale:1},0,100,25,0);
assert(calls.some(c=>c.name==='lineStyle'&&c.args[1]===0xff913d));
assert(calls.filter(c=>c.name==='lineBetween').every(c=>c.args[0]>90&&c.args[2]>90),'attack envelope is ahead of the bow');
console.log('PASS: tutorial stage gates, room-held weapon suppression, online isolation, staged mineral drops, swept multi-ring/wrapped crossing, orange bow cue and 800ms collapse');
