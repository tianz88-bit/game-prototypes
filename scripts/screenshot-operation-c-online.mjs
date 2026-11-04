// Two real browser clients against the isolated authoritative Worker.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPERATION_C_BROWSER_PACKAGE||import.meta.url),{chromium}=require('playwright');
const [base,out='outputs/operation-c-online',server]=process.argv.slice(2);
if(!base)throw new Error('Usage: screenshot-operation-c-online.mjs <client-url> <out-dir> [server-url]');
fs.mkdirSync(out,{recursive:true});
const executablePath=process.platform==='win32'?'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe':undefined;
if(executablePath&&!fs.existsSync(executablePath))throw new Error('Brave unavailable; reconnect Brave instead of switching.');
const browser=await chromium.launch({executablePath,headless:true}),errors=[];
try{
  const contexts=await Promise.all([
    browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:1}),
    browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true}),
    browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1}),
  ]);
  const [host,guest,extra]=await Promise.all(contexts.map(c=>c.newPage()));
  const guestFrames=[];guest.on('websocket',ws=>ws.on('framereceived',event=>{try{guestFrames.push(JSON.parse(String(event.payload)));}catch{}}));
  for(const p of[host,guest,extra]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
  const snap=p=>p.evaluate(()=>window.__operationC.snapshot());
  const targets=p=>p.evaluate(()=>window.__operationC.targets());
  const tap=async(p,x,y)=>p===guest?p.touchscreen.tap(x,y):p.mouse.click(x,y);
  const press=async(p,id)=>{const b=(await targets(p)).buttons.find(b=>b.id===id);assert(b,id);await tap(p,b.x,b.y);await p.waitForTimeout(85);};
  const capture=(p,name)=>p.screenshot({path:path.join(out,name+'.png')});
  const initial=new URL(base);initial.searchParams.set('test','1');if(server)initial.searchParams.set('server',server);
  await host.goto(initial.href,{waitUntil:'networkidle'});await host.waitForFunction(()=>window.__operationC);
  assert((await snap(host)).loadout.includes('bunker')&&(await snap(host)).loadout.includes('silo'),'new utilities are discoverable in the default eight');
  const requestedMap=(await snap(host)).mapConfig;await press(host,'host-online');await host.waitForFunction(()=>window.__operationC.snapshot().online?.connected,null,{timeout:20000});
  await host.waitForFunction(config=>{const map=window.__operationC.snapshot().online?.lobby?.map;return map?.shape===config.shape&&map?.seed===config.seed;},requestedMap,{timeout:15000});
  let h=await snap(host);assert.equal(h.online.seat,0);console.log('CHECK online: host connected');
  const invite=new URL(h.online.inviteLink);invite.searchParams.set('test','1');
  await guest.goto(invite.href,{waitUntil:'networkidle'});await guest.waitForFunction(()=>window.__operationC?.snapshot().online?.connected,null,{timeout:20000});assert.equal((await snap(guest)).online.seat,1);
  if(process.env.OPERATION_C_ONLINE_MAP){
    const shape=process.env.OPERATION_C_ONLINE_MAP;await press(guest,'ready');await press(host,'map-setup');await press(host,'map-shape-'+shape);
    await host.waitForFunction(shape=>window.__operationC.snapshot().online.lobby.map.shape===shape,shape);await press(host,'map-seed-plus');
    await guest.waitForFunction(()=>window.__operationC.snapshot().online.lobby.map.seed===2);await press(guest,'map-setup');
    assert.deepEqual((await snap(host)).previewHexes,(await snap(guest)).previewHexes);assert.deepEqual((await snap(host)).mapConfig,(await snap(guest)).mapConfig);
    assert((await targets(guest)).buttons.filter(b=>b.id.startsWith('map-shape-')||b.id==='map-seed-plus').every(b=>b.disabled),'guest map editing disabled');
    assert(!(await snap(host)).online.lobby.players.find(p=>p.seat===1).ready,'map change clears readiness');
    await capture(host,'host-map-preview');await capture(guest,'guest-map-preview');await press(host,'map-back');await press(guest,'map-back');
  }
  await capture(host,'host-lobby');await capture(guest,'guest-lobby');
  await extra.goto(invite.href,{waitUntil:'networkidle'});await extra.waitForFunction(()=>window.__operationC?.snapshot().online?.status.toLowerCase().includes('two players'),null,{timeout:15000});assert.equal((await snap(extra)).online.connected,false);await capture(extra,'room-full');await extra.close();
  await press(host,'ready');await press(guest,'ready');
  await Promise.all([host,guest].map(p=>p.waitForFunction(()=>window.__operationC.snapshot().page==='battle',null,{timeout:15000})));
  assert.deepEqual((await snap(guest)).mapConfig,(await snap(host)).mapConfig);assert.deepEqual((await snap(guest)).hexes.filter(h=>h.gap).map(h=>h.id),(await snap(host)).hexes.filter(h=>h.gap).map(h=>h.id));assert.deepEqual((await snap(guest)).commandIndicator,{hqId:'hq1',mode:'defend'});console.log('CHECK online: both ready, countdown, playing');
  const before=(await snap(host)).timeMs;await press(host,'pause');await host.keyboard.press('Space');assert.equal((await snap(host)).paused,false);
  await host.evaluate(()=>window.__operationC.advance(10000));await host.waitForTimeout(650);assert((await snap(host)).timeMs>before);assert((await snap(host)).timeMs<before+4000,'client cannot fast-forward server');
  const place=async(p,seat,kind='infantry')=>{
    await press(p,'home');await press(p,`card-${kind}`);
    let hex;
    for(let i=0;i<25&&!hex;i++){const t=await targets(p);hex=t.hexes.find(h=>h.valid&&h.x>24&&h.x<t.board.right-24&&h.y>t.board.top+25&&h.y<t.board.bottom-25);if(!hex)await p.waitForTimeout(1000);}
    assert(hex,`seat ${seat} legal visible ${kind} site`);const count=(await snap(p)).buildings.filter(b=>b.owner===seat&&b.kind===kind).length;
    await tap(p,hex.x,hex.y);await p.waitForTimeout(90);assert((await snap(p)).selectedBuild?.valid);await tap(p,hex.x,hex.y);
    await p.waitForFunction(({seat,count,kind})=>window.__operationC.snapshot().buildings.filter(b=>b.owner===seat&&b.kind===kind).length>count,{seat,count,kind},{timeout:10000});
    const position=(await targets(p)).hexes.find(h=>h.id===hex.id);await tap(p,position.x,position.y);await p.waitForTimeout(85);
  };
  await place(host,0);await place(guest,1);
  await Promise.all([host,guest].map(p=>p.waitForFunction(()=>window.__operationC.snapshot().units.filter(u=>u.kind!=='worker').length>=2,null,{timeout:15000})));
  await capture(host,'host-battle');await capture(guest,'guest-battle');
  const anchor=(await snap(guest)).buildings.find(b=>b.owner===1&&b.kind==='infantry');await press(guest,'defend-building');await guest.waitForFunction(id=>window.__operationC.snapshot().players[1].defendTargetId===id,anchor.id);assert.deepEqual((await snap(guest)).commandIndicator,{hqId:anchor.id,mode:'defend'});await capture(guest,'guest-defense-anchor');
  h=await snap(host);let g=await snap(guest);assert.deepEqual(h.buildings.map(b=>[b.id,b.owner,b.kind]),g.buildings.map(b=>[b.id,b.owner,b.kind]));
  const firstTime=g.timeMs;await guest.reload({waitUntil:'networkidle'});await guest.waitForFunction(()=>window.__operationC?.snapshot().online?.connected&&window.__operationC.snapshot().page==='battle',null,{timeout:20000});g=await snap(guest);assert.equal(g.online.seat,1);assert(g.timeMs>=firstTime);assert(g.buildings.some(b=>b.owner===1&&b.kind==='infantry'));await capture(guest,'guest-rejoined');
  await press(guest,'overview');h=await snap(guest);const rival=h.buildings.find(b=>b.owner===0&&b.kind==='infantry'),rivalHex=(await targets(guest)).hexes.find(hex=>hex.id===rival.hexId);await tap(guest,rivalHex.x,rivalHex.y);await guest.waitForTimeout(90);assert(!(await targets(guest)).buttons.some(b=>b.id==='sell'||b.id==='upgrade'),'rival producer has no owner-only commands');
  console.log('PASS online: room capacity, authenticated seat1 UI, no local pause/advance, both placement/construction/units, shared buildings, same-seat reload, enemy command restrictions');
  if(process.env.OPERATION_C_ONLINE_NUKE==='1'){
    for(let i=0;i<3;i++)await place(host,0);
    await host.waitForFunction(()=>{const s=window.__operationC.snapshot();return s.resources.capacity>=64;},null,{timeout:120000});
    console.log('CHECK nuclear: expansion earned silo capacity');
    // Reallocate captured territory through real commands; avoid an unrelated infantry win during tech/payload timers.
    await press(host,'overview');
    const home=(await snap(host)).buildings.find(b=>b.owner===0&&b.kind==='hq'),homePoint=(await targets(host)).hexes.find(h=>h.id===home.hexId);await tap(host,homePoint.x,homePoint.y);await host.waitForTimeout(90);await press(host,'map-gather-defense');
    await press(host,'research');await host.waitForFunction(()=>window.__operationC.snapshot().players[0].techTier===2,null,{timeout:40000});await press(host,'research');await host.waitForFunction(()=>window.__operationC.snapshot().players[0].techTier===3,null,{timeout:70000});console.log('CHECK nuclear: real-time T2 and T3 completed');
    await press(host,'card-silo');let candidates=await targets(host),site=candidates.hexes.find(h=>h.valid&&h.y>candidates.board.top+20&&h.y<candidates.board.bottom-20);assert(site,'connected silo footprint');await tap(host,site.x,site.y);await host.waitForTimeout(90);await tap(host,site.x,site.y);await host.waitForFunction(()=>window.__operationC.snapshot().buildings.some(b=>b.owner===0&&b.kind==='silo'),null,{timeout:10000});
    let silo=(await snap(host)).buildings.find(b=>b.owner===0&&b.kind==='silo');await host.waitForFunction(id=>{const s=window.__operationC.snapshot(),b=s.buildings.find(b=>b.id===id);return b?.nukeReadyAtMs!==undefined&&b.nukeReadyAtMs<=s.timeMs;},silo.id,{timeout:85000});
    const position=(await targets(host)).hexes.find(h=>h.id===silo.hexId);await tap(host,position.x,position.y);await host.waitForTimeout(90);await press(host,'defend-building');await host.waitForFunction(id=>window.__operationC.snapshot().players[0].defendTargetId===id,silo.id);await press(host,'launch-nuke');
    const victim=(await snap(host)).buildings.find(b=>b.kind==='hq'&&b.owner===1),oldHp=victim.hp,point=(await targets(host)).hexes.find(h=>h.id===victim.hexId);await tap(host,point.x,point.y);await host.waitForTimeout(90);guestFrames.length=0;await capture(host,'nuclear-aim');await press(host,'confirm-nuke');
    await host.waitForTimeout(1500);assert.equal((await snap(guest)).buildings.find(b=>b.id===victim.id).hp,oldHp,'flight has not impacted');assert(guestFrames.filter(m=>m.t==='state').every(m=>m.entities.nukeFlights.length===0),'defender receives no private flights');assert(guestFrames.filter(m=>m.t==='state').every(m=>m.entities.buildings.filter(b=>b.owner===0).every(b=>b.nukeReadyAtMs===undefined)),'defender receives no payload timer');
    await host.waitForFunction(()=>window.__operationC.snapshot().nuclearImpacts.length>0,null,{timeout:12000});await guest.waitForFunction(()=>window.__operationC.snapshot().nuclearImpacts.length>0,null,{timeout:5000});assert((await snap(guest)).buildings.find(b=>b.id===victim.id).hp<oldHp);await host.waitForTimeout(850);await capture(host,'nuclear-impact-host');await capture(guest,'nuclear-impact-guest');console.log('PASS online nuclear strike: real research/construction/production/flight timers, contextual aim/launch, building anchor, private defender wire data, shared impact/damage');
  }
  if(process.env.OPERATION_C_ONLINE_FULL_MATCH==='1'){
    for(const kind of ['infantry','tank','artillery'])await place(host,0,kind);
    await press(host,'overview');h=await snap(host);const enemy=h.buildings.find(b=>b.kind==='hq'&&b.owner===1),point=(await targets(host)).hexes.find(hex=>hex.id===enemy.hexId);await tap(host,point.x,point.y);await host.waitForTimeout(100);await press(host,'map-attack-here');
    await host.waitForFunction(()=>window.__operationC.snapshot().target===1,null,{timeout:10000});await capture(host,'host-attack-command');
    await host.waitForFunction(()=>window.__operationC.snapshot().winner!==null,null,{timeout:process.env.OPERATION_C_ONLINE_MAP?240000:180000});await guest.waitForFunction(()=>window.__operationC.snapshot().winner!==null,null,{timeout:10000});h=await snap(host);g=await snap(guest);assert.equal(h.winner,g.winner);assert.equal(h.online.lobby.phase,'ended');assert.equal(g.online.lobby.phase,'ended');assert.equal(h.timeMs,g.timeMs);assert.deepEqual(h.hexes,g.hexes);assert.deepEqual(h.buildings,g.buildings);assert.deepEqual(h.units,g.units);for(const state of [h,g])assert(state.renderCache.hqLabels.every(id=>state.buildings.some(b=>id==='hq-level-'+b.id)),'destroyed HQ labels released');await capture(host,'host-result');await capture(guest,'guest-result');console.log(`PASS full online match: winner ${h.winner}, ${h.timeMs}ms, identical final worlds`);
  }
  assert.deepEqual(errors,[],'browser console/page errors');
  for(const c of contexts)await c.close();
}finally{await browser.close();}
console.log('Operation C two-human online browser checks passed.');
