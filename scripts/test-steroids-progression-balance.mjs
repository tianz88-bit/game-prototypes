// Progression ceiling and independent-wallet authority checks. No browser/capture or live writes.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:"export * from './prototypes/steroids-alpha/sim/ship';export * from './prototypes/steroids-alpha/sim/shop';export * from './prototypes/steroids-alpha/sim/chassis';export * from './prototypes/steroids-alpha/sim/liveConfig';export {World} from './prototypes/steroids-alpha/sim/world';export {TUNE} from './prototypes/steroids-alpha/sim/tune';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const S=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64')),t=structuredClone(S.TUNE),dt=1/t.net.tickHz;
const input={seq:0,turn:0,aim:NaN,thrust:0,dash:false,fire:true,missile:false,mine:false,warp:false};
function fighter(chassis=3,tier=0){const s=S.newShip(1000,1000,0,260);Object.assign(s,{chassis,hp:t.ship.maxHp,hullMax:t.ship.maxHp,shieldTier:tier,damageTier:tier,turrets:tier});s.shield=S.maxShield(s,t);return s;}
function measure(chassis,tier){const s=fighter(chassis,tier);let shots=0;for(let i=0;i<60*t.net.tickHz;i++){const n=s.shots;S.stepShip(s,input,dt,t);shots+=s.shots!==n?1:0;}const primary=shots*t.weapon.damage*S.damageScale(s,t)/60,automatic=tier*t.turret.damage*t.net.tickHz/t.turret.fireIntervalSteps;return{chassis,tier,hull:S.hullCapacity(s,t),shield:S.maxShield(s,t),primaryDps60:primary,automaticDps:automatic,ehp:S.hullCapacity(s,t)+S.maxShield(s,t),dps:primary+automatic};}
const fresh=measure(3,0),max=[0,1,3].map(c=>measure(c,4)),indices=max.map(a=>a.ehp/fresh.ehp*a.dps/fresh.dps),ceiling=Math.max(...indices);
assert(ceiling>=1.7&&ceiling<=1.8,'owner target about +75% on primary+automatic sustained DPS × durability');
assert.deepEqual([0,1,3].map(c=>fighter(c).shield),[75,52.5,75]);
for (const tier of [0,4]) {
 assert.equal(measure(1,tier).primaryDps60,measure(0,tier).primaryDps60,'Bat and Falcon share primary DPS');
}
assert.equal(S.shipMotion(1,t).turnRate,S.shipMotion(0,t).turnRate*1.7);
assert.equal(S.maxShield({chassis:2,shieldTier:0},t),125);
assert.equal(S.maxShield({chassis:4,shieldTier:0},t),125);
const total=S.SHOP_ITEMS.reduce((n,k)=>n+t.shop[k+'Costs'].reduce((a,b)=>a+b,0),0);assert.equal(total,50);
assert.equal(S.mineralBalance({hullMax:54.999996185302734},t),5,'Float32 money survives exact-price boundaries');
const full=fighter();full.hullMax+=total;full.hp=20;for(const item of S.SHOP_ITEMS)for(let tier=0;tier<4;tier++)assert(S.buy(full,item,tier,t));assert.equal(S.mineralBalance(full,t),0);assert.equal(full.hp,20);assert.equal(S.hullCapacity(full,t),50);
for(const build of[0,1]){const s=fighter();s.hullMax+=23;const wants=build?{missile:4,mine:2}:{turret:2,damage:4};for(const[item,count]of Object.entries(wants))for(let i=0;i<count;i++)assert(S.buy(s,item,i,t));assert.equal(S.mineralBalance(s,t),10);assert(S.canEvolve(s,t,build));assert(S.evolve(s,t,build));assert.equal(S.mineralBalance(s,t),0);assert.equal(s.hp,50);assert(!S.evolve(s,t,build));}
const w=new S.World(t,()=>.5);w.asteroids.clear();const s=w.addShip(1);Object.assign(s,{x:1000,y:1000,arrival:0,hp:50,hullMax:80,shield:0});w.drain();w.damageShip(1,s,10,2,s.x,s.y);assert.equal(s.hp,40);assert.equal(S.mineralBalance(s,t),28.8);assert.equal(w.drain().pickups.filter(p=>p.kind==='mineral').reduce((n,p)=>n+p.value,0),1.2);w.damageShip(1,s,100,2,s.x,s.y);const death=w.drain().pickups.filter(p=>p.kind==='mineral').reduce((n,p)=>n+p.value,0);assert(Math.abs(death-14.4)<1e-8,'death drops wallet share, never base health: '+death+' '+JSON.stringify({hp:s.hp,cash:S.mineralBalance(s,t)}));
const mined=fighter();w.ships.set(3,mined);mined.hp=25;mined.shield=10;w.pickups.clear();w.pickups.set(99,{id:99,kind:'mineral',x:mined.x,y:mined.y,value:400,from:0,lockedUntil:0,expires:9999,salvage:0});w.step();assert.equal(mined.hp,25);assert.equal(S.hullCapacity(mined,t),50);assert.equal(S.mineralBalance(mined,t),400);assert(mined.shield<11);
w.pickups.set(100,{id:100,kind:'heal',x:mined.x,y:mined.y,value:0,from:0,lockedUntil:0,expires:9999,salvage:0});w.step();assert.equal(mined.hp,37.5,'repair pod heals actual hull');
const smallSpill = fighter();
Object.assign(smallSpill,{hullMax:t.ship.maxHp+.6,shield:0});
w.ships.set(4,smallSpill);
w.drain();
w.damageShip(4,smallSpill,5,2,smallSpill.x,smallSpill.y);
assert.equal(S.mineralBalance(smallSpill,t),0);
assert.deepEqual(w.drain().pickups.filter(p=>p.kind==='mineral').map(p=>p.value),[.6]);
const old=S.defaultConfig();delete old.tune.shop.balanceVersion;old.tune.shop.damagePerTier=.25;old.tune.shop.shieldPerTier=60;old.tune.turret.damage=2;old.tune.battlecruiser.powerFloor=300;old.clientTune.render.hoverLightY=98;const migrated=S.validateConfig(old);assert.deepEqual(migrated.tune.shop,t.shop);assert.equal(migrated.tune.turret.damage,.8);assert.equal(migrated.tune.battlecruiser.powerFloor,10);assert.equal(migrated.clientTune.render.hoverLightY,98,'art calibration survives balance migration');migrated.tune.shop.turretCosts[0]=2;migrated.tune.shop.turretFloors[0]=2;assert.equal(S.validateConfig(migrated).tune.shop.turretCosts[0],2,'later owner price edits survive');
const previous = S.defaultConfig();
previous.tune.shop.balanceVersion = 2;
previous.tune.interceptor.damageFactor = .85;
previous.tune.shop.damageCosts = [5,10,15,20];
previous.tune.battlecruiser.cost = previous.tune.battlecruiser.powerFloor = 50;
delete previous.tune.ship.fighterShieldBonus;
previous.tune.asteroid.miningMineralFactor = .7;
const revised = S.validateConfig(previous);
assert.deepEqual(revised.tune.shop.damageCosts,[1,2,3,4]);
assert.equal(revised.tune.ship.fighterShieldBonus,25);
assert.equal(revised.tune.asteroid.miningMineralFactor,.18);
assert.equal(revised.tune.battlecruiser.cost,10);
assert.equal(revised.tune.interceptor.damageFactor,1);
revised.tune.interceptor.damageFactor = 1.1;
assert.equal(S.validateConfig(revised).tune.interceptor.damageFactor,1.1);
console.log('PASS progression balance',JSON.stringify({fresh,max,indices,ceiling,shopTotal:total,evolutionPath:23,scope:'primary+automatic throughput × hull+shield; excludes aiming, regen, missiles/mines and cruiser roles'}));


