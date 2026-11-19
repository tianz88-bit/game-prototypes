import fs from 'node:fs';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',args:process.env.DENSHA_GPU==='1'?['--no-sandbox']:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__frames=[];let last=0,draws=0;
  for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(C)for(const name of ['drawElements','drawArrays']){const original=C.prototype[name];C.prototype[name]=function(...args){draws++;return original.apply(this,args);};}
  function frame(t){if(last)window.__frames.push({ms:t-last,draws});last=t;draws=0;requestAnimationFrame(frame);}requestAnimationFrame(frame);
 });
 const collect=async()=>page.evaluate(()=>{const a=window.__frames.splice(0),times=a.map(f=>f.ms).sort((a,b)=>a-b),sum=times.reduce((a,b)=>a+b,0);return {frames:a.length,fps:1000*a.length/sum,p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],draws:a.reduce((a,b)=>a+b.draws,0)/a.length};});
 await page.goto('about:blank');await page.waitForTimeout(1000);await collect();await page.waitForTimeout(4000);const blank=await collect();
 await page.goto(process.argv[2]+'?test=1');await page.waitForFunction(()=>window.__densha);
 await page.evaluate(()=>window.__densha.goto(99));await page.waitForTimeout(1000);await collect();await page.evaluate(()=>window.__densha.perf());await page.waitForTimeout(4000);const idle={...await collect(),...await page.evaluate(()=>window.__densha.perf())};
 await page.evaluate(()=>window.__densha.goto(4));await page.waitForTimeout(500);await collect();
 for(let i=0;i<3;i++){const m=await page.evaluate(()=>window.__densha.nextMove());await page.mouse.move(m.x,m.y);await page.mouse.down();await page.mouse.move(m.x+(m.axis==='h'?40*m.dir:0),m.y+(m.axis==='v'?40*m.dir:0),{steps:3});await page.mouse.up();await page.waitForFunction(()=>window.__densha.phase()!=='animating',{},{timeout:30000});}
 const chain={...await collect(),...await page.evaluate(()=>window.__densha.perf())};
 const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl');if(!gl)return 'Canvas';const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 const report={gpu,blank,idle,chain,errors};fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
