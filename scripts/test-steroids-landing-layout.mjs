import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:"export * from './prototypes/steroids-alpha/src/render/landingLayout';export {flightHeader} from './prototypes/steroids-alpha/src/render/hudLayout';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const{landingLayout,menuDialog,flightHeader}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const overlap=(a,b)=>a&&b&&Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2;
for(const[w,h]of[[2560,1440],[1920,1080],[1280,720],[1000,560],[960,540],[960,320],[844,390],[568,320],[480,600],[320,600],[320,240]])for(const touch of[false,true]){
 const l=landingLayout(w,h,touch),rects=[l.name,l.warp,l.tutorial,l.evolution,l.hangar,...l.utilities].filter(Boolean);
 for(const r of [...rects,menuDialog(w,h)])assert(r.x-r.w/2>=0&&r.x+r.w/2<=w&&r.y-r.h/2>=0&&r.y+r.h/2<=h,`all actions fit ${w}x${h}`);
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert(!overlap(rects[i],rects[j]),`independent actions never overlap ${w}x${h}`);
 assert.equal(l.utilities.length,3);assert(l.evolution.h>=44&&l.tutorial.h>=44&&l.hangar.h>=44&&l.warp.h>=44);assert(l.utilities.every(b=>b.h>=44));
 if(h<300)assert.equal(l.name,null,'short screens retain name editing in Account');
 if(w<520&&h>=480)assert(l.stack&&l.hero.y<l.warp.y,'tall view preserves ship above primary action');
 assert.equal(l.desktop,!touch&&w>=1000&&h>=560);
 if(l.desktop){assert(l.logo.w>=360&&l.warp.h>=70);assert(l.hero.y+l.hero.h/2<l.shipY,'rotating ship clears caption');assert(l.hero.w<800,'desktop content stays bounded');}
 const header=flightHeader(w,touch),nav=[header.warp,header.shop,header.board];
 for(const a of nav){assert(a.x-a.w/2>=0&&a.x+a.w/2<=w);for(const b of nav)if(a!==b)assert(!overlap(a,b),'header buttons stay separate');}
}
console.log('Landing/HUD layout: 22 size/input combinations, desktop hierarchy, bounds and action separation pass.');
