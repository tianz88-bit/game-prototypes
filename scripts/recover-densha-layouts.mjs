// Small obstacle repairs for layouts whose original chain proof could not survive
// fixed heads. Keep train positions, lengths and axes; require original exact par.
import fs from 'node:fs';import {build} from 'esbuild';
const root=process.cwd(),dir='.cache/densha-rule-audit/',audit=JSON.parse(fs.readFileSync(dir+'quality-report.json','utf8')),heads=JSON.parse(fs.readFileSync(dir+'repaired-heads.json','utf8')),contracts=JSON.parse(fs.readFileSync(dir+'puzzle-contracts.json','utf8'));
const b=await build({stdin:{contents:"export {LEVELS} from './prototypes/densha-domino/src/game/levels';export {solve} from './prototypes/densha-domino/src/game/solver';export * from './prototypes/densha-domino/src/game/rules';export * as legacy from './.cache/densha-rule-audit/rules';export {solve as oldSolve} from './.cache/densha-rule-audit/solver';",resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,tsconfig:'tsconfig.json'});
const R=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
function replay(l,plan,api=R){let state=api.initialState(l),moves=[],exits=[],events=[];for(const m of plan){if(!api.canRun(l,state,m.train,m.dir))continue;const r=api.applyTap(l,state,m);state=r.state;moves.push(m);exits.push(r.exited);events.push(...r.events);}return {clear:api.isCleared(state),moves,events,max:Math.max(0,...exits),final:exits.at(-1)??0};}
function variants(...plans){const map=new Map(),add=p=>map.set(JSON.stringify(p),p);for(const p of plans){add(p);for(let i=0;i<p.length;i++)for(let j=0;j<p.length;j++){const a=p.slice(),[m]=a.splice(i,1);a.splice(j,0,m);add(a);}if(p.length<=7){const perm=(prefix,left)=>{if(!left.length)add(prefix);else left.forEach((m,i)=>perm([...prefix,m],left.filter((_,k)=>k!==i)));};perm([],p);}}return [...map.values()];}
const repairs={},failed=[];
for(const number of [8,49,88]){
 const original=R.LEVELS[number-1],row=audit[number-1],old=R.oldSolve(original),current=R.solve(original),last=original.trains.map(t=>t.headDir);
 for(const e of replay(original,old.moves,R.legacy).events)if(e.type==='run')last[e.train]=e.dir;
 const originalHeads=original.trains.map(t=>t.headDir),seeds=[originalHeads,last];if(row.heads)seeds.push(original.trains.map(t=>row.heads[t.letter]));
 const hm=new Map();for(const seed of seeds){hm.set(seed.join(),seed);for(let i=0;i<seed.length;i++){const a=seed.slice();a[i]*=-1;hm.set(a.join(),a);}}
 const candidates=[...hm.values()],plans=variants(old.moves,current.moves,row.plan??[]),variantsOfLayout=[{obstacles:original.obstacles,change:'directions only'}];
 for(const cell of original.obstacles.keys()){const obstacles=new Map(original.obstacles);obstacles.delete(cell);variantsOfLayout.push({obstacles,change:'remove obstacle '+cell});}
 const occupied=new Set(original.obstacles.keys());for(const t of original.trains)for(let i=0;i<t.len;i++)occupied.add(t.axis==='h'?t.line*original.cols+t.start+i:(t.start+i)*original.cols+t.line);
 for(let cell=0;cell<original.cols*original.rows;cell++)if(!occupied.has(cell)){const obstacles=new Map(original.obstacles);obstacles.set(cell,'kiosk');variantsOfLayout.push({obstacles,change:'add plate stack '+cell});}
 let found=null;console.log('Recovering L'+number+' with '+plans.length+' setup orders, '+candidates.length+' head patterns, '+variantsOfLayout.length+' obstacle variants');
 outer:for(const variant of variantsOfLayout)for(const h of candidates){const level={...original,obstacles:variant.obstacles,trains:original.trains.map((t,i)=>({...t,headDir:h[i]}))};
  for(const plan of plans){const proof=replay(level,plan);if(!proof.clear||proof.moves.length!==row.oldPar||proof.max<row.oldMax||proof.final<row.oldFinal)continue;const exact=R.solve(level);if(exact.par!==row.oldPar)break;found={level,h,proof,change:variant.change};break outer;}
 }
 if(!found){failed.push(number);console.log('UNRESOLVED L'+number);continue;}
 const level=found.level,grid=Array.from({length:level.rows},()=>Array(level.cols).fill('.')),glyph={concrete:'#',kiosk:'k',signal:'s',tree:'t',machine:'m',buffer:'b'},axis={};
 for(const [cell,kind]of level.obstacles)grid[Math.floor(cell/level.cols)][cell%level.cols]=glyph[kind];
 for(const t of level.trains){axis[t.letter]=t.axis;for(let i=0;i<t.len;i++)if(t.axis==='h')grid[t.line][t.start+i]=t.letter;else grid[t.start+i][t.line]=t.letter;}
 heads[level.name]=Object.fromEntries(level.trains.map((t,i)=>[t.letter,found.h[i]]));
 repairs[level.name]={rows:grid.map(r=>r.join('')),axis,head:heads[level.name]};contracts.push({level:number,name:level.name,par:row.oldPar,minChain:row.oldMax,minFinal:row.oldFinal,plan:found.proof.moves});
 console.log('REPAIRED L'+number+' '+found.change+' par '+row.oldPar+' chain '+found.proof.max+' final '+found.proof.final);
}
fs.writeFileSync(dir+'layout-repairs.json',JSON.stringify(repairs,null,2));
if(failed.length){console.log('Unresolved '+failed.join(','));process.exitCode=1;}else{
 fs.writeFileSync('prototypes/densha-domino/src/game/head-directions.ts',"import type { Dir } from './types';\n\n// Repaired against original par and optimal-chain proof contracts.\nexport const HEAD_DIRECTIONS: Record<string,Record<string,Dir>> = {\n"+Object.entries(heads).map(([name,h])=>'  '+JSON.stringify(name)+': '+JSON.stringify(h)+',').join('\n')+'\n};\n');
 fs.writeFileSync('prototypes/densha-domino/src/game/level-repairs.ts',"import type {LevelSource} from './levels';\n// Generated obstacle-only repairs; train positions and dimensions retained.\nexport const LEVEL_REPAIRS: Record<string,Omit<LevelSource,'name'>> = "+JSON.stringify(repairs,null,2)+';\n');
 fs.writeFileSync('prototypes/densha-domino/src/game/puzzle-contracts.ts',"// Proof plans preserve original par, largest chain and final-chain targets.\nexport const PUZZLE_CONTRACTS = "+JSON.stringify(contracts.sort((a,b)=>a.level-b.level))+';\n');
 console.log('PASS: all 100 puzzles have quality contracts; three small layout repairs generated.');
}
