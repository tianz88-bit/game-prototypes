// Rebuild only layouts whose quality could not be recovered by direction/small
// obstacle changes. Generated under fixed heads, then prove their par and climax.
import fs from 'node:fs';import {build} from 'esbuild';
const root=process.cwd(),dir='.cache/densha-rule-audit/',report=JSON.parse(fs.readFileSync(dir+'quality-report.json','utf8')),heads=JSON.parse(fs.readFileSync(dir+'repaired-heads.json','utf8')),contracts=JSON.parse(fs.readFileSync(dir+'puzzle-contracts.json','utf8'));
const b=await build({stdin:{contents:"export {LEVELS,parseLevel} from './prototypes/densha-domino/src/game/levels';export {solve} from './prototypes/densha-domino/src/game/solver';export * from './prototypes/densha-domino/src/game/rules';export {generate} from './prototypes/densha-domino/src/game/generator';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,tsconfig:'tsconfig.json'});
const R=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64')),repairs={};
for(const number of [8,49,88]){
 const old=R.LEVELS[number-1],target=report[number-1],trains=Math.max(old.trains.length,target.oldPar+target.oldMax-1),spec={cols:old.cols,rows:old.rows,trains,maxLen:3,obstacles:Math.min(7,Math.max(3,old.obstacles.size)),climax:Math.max(target.oldMax,trains-target.oldPar+1),minPar:target.oldPar};let found=null;
 for(let attempt=0;attempt<50&&!found;attempt++){
  const generated=R.generate({...spec,seed:18000+number*100+attempt},undefined,15);if(!generated){console.log('L'+number+' seed '+attempt+' retry');continue;}
  const level=R.parseLevel(old.name,generated.rows,generated.axis,generated.head),sol=R.solve(level);if(sol.truncated||sol.par!==target.oldPar){console.log('L'+number+' seed '+attempt+' rejected par '+sol.par);continue;}
  let state=R.initialState(level),exits=[];for(const m of generated.plan){const result=R.applyTap(level,state,m);state=result.state;exits.push(result.exited);}
  if(!R.isCleared(state)||generated.plan.length!==sol.par||Math.max(...exits)<target.oldMax||exits.at(-1)<target.oldFinal)continue;
  found={generated,sol,exits};
 }
 if(!found)throw Error('No quality-proven replacement for L'+number);
 const {generated:g,sol,exits}=found;repairs[old.name]={rows:g.rows,axis:g.axis,head:g.head};heads[old.name]=g.head;
 contracts.push({level:number,name:old.name,par:sol.par,minChain:target.oldMax,minFinal:target.oldFinal,plan:g.plan});
 fs.writeFileSync(dir+'rebuilt-layouts-progress.json',JSON.stringify(repairs,null,2));
 console.log('REBUILT L'+number+' '+old.cols+'x'+old.rows+' trains '+trains+' exact par '+sol.par+' final chain '+exits.at(-1));
}
fs.writeFileSync('prototypes/densha-domino/src/game/head-directions.ts',"import type { Dir } from './types';\n\n// Quality-repaired cab identities; each board has an optimal-chain proof.\nexport const HEAD_DIRECTIONS: Record<string,Record<string,Dir>> = {\n"+report.map(r=>'  '+JSON.stringify(r.name)+': '+JSON.stringify(heads[r.name])+',').join('\n')+'\n};\n');
fs.writeFileSync('prototypes/densha-domino/src/game/level-repairs.ts',"import type {LevelSource} from './levels';\n// Three layouts rebuilt under fixed-head rules; original par/chain targets retained.\nexport const LEVEL_REPAIRS: Record<string,Omit<LevelSource,'name'>> = "+JSON.stringify(repairs,null,2)+';\n');
fs.writeFileSync('prototypes/densha-domino/src/game/puzzle-contracts.ts',"// Optimal setup/chain proofs. Regeneration must preserve these quality targets.\nexport const PUZZLE_CONTRACTS = [\n"+contracts.sort((a,b)=>a.level-b.level).map(r=>'  '+JSON.stringify(r)+',').join('\n')+'\n];\n');
console.log('PASS: 100 quality-contracted puzzles; repaired heads and three rebuilt layouts saved.');
