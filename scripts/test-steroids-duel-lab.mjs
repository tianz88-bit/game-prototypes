import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:"export * from './prototypes/steroids-alpha-lab/duel-model'; export {TUNE} from './prototypes/steroids-alpha/sim/tune'; export {cornerFactor,shipRadius} from './prototypes/steroids-alpha/sim/ship'; export {shipMotion} from './prototypes/steroids-alpha/sim/chassis';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const S=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const original=JSON.stringify(S.TUNE),evidence={turns:[],impacts:[]};
for(const chassis of [0,1,2,3]){
 const m=new S.DuelModel('circle','candidate',chassis),s=m.pilots[0],motion=S.shipMotion(chassis,m.tune);
 const radius=v=>v/(motion.turnRate*S.cornerFactor({...s,speed:v},m.tune));
 const radii={min:radius(motion.minSpeed),cruise:radius(motion.cruiseSpeed),max:radius(motion.maxSpeed)};
 assert(radii.cruise<radii.min&&radii.cruise<radii.max,'cruise is tightest across every chassis');evidence.turns.push({chassis,...radii});
 const b=new S.DuelModel('tail','baseline',chassis),c=new S.DuelModel('tail','candidate',chassis);assert.deepEqual(b.pilots,c.pilots,'identical reset state for A/B comparisons');assert.equal(b.tune.ship.turnAtMinSpeed,S.TUNE.ship.turnAtMinSpeed);
 for(let tick=0;tick<180;tick++)m.step({...S.idle(),turn:-1});assert(m.pilots.every(s=>Number.isFinite(s.x+s.y+s.kx+s.ky)));
}
function collide(handling,ram,glance=false){const m=new S.DuelModel('tail',handling),[a,b]=m.pilots;Object.assign(a,{x:2000,y:2000,heading:0,speed:350,dashTime:ram?.5:0});Object.assign(b,{x:2045,y:glance?2022:2000,heading:Math.PI,speed:350});m.step(S.idle(),S.idle());return m;}
for(const ram of [false,true])for(const glance of [false,true]){
 const b=collide('baseline',ram,glance),c=collide('candidate',ram,glance),[a,z]=c.pilots;
 const separation=Math.hypot(a.x-z.x,a.y-z.y);assert(separation>=S.shipRadius(a.hullMax,c.tune,a.chassis)+S.shipRadius(z.hullMax,c.tune,z.chassis),'contacts resolve penetration');assert(a.kx<0&&z.kx>0,'opposite normal impulses');
 assert.deepEqual(c.pilots.map(s=>[s.hp,s.shield]),b.pilots.map(s=>[s.hp,s.shield]),'damage unchanged on impact');
 if(ram){assert.equal(a.dashTime,0);assert.equal(a.dashCharge,0);assert(a.speed+a.kx<0,'head-on attacker genuinely reverses');}
 evidence.impacts.push({ram,glance,separation,kicks:c.pilots.map(s=>[s.kx,s.ky]),damage:c.pilots.map(s=>[s.hp,s.shield])});
}
// A rear ram must recoil despite its former dash speed.
{
 const m=new S.DuelModel('tail','candidate'),[a,b]=m.pilots;Object.assign(a,{x:2000,y:2000,heading:0,speed:630,dashTime:.5});Object.assign(b,{x:2050,y:2000,heading:0,speed:260});m.step(S.idle(),S.idle());assert(a.speed+a.kx<0);assert(b.kx>0);assert.equal(m.ramHits,1);
 const shields=m.pilots.map(s=>s.shield);m.step(S.idle(),S.idle());assert.equal(m.ramHits,1,'same dash cannot ram twice');assert.deepEqual(m.pilots.map(s=>s.shield),shields,'no repeated bump immediately after recoil');
}
// Preserve tangent velocity, handle exact overlap, swept crossing and toroidal seam.
for(const seam of [false,true]){
 const m=new S.DuelModel('tail','candidate'),[a,b]=m.pilots;Object.assign(a,{x:seam?3995:2000,y:2000,heading:0,speed:260,kx:0,ky:70});Object.assign(b,{x:seam?15:2020,y:2000,heading:0,speed:260,kx:0,ky:70});const pa={...a},pb={...b};S.pushApart(a,b,pa,pb,m.tune,true);assert.equal(a.ky,70);assert.equal(b.ky,70);assert(Number.isFinite(a.x+b.x));
 const n=S.contactNormal({...a,x:70},{...b,x:50},{...pa,x:0},{...pb,x:100},m.tune);assert(n.x>.99,'swept normal keeps original side after crossing');
}
const solo=new S.DuelModel('tail','candidate');Object.assign(solo.pilots[1],{x:solo.pilots[0].x,y:solo.pilots[0].y});solo.step(S.idle(),S.idle());assert(solo.pilots.every(s=>Number.isFinite(s.x+s.y+s.kx+s.ky)));
assert.equal(JSON.stringify(S.TUNE),original,'preview cannot mutate production tuning');
console.log(JSON.stringify(evidence));console.log('PASS: duel reset parity, all chassis cruise radii, genuine ram recoil, opposed impulses, damage parity, no repeat hit, wrap/tangent/swept safety and immutable live tune.');
