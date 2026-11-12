// Generated-map UI and actual air crossings through real canvas commands in isolated Brave.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPERATION_C_BROWSER_PACKAGE||import.meta.url),{chromium}=require('playwright');
const [base,out='outputs/operation-c-maps']=process.argv.slice(2);if(!base)throw Error('Usage: screenshot-operation-c-maps.mjs <url> <out-dir>');
fs.mkdirSync(out,{recursive:true});
const tune=JSON.parse(fs.readFileSync(new URL('../prototypes/operation-c/tune.json',import.meta.url),'utf8'));
const browser=await chromium.launch({executablePath:process.platform==='win32'?'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe':undefined,headless:true}),errors=[];
const distance=(a,b)=>{const [q,r]=a.split(',').map(Number),[x,y]=b.split(',').map(Number);return(Math.abs(q-x)+Math.abs(r-y)+Math.abs(q+r-x-y))/2;};
try{for(const profile of[
 {name:'desktop',viewport:{width:1440,height:900},touch:false},
 {name:'portrait',viewport:{width:390,height:844},touch:true},
 {name:'landscape',viewport:{width:844,height:390},touch:true},
 {name:'small-landscape',viewport:{width:667,height:375},touch:true},
].filter(p=>!process.env.OPERATION_C_PROFILE||p.name===process.env.OPERATION_C_PROFILE)){
 const context=await browser.newContext({viewport:profile.viewport,deviceScaleFactor:2,hasTouch:profile.touch}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const url=new URL(base);url.searchParams.set('test','1');url.searchParams.set('bot','0');url.searchParams.delete('room');url.searchParams.delete('join');url.searchParams.set('map','open');url.searchParams.set('seed','1');
 const snap=()=>page.evaluate(()=>window.__operationC.snapshot()),targets=()=>page.evaluate(()=>window.__operationC.targets());
 const tap=(x,y)=>profile.touch?page.touchscreen.tap(x,y):page.mouse.click(x,y);
 const press=async id=>{const b=(await targets()).buttons.find(b=>b.id===id);assert(b,id);assert(!b.disabled,id+' enabled');await tap(b.x,b.y);await page.waitForTimeout(85);};
 const advance=ms=>page.evaluate(async ms=>{window.__operationC.advance(ms);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);},ms);
 const shot=name=>page.screenshot({path:path.join(out,profile.name+'-'+name+'.png')});
 const bounds=async()=>{for(const b of(await targets()).buttons)assert(b.left>=0&&b.top>=0&&b.left+b.w<=profile.viewport.width+1&&b.top+b.h<=profile.viewport.height+1,b.id+' fits');};
 const load=async u=>{await page.goto(u.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__operationC);};
 await load(url);await press('map-setup');assert.equal((await snap()).page,'map');
 for(const shape of ['open','narrows','forks','ring']){
  await press('map-shape-'+shape);const s=await snap(),byId=new Map(s.previewHexes.map(h=>[h.id,h]));assert.equal(s.mapConfig.shape,shape);
  for(const h of s.previewHexes)assert.equal(!!h.gap,!!byId.get(`${-h.q},${-h.r}`).gap,'rotational symmetry');
  assert(shape==='open'?s.previewHexes.every(h=>!h.gap):s.previewHexes.some(h=>h.gap));
  for(const q of[-5,5])for(const h of s.previewHexes)if(distance(h.id,`${q},0`)<=2)assert(!h.gap,'protected start');
  await bounds();await shot('map-'+shape);
 }
 const original=(await snap()).previewHexes;await press('map-seed-plus');assert.equal((await snap()).mapConfig.seed,2);assert.notDeepEqual((await snap()).previewHexes,original);await press('map-seed-minus');assert.deepEqual((await snap()).previewHexes,original);
 await press('map-back');await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__operationC);assert.equal((await snap()).mapConfig.shape,'ring');assert.equal((await snap()).mapConfig.seed,1);await press('start-match');await press('pause');let s=await snap();assert.equal(s.mapConfig.shape,'ring');assert.equal(s.resources.capacity,6);assert.equal(s.units.length,6);assert(s.hexes.some(h=>h.gap));
 await advance(30000);s=await snap();assert(s.units.every(u=>!s.hexes.find(h=>h.id===u.hexId).gap));assert(s.hexes.filter(h=>h.gap).every(h=>h.owner===null&&!h.lockedBy));await press('card-hq');assert((await targets()).hexes.filter(h=>s.hexes.find(x=>x.id===h.id).gap).every(h=>!h.valid));await shot('generated-battle');
 url.searchParams.set('map','forks');url.searchParams.set('seed','27');await load(url);assert.equal((await snap()).mapConfig.shape,'forks');assert.equal((await snap()).mapConfig.seed,27);await press('map-setup');await shot('seed-link');await press('map-back');
 if(profile.name==='desktop'||profile.name==='portrait'){
  url.searchParams.set('map','ring');url.searchParams.set('seed','1');await load(url);
  const fighter=(await snap()).menuOrder.indexOf('fighter');await press('socket-'+(fighter+1));
  for(let i=0;i<45&&!(await targets()).buttons.some(b=>b.id==='loadout-helicopter'&&b.h>18);i++){await page.mouse.move(profile.viewport.width/2,profile.viewport.height/2);await page.mouse.wheel(0,180);await page.waitForTimeout(50);}
  await press('loadout-helicopter');assert((await snap()).loadout.includes('helicopter'));await press('start-match');await press('pause');await press('overview');await advance(90000);
  for(let i=0;i<90&&(await snap()).resources.capacity-(await snap()).resources.committed<16;i++)await advance(1000);
  await press('research');await advance(30000);assert.equal((await snap()).players[0].techTier,2);
  const place=async kind=>{await press('card-'+kind);let t=await targets();const enemy=t.hexes.find(h=>h.id==='5,0');const h=t.hexes.filter(h=>h.valid&&h.y>t.board.top+25&&h.y<t.board.bottom-25).sort((a,b)=>Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(b.x-enemy.x,b.y-enemy.y))[0];assert(h,kind+' site');await tap(h.x,h.y);await page.waitForTimeout(75);await tap(h.x,h.y);await page.waitForTimeout(75);return(await snap()).buildings.find(b=>b.hexId===h.id);};
  await place('helicopter');await advance(6000);await place('infantry');await advance(3000);
  const enemy=(await targets()).hexes.find(h=>h.id==='5,0');await tap(enemy.x,enemy.y);await page.waitForTimeout(75);await press('map-attack-here');
  let crossing;for(let i=0;i<600&&!crossing;i++){await advance(100);s=await snap();assert(s.units.every(u=>!s.hexes.find(h=>h.id===u.hexId).gap));for(const u of s.units.filter(u=>u.kind==='infantry'&&u.fromHexId))assert.equal(distance(u.hexId,u.fromHexId),1);crossing=s.units.find(u=>u.kind==='helicopter'&&u.owner===0&&u.fromHexId&&distance(u.hexId,u.fromHexId)>1&&u.movingUntilMs>s.timeMs);}
  assert(crossing,'actual helicopter crosses gap');s=await snap();const span=distance(crossing.hexId,crossing.fromHexId),[q,r]=crossing.fromHexId.split(',').map(Number),[x,y]=crossing.hexId.split(',').map(Number);
  for(let i=1;i<span;i++)assert(s.hexes.find(h=>h.id===`${q+(x-q)*i/span},${r+(y-r)*i/span}`).gap,'crossing intermediate cells are gaps');
  const speed=s.hexes.find(h=>h.id===crossing.fromHexId).owner===0?tune.movement.friendlySpeedMultiplier:1;assert.equal(crossing.movingUntilMs-crossing.movedAtMs,tune.cards.helicopter.moveMs*span/speed);
  await advance(Math.floor((crossing.movingUntilMs-s.timeMs)/2));s=await snap();assert(!s.shots.some(shot=>shot.unitId===crossing.id&&shot.timeMs>=crossing.movedAtMs),'no fighting mid-crossing');await shot('air-crossing');await advance(crossing.movingUntilMs-s.timeMs+1500);s=await snap();assert(s.shots.some(shot=>shot.unitId===crossing.id),'engages after landing');
 }
 console.log('PASS '+profile.name+': seeded presets, symmetric starts, URL replay, gap-safe ground, valid air crossing and real flight duration');await context.close();
}assert.deepEqual(errors,[],'browser errors');}finally{await browser.close();}
console.log('Operation C generated-map browser checks passed.');
