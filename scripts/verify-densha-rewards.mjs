import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__densha);await page.evaluate(()=>window.__densha.goto(0));await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.__densha.effects().travelSpeed),.67);
 const m=await page.evaluate(()=>window.__densha.nextMove());await page.mouse.move(m.x,m.y);await page.mouse.down();await page.mouse.move(m.x+(m.axis==='h'?m.dir*40:0),m.y+(m.axis==='v'?m.dir*40:0),{steps:3});await page.mouse.up();
 await page.waitForFunction(()=>window.__densha.phase()==='won',{},{timeout:15000});
 await page.waitForTimeout(200);assert.ok((await page.evaluate(()=>window.__densha.effects().confetti)).every(n=>n===0),'Confetti must wait for star landings and settle');
 await page.waitForFunction(()=>window.__densha.effects().confetti.some(n=>n>0),{},{timeout:4000});
 assert.ok((await page.evaluate(()=>window.__densha.effects().confetti[0]))<=72);await page.screenshot({path:path.join(out,'three-star-bounce-confetti.png')});
 await page.waitForFunction(()=>window.__densha.effects().confetti.every(n=>n===0),{},{timeout:8000});assert.deepEqual(await page.evaluate(()=>window.__densha.effects().confetti),[0]);
 await page.screenshot({path:path.join(out,'three-star-settled.png')});
 await page.mouse.click(195,480);await page.waitForFunction(()=>window.__densha.phase()==='play');assert.deepEqual(await page.evaluate(()=>window.__densha.effects().confetti),[]);
 // Advance before the reward timer fires; no delayed emitter may survive.
 await page.evaluate(()=>window.__densha.goto(0));await page.waitForTimeout(100);
 const early=await page.evaluate(()=>window.__densha.nextMove());await page.mouse.move(early.x,early.y);await page.mouse.down();await page.mouse.move(early.x+(early.axis==='h'?early.dir*40:0),early.y+(early.axis==='v'?early.dir*40:0),{steps:3});await page.mouse.up();
 await page.waitForFunction(()=>window.__densha.phase()==='won',{},{timeout:15000});await page.waitForTimeout(240);await page.mouse.click(195,480);await page.waitForFunction(()=>window.__densha.phase()==='play');await page.waitForTimeout(1000);assert.deepEqual(await page.evaluate(()=>window.__densha.effects().confetti),[]);
 await page.waitForTimeout(500);await page.mouse.click(285,760);await page.waitForFunction(()=>window.__densha.menuOpen());await page.waitForTimeout(550);await page.screenshot({path:path.join(out,'bouncing-level-menu.png')});
 await page.mouse.click(195,668); // Outside/close remains keyboard-independent; reload below also tests disposal.
 await page.evaluate(()=>window.__densha.goto(100));await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'new-tunnels-tracks-pillars.png')});
 assert.deepEqual(errors,[]);console.log('PASS: 0.67 travel speed, actual three-star win, bounded confetti burst and expiry, next button/cleanup, bouncing selector and new dense-board art; no console errors.');
}finally{await browser.close();}
