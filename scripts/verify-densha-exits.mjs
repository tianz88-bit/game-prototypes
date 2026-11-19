// Real pack, real canvas swipes; geometry sampled on browser animation frames.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import sharp from 'sharp';import {build} from 'esbuild';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
const bundle=await build({stdin:{contents:"export {LEVELS} from './prototypes/densha-domino/src/game/levels';export * from './prototypes/densha-domino/src/game/rules';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const R=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64')),cases=new Map();
for(const [level,l]of R.LEVELS.entries())for(const t of l.trains)for(const dir of [-1,1]){
 const direction=t.axis==='h'?(dir<0?'west':'east'):(dir<0?'north':'south'),key=direction+'-'+t.len;
 if(cases.has(key))continue;
 if(R.applyTap(l,R.initialState(l),{train:t.id,dir}).events.some(e=>e.type==='run'&&e.train===t.id&&e.exited))cases.set(key,{key,level,id:t.id,len:t.len,axis:t.axis,dir,direction});
}
for(const dir of ['north','south','east','west'])assert.ok(cases.has(dir+'-3'),'Need a real three-car '+dir+' exit');
const browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',args:['--no-sandbox']});
const results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__densha);
 for(const c of [...cases.values()].sort((a,b)=>b.len-a.len||a.key.localeCompare(b.key))){
  await page.evaluate(n=>{window.__densha.slow(1);window.__densha.goto(n);window.__densha.exitAudit(true);},c.level);await page.waitForTimeout(100);
  const board=await page.evaluate(()=>window.__densha.board()),initial=await page.evaluate(id=>window.__densha.carriages(id),c.id),plane=c.axis==='h'?(c.dir<0?board.x:board.x+board.cols*board.cs):(c.dir<0?board.y:board.y+board.rows*board.cs);
  await page.evaluate(id=>{window.__exitFrames=[];window.__exitWatch=true;function sample(){if(!window.__exitWatch)return;const g=window.__densha.carriages(id);if(g)window.__exitFrames.push(g);requestAnimationFrame(sample);}requestAnimationFrame(sample);},c.id);
  if(c.len===3)await page.evaluate(()=>window.__densha.slow(.4));
  await page.mouse.move(initial.x,initial.y);await page.mouse.down();await page.mouse.move(initial.x+(c.axis==='h'?c.dir*40:0),initial.y+(c.axis==='v'?c.dir*40:0),{steps:3});await page.mouse.up();
  let leakedPixels=0;
  if(c.len===3){
   await page.waitForFunction(({id,dir,axis,plane,len})=>{const g=window.__densha.carriages(id);if(!g||g.travel===null)return false;const b=g.cars[dir>0?0:len-1].bounds,min=axis==='h'?b.x:b.y,max=min+(axis==='h'?b.width:b.height);return min<plane&&max>plane;},{...c,plane},{timeout:20000,polling:'raf'});
   await page.evaluate(()=>window.__densha.slow(0));await page.waitForTimeout(60);
   const withTrain=await page.screenshot({path:path.join(out,c.key+'-tail-entering.png')});
   await page.evaluate(id=>window.__densha.setTrainVisible(id,false),c.id);const withoutTrain=await page.screenshot();await page.evaluate(id=>window.__densha.setTrainVisible(id,true),c.id);
   const normal=await sharp(withTrain).ensureAlpha().raw().toBuffer(),hidden=await sharp(withoutTrain).ensureAlpha().raw().toBuffer();
   const d=await page.evaluate(id=>window.__densha.definitions().find(t=>t.id===id),c.id),cross=(c.axis==='h'?board.y:board.x)+(d.line+.5)*board.cs;
   for(let y=0;y<844;y++)for(let x=0;x<390;x++){
    const along=c.axis==='h'?x:y,across=c.axis==='h'?y:x;
    if(Math.abs(across-cross)>board.cs*.33||(c.dir>0?along<plane+3:along>plane-3))continue;
    const p=(y*390+x)*4;if(Math.max(...[0,1,2].map(k=>Math.abs(normal[p+k]-hidden[p+k])))>14)leakedPixels++;
   }
   await page.evaluate(()=>window.__densha.slow(1));
  }
  await page.waitForFunction(id=>!window.__densha.carriages(id),c.id,{timeout:20000});
  const {frames,audit}=await page.evaluate(()=>{window.__exitWatch=false;return {frames:window.__exitFrames,audit:window.__densha.exitAudit()};});
  const disposal=audit.find(e=>e.train===c.id);assert.ok(disposal,c.key+' must reach the real despawn callback');
  const outside=b=>c.axis==='h'?(c.dir<0?b.x+b.width<=0:b.x>=390):(c.dir<0?b.y+b.height<=0:b.y>=844);
  assert.ok(disposal.geometry.cars.every(car=>outside(car.bounds)),c.key+' despawned while a carriage was still on screen');
  for(let i=0;i<c.len;i++){
   assert.ok(frames.some(g=>{const b=g.cars[i].bounds,min=c.axis==='h'?b.x:b.y,max=min+(c.axis==='h'?b.width:b.height);return c.dir>0?min>=plane:max<=plane;}),c.key+' car '+i+' never passed fully under the tunnel');
   for(const g of frames){const car=g.cars[i];assert.ok(car.visible||outside(car.bounds),c.key+' car '+i+' culled while still on screen');}
  }
  for(let i=1;i<frames.length;i++)assert.ok(c.dir*(frames[i][c.axis==='h'?'x':'y']-frames[i-1][c.axis==='h'?'x':'y'])>=-.01,c.key+' root jumped backwards');
  results.push({...c,frames:frames.length,leakedPixels,allCarsOutsideAtDespawn:true});console.log('checked '+c.key+': '+frames.length+' frames, '+leakedPixels+' train pixels over tunnel');
 }
 fs.writeFileSync(path.join(out,'exit-audit.json'),JSON.stringify({results,errors},null,2));assert.deepEqual(errors,[]);
 assert.ok(results.filter(c=>c.len===3).every(c=>c.leakedPixels<=3),'A train is drawing over an opaque tunnel cover; see tail-entering captures.');
 console.log('PASS: all four real exits across available carriage lengths, full-screen clearance before despawn, per-car passage/culling, monotonic movement and opaque cover occlusion; no console errors.');
}finally{await browser.close();}
