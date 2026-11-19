// Actual game, actual swipes, tab-only captures. No separate review scene/lab.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import sharp from 'sharp';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',args:['--no-sandbox','--disable-gpu']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__densha?.renderInfo().eyeFrames===120);
 const info=await page.evaluate(()=>({info:window.__densha.renderInfo(),ratio:document.querySelector('canvas').width/document.querySelector('canvas').getBoundingClientRect().width}));
 assert.equal(info.info.pixelRatio,2);assert.equal(info.info.eyeFrames,120);assert.equal(info.info.signalFrames,16);assert.ok(info.ratio>=1.99,'1x desktop must still receive a 2x backing store');
 await page.evaluate(()=>window.__densha.goto(0));await page.waitForTimeout(150);
 const initial=await page.screenshot({path:path.join(out,'real-game-tutorial-1x.png')});
 const sample=async(x,y)=>[...await sharp(initial).extract({left:x,top:y,width:1,height:1}).removeAlpha().raw().toBuffer()];
 const tileA=await sample(55,265),tileB=await sample(125,265);assert.ok(tileA.every((v,i)=>Math.abs(v-tileB[i])<=9),'Floor tile variation must stay subtle, without a strong checker contrast');
 const swipe=async m=>{await page.mouse.move(m.x,m.y);await page.mouse.down();await page.mouse.move(m.axis==='h'?m.x+m.dir*40:m.x,m.axis==='v'?m.y+m.dir*40:m.y,{steps:3});await page.mouse.up();};
 const settle=()=>page.waitForFunction(()=>window.__densha.phase()!=='animating',{},{timeout:15000});
 await page.evaluate(()=>{window.__densha.goto(1);window.__densha.slow(.35);});await swipe(await page.evaluate(()=>window.__densha.nextMove()));
 await page.waitForFunction(()=>window.__densha.trains().some(t=>t.carriagePoses?.some(p=>p.expression==='insist')),{},{timeout:6000,polling:16});
 await page.evaluate(()=>window.__densha.slow(0));await page.waitForTimeout(30);await page.screenshot({path:path.join(out,'real-game-honk-eyes.png')});
 await page.evaluate(()=>window.__densha.slow(1));await settle();
 await page.evaluate(()=>window.__densha.goto(5));await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.__densha.definitions().find(t=>t.letter==='E').headDir),1);
 assert.equal(await page.evaluate(()=>window.__densha.trains().find(t=>t.id===4).light),'off');
 await swipe(await page.evaluate(()=>window.__densha.nextMove()));await settle();
 await page.evaluate(()=>window.__densha.slow(.35));await swipe(await page.evaluate(()=>window.__densha.nextMove()));
 await page.waitForFunction(()=>window.__densha.trains().some(t=>t.id===4&&t.travel===-1&&t.light==='off'),{},{polling:16});
 await page.evaluate(()=>window.__densha.slow(0));await page.waitForTimeout(30);await page.screenshot({path:path.join(out,'real-game-reverse-tail-band.png')});
 assert.equal(await page.evaluate(()=>window.__densha.trains().find(t=>t.id===4).headDir),1);
 await page.evaluate(()=>window.__densha.slow(1));await settle();
 assert.equal(await page.evaluate(()=>window.__densha.trains().find(t=>t.id===4).light),'flashing');
 assert.equal(await page.evaluate(()=>window.__densha.trains().find(t=>t.id===4).travel),null);
 await page.screenshot({path:path.join(out,'real-game-restored-head-band.png')});
 await page.evaluate(()=>window.__densha.slow(.35));await swipe(await page.evaluate(()=>window.__densha.nextMove()));
 await page.waitForFunction(()=>window.__densha.trains().some(t=>t.carriagePoses?.length>=3&&new Set(t.carriagePoses.map(p=>Math.round(p.scale*100))).size>1),{},{timeout:10000,polling:16});
 await page.evaluate(()=>window.__densha.slow(0));await page.waitForTimeout(30);await page.screenshot({path:path.join(out,'real-game-carriage-cascade.png')});
 await page.evaluate(()=>window.__densha.slow(1));await settle();assert.equal(await page.evaluate(()=>window.__densha.phase()),'won');assert.equal(await page.evaluate(()=>window.__densha.taps()),3);
 assert.deepEqual(errors,[]);console.log('PASS: 1x crisp backing store, subtle floor variation, 120 reviewed eye frames, 16 socket-registered light frames, honk, reverse with no tail light→stop flashing-head, independent carriage poses, level 6 three-tap/six-train chain; no console errors.');
}finally{await browser.close();}
