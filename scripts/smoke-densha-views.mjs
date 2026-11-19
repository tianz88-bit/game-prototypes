import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',args:['--no-sandbox','--disable-gpu']});
try{
 for(const [name,viewport,art]of [['desktop',{width:1280,height:720},true],['phone',{width:390,height:844},true],['missing-art',{width:390,height:844},false]]){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:2}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(art&&m.type()==='error')errors.push(m.text()+' '+m.location().url);});
  if(!art)await page.route('**/assets/manifest.json',route=>route.fulfill({status:404,body:'Missing art test'}));
  await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__densha);
  assert.equal(await page.evaluate(()=>window.__densha.art()),art);
  await page.evaluate(()=>window.__densha.goto(100));await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.__densha.phase()),'play');assert.equal(await page.evaluate(()=>window.__densha.level()),99);
  await page.screenshot({path:path.join(out,'densha-'+name+'-level100.png')});assert.deepEqual(errors,[]);
  console.log('PASS: '+name+' level 100 boots; '+(art?'approved art':'automatic missing-manifest fallback')+'; no runtime exceptions.');await ctx.close();
 }
}finally{await browser.close();}
