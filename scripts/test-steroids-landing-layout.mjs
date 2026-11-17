import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({entryPoints:['prototypes/steroids-alpha/src/render/landingLayout.ts'],bundle:true,platform:'node',format:'esm',write:false});
const{landingLayout,menuDialog}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const overlap=(a,b)=>a&&b&&Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2;
for(const[w,h]of[[1280,720],[960,540],[960,320],[844,390],[568,320],[480,600],[320,600],[320,240]]){
 const l=landingLayout(w,h),rects=[l.name,l.warp,l.tutorial,l.hangar,...l.utilities].filter(Boolean);
 for(const r of [...rects,menuDialog(w,h)])assert(r.x-r.w/2>=0&&r.x+r.w/2<=w&&r.y-r.h/2>=0&&r.y+r.h/2<=h,`all actions fit ${w}x${h}`);
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert(!overlap(rects[i],rects[j]),`independent actions never overlap ${w}x${h}`);
 assert.equal(l.utilities.length,3);assert(l.tutorial.h>=44&&l.hangar.h>=44&&l.warp.h>=44);assert(l.utilities.every(b=>b.h>=44));
 if(h<300)assert.equal(l.name,null,'short screens retain name editing in Account');
 if(w<520&&h>=480)assert(l.stack&&l.hero.y<l.warp.y,'tall view preserves ship above primary action');
}
console.log('Landing layout: 8 logical sizes, action bounds/separation and mobile targets pass.');
