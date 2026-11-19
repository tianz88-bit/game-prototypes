// Actual level-five chain: independently delayed, plate-anchored food envelope.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]+'?test=1');await page.waitForFunction(()=>window.__densha);await page.evaluate(()=>{
   window.__densha.goto(4);window.__foodSamples=[];window.__watchFood=true;
   function sample(){if(!window.__watchFood)return;window.__foodSamples.push(window.__densha.trains().map(t=>({id:t.id,poses:t.carriagePoses})));requestAnimationFrame(sample);}requestAnimationFrame(sample);
 });
 for(let i=0;i<3;i++){const m=await page.evaluate(()=>window.__densha.nextMove());await page.mouse.move(m.x,m.y);await page.mouse.down();await page.mouse.move(m.x+(m.axis==='h'?m.dir*40:0),m.y+(m.axis==='v'?m.dir*40:0),{steps:3});await page.mouse.up();await page.waitForFunction(()=>window.__densha.phase()!=='animating',{},{timeout:30000});}
 const samples=await page.evaluate(()=>{window.__watchFood=false;return window.__foodSamples;}),scales=samples.flat(2).flatMap(t=>t.poses?.map(p=>p.foodScale)??[]).filter(Number.isFinite);
 const report={minimum:Math.min(...scales),maximum:Math.max(...scales),independent:samples.some(frame=>frame.some(t=>t.poses?.length>=3&&new Set(t.poses.map(p=>Math.round(p.foodScale*100))).size>1)),errors};
 assert.ok(report.minimum<.89&&report.minimum>.8,'Clearly legible compression without flattening food');assert.ok(report.maximum>1.1&&report.maximum<1.2,'Controlled rebound');assert.ok(report.independent,'Food must cascade per carriage');assert.deepEqual(errors,[]);
 fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));console.log('PASS: '+JSON.stringify(report));
}finally{await browser.close();}
