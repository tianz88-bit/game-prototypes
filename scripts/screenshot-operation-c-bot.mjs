// Bot-enabled gameplay through real canvas commands; QA advances time only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPERATION_C_BROWSER_PACKAGE||import.meta.url),{chromium}=require('playwright');
const [base,out='outputs/operation-c-bot']=process.argv.slice(2);
if(!base)throw new Error('Usage: screenshot-operation-c-bot.mjs <client-url> <output-dir>');
fs.mkdirSync(out,{recursive:true});
const executablePath=process.platform==='win32'?'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe':undefined;
if(executablePath&&!fs.existsSync(executablePath))throw new Error('Brave unavailable; reconnect Brave instead of switching.');
const browser=await chromium.launch({executablePath,headless:true}),errors=[],reports=[];
try{
  for(const profile of[
    {name:'desktop',viewport:{width:1440,height:900},touch:false},
    {name:'phone-portrait',viewport:{width:390,height:844},touch:true},
  ]){
    const context=await browser.newContext({viewport:profile.viewport,deviceScaleFactor:2,hasTouch:profile.touch});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const url=new URL(base);url.searchParams.set('test','1');url.searchParams.delete('bot');
    await page.goto(url.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__operationC);
    const snap=()=>page.evaluate(()=>window.__operationC.snapshot());
    const targets=()=>page.evaluate(()=>window.__operationC.targets());
    const tap=(x,y)=>profile.touch?page.touchscreen.tap(x,y):page.mouse.click(x,y);
    const press=async id=>{const b=(await targets()).buttons.find(b=>b.id===id);assert(b,id);await tap(b.x,b.y);await page.waitForTimeout(65);};
    const advance=ms=>page.evaluate(async ms=>{window.__operationC.advance(ms);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);},ms);
    const shot=name=>page.screenshot({path:path.join(out,`${profile.name}-${name}.png`)});
    await press('start-match');await press('pause');
    for(const kind of ['infantry','tank']){
      await press(`card-${kind}`);let t=await targets();
      const visible=h=>h.valid&&h.x>24&&h.x<t.board.right-24&&h.y>t.board.top+24&&h.y<t.board.bottom-24;
      let hex=t.hexes.find(visible);
      if(!hex){await press('overview');t=await targets();hex=t.hexes.find(visible);}
      assert(hex,`${kind} legal mixed opening`);await tap(hex.x,hex.y);await page.waitForTimeout(70);await tap(hex.x,hex.y);await page.waitForTimeout(70);
      assert((await snap()).buildings.some(b=>b.owner===0&&b.kind===kind));
    }
    await press('cancel');await press('overview');
    const samples=[],seen=new Set();let attackOrdered=false;
    for(let elapsed=0;elapsed<=180000;elapsed+=5000){
      let s=await snap();
      for(const b of s.buildings.filter(b=>b.owner===1&&b.kind!=='hq'))seen.add(b.kind);
      assert.equal(new Set(s.units.map(u=>u.hexId)).size,s.units.length,'exclusive occupancy');
      if(elapsed%15000===0)samples.push({timeMs:s.timeMs,winner:s.winner,players:s.players.map(p=>({id:p.id,tech:p.techTier,research:!!p.research,mode:p.targetId===p.id?'defend':'attack',land:s.hexes.filter(h=>h.owner===p.id&&!h.burnt).length,hqHp:s.buildings.find(b=>b.owner===p.id&&b.kind==='hq')?.hp??0,units:s.units.filter(u=>u.owner===p.id).length,buildings:s.buildings.filter(b=>b.owner===p.id&&b.kind!=='hq').map(b=>b.kind)}))});
      if(s.winner!==null)break;
      if(elapsed>=90000&&!attackOrdered){
        const enemy=s.buildings.find(b=>b.owner===1&&b.kind==='hq'),hex=(await targets()).hexes.find(h=>h.id===enemy.hexId);
        await tap(hex.x,hex.y);await page.waitForTimeout(80);assert.equal((await snap()).target,1);attackOrdered=true;
      }
      if(elapsed===30000||elapsed===90000)await shot(`battle-${elapsed/1000}s`);
      if(elapsed<180000)await advance(5000);
    }
    assert(seen.size>=2,'bot uses more than one building role');
    await shot('result');reports.push({profile:profile.name,seen:[...seen],samples});
    console.log(`PASS ${profile.name}: bot-enabled mixed opening, legal commands, exclusive occupancy; bot built ${[...seen].join(', ')}`);
    await context.close();
  }
}finally{await browser.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));
assert.deepEqual(errors,[],'browser console/page errors');console.log('Operation C bot-enabled browser checks passed.');
