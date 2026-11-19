// Compare puzzle intent with the pre-integration rules, then test direction assignments
// against proven setup/chain plans. This audits chain quality as well as solvability.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {build} from 'esbuild';
const root=process.cwd(),dir=path.join(root,'.cache/densha-rule-audit');fs.mkdirSync(dir,{recursive:true});
for(const file of ['rules','solver']){const source=execFileSync('git',['-c','safe.directory='+root,'show','origin/main:prototypes/densha-domino/src/game/'+file+'.ts'],{encoding:'utf8'});fs.writeFileSync(path.join(dir,file+'.ts'),source.replaceAll("'./types'",JSON.stringify(path.join(root,'prototypes/densha-domino/src/game/types').replaceAll('\\','/'))));}
const bundle=await build({stdin:{contents:"export {LEVELS} from './prototypes/densha-domino/src/game/levels';export {solve} from './prototypes/densha-domino/src/game/solver';export * from './prototypes/densha-domino/src/game/rules';export * as legacy from './.cache/densha-rule-audit/rules';export {solve as solveLegacy} from './.cache/densha-rule-audit/solver';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,tsconfig:'tsconfig.json'});
const R=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function replay(l,plan,api=R){let state=api.initialState(l),moves=[],exits=[],events=[];for(const m of plan){if(!api.canRun(l,state,m.train,m.dir))continue;const r=api.applyTap(l,state,m);state=r.state;moves.push(m);exits.push(r.exited);events.push(...r.events);}return {clear:api.isCleared(state),moves,exits,events,final:exits.at(-1)??0,max:Math.max(0,...exits)};}
function variants(...plans){const all=new Map();for(const p of plans){const add=a=>all.set(JSON.stringify(a),a);add(p);for(let i=0;i<p.length;i++)for(let j=0;j<p.length;j++){const a=p.slice(),[m]=a.splice(i,1);a.splice(j,0,m);add(a);}}return [...all.values()];}
const report=[],repaired={};
for(const [i,original]of R.LEVELS.entries()){
 const oldSol=R.solveLegacy(original),sol=R.solve(original),old=replay(original,oldSol.moves,R.legacy),current=replay(original,sol.moves);
 const originalHeads=original.trains.map(t=>t.headDir),last=originalHeads.slice();for(const e of old.events)if(e.type==='run')last[e.train]=e.dir;
 const candidates=[originalHeads,last];for(const seed of [originalHeads,last])for(let k=0;k<seed.length;k++){const a=seed.slice();a[k]*=-1;candidates.push(a);}
 const plans=variants(sol.moves,oldSol.moves),seen=new Set();let best=null;
 for(const heads of candidates){if(seen.has(heads.join()))continue;seen.add(heads.join());const l={...original,trains:original.trains.map((t,k)=>({...t,headDir:heads[k]}))};let proof=null,shortcut=false;
  for(const plan of plans){const p=replay(l,plan);if(!p.clear)continue;if(p.moves.length<oldSol.par){shortcut=true;break;}if(!proof||p.moves.length<proof.moves.length||p.moves.length===proof.moves.length&&(p.final>proof.final||p.final===proof.final&&p.max>proof.max))proof=p;}
  if(shortcut||!proof)continue;const edits=heads.filter((h,k)=>h!==originalHeads[k]).length,score=-Math.abs(proof.moves.length-oldSol.par)*10000+proof.final*100+proof.max*10-edits;
  if(!best||score>best.score)best={heads,proof,score,level:l};
 }
 if(best){const verified=R.solve(best.level);best.par=verified.par;if(verified.par<oldSol.par||best.proof.moves.length!==verified.par)best=null;}
 const result={level:i+1,name:original.name,oldPar:oldSol.par,oldFinal:old.final,oldMax:old.max,currentPar:sol.par,currentFinal:current.final,currentMax:current.max,proposedPar:best?.par??null,proposedFinal:best?.proof.final??null,proposedMax:best?.proof.max??null,heads:best?Object.fromEntries(original.trains.map((t,k)=>[t.letter,best.heads[k]])):null,plan:best?.proof.moves??null};
 report.push(result);if(best)repaired[original.name]=result.heads;
 console.log(JSON.stringify(result));
}
fs.writeFileSync(path.join(dir,'quality-report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(dir,'proposed-heads.json'),JSON.stringify(repaired,null,2));
console.log('AUDIT COMPLETE: '+report.filter(r=>r.proposedPar!==null&&r.proposedFinal>=r.oldFinal).length+'/100 preserve baseline par and final-chain size; report in .cache/densha-rule-audit/quality-report.json');
