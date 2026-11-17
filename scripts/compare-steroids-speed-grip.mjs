import{build}from'esbuild';import fs from'node:fs';
const r=await build({stdin:{contents:"export * from './prototypes/steroids-alpha-lab/duel-model';export * from './prototypes/steroids-alpha-lab/duel-controls';export {TUNE} from './prototypes/steroids-alpha/sim/tune';export {shipMotion} from './prototypes/steroids-alpha/sim/chassis';export {wrapDelta,angleDelta} from './prototypes/steroids-alpha/sim/wrap';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false}),S=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const rows=[];for(const grip of[false,true])for(const name of['fast-tail-brake-cut','circle-fast-cut'])for(const duration of[.35,.5,.65,.8,1,1.2])for(const guns of[false,true]){
 const start=name==='fast-tail-brake-cut'?'tail':'circle',m=new S.DuelModel(start,'candidate',0,false,S.TUNE,grip),begin=start==='tail'?2.35:3;
 if(start==='tail'){for(const s of m.pilots)s.speed=S.shipMotion(s.chassis,m.tune).maxSpeed;m.resetGrip();}
 let frames=0,enemyCone=0,window=0,clear=0,maxClear=0,peakSlip=0,brakeSlip=[];
 for(let n=0;n<360&&m.pilots.every(s=>s.hp>0);n++){
  const[p,e]=m.pilots,t=m.elapsed-begin,dx=S.wrapDelta(e.x,p.x,4000),dy=S.wrapDelta(e.y,p.y,4000),aim=Math.atan2(dy,dx),i=S.idle();let fast=false,brake=false;
  if(t<0){i.turn=start==='circle'?-1:0;fast=start==='tail';}
  else if(start==='tail'){brake=t<duration;i.turn=t<duration?1:0;if(t>=duration)i.aim=aim;i.fire=guns&&t>=duration;}
  else{fast=t<duration;brake=t>=duration&&t<duration+.6;i.turn=t<duration?1:0;if(t>=duration)i.aim=aim;i.fire=guns&&t>=duration;}
  i.thrust=S.combatThrottle(p,m.tune,fast,brake);const enemy=m.opponent();if(start==='tail'&&Math.hypot(dx,dy)>150)enemy.thrust=1;if(!guns)enemy.fire=false;m.step(i,enemy);if(t<0)continue;
  const x=S.wrapDelta(p.x,e.x,4000),y=S.wrapDelta(p.y,e.y,4000),d=Math.hypot(x,y),locked=d<600&&Math.abs(S.angleDelta(Math.atan2(y,x),e.heading))<.18;frames++;if(locked)enemyCone++;clear=locked?0:clear+1/30;maxClear=Math.max(clear,maxClear);if(d<600&&Math.abs(S.angleDelta(Math.atan2(-y,-x),p.heading))<.2)window+=1/30;peakSlip=Math.max(peakSlip,Math.abs(m.gripStates[0].slip)*180/Math.PI);if(brake&&m.gripStates[0].slowing)brakeSlip.push(Math.abs(m.gripStates[0].slip)*180/Math.PI);
 }
 rows.push({grip,name,duration,guns,alive:m.pilots[0].hp>0,enemyAlive:m.pilots[1].hp>0,seconds:m.elapsed,potentialEnemyConePct:enemyCone/frames*100,maxClear,playerGunWindow:window,peakSlip,contacts:m.ramHits+m.bumpHits});
}
const summary=[];for(const grip of[false,true])for(const name of['fast-tail-brake-cut','circle-fast-cut']){const off=rows.filter(r=>r.grip===grip&&r.name===name&&!r.guns),on=rows.filter(r=>r.grip===grip&&r.name===name&&r.guns),avg=(a,k)=>a.reduce((s,r)=>s+r[k],0)/a.length;summary.push({grip,name,potentialEnemyConePct:avg(off,'potentialEnemyConePct'),maxClearMean:avg(off,'maxClear'),playerGunWindowMean:avg(off,'playerGunWindow'),survived:on.filter(r=>r.alive).length,won:on.filter(r=>r.alive&&!r.enemyAlive).length,attempts:on.length,aliveSeconds:avg(on,'seconds')});}
if(process.env.GRIP_RESULTS_FILE)fs.writeFileSync(process.env.GRIP_RESULTS_FILE,JSON.stringify({scope:'48 scripted Falcon comparisons, six timings, guns on/off, same policies; geometric opportunities and scripted outcomes are not human-fun/win-rate proof.',summary,rows},null,2));console.table(summary);
