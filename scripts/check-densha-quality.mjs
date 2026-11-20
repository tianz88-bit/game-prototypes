import assert from 'node:assert/strict';import {build} from 'esbuild';
const b=await build({stdin:{contents:"export {LEVELS,LEVEL_SOURCES,ALL_SOURCES} from './prototypes/densha-domino/src/game/levels';export {PACK} from './prototypes/densha-domino/src/game/pack';export {PUZZLE_CONTRACTS} from './prototypes/densha-domino/src/game/puzzle-contracts';export {solve} from './prototypes/densha-domino/src/game/solver';export * from './prototypes/densha-domino/src/game/rules';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,tsconfig:'tsconfig.json'});
const R=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
assert.equal(R.PUZZLE_CONTRACTS.length,101);const sources=R.ALL_SOURCES;
for(const [i,l]of R.LEVELS.entries()){
 const contract=sources[i].quality??R.PUZZLE_CONTRACTS.find(c=>c.name===l.name);assert.ok(contract,l.name+' has no quality contract');
 const sol=R.solve(l);assert.ok(!sol.truncated,l.name+' needs an exact par');assert.equal(sol.par,contract.par,l.name+' has a new shortcut or lost setup');
 let state=R.initialState(l),max=0,final=0;for(const move of contract.plan){assert.ok(R.canRun(l,state,move.train,move.dir),l.name+' proof contains an illegal move');const r=R.applyTap(l,state,move);state=r.state;max=Math.max(max,r.exited);final=r.exited;}
 assert.ok(R.isCleared(state),l.name+' proof fails');assert.equal(contract.plan.length,sol.par,l.name+' climax plan is not optimal');assert.ok(max>=contract.minChain,l.name+' lost its chain');assert.ok(final>=contract.minFinal,l.name+' lost its finale');
 console.log('ok L'+(i+1)+' par '+sol.par+' optimal chain '+max+' final '+final);
}
const fifth=R.LEVELS[5],pink=fifth.trains.find(t=>t.letter==='E');assert.equal(pink.headDir,1);assert.equal(R.canRun(fifth,R.initialState(fifth),pink.id,1),false);assert.equal(R.PUZZLE_CONTRACTS[5].par,3);assert.equal(R.PUZZLE_CONTRACTS[5].minChain,6);
console.log('PASS: all 101 exact pars, optimal-chain plans and finale targets; level 6 pink E prefers right, initially blocked, six-train climax in three taps.');
