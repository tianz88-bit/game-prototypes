import assert from 'node:assert/strict';import{build}from'esbuild';import fs from'node:fs';
const r=await build({stdin:{contents:"export * from './prototypes/steroids-alpha/sim/world'; export {Room} from './prototypes/steroids-alpha/server/src/room'; export * from './prototypes/steroids-alpha/sim/ship'; export * from './prototypes/steroids-alpha/sim/shop'; export * from './prototypes/steroids-alpha/sim/chassis'; export * from './prototypes/steroids-alpha/sim/turrets'; export * from './prototypes/steroids-alpha/sim/protocol'; export {TUNE} from './prototypes/steroids-alpha/sim/tune'; export * from './prototypes/steroids-alpha/sim/liveConfig';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});const S=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));const t=structuredClone(S.TUNE);t.asteroid.max=0;t.warp.arrivalSeconds=0;const idle={seq:0,turn:0,aim:NaN,thrust:0,dash:false,fire:false,missile:false,mine:false,warp:false},dt=1/t.net.tickHz;
function world(){const w=new S.World(t,()=>.5);w.asteroids.clear();return w;}function ship(w,id,x=1500,y=1500,chassis=4){const s=S.newShip(x,y,0,0);Object.assign(s,{hp:5000,hullMax:5000,shield:0,chassis,arrival:0,missileTier:4,mineTier:2,missileCharges:8,lockdown:0});w.ships.set(id,s);return s;}
{const w=world(),s=ship(w,1);s.chassis=3;s.hp=s.hullMax=500;assert(!w.buy(1,5,9));assert(!w.buy(1,5,-1));s.mineTier=1;assert(!w.buy(1,5,1));s.mineTier=2;const before={...s};assert(w.buy(1,5,1));assert.equal(s.chassis,4);assert.equal(S.turretCount(s,t),0,'no unbought Missile Cruiser turrets');assert.equal(s.hullMax,500-t.missileCruiser.cost);assert.equal(s.missileCharges,8);assert.equal(s.mineTier,before.mineTier);assert(!w.buy(1,5,0));const wire=S.decodeServer(S.encodeSnapshot(1,0,[{id:1,...s}]));assert.equal(wire.ships[0].chassis,4);}
{const w=world(),s=ship(w,1);let launches=0;for(let n=0;n<90;n++){const before=s.missileShots;S.stepShip(s,{...idle,fire:true},dt,t);launches+=s.missileShots!==before?1:0;}assert.equal(launches,8);assert.equal(s.shots,0);assert.equal(s.missileCharges,0);const replay={...s};for(let n=0;n<30;n++){S.stepShip(s,idle,dt,t);S.stepShip(replay,idle,dt,t);}assert.deepEqual(s,replay);}
{const w=world(),s=ship(w,1),enemy=ship(w,2,2000,1500,0);w.stepShip(1,{...idle,missile:true});const m=[...w.ordnance.values()][0];assert(m.heavy);assert.equal(m.damage,t.missile.damage*t.missileCruiser.damageFactor);assert(Math.cos(m.heading-s.heading)<-.99);const start=m.heading;for(let i=0;i<Math.ceil(t.missileCruiser.reverseSeconds*t.net.tickHz)-1;i++)w.step();assert.equal(m.heading,start);w.step();assert.notEqual(m.heading,start);assert(S.decodeServer(S.encodeOrdnance([{id:1,kind:2,owner:1,x:m.x,y:m.y,heading:m.heading,hp:1,armed:true,target:2}])).items[0].kind===2);}
for(const chassis of[2,4]){const w=world(),s=ship(w,1,1500,1500,chassis),target=ship(w,2,1750,1500,0);s.turrets=chassis===4?2:0;target.shield=10000;let ticks=[];for(let n=0;n<55;n++){w.step();if(w.drain().shots.some(s=>s.owner===1&&s.side===10))ticks.push(n);}assert(ticks.length>=7);assert(ticks.slice(1,7).every((v,i)=>v-ticks[i]===2),'fixed-step seven-shot burst');assert(ticks.length===7||ticks[7]-ticks[6]>=35,'pause before reacquire');}
{const w=world();w.setPlanet('warzone');w.startWar();const at=w.layout.turrets[0],s=ship(w,1,at.x+400,at.y,3);w.clanOf.set(1,w.attackerClan);s.shield=10000;let ticks=[];for(let n=0;n<150;n++){w.step();if(w.drain().shots.some(s=>s.side===40))ticks.push(n);}assert(ticks.length>=2,'tower fires');assert.equal(ticks[1]-ticks[0],6,'heavy doublet');assert(ticks[2]-ticks[1]>=45,'reload and warning');}
{const w=world();w.setPlanet('warzone');w.startWar();w.siege.shield=0;w.siege.shieldBroken=true;const base=w.layout.treasury,s=ship(w,1,base.x-1050,base.y);w.clanOf.set(1,w.attackerClan);w.stepShip(1,{...idle,missile:true});assert([...w.ordnance.values()][0].target<0,'server locks siege structures');let hit=false;for(let n=0;n<240;n++){w.step();if(w.drain().structureHits.length){hit=true;break;}}assert(hit,'rear-launched heavy missile arcs into a structure');}
{for(const bought of[0,1,2,4]){const w=world(),s=ship(w,1);s.chassis=3;s.hp=s.hullMax=500;s.turrets=bought;assert(w.buy(1,5,1));assert.equal(S.turretCount(s,t),bought,'only bought turrets survive evolution');}const w=world(),s=ship(w,1);s.speed=170;for(let i=0;i<150;i++)S.stepShip(s,{...idle,thrust:-1},dt,t);assert.equal(s.speed,90,'artillery braking reaches the lower cruise floor');assert.equal(S.chassisStats(2,t).baseTurrets,2);assert.equal(S.shipMotion(2,t).minSpeed,140);}
{const old=S.defaultConfig();delete old.tune.missileCruiser;delete old.tune.ciws;delete old.tune.heavyTower;const up=S.validateConfig(old);assert.equal(up.tune.missileCruiser.capacity,8);for(const mutate of[c=>c.tune.ciws.shots=.5,c=>c.tune.heavyTower.intervalSeconds=0,c=>c.tune.missileCruiser.capacity=999]){const c=S.defaultConfig();mutate(c);assert.throws(()=>S.validateConfig(c));}}
// An unlocked shot still arcs forward, and refill uses the same duration as the HUD.
{
 const w=world(),s=ship(w,1), launchX=s.x;
 w.stepShip(1,{...idle,missile:true});
 const missile=[...w.ordnance.values()][0];
 assert.equal(missile.target,0);
 assert.equal(s.missileCd,12);
 for(let n=0;n<32;n++)w.step();
 assert(Math.cos(missile.heading)>.95,'unlocked heavy missile returns forward');
 assert(missile.x>launchX-100,'heavy missile has already recovered its rear excursion');
 for(let n=0;n<361;n++)S.stepShip(s,idle,dt,t);
 assert.equal(s.missileCharges,8);
 const fighter=ship(world(),1,1500,1500,3);
 fighter.missileTier=fighter.missileCharges=1;
 S.stepShip(fighter,{...idle,missile:true},dt,t);
 assert.equal(fighter.missileCd,6);
}
{
 const legacy=S.defaultConfig();
 delete legacy.tune.missileCruiser.missileRefillFactor;
 legacy.tune.missileCruiser.reverseSeconds=.45;
 legacy.tune.missileCruiser.turnRateMissile=1.9;
 const updated=S.validateConfig(legacy);
 assert.equal(updated.tune.missileCruiser.reverseSeconds,.18);
 assert.equal(updated.tune.missileCruiser.turnRateMissile,4.2);
 updated.tune.missileCruiser.reverseSeconds=.22;
 assert.equal(S.validateConfig(updated).tune.missileCruiser.reverseSeconds,.22);
}
// Fighter ordnance presses survive a discarded input and are applied only once.
for (const cause of ['late', 'overflow']) {
 const room = new S.Room();
 room.setManualBots(true);
 room.setLockstep(true);
 const socket = { send(){}, accept(){}, addEventListener(){}, close(){} };
 room.join(socket, 'Missile QA');
 room.setLockstep(false);
 const pilot=[...room.players.values()][0];
 Object.assign(pilot.ship,{arrival:0,missileTier:2,missileCharges:2,mineTier:2,mineCharges:2});
 pilot.started=true;
 if (cause==='late') pilot.deficit=1;
 const count=cause==='late'?2:t.net.maxQueuedInputs+1;
 for(let seq=1;seq<=count;seq++)room.handleBuffer(pilot,S.encodeInput({...idle,seq,missile:seq===1,mine:seq===1}));
 room.step();
 assert.equal(pilot.ship.missileCharges,1,cause+' missile press');
 assert.equal(pilot.ship.mineCharges,1,cause+' mine press');
 room.step();
 assert.equal(pilot.ship.missileShots,1,cause+' missile must not repeat');
 assert.equal(pilot.ship.mineShots,1,cause+' mine must not repeat');
 room.stop();
}
console.log('PASS capital evolution authority, capacity/hold/replay/no primary, backward delayed missiles, chassis/heavy wire identity, seven-shot CIWS, heavy tower doublet and bounded config upgrade.');
