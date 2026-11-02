// Real canvas intents in isolated Brave; no mutation of gameplay fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPERATION_C_BROWSER_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const [base,outDir='outputs/operation-c']=process.argv.slice(2);
if(!base)throw new Error('Usage: screenshot-operation-c.mjs <url> <output-dir>');
fs.mkdirSync(outDir,{recursive:true});
const executablePath=process.platform==='win32'?'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe':undefined;
if(executablePath&&!fs.existsSync(executablePath))throw new Error('Brave unavailable; reconnect Brave instead of switching.');
const browser=await chromium.launch({executablePath,headless:true}),errors=[];
try {
for(const profile of [
  {name:'desktop',viewport:{width:1440,height:900},touch:false},
  {name:'phone-portrait',viewport:{width:390,height:844},touch:true},
  {name:'phone-landscape',viewport:{width:844,height:390},touch:true},
  {name:'phone-small-landscape',viewport:{width:667,height:375},touch:true},
].filter(p=>!process.env.OPERATION_C_PROFILE||p.name===process.env.OPERATION_C_PROFILE)){
  console.log(`CHECK ${profile.name}: loadout and card previews`);
  const context=await browser.newContext({viewport:profile.viewport,deviceScaleFactor:2,hasTouch:profile.touch,reducedMotion:'no-preference'}),page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')errors.push(`${profile.name}: ${m.text()}`);});page.on('pageerror',e=>errors.push(`${profile.name}: ${e.message}`));
  await page.goto(`${base}${base.includes('?')?'&':'?'}test=1&bot=0`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__operationC?.targets().buttons.length>0);
  const snap=()=>page.evaluate(()=>window.__operationC.snapshot());
  const targets=()=>page.evaluate(()=>window.__operationC.targets());
  const tap=async(x,y)=>profile.touch?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  const press=async id=>{const b=(await targets()).buttons.find(b=>b.id===id);assert(b,`button ${id}`);await tap(b.x,b.y);await page.waitForTimeout(65);};
  const advance=async ms=>page.evaluate(async ms=>{window.__operationC.advance(ms);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);},ms);
  const shot=async name=>page.screenshot({path:path.join(outDir,`${profile.name}-${name}.png`)});
  const checkButtons=async()=>{for(const b of (await targets()).buttons)assert(b.left>=0&&b.top>=0&&b.left+b.w<=profile.viewport.width+1&&b.top+b.h<=profile.viewport.height+1,`${profile.name}: ${b.id} fits`);};
  const scrollTo=async id=>{
    // Return to the top through ordinary wheel intent, then search the catalog.
    await page.keyboard.press('Home');await page.mouse.move(profile.viewport.width/2,profile.viewport.height/2);await page.waitForTimeout(90);
    for(let i=0;i<45;i++){if((await targets()).buttons.some(b=>b.id===id&&b.h>18))return;await page.mouse.wheel(0,170);await page.waitForTimeout(45);}
    throw new Error(`Could not scroll to ${id}`);
  };
  const inspect=async entity=>{const h=(await targets()).hexes.find(h=>h.id===entity.hexId);assert(h);await tap(h.x,h.y);await page.waitForTimeout(75);assert.equal((await snap()).inspected,entity.id);};
  const place=async kind=>{
    await press(`card-${kind}`);const t=await targets();
    const h=t.hexes.find(h=>h.valid&&h.x>22&&h.x<t.board.right-22&&h.y>t.board.top+25&&h.y<t.board.bottom-25);
    assert(h,`${profile.name}: visible legal ${kind} placement`);await tap(h.x,h.y);await page.waitForTimeout(70);assert.equal((await snap()).selectedBuild?.valid,true);
    await shot(`${kind}-hammer`);await tap(h.x,h.y);await page.waitForTimeout(70);
    const b=(await snap()).buildings.find(b=>b.owner===0&&b.hexId===h.id);assert(b,`${kind} placed`);await inspect(b);assert.equal((await snap()).selectedBuild,null,'occupied selection exits build mode');return b;
  };
  assert.equal((await snap()).loadout.length,8);await checkButtons();await shot('loadout');
  await press('portrait-toggle');assert.equal((await snap()).unitPortraits,true);await shot('unit-sockets');await press('portrait-toggle');
  await scrollTo('preview-infantry');await press('preview-infantry');await page.waitForTimeout(225);await shot('card-flip');await page.waitForTimeout(750);
  assert((await snap()).previewUpgrades.includes('infantry'));assert(!(await snap()).loadout.includes('missile'));await shot('upgrade-preview');
  await press('preview-infantry');await page.waitForTimeout(950);
  const original=(await snap()).loadout;
  for(let i=0;i<8;i++)await press('socket-0');
  await scrollTo('loadout-fighter');await press('loadout-fighter');await press('start-match');assert.equal((await snap()).page,'loadout','T1 ground required');
  for(const kind of original.filter(k=>k!=='fighter')){await scrollTo(`loadout-${kind}`);await press(`loadout-${kind}`);}
  assert.equal((await snap()).loadout.length,8);await scrollTo('loadout-gunner');await press('loadout-gunner');assert.equal((await snap()).loadout.length,8,'no ninth card');
  await scrollTo('loadout-carrier');await shot('tier-three');await checkButtons();
  // Touch drag scroll is the same intent used by wheel navigation.
  if(profile.touch){const before=(await snap()).loadoutScroll;await page.mouse.move(80,profile.viewport.height*0.55);await page.mouse.down();await page.mouse.move(80,profile.viewport.height*0.7,{steps:8});await page.mouse.up();await page.waitForTimeout(80);assert((await snap()).loadoutScroll<before,'drag scroll');}
  console.log(`CHECK ${profile.name}: construction, commands and progression`);
  await press('start-match');await press('pause');await checkButtons();await shot('start');
  const hq=(await snap()).buildings.find(b=>b.owner===0&&b.kind==='hq');await press('card-infantry');await inspect(hq);assert.equal((await snap()).selectedBuild,null);assert((await targets()).buttons.some(b=>b.id==='defend'));
  const barracks=await place('infantry');assert.equal((await snap()).resources.committed,4);assert.equal((await snap()).units.length,0);await shot('construction');
  const remaining=barracks.completeAtMs-(await snap()).timeMs;await advance(Math.floor(remaining/2));assert.equal((await snap()).units.length,0);await advance(remaining);
  let s=await snap(),squad=s.units.find(u=>u.owner===0);assert.equal(squad.members.length,5);assert.equal(squad.maxHp,40);
  await inspect(squad);await advance(3500);s=await snap();assert.equal(s.inspected,squad.id);assert.equal(s.inspectorKind,'infantry');await shot('persistent-inspector');
  await inspect(s.buildings.find(b=>b.id===barracks.id));await press('upgrade');assert.equal((await snap()).resources.committed,6);await shot('upgrade');
  await press('cancel-upgrade');s=await snap();assert.equal(s.resources.committed,4);assert.equal(s.buildings.find(b=>b.id===barracks.id).readyAtMs-s.timeMs,6500);
  await advance(6500);await press('upgrade');await advance(5000);s=await snap();assert.equal(s.buildings.find(b=>b.id===barracks.id).kind,'missile');assert(s.units.some(u=>u.kind==='missile'));await shot('armoury');
  for(let i=0;i<180&&s.resources.capacity-s.resources.committed<20;i++){await advance(1000);s=await snap();}
  assert(s.resources.capacity-s.resources.committed>=20);await press('research');assert.equal((await snap()).hexes.filter(h=>h.commitment==='research').length,20);await shot('research');
  await press('research');assert.equal((await snap()).players[0].research,null);await press('research');await advance(30000);assert.equal((await snap()).players[0].techTier,2);await press('research');await advance(60000);assert.equal((await snap()).players[0].techTier,3);
  const airfield=await place('fighter');await advance(6000);await inspect((await snap()).buildings.find(b=>b.id===airfield.id));await press('upgrade');await advance(8000);s=await snap();assert.equal(s.buildings.find(b=>b.id===airfield.id).kind,'bomber');assert(s.units.some(u=>u.kind==='bomber'));await shot('bomber');await press('sell');assert(!(await snap()).buildings.some(b=>b.id===airfield.id));
  const artillery=await place('artillery');await advance(5000);await inspect((await snap()).buildings.find(b=>b.id===artillery.id));await press('upgrade');await advance(8000);s=await snap();assert.equal(s.buildings.find(b=>b.id===artillery.id).kind,'mlrs');assert(s.units.some(u=>u.kind==='mlrs'));assert(!(await targets()).buttons.some(b=>b.id==='card-mlrs'));await shot('mlrs');await checkButtons();
  // HQ taps, not global command buttons, issue faction orders.
  await press('overview');let rival=(await snap()).buildings.find(b=>b.kind==='hq'&&b.owner===1);await inspect(rival);assert.equal((await snap()).target,1);assert((await targets()).buttons.some(b=>b.id==='attack'));await shot('hq-command');await inspect(hq);assert.equal((await snap()).target,0);
  await press('card-tank');assert.equal((await snap()).inspected,null,'card clears contextual selection');await press('cancel');
  s=await snap();assert.equal(new Set(s.units.map(u=>u.hexId)).size,s.units.length);await press('restart');assert.equal((await snap()).page,'loadout');
  console.log(`PASS ${profile.name}: pinned8sockets/toggle; tier scroll; animated upgrade preview; base-only8unique/T1validation; bottomdeck/occupiedcancel; construction/squad/persistentselection; upgradecancel/research/T3; bomber/sale; artillery-to-MLRS; HQorders; exclusiveoccupancy`);
  await context.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'browser console/page errors');console.log('Operation C RTS browser flow passed, no console errors.');
