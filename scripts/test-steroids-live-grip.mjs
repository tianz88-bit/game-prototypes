import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:`export * from './prototypes/steroids-alpha/sim/ship';export * from './prototypes/steroids-alpha/sim/chassis';export * from './prototypes/steroids-alpha/sim/protocol';export * from './prototypes/steroids-alpha/sim/wrap';export * from './prototypes/steroids-alpha/sim/shop';export {World} from './prototypes/steroids-alpha/sim/world';export {TUNE} from './prototypes/steroids-alpha/sim/tune';export {defaultConfig,validateConfig} from './prototypes/steroids-alpha/sim/liveConfig';export * from './prototypes/steroids-alpha/src/render/hangarStats';export {stepGrip,newGripState} from './prototypes/steroids-alpha-lab/speed-grip';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',write:false});
const S=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const t=structuredClone(S.TUNE),plain=structuredClone(t);plain.grip.enabled=0;
const dt=1/t.net.tickHz,idle={seq:0,turn:0,aim:NaN,thrust:0,dash:false,fire:false,missile:false,mine:false,warp:false};
const near=(a,b,eps=1e-8)=>assert(Math.abs(a-b)<eps,`${a} vs ${b}`);
const fresh=(c,power=t.ship.maxHp)=>Object.assign(S.newShip(2000,2000,0,S.topSpeed(power,t,c)),{chassis:c,hp:power,hullMax:power,shield:S.maxShield({chassis:c,shieldTier:0},t)});
const evidence=[];
for(const c of[0,1,2,3])for(const power of[t.ship.maxHp,t.ship.powerCap]){
 const a=fresh(c,power),b=S.copyShip(a),lab=S.copyShip(a),state=S.newGripState(lab);
 for(let tick=0;tick<40;tick++){
  const input={...idle,turn:1,thrust:1,fire:true},before=S.copyShip(lab);
  S.stepShip(a,input,dt,t);S.stepShip(b,input,dt,plain);S.stepShip(lab,input,dt,plain);S.stepGrip(state,lab,before,t);
  near(a.heading,b.heading);near(a.speed,b.speed);near(a.x,lab.x);near(a.y,lab.y);near(a.travelHeading,state.travel);
  assert(Math.abs(S.angleDelta(a.heading,a.travelHeading))<=24*Math.PI/180+1e-9);
 }
 const fast=Math.abs(S.angleDelta(a.heading,a.travelHeading))*180/Math.PI;
 for(let tick=0;tick<6;tick++)S.stepShip(a,{...idle,turn:1,thrust:-1},dt,t);
 const braking=Math.abs(S.angleDelta(a.heading,a.travelHeading))*180/Math.PI;assert(braking<4);
 const cruise=fresh(c,power);cruise.speed=Math.max(S.shipMotion(c,t).minSpeed,S.topSpeed(power,t,c)*S.shipMotion(c,t).cruiseSpeed/S.shipMotion(c,t).maxSpeed);
 for(let tick=0;tick<40;tick++)S.stepShip(cruise,{...idle,turn:1},dt,t);
 assert(fast>Math.abs(S.angleDelta(cruise.heading,cruise.travelHeading))*180/Math.PI+3);
 // Float32 authoritative snapshots retain travel; pending-input replay converges after ack.
 const snap=S.decodeServer(S.encodeSnapshot(4,4,[{id:1,...a}]));assert(snap&&snap.ships.length===1);near(snap.ships[0].travelHeading,a.travelHeading,1e-6);
 const auth=S.copyShip(a),replay=S.copyShip(snap.ships[0]);
 for(let tick=0;tick<30;tick++){const i={...idle,turn:tick<15?-1:1,thrust:tick<10?1:-1};S.stepShip(auth,i,dt,t);S.stepShip(replay,i,dt,t);}
 assert(Math.hypot(S.wrapDelta(auth.x,replay.x,t.world.width),S.wrapDelta(auth.y,replay.y,t.world.height))<.002);
 near(auth.travelHeading,replay.travelHeading,1e-6);
 evidence.push({chassis:c,power,fastSlip:fast,brakeSlip:braking});
}
assert.equal(S.decodeServer(new ArrayBuffer(11+103)),null,'old/truncated snapshot rejected');
for(const mode of['arrival','warp','dock']){
 const a=fresh(0);a.travelHeading=-.4;
 if(mode==='arrival')a.arrival=2;if(mode==='warp')a.warping=true;
 S.stepShip(a,{...idle,turn:1},dt,t,mode==='dock'?0:undefined);near(a.travelHeading,a.heading);
}
// Knockback is independent of grip; velocity used for leading follows actual travel.
{const a=fresh(0);a.kx=100;a.ky=-70;const before=S.copyShip(a);S.stepShip(a,{...idle,turn:1},dt,t);
 near(a.x-before.x,(Math.cos(a.travelHeading)*a.speed+100)*dt);near(a.y-before.y,(Math.sin(a.travelHeading)*a.speed-70)*dt);
 const v=S.shipVelocity(a);near(v.vx,Math.cos(a.travelHeading)*a.speed+a.kx);near(v.vy,Math.sin(a.travelHeading)*a.speed+a.ky);
}
// Shared authority emits from the corrected mount without a lab/private-field repair.
{const w=new S.World(t,()=>.4);w.asteroids.clear();const a=w.addShip(1);Object.assign(a,fresh(0),{travelHeading:-.3,arrival:0});
 const prediction=S.copyShip(a),i={...idle,turn:1,fire:true};S.stepShip(prediction,i,dt,t);w.stepShip(1,i);
 near(a.x,prediction.x);near(a.y,prediction.y);near(a.heading,prediction.heading);near(a.travelHeading,prediction.travelHeading);
 const shot=w.drain().shots[0],expected=S.muzzleShot(prediction,t,[]);near(shot.x,expected.x);near(shot.y,expected.y);near(shot.vx,expected.vx);near(shot.vy,expected.vy);
}
// Capped regeneration keeps the delay, has a percentage rate for small pools and no capacity loophole.
for(const c of[0,1,2,3])for(const tier of[0,4]){
 const w=new S.World(t,()=>.4);w.asteroids.clear();const a=w.addShip(1);Object.assign(a,fresh(c),{shieldTier:tier,shield:0,shieldCd:1,arrival:0});
 const rate=Math.min(S.maxShield(a,t)*.35,25);near(S.shieldRegen(a,t),rate);
 for(let n=0;n<15;n++)w.step();near(a.shield,0);
 a.shieldCd=0;for(let n=0;n<30;n++)w.step();near(a.shield,rate,1e-6);
}
{const a=fresh(0,400);Object.assign(a,{turrets:1,damageTier:4,shieldTier:4});assert(!S.canEvolve(a,t));a.turrets=2;a.damageTier=3;assert(!S.canEvolve(a,t));a.damageTier=4;assert(S.canEvolve(a,t));assert(S.evolve(a,t));assert.equal(a.turrets,2);assert.equal(a.damageTier,4);assert.equal(S.chassisStats(a.chassis,t).baseTurrets,2);}
// Old hosted records adopt new fields while preserving the owner's published values.
{const old=S.defaultConfig();delete old.tune.grip;delete old.tune.ship.shieldRegenCapPerSecond;delete old.tune.battlecruiser.minTurrets;delete old.tune.battlecruiser.minGuns;old.tune.ship.maxHp=55;const upgraded=S.validateConfig(old);assert.equal(upgraded.tune.ship.maxHp,55);assert.equal(upgraded.tune.grip.enabled,1);assert.equal(upgraded.tune.ship.shieldRegenCapPerSecond,25);assert.equal(upgraded.tune.battlecruiser.minGuns,4);}
for(const c of[0,1,2,3]){
 const a=fresh(c);a.speed=0;let shots=0;
 for(let tick=0;tick<10000&&!a.overheated;tick++){const before=a.shots;S.stepShip(a,{...idle,fire:true},dt,t);if(a.shots!==before)shots++;}
 const stats=S.shipStats(c,t);assert.equal(stats[4].value,a.overheated?shots:Infinity,'Hangar ammo matches actual shots');
 assert(S.shipStatBars(c,t).every(r=>r.fill>=0&&r.fill<=1));
}
for(const field of['slowTau','maxSlipDeg','enabled']){const bad=S.defaultConfig();bad.tune.grip[field]=field==='slowTau'?0:100;assert.throws(()=>S.validateConfig(bad));}
console.log(JSON.stringify(evidence));console.log('PASS live grip: 8 chassis/power cases, unchanged aiming/speed, lab travel parity, brake recovery, snapshot replay, muzzle/lead, arrival/warp/dock/knockback; shield caps, evolution gates, config upgrade and actual Hangar ammo.');
