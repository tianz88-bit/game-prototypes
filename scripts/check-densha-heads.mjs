import assert from 'node:assert/strict';
import {build} from 'esbuild';
const code="export * from './prototypes/densha-domino/src/game/rules';export {parseLevel} from './prototypes/densha-domino/src/game/levels';export {generate} from './prototypes/densha-domino/src/game/generator';export {solve} from './prototypes/densha-domino/src/game/solver';";
const b=await build({stdin:{contents:code,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,tsconfig:'tsconfig.json'});
const R=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
for(const col of [1,2,3])for(const head of [-1,1]){
 const rows=['......','......','.AAA..','......','......','......'].map(r=>r.split(''));rows[4][col]='B';rows[5][col]='B';
 const l=R.parseLevel('test',rows.map(r=>r.join('')),{}, {A:head,B:-1}),s=R.initialState(l),hit=R.applyTap(l,s,{train:1,dir:-1}).events.find(e=>e.type==='hit');
 assert.equal(hit.targetDir,head,'Near-end and centre signals must follow permanent head');
 assert.equal(hit.spooked,true);
}
const reverse=R.parseLevel('reverse',['......','......','#.AAA.','......','......','......'],{}, {A:1}),s=R.initialState(reverse);
const stopped=R.applyTap(reverse,s,{train:0,dir:-1});assert.equal(stopped.state[0],1);assert.equal(reverse.trains[0].headDir,1);assert.ok(R.canRun(reverse,stopped.state,0,1));
const blocked=R.parseLevel('blocked',['......','......','.AAA#.','......','..B...','..B...'],{}, {A:1,B:-1});
assert.equal(R.canRun(blocked,R.initialState(blocked),0,1),false);assert.equal(R.canRun(blocked,R.initialState(blocked),0,-1),true);
assert.equal(R.applyTap(blocked,R.initialState(blocked),{train:1,dir:-1}).events.find(e=>e.type==='hit').spooked,false,'Blocked head must not automatically reverse');
for(const seed of [1,19,53]){
 const g=R.generate({cols:6,rows:6,trains:5,maxLen:3,obstacles:2,climax:2,minPar:2,seed});assert.ok(g,'Builder must produce a puzzle');
 const level=R.parseLevel('roundtrip',g.rows,g.axis,g.head);let state=R.initialState(level);for(const move of g.plan)state=R.applyTap(level,state,move).state;assert.ok(R.isCleared(state),'Serialized builder plan must remain valid');
 assert.equal(R.solve(level).par,g.par);assert.equal(Object.keys(g.head).length,level.trains.length);
}
console.log('PASS: end/centre fixed-head signals, reverse without identity mutation, blocked head refuses chain, three generated head-bearing puzzle round trips and par.');
