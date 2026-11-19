import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({stdin:{contents:"export {channelRuns} from './prototypes/densha-domino/src/render/channelRuns';export {LEVELS,parseLevel} from './prototypes/densha-domino/src/game/levels';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {channelRuns,LEVELS,parseLevel}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const fixture=parseLevel('dead ends',['.......','.AA#...','.......','...B...','...B...','...#...','.......'],{}, {A:1,B:1});
assert.deepEqual(channelRuns(fixture),[{axis:'h',line:1,start:0,end:3},{axis:'v',line:3,start:2,end:5}]);
// The right-hand pocket and the bottom pocket have no train: no track or exit.
assert.equal(channelRuns(fixture).filter(r=>r.end===(r.axis==='h'?fixture.cols:fixture.rows)).length,0);
for(const level of LEVELS){
 const runs=channelRuns(level);
 for(const r of runs)for(let n=r.start;n<r.end;n++)assert.ok(!level.obstacles.has(r.axis==='h'?r.line*level.cols+n:n*level.cols+r.line),'Channel must never enter a fixed-block tile');
 for(const t of level.trains)assert.ok(runs.some(r=>r.axis===t.axis&&r.line===t.line&&r.start<=t.start&&r.end>=t.start+t.len),'Every train must retain its entire usable lane');
}
console.log('PASS: square cell-boundary runs, no tracks beneath fixed blocks or in disconnected dead-end pockets, all 100 boards retain every train lane.');
