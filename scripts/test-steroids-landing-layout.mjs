import assert from 'node:assert/strict';
import {build} from 'esbuild';
const r=await build({stdin:{contents:"export * from './prototypes/steroids-alpha/src/render/landingLayout';export {flightHeader,levelStrip,flightControls} from './prototypes/steroids-alpha/src/render/hudLayout'; export {turnCoverScreen} from './prototypes/steroids-alpha/src/render/viewportLayout';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const{landingLayout,menuDialog,flightHeader,levelStrip,flightControls,turnCoverScreen}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const overlap=(a,b)=>a&&b&&Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2;
for(const[w,h]of[[2560,1440],[1920,1080],[1280,720],[1000,560],[960,540],[960,320],[844,390],[568,320],[480,600],[320,600],[320,240],[514,882],[600,840],[673,881],[782,700]])for(const touch of[false,true]){
 const l=landingLayout(w,h,touch),rects=[l.name,l.warp,l.tutorial,l.hangar,...l.utilities].filter(Boolean);
 for(const r of [...rects,menuDialog(w,h)])assert(r.x-r.w/2>=0&&r.x+r.w/2<=w&&r.y-r.h/2>=0&&r.y+r.h/2<=h,`all actions fit ${w}x${h}`);
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert(!overlap(rects[i],rects[j]),`independent actions never overlap ${w}x${h}`);
 assert.equal(l.utilities.length,3);assert(!('evolution' in l),'no evolution equip slot on the landing menu');assert(l.tutorial.h>=44&&l.hangar.h>=44&&l.warp.h>=44);assert(l.utilities.every(b=>b.h>=44));
 if(h<300)assert.equal(l.name,null,'short screens retain name editing in Account');
 if(w<520&&h>=480)assert(l.stack&&l.hero.y<l.warp.y,'tall view preserves ship above primary action');
 assert.equal(l.desktop,!touch&&w>=1000&&h>=560);
 if(l.desktop){assert(l.logo.w>=360&&l.warp.h>=70);assert(l.hero.y+l.hero.h/2<l.shipY,'rotating ship clears caption');assert(l.hero.w<800,'desktop content stays bounded');}
 const header=flightHeader(w,touch),nav=[header.warp,header.shop,header.board];
 for(const a of nav){assert(a.x-a.w/2>=0&&a.x+a.w/2<=w);for(const b of nav)if(a!==b)assert(!overlap(a,b),'header buttons stay separate');}
}
// Foldables can move between these sizes without switching to another game scene.
for(const [rawW,rawH,turned] of [[344,848,true],[412,915,true],[500,880,false],[514,882,false],[600,840,false],[673,881,false],[740,670,false]]){
 assert.equal(turnCoverScreen(rawW,rawH,true),turned);
 assert.equal(turnCoverScreen(rawW,rawH,false),false);
 const [w,h]=turned?[rawH,rawW]:[rawW,rawH],strip=levelStrip(w,h,true);
 const last=strip.x+strip.width;
 assert(strip.cardWidth>=44&&strip.cardHeight>=44,'cards have room to tap');
 assert(last < w-10-Math.min(224,w*.34),'strip clears the leaderboard');
 for(const b of Object.values(flightControls(w,h,22,34,34))){
  assert(b.x-b.hw>=0&&b.x+b.hw<=w&&b.y-b.hh>=0&&b.y+b.hh<=h);
  assert(b.x-b.hw>=last||b.y-b.hh>=strip.y+strip.cardHeight,'combat controls clear all cards');
 }
 if(!turned&&h>w*1.08)assert(landingLayout(w,h,true).stack);
}
console.log('Landing/HUD layout: desktop, cover and unfolded displays, touch targets and card spacing pass.');
