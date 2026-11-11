// Fixed-purpose loopback publisher. Browser receives no GitHub/Cloudflare credential.
import http from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
export const REPO='tianz88-bit/game-prototypes',WORKFLOW='publish-steroids-alpha-config.yml';
export function githubCli(gh='gh'){
 return async(endpoint,body)=>{
  const args=['api',`repos/${REPO}/${endpoint}`];if(body)args.push('--method','POST','--input','-');
  const child=execFile(gh,args,{windowsHide:true,timeout:30000,maxBuffer:1024*1024},()=>{});
  const result=new Promise((resolve,reject)=>{let out='';child.stdout.on('data',c=>out+=c);child.on('error',()=>reject(Error('GitHub CLI is unavailable. Sign in with gh auth login in your terminal.')));child.on('close',code=>{if(code)reject(Error('GitHub request failed; check existing gh authentication and repository access.'));else{try{resolve(out.trim()?JSON.parse(out):{});}catch{reject(Error('Invalid GitHub response'));}}});});child.stdin.end(body?JSON.stringify(body):undefined);return result;
 };
}
export function createPublisher({api,model,staticDir,live=async()=>{const r=await fetch('https://steroids-alpha-server.tianz-88.workers.dev/config',{cache:'no-store'});if(!r.ok)throw Error('Live settings unavailable');return model.parseRecord(await r.json());}}){
 const sessions=new Map();let publishing=false;
 const fail=(message,status=400)=>Object.assign(Error(message),{status});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://steroids-alpha-server.tianz-88.workers.dev; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  try{
   const origin=`http://127.0.0.1:${server.address().port}`;if(req.headers.host!==new URL(origin).host)throw fail('Invalid host',403);
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/api/')){
    if(req.method!=='POST'||req.headers.origin!==origin||req.headers['content-type']!=='application/json'||req.headers['x-steroids-local']!=='1'||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))throw fail('Private same-origin publisher only',403);
    let text='';for await(const c of req){text+=c;if(Buffer.byteLength(text)>32768)throw fail('Settings too large',413);}let body;try{body=JSON.parse(text);}catch{throw fail('Invalid JSON');}
    if(url.pathname==='/api/load'){const record=await live(),session=randomBytes(32).toString('hex');if(sessions.size>32)sessions.delete(sessions.keys().next().value);sessions.set(session,{version:record.version,at:Date.now()});return json(200,{session,version:record.version});}
    const baseline=sessions.get(body.session);if(!baseline||Date.now()-baseline.at>3600000)throw fail('Load live settings before publishing',409);
    if(url.pathname==='/api/status'){
     const record=await live();let runs=[];if(baseline.requestedAt){const result=await api(`actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=8`);runs=result.workflow_runs.filter(r=>r.created_at>=baseline.requestedAt);}
     return json(200,{active:record.version===baseline.target,version:record.version,failed:runs.length>0&&runs[0].status==='completed'&&runs[0].conclusion!=='success'});
    }
    if(url.pathname!=='/api/publish')throw fail('Not found',404);if(publishing)throw fail('Publish already in progress',409);publishing=true;
    try{const record=await live();if(record.version!==baseline.version)throw fail('Live settings changed; reload and review',409);let data;try{data=model.validateConfig(body.data);}catch(e){throw fail(e.message,400);}baseline.target=createHash('sha256').update(JSON.stringify(data)).digest('hex');baseline.requestedAt=new Date().toISOString();await api(`actions/workflows/${WORKFLOW}/dispatches`,{ref:'main',inputs:{payload:JSON.stringify(data),expected_version:baseline.version}});return json(200,{url:`https://github.com/${REPO}/actions/workflows/${WORKFLOW}`});}finally{publishing=false;}
   }
   if(req.method!=='GET')throw fail('Method not allowed',405);
   const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!/^(index\.html|assets\/[a-zA-Z0-9_.-]+|ship-art\/human-nomad-v1-[a-z-]+\.png)$/.test(relative))throw fail('Not found',404);
   const data=await readFile(path.join(staticDir,relative));res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(relative)]||'application/octet-stream'});res.end(data);
  }catch(e){json(e.status??500,{error:e.status?e.message:'Publisher failed. Check GitHub login and the live server.'});}
 });return server;
}
