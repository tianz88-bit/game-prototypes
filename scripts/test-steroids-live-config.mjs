import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createHash,webcrypto} from 'node:crypto';
import {createPublisher,WORKFLOW} from './steroids-lab-server.mjs';
const result=await build({stdin:{contents:`export * from './prototypes/steroids-alpha/sim/liveConfig.ts';export * from './prototypes/steroids-alpha/server/src/configStore.ts';export * from './prototypes/steroids-alpha/server/src/configAuth.ts';export * from './prototypes/steroids-alpha/server/src/room.ts';export * from './prototypes/steroids-alpha/sim/protocol.ts';export * from './prototypes/steroids-alpha-lab/preview.ts';export * from './prototypes/steroids-alpha/server/src/adminAuth.ts';export * from './prototypes/steroids-alpha/server/src/admin.ts';export {default as worker} from './prototypes/steroids-alpha/server/src/index.ts';export {currentData,importSettings,baseVersion} from './prototypes/steroids-alpha-lab/draft.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const S=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const base=S.defaultConfig();assert.deepEqual(S.validateConfig(base),base);
for(const mutate of [d=>d.tune.world.width++,d=>d.tune.net.tickHz++,d=>d.tune.ship.minSpeed=500,d=>d.tune.weapon.fireIntervalSteps=.5,d=>d.calibration.modules.canopy.order.left=2,d=>d.calibration.modules.cockpit.width=Infinity,d=>d.tune.asteroid.radius.push(2),d=>d.clientTune.render.partTextureMax=8]){const d=structuredClone(base);mutate(d);assert.throws(()=>S.validateConfig(d));}
const edited=structuredClone(base);edited.tune.ship.maxSpeed=400;S.validateConfig(edited);
// Exercise the real import handler: calibration-only export must preserve all edited poses and stats.
const priorGlobals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage};
const draftStorage=new Map();let configEvents=0;
globalThis.document={querySelector:()=>({textContent:''})};globalThis.window={dispatchEvent:()=>{configEvents++;}};globalThis.localStorage={setItem:(k,v)=>draftStorage.set(k,v)};
try{
 const original=structuredClone(S.currentData()),rig=structuredClone(original.calibration);
 rig.modules.cockpit.offsets={up:{x:0,y:-50},right:{x:35,y:-20},down:{x:0,y:50},left:{x:-35,y:-20}};
 const baselineVersion=S.baseVersion;
 S.importSettings(JSON.parse(JSON.stringify(rig)));
 assert.deepEqual(S.currentData().calibration,rig);assert.deepEqual(S.currentData().tune,original.tune);assert.deepEqual(S.currentData().clientTune,original.clientTune);assert.equal(S.baseVersion,baselineVersion);
 const roundtrip=JSON.parse(JSON.stringify(S.currentData()));S.importSettings(roundtrip);assert.deepEqual(S.currentData(),roundtrip);
 const reference=await import('../prototypes/steroids-alpha-lab/rig.mjs');
 for(const angle of [0,45,90,135,180,225,270,315])for(const part of reference.modules)assert.deepEqual(reference.pose(part,angle,S.currentData().calibration),reference.pose(part,angle,rig),'Roundtrip preserves pose for '+part.id+' at '+angle);
 const beforeBad=structuredClone(S.currentData()),events=configEvents;assert.throws(()=>S.importSettings({version:7,modules:{}}));assert.deepEqual(S.currentData(),beforeBad);assert.equal(configEvents,events);
 assert.ok(draftStorage.size);S.importSettings(original);
}finally{for(const [key,value]of Object.entries(priorGlobals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
const input={accelerate:true,brake:false,left:false,right:false};
S.resetPreview();const slow=S.advancePreview(0,input,1/30).speed;
S.currentData().tune.ship.acceleration*=2;S.resetPreview();const fast=S.advancePreview(0,input,1/30).speed;
assert.ok(fast>slow,'Draft acceleration drives the actual shared simulation preview');S.currentData().tune.ship.acceleration/=2;
class Storage {data=new Map();queue=Promise.resolve();async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.data.set(k,structuredClone(v));}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p;}}
const store=new Storage();const raced=await Promise.allSettled([S.publishConfig(store,'bundled',edited,'owner'),S.publishConfig(store,'bundled',base,'stale')]);assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);const active=(await store.get('settings')).active;assert.equal(active.version,createHash('sha256').update(JSON.stringify(edited)).digest('hex'));assert.equal((await store.get('settings')).history.length,1);
const now=Math.floor(Date.now()/1000),claims={iss:'https://token.actions.githubusercontent.com',aud:S.AUDIENCE,repository:'tianz88-bit/game-prototypes',repository_id:'1323842834',repository_owner_id:'280732766',ref:'refs/heads/main',workflow_ref:'tianz88-bit/game-prototypes/.github/workflows/publish-steroids-alpha-config.yml@refs/heads/main',event_name:'workflow_dispatch',iat:now,exp:now+300,actor:'tianz88-bit'};
S.checkClaims(claims);for(const patch of [{ref:'refs/heads/attacker'},{repository:'attacker/repo'},{repository_id:'1'},{repository_owner_id:'1'},{workflow_ref:'another-workflow'},{aud:'wrong'},{exp:now-100},{iat:now+500}])assert.throws(()=>S.checkClaims({...claims,...patch}));
const keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await webcrypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';
const realFetch=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,'https://token.actions.githubusercontent.com/.well-known/jwks');return Response.json({keys:[jwk]});};
const head=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url'),payload=Buffer.from(JSON.stringify(claims)).toString('base64url'),message=head+'.'+payload,signature=Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(message))).toString('base64url');
assert.equal(await S.authorizePublisher('Bearer '+message+'.'+signature),'tianz88-bit');await assert.rejects(S.authorizePublisher('Bearer '+message+'.'+Buffer.alloc(256).toString('base64url')));await assert.rejects(S.authorizePublisher(null));globalThis.fetch=realFetch;
await assert.rejects(S.authorizePublisher('Bearer '+Buffer.from(JSON.stringify({alg:'none',kid:'test-key'})).toString('base64url')+'.'+payload+'.'));
await assert.rejects(S.readBounded(new Request('https://example.test/',{method:'POST',body:'x'.repeat(33000)})));
class Socket extends EventTarget {sent=[];closed=null;send(v){this.sent.push(v);}close(code){this.closed=code;this.dispatchEvent(new Event('close'));}}
const room=new S.Room(100000),socket=new Socket();room.join(socket);room.stop();const player=[...room.players.values()][0];player.started=true;player.ship.heading=0;player.ship.speed=260;player.ship.x=2000;player.ship.y=2000;
for(let i=1;i<=70;i++)room.onMessage(player,S.encodeInput({seq:i,turn:0,aim:NaN,thrust:0,fire:false}));await player.reading;assert.ok(player.queue.length<=base.tune.net.maxQueuedInputs);const x=player.ship.x;room.stepPlayer(player);assert.ok(Math.abs(player.ship.x-x-260/base.tune.net.tickHz)<1e-6,'Flooded input queue never buys a second movement step');
room.applyConfig(active);assert.equal(player.queue.length,0);assert.equal(player.started,false);assert.ok(socket.sent.some(x=>typeof x==='string'&&JSON.parse(x).record?.version===active.version));
for(let i=0;i<60;i++)room.onMessage(player,S.encodePing(S.MSG.PING,1));assert.equal(socket.closed,1008,'Excess packet rate rejected');
const otherRoom=new S.Room(),bad=new Socket();otherRoom.join(bad);otherRoom.stop();const p=[...otherRoom.players.values()][0];otherRoom.onMessage(p,new ArrayBuffer(100000));assert.equal(bad.closed,S.CLOSE.BAD_PROTOCOL);
const legacy=S.defaultConfig();legacy.tune.ship.maxHp+=legacy.tune.ship.maxShield;delete legacy.tune.ship.maxShield;
const legacyRecord={...S.bundledRecord(),version:'a'.repeat(64),data:legacy};let savedRecords=[];
let liveRecord=S.bundledRecord(),calls=[];const server=createPublisher({model:S,staticDir:'.',knownRecords:[legacyRecord],saveRecords:async records=>{savedRecords=records;},live:async()=>liveRecord,api:async(endpoint,body)=>{calls.push({endpoint,body});return {workflow_runs:[]};}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const post=(route,body,headers={})=>fetch(origin+'/api/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Steroids-Local':'1',...headers},body:JSON.stringify(body)});
try{
 assert.equal((await post('load',{}, {Origin:'https://evil.example'})).status,403);assert.equal((await post('load',{}, {'X-Steroids-Local':'0'})).status,403);assert.equal(calls.length,0);
 assert.equal((await (await post('load',{baseVersion:legacyRecord.version})).json()).compatible,true,'Equivalent migrated baseline preserves draft without false conflict');
 assert.equal((await (await post('load',{baseVersion:'b'.repeat(64)})).json()).compatible,false,'Unknown baseline never bypasses stale-write protection');assert.ok(savedRecords.some(r=>r.version==='bundled'));
 const {session}=await (await post('load',{})).json();assert.equal((await post('publish',{session:'forged',data:edited})).status,409);
 const invalid=structuredClone(edited);invalid.tune.net.tickHz=999;assert.equal((await post('publish',{session,data:invalid})).status,400);assert.equal(calls.length,0);
 assert.equal((await fetch(origin+'/.git/config')).status,404);
 assert.equal((await post('publish',{session,data:edited})).status,200);assert.equal(calls.length,1);assert.equal(calls[0].endpoint,`actions/workflows/${WORKFLOW}/dispatches`);assert.equal(calls[0].body.ref,'main');assert.equal(calls[0].body.inputs.expected_version,'bundled');
 liveRecord=active;assert.equal((await (await post('status',{session})).json()).active,true);assert.equal((await post('publish',{session,data:edited})).status,409);
 assert.equal((await (await post('load',{baseVersion:legacyRecord.version})).json()).compatible,false,'Real balance changes still require review');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
console.log('PASS: config validation, atomic stale-write rejection/history, real OIDC signature and claim rejection, live room cutover, input flood/oversize limits, private publisher CSRF/session/fixed-workflow boundaries');

// Hosted owner publishing: real Access signatures, owner restriction and same-origin writes.
{
 const owner='owner@example.test',aud='1'.repeat(64),issuer='https://test-owner-admin.cloudflareaccess.com';
 const accessClaims={iss:issuer,aud:[aud],email:owner,iat:now,exp:now+3600};
 const sign=async(patch={},h={alg:'RS256',kid:'test-key'})=>{const h64=Buffer.from(JSON.stringify(h)).toString('base64url'),p64=Buffer.from(JSON.stringify({...accessClaims,...patch})).toString('base64url'),body=h64+'.'+p64;return body+'.'+Buffer.from(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(body))).toString('base64url');};
 const token=await sign(),adminStore=new Storage();let writes=0;
 const env={ADMIN_ACCESS_TEAM:'test-owner-admin',ADMIN_ACCESS_AUD:aud,ADMIN_OWNER_EMAIL:owner,PLANET_CONFIG:{idFromName:n=>n,get:()=>({fetch:async req=>{if(req.method==='GET')return Response.json((await adminStore.get('settings'))?.active??S.bundledRecord());writes++;const p=await req.json();try{return Response.json(await S.publishConfig(adminStore,p.expectedVersion,p.data,p.actor));}catch(e){return Response.json({error:e.message},{status:409});}}})}};
 const origin='https://steroids-alpha-server.tianz-88.workers.dev';
 const request=(route='/manage/',options={})=>new Request(origin+route,{...options,headers:{'Cf-Access-Jwt-Assertion':token,...options.headers}});
 globalThis.fetch=async url=>{assert.equal(url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 try{
  assert.equal(S.adminConfigured({}),false);assert.equal((await S.adminResponse(request(),{...env,ADMIN_ACCESS_AUD:undefined})).status,503);
  assert.equal((await S.adminResponse(new Request(origin+'/manage/'),env)).status,401);
  for(const patch of [{email:'other@example.test'},{aud:['2'.repeat(64)]},{iss:'https://attacker.example'},{exp:now-1},{iat:now+1000}])await assert.rejects(S.authorizeAdmin(request('/manage/',{headers:{'Cf-Access-Jwt-Assertion':await sign(patch)}}),env));
  await assert.rejects(S.authorizeAdmin(request('/manage/',{headers:{'Cf-Access-Jwt-Assertion':await sign({}, {alg:'none',kid:'test-key'})}}),env));
  const forged=token.slice(0,token.lastIndexOf('.')+1)+Buffer.alloc(256).toString('base64url');await assert.rejects(S.authorizeAdmin(request('/manage/',{headers:{'Cf-Access-Jwt-Assertion':forged}}),env));
  const html=await S.adminResponse(request(),env);assert.equal(html.status,200);assert.match(await html.text(),/Publish settings/);assert.match(html.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  assert.equal((await S.adminResponse(request('/manage/app.js'),env)).status,200);
  const headers={Origin:origin,'Content-Type':'application/json','X-Steroids-Admin':'1','Sec-Fetch-Site':'same-origin'};
  const payload={expectedVersion:'bundled',data:edited};const post=(extra={},body=payload)=>S.adminResponse(request('/manage/api/publish',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)}),env);
  for(const patch of [{Origin:'https://evil.example'},{'X-Steroids-Admin':'0'},{'Sec-Fetch-Site':'cross-site'},{'Content-Type':'text/plain'}])assert.equal((await post(patch)).status,403);
  const bad=structuredClone(payload);bad.data.tune.net.tickHz=1000;assert.equal((await post({},bad)).status,400);assert.equal(writes,0);
  const saved=await post();assert.equal(saved.status,200);const record=await saved.json();assert.equal(record.actor,'Owner (web)');assert.equal(JSON.stringify(record).includes(owner),false);assert.deepEqual(record.data,edited);
  assert.equal((await post()).status,409);assert.equal((await S.adminResponse(request('/manage/api/live'),env)).status,200);
  assert.equal((await S.worker.fetch(new Request(origin+'/health'),env)).status,200);assert.equal((await S.worker.fetch(new Request(origin+'/config'),env)).status,200);assert.equal((await S.worker.fetch(new Request(origin+'/manage/'),env)).status,401);
 }finally{globalThis.fetch=realFetch;}
 console.log('PASS: hosted Access signature, owner/audience/issuer/expiry restrictions, fail-closed setup, CSRF guards, bounded validation, atomic publish and unchanged public routes');
}
