// Actual canvas inputs and production simulation, on isolated Brave (Windows).
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
const browser=await chromium.launch({executablePath,headless:true});const errors=[];
try {
for(const profile of [
  {name:'desktop',viewport:{width:1440,height:900},touch:false},
  {name:'phone-portrait',viewport:{width:390,height:844},touch:true},
  {name:'phone-landscape',viewport:{width:844,height:390},touch:true},
  {name:'phone-small-landscape',viewport:{width:667,height:375},touch:true}
].filter(p=>!process.env.OPERATION_C_PROFILE||p.name===process.env.OPERATION_C_PROFILE)) {
  const context=await browser.newContext({viewport:profile.viewport,deviceScaleFactor:2,hasTouch:profile.touch,reducedMotion:'no-preference'}),page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')errors.push(`${profile.name}: ${m.text()}`);});page.on('pageerror',e=>errors.push(`${profile.name}: ${e.message}`));
  await page.goto(`${base}${base.includes('?')?'&':'?'}test=1&bot=0`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__operationC?.targets().buttons.length>0);
  const snap=()=>page.evaluate(()=>window.__operationC.snapshot());
  const tap=async(x,y)=>profile.touch?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  const press=async id=>{const b=await page.evaluate(id=>window.__operationC.targets().buttons.find(b=>b.id===id),id);assert(b,`button ${id}`);await tap(b.x,b.y);await page.waitForTimeout(70);};
  const advance=async ms=>page.evaluate(async ms=>{window.__operationC.advance(ms);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);},ms);
  const shot=async name=>page.screenshot({path:path.join(outDir,`${profile.name}-${name}.png`)});
  const checkButtons=async()=>{const buttons=await page.evaluate(()=>window.__operationC.targets().buttons);for(const b of buttons)assert(b.left>=0&&b.top>=0&&b.left+b.w<=profile.viewport.width+1&&b.top+b.h<=profile.viewport.height+1,`${profile.name}: ${b.id} fits viewport`);};
  const hexPoint=async id=>page.evaluate(id=>window.__operationC.targets().hexes.find(h=>h.id===id),id);
  const inspect=async entity=>{await press('panel-build');const selected=(await snap()).selectedBuild;if(selected)await press('cancel');const p=await hexPoint(entity.hexId);assert(p);await tap(p.x,p.y);await page.waitForTimeout(70);assert.equal((await snap()).inspected,entity.id);};
  const place=async kind=>{
    await press('panel-build');await press(`card-${kind}`);
    const h=await page.evaluate(()=>{const t=window.__operationC.targets();return t.hexes.find(h=>h.valid&&h.x>22&&h.x<t.board.right-22&&h.y>t.board.top+22&&h.y<t.board.bottom-25);});
    assert(h,`${profile.name}: legal visible ${kind} placement`);await tap(h.x,h.y);await page.waitForTimeout(70);
    assert.equal((await snap()).selectedBuild?.valid,true);await shot(`${kind}-hammer`);await tap(h.x,h.y);await page.waitForTimeout(70);
    const s=await snap(),b=s.buildings.find(b=>b.owner===0&&b.hexId===h.id);assert(b,`${kind} building placed`);await press('cancel');return b;
  };
  assert.equal((await snap()).page,'loadout');await checkButtons();
  for(const kind of ['infantry','tank','artillery'])await press(`loadout-${kind}`);
  await press('start-match');assert.equal((await snap()).page,'loadout','T1 ground requirement');
  for(const kind of ['infantry','tank','artillery'])await press(`loadout-${kind}`);
  await press('preview-infantry');assert(!(await snap()).loadout.includes('missile'),'upgrade not selectable');await shot('loadout');await press('preview-infantry');
  await press('start-match');await press('pause');assert.equal((await snap()).page,'battle');await checkButtons();await shot('start');
  const barracks=await place('infantry');assert.equal((await snap()).resources.committed,4);assert.equal((await snap()).units.length,0,'no unit during construction');await shot('construction');
  assert.equal((await snap()).paused,true); const remaining=barracks.completeAtMs-(await snap()).timeMs; await advance(Math.floor(remaining/2)); assert.equal((await snap()).units.length,0); await advance(remaining); let s=await snap();let squad=s.units.find(u=>u.owner===0);assert.equal(squad.members.length,5);assert.equal(squad.maxHp,40);
  await inspect(squad);await advance(3500);s=await snap();assert.equal(s.inspected,squad.id,'selection follows unit identity');assert.equal(s.inspectorKind,'infantry');await checkButtons();await shot('persistent-inspector');
  await inspect(s.buildings.find(b=>b.id===barracks.id));await press('upgrade');s=await snap();assert.equal(s.resources.committed,6);assert.equal(s.units.filter(u=>u.owner===0).length,0,'old squad retired immediately');assert(s.buildings.find(b=>b.id===barracks.id).upgradeKind);await shot('upgrade');await checkButtons();
  await press('cancel-upgrade');s=await snap();assert.equal(s.resources.committed,4);const cd=s.buildings.find(b=>b.id===barracks.id).readyAtMs-s.timeMs;assert.equal(cd,6500);await advance(6400);assert.equal((await snap()).units.length,0);await advance(100);assert.equal((await snap()).units.length,1);
  await press('upgrade');await advance(5000);s=await snap();assert.equal(s.buildings.find(b=>b.id===barracks.id).kind,'missile');assert.equal(s.units.find(u=>u.owner===0).kind,'missile');assert.equal(s.hexes.filter(h=>h.commitment==='upgrade').length,2);await shot('armoury');
  // Actual autonomous capture earns research capacity; no fixture mutation.
  for(let i=0;i<160&&(s.resources.capacity-s.resources.committed<20);i++){await advance(1000);s=await snap();}
  assert(s.resources.capacity-s.resources.committed>=20,'captured enough capacity for research');
  await press('research');s=await snap();assert.equal(s.players[0].research.toTier,2);assert.equal(s.hexes.filter(h=>h.commitment==='research').length,20);await shot('research');
  await press('research');assert.equal((await snap()).players[0].research,null);await press('research');await advance(30000);assert.equal((await snap()).players[0].techTier,2);
  await press('research');await advance(60000);s=await snap();assert.equal(s.players[0].techTier,3);assert.equal(s.players[0].research,null);
  const airfield=await place('fighter');await advance(6000);s=await snap();assert(s.units.some(u=>u.kind==='fighter'));await inspect(s.buildings.find(b=>b.id===airfield.id));await press('upgrade');assert(!(await snap()).units.some(u=>u.kind==='fighter'));await advance(8000);s=await snap();assert(s.units.some(u=>u.kind==='bomber'));assert.equal(s.buildings.find(b=>b.id===airfield.id).kind,'bomber');await shot('bomber');
  await press('sell');s=await snap();assert(!s.buildings.some(b=>b.id===airfield.id));assert(!s.units.some(u=>u.kind==='bomber'));assert(!s.hexes.find(h=>h.id===airfield.hexId).burnt);
  const mlrs=await place('mlrs');await advance(8000);s=await snap();assert(s.units.some(u=>u.kind==='mlrs'));await inspect(s.buildings.find(b=>b.id===mlrs.id));await shot('mlrs');await checkButtons();
  assert.equal(new Set(s.units.map(u=>u.hexId)).size,s.units.length,'exclusive occupancy');
  await press('restart');assert.equal((await snap()).page,'loadout');
  console.log(`PASS ${profile.name}: base loadout validation/upgrade preview; construction/squad; persistent inspector; upgrade/cancel/cooldown; captured research/cancel/T2/T3; bomber conversion/sale; MLRS; occupancy; no console errors`);
  await context.close();
}
} finally {await browser.close();}
assert.deepEqual(errors,[],'browser console/page errors');console.log('Operation C progression browser flow passed.');
