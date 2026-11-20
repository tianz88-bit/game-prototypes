// Progression ceiling and independent-wallet authority checks. No browser/capture or live writes.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:"export * from './prototypes/steroids-alpha/sim/ship';export * from './prototypes/steroids-alpha/sim/shop';export * from './prototypes/steroids-alpha/sim/levels';export * from './prototypes/steroids-alpha/sim/chassis';export * from './prototypes/steroids-alpha/sim/liveConfig';export {World} from './prototypes/steroids-alpha/sim/world';export {TUNE} from './prototypes/steroids-alpha/sim/tune';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
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
// --- Run levels (owner, 19 November 2026): collected minerals are XP, never spent; each level offers
// three cards; owned evolutions are guaranteed cards once ready; minerals carried out bank. ---
assert.equal(t.shop.levelUp,1,'run levels are the live progression');
assert.equal(S.levelStep(1,t),t.shop.levelXpBase);
assert.equal(S.xpForLevel(20,t),20*t.shop.levelXpBase+t.shop.levelXpGrowth*190,'level curve: base + growth per level');
assert.equal(S.levelsEarned(S.xpForLevel(5,t),t),5);assert.equal(S.levelsEarned(S.xpForLevel(5,t)-.01,t),4);
for(let n=0;n<20;n++)assert(S.walletCap({picks:n},t)-t.ship.maxHp>S.xpForLevel(n+1,t),`hold at level ${n} stays ahead of the next level`);
{
 const w=new S.World(t,()=>.5);w.asteroids.clear();const s=w.addShip(1);Object.assign(s,{x:1000,y:1000,arrival:0,shield:0});w.drain();
 assert.equal(w.buy(1,2,0),false,'the mineral shop is closed while run levels are on');
 w.pickups.set(1,{id:1,kind:'mineral',x:s.x,y:s.y,value:30,from:0,lockedUntil:0,expires:9999});w.step();
 assert.equal(S.mineralBalance(s,t),30,'collected minerals are carried');assert.equal(s.xp,30,'and count as XP');
 assert.equal(S.pendingPicks(s,t),3,'30 XP earns three levels');
 w.step();const offer=w.cards.get(1);assert.equal(offer.length,3,'three cards');assert.equal(new Set(offer).size,3,'no repeats');
 assert(offer.every(c=>c>=0&&c<5),'no evolution card without an owned evolution');
 const before={damage:s.damageTier,turrets:s.turrets,shield:s.shieldTier,missile:s.missileTier,mine:s.mineTier};
 assert(w.pick(1,offer[0]),'pick a card');assert.equal(s.picks,1);assert.equal(S.mineralBalance(s,t),30,'picking spends nothing');
 assert.equal(S.upgradeTotal(s),1,'one upgrade applied');assert(!w.pick(1,offer[1]),'the old offer is gone');
 w.step();assert.equal(w.cards.get(1).length,3,'the next waiting level draws new cards');
 s.hullMax=S.walletCap(s,t)-1;w.pickups.set(2,{id:2,kind:'mineral',x:s.x,y:s.y,value:20,from:0,lockedUntil:0,expires:9999});const xp=s.xp;w.step();
 assert.equal(s.hullMax,S.walletCap(s,t),'the hold caps what is carried');near(s.xp-xp,1,1e-6,'XP counts only what fitted');
}
{
 const w=new S.World(t,()=>.5);w.asteroids.clear();const s=w.addShip(1);Object.assign(s,{x:1000,y:1000,arrival:0,shield:0,turrets:2,damageTier:4,xp:S.xpForLevel(7,t),picks:6});w.drain();
 w.evolutionsOwned.set(1,[0]);w.step();assert(w.cards.get(1).includes(10),'an owned, ready evolution is a guaranteed card');
 const wallet=S.mineralBalance(s,t);assert(w.pick(1,10));assert.equal(s.chassis,S.BATTLECRUISER);assert.equal(S.mineralBalance(s,t),wallet,'evolving costs no minerals');
 const w2=new S.World(t,()=>.5);w2.asteroids.clear();const u=w2.addShip(1);Object.assign(u,{turrets:2,damageTier:4,xp:S.xpForLevel(7,t),picks:6});w2.step();
 assert(!w2.cards.get(1).includes(10),'an evolution not owned is never offered');
 {let a=7;const rnd=()=>((a=(a*16807)%2147483647)-1)/2147483646,seen=[0,0,0,0,0];for(let i=0;i<3000;i++)for(const c of S.drawCards({...S.newShip(0,0,0,0),hp:50},[1],t,rnd))seen[c]++;assert(seen[3]>seen[0]*1.2&&seen[4]>seen[1]*1.2,`tracks an owned evolution needs are offered more often: ${seen}`);}
}
assert.equal(S.bankedMinerals({hullMax:t.ship.maxHp+123.7},t,false),123,'whole minerals bank from ordinary planets');
assert.equal(S.bankedMinerals({hullMax:t.ship.maxHp+123.7},t,true),0,'clan home planets bank nothing');
// Haul bonus (owner, 20 November 2026): +10% of the bank per full minute after 3:00, up to +50%.
assert.deepEqual([0,179,180,239,240,300,480,9999].map(x=>Math.round(S.haulBonus(x,t)*100)),[0,0,0,0,10,20,50,50]);
assert.equal(S.bankedMinerals({hullMax:t.ship.maxHp+100},t,false,300),120,'staying 5 minutes banks +20%');
assert.equal(S.bankedMinerals({hullMax:t.ship.maxHp+100},t,true,600),0,'home planets still bank nothing');
assert.deepEqual([100,180,200,470,480].map(x=>Math.round(S.haulBonusNext(x,t))),[140,60,40,10,0],'countdown to the next step, none once capped');
{
 const w=new S.World(t,()=>.5);w.asteroids.clear();const s=w.addShip(1);Object.assign(s,{x:1000,y:1000,arrival:0,hp:50,hullMax:80,shield:0,picks:20});w.drain();
 w.damageShip(1,s,10,2,s.x,s.y);assert.equal(s.hp,40);assert.equal(S.mineralBalance(s,t),30-10*t.ship.hullSpillFraction,'hull hits spill minerals');
 w.drain();w.damageShip(1,s,100,2,s.x,s.y);const drop=w.drain().pickups.filter(p=>p.kind==='mineral').reduce((n,p)=>n+p.value,0);
 near(drop,30-10*t.ship.hullSpillFraction,1e-6,'a destroyed ship drops everything it carried');
 assert.equal(w.drain().pickups.filter(p=>p.kind==='salvage').length,0,'no separate kill payout');
}
for(const version of[undefined,2,3,4]){const old=S.defaultConfig();if(version===undefined)delete old.tune.shop.balanceVersion;else old.tune.shop.balanceVersion=version;Object.assign(old.tune.shop,{levelUp:0,damageCosts:[1,2,3,4]});old.tune.asteroid.miningMineralFactor=.18;old.tune.warp.lockdownSeconds=180;old.tune.salvage.killPowerShare=.5;
 const m=S.validateConfig(old);assert.deepEqual(m.tune.shop,t.shop,`epoch ${version} adopts the run economy`);assert.equal(m.tune.asteroid.miningMineralFactor,t.asteroid.miningMineralFactor);assert.equal(m.tune.warp.lockdownSeconds,t.warp.lockdownSeconds);assert.equal(m.tune.salvage.killPowerShare,0);}
{const later=S.defaultConfig();later.tune.interceptor.damageFactor=1.1;later.tune.shop.levelXpGrowth=4;const kept=S.validateConfig(later);assert.equal(kept.tune.interceptor.damageFactor,1.1);assert.equal(kept.tune.shop.levelXpGrowth,4,'edits at the current epoch survive');}
function near(a,b,e,m){assert(Math.abs(a-b)<=e,`${m}: ${a} vs ${b}`);}
console.log('PASS progression balance',JSON.stringify({fresh,max,indices,ceiling,levels:{xpFor20:S.xpForLevel(20,t),hold20:S.walletCap({picks:20},t)-t.ship.maxHp},scope:'primary+automatic throughput × hull+shield; excludes aiming, regen, missiles/mines and cruiser roles'}));
