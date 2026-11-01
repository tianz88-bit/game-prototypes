import assert from 'node:assert/strict';
import http from 'node:http';
import {build} from 'esbuild';
import {createCompanion,TUNE_PATH} from './punchies-github-server.mjs';
const bundle=await build({entryPoints:['prototypes/punchies-tuner/src/model.ts'],bundle:true,platform:'node',format:'esm',write:false});
const model=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
let remote=model.defaults(),sha='file-1',branch='trunk',writes=0,race=false,failWrite=false;
delete remote.balanceWorkshop?.baseHistory;
const api=async(endpoint,body)=>{
  if(endpoint==='')return{default_branch:branch};
  if(endpoint.startsWith('actions/runs?'))return{workflow_runs:[{name:'Deploy Pages',status:'completed',conclusion:'success',html_url:'https://github.com/tianz88-bit/game-prototypes/actions/runs/123'}]};
  if(!body){assert.equal(endpoint,`contents/${TUNE_PATH}?ref=${encodeURIComponent(branch)}`);return{sha,encoding:'base64',content:Buffer.from(JSON.stringify(remote)).toString('base64')};}
  assert.equal(endpoint,`contents/${TUNE_PATH}`);assert.equal(body.branch,branch);assert.equal(body.sha,sha);
  if(race||failWrite)throw Object.assign(Error(race?'GitHub changed during Save':'Authentication failed'),{status:race?409:502});
  writes++;remote=JSON.parse(Buffer.from(body.content,'base64'));sha=`file-${writes+1}`;
  return{content:{sha},commit:{sha:`commit-${writes}`,html_url:'https://github.com/tianz88-bit/game-prototypes/commit/mock'}};
};
const server=createCompanion({api,model,staticDir:'.local/punchies-tuner'});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const request=async(action,body={},headers={})=>{
  const response=await fetch(`${origin}/api/${action}`,{method:'POST',headers:{origin,'Content-Type':'application/json','X-Punchies-Local':'1',...headers},body:JSON.stringify(body)});
  return{code:response.status,data:await response.json()};
};
try{
  assert.equal((await request('load',{}, {origin:'https://evil.example'})).code,403);
  assert.equal((await request('load',{}, {'X-Punchies-Local':''})).code,403);
  assert.equal((await request('load',{}, {'sec-fetch-site':'cross-site'})).code,403);
  const wrongHost=await new Promise((resolve,reject)=>{const req=http.request(`${origin}/api/load`,{method:'POST',headers:{host:'evil.example',origin,'Content-Type':'application/json','X-Punchies-Local':'1'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end('{}');});
  assert.equal(wrongHost,403);
  assert.equal((await fetch(`${origin}/api/load`)).status,403);
  assert.equal((await fetch(`${origin}/scripts/punchies-github-server.mjs`)).status,404);
  assert.equal((await fetch(`${origin}/local-mode.json`)).status,200);
  assert.equal((await request('save',{session:'guessed',draft:remote})).code,409);
  const loaded=(await request('load')).data;assert.equal(loaded.branch,'trunk');assert.equal(loaded.sha,sha);
  const draft=structuredClone(loaded.doc);model.set(draft,'characters.mia.hp',.9);
  remote.view.headOffsetY=-3;remote.futureLocalisation={keep:true};sha='concurrent-file';
  draft.futureLocalisation={keep:false}; // Unknown fields are never writable through the editor.
  const saved=await request('save',{session:loaded.session,draft});assert.equal(saved.code,200);assert.equal(writes,1);
  assert.equal(remote.characters.mia.hp,.9);assert.equal(remote.view.headOffsetY,-3);assert.deepEqual(remote.futureLocalisation,{keep:true});
  assert.equal(saved.data.commit.sha,'commit-1');assert.equal(saved.data.sha,sha);
  assert.equal((await request('status',{session:loaded.session})).data.runs[0].conclusion,'success');
  assert.equal((await request('save',{session:loaded.session,draft:saved.data.doc})).data.commit,null);assert.equal(writes,1);
  const invalid=structuredClone(remote);invalid.characters.mia.hp=999;
  assert.equal((await request('save',{session:loaded.session,draft:invalid})).code,400);assert.equal(writes,1);
  const next=structuredClone(remote);model.set(next,'characters.mia.hp',1);remote.characters.mia.hp=.8;
  assert.equal((await request('save',{session:loaded.session,draft:next})).code,409);assert.equal(writes,1);
  const reload=(await request('load')).data;const nextDraft=structuredClone(reload.doc);model.set(nextDraft,'characters.mia.hp',1);
  race=true;assert.equal((await request('save',{session:reload.session,draft:nextDraft})).code,409);assert.equal(writes,1);race=false;
  failWrite=true;assert.equal((await request('save',{session:reload.session,draft:nextDraft})).code,502);assert.equal(writes,1);failWrite=false;
  branch='new-default';assert.equal((await request('save',{session:reload.session,draft:nextDraft})).code,409);assert.equal(writes,1);
  branch='trunk';assert.equal((await request('save',{session:reload.session,draft:nextDraft})).code,200);assert.equal(writes,2);
  const baseLoaded=(await request('load')).data,baseDraft=structuredClone(baseLoaded.doc);model.set(baseDraft,'health.max',110);
  const baseSaved=await request('save',{session:baseLoaded.session,draft:baseDraft});assert.equal(baseSaved.code,200);assert.equal(model.baseVersion(remote),1);
  assert.equal(remote.balanceWorkshop.baseHistory.versions[0].changes[0].before,100);assert.equal(remote.balanceWorkshop.baseHistory.versions[0].changes[0].after,110);
  assert.equal(model.baseVersion((await request('load')).data.doc),1,'GitHub reload preserves Base history');
  model.set(baseDraft,'health.max',120);race=true;
  assert.equal((await request('save',{session:baseLoaded.session,draft:baseDraft})).code,409);assert.equal(model.baseVersion(remote),1,'Rejected write does not persist a revision');race=false;
  const baseSecond=await request('save',{session:baseLoaded.session,draft:baseDraft});assert.equal(baseSecond.code,200);assert.equal(model.baseVersion(remote),2);
  assert.equal((await request('save',{session:baseLoaded.session,draft:baseSecond.data.doc})).data.commit,null);assert.equal(model.baseVersion(remote),2);
  const textLoaded=(await request('load')).data,textDraft=structuredClone(textLoaded.doc);model.setArchetype(textDraft,'char.mia.nick','Counter Specialist');
  const textSaved=await request('save',{session:textLoaded.session,draft:textDraft});assert.equal(textSaved.code,200);assert.deepEqual(textSaved.data.edited,['char.mia.nick']);assert.equal(model.baseVersion(remote),2);
  assert.equal(model.archetypeValue((await request('load')).data.doc,'char.mia.nick'),'Counter Specialist');
  model.setArchetype(textDraft,'char.mia.nick','Fast Counter');model.setArchetype(remote,'char.mia.nick','Brawler');
  assert.equal((await request('save',{session:textLoaded.session,draft:textDraft})).code,409);assert.equal(model.archetypeValue(remote,'char.mia.nick'),'Brawler');
  console.log('PASS: HTTP load/edit/save, actual default branch, selective merge, unknown-field preservation, conflict/SHA race, failed-write retry, no-op, build status, origin/header/host guards and static isolation');
}finally{if(!process.argv.includes('--serve'))await new Promise(resolve=>server.close(resolve));}
if(process.argv.includes('--serve')){
  remote=model.defaults();sha='file-1';writes=0;
  console.log(`Mock-only browser verification: ${origin}/ (never calls GitHub)`);
}
