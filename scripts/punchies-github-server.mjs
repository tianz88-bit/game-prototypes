import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export const REPO='tianz88-bit/game-prototypes';
export const TUNE_PATH='prototypes/punchies/tune.json';
export function githubCli(gh='gh') {
  return async (endpoint,body) => {
    // Only fixed GitHub API endpoints constructed by this module; no shell.
    const args=['api',`repos/${REPO}${endpoint?'/'+endpoint:''}`];
    if(body)args.push('--method','PUT','--input','-');
    const child=execFile(gh,args,{windowsHide:true,timeout:30000,maxBuffer:2*1024*1024},()=>{});
    const result=new Promise((resolve,reject)=>{
      let out='',err='';child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);
      child.on('error',reject);child.on('close',code=>{
        if(code!==0){const error=Error(/HTTP 409|HTTP 422/.test(err)?'GitHub changed during Save. Load latest and review your draft before retrying.':'GitHub request failed. Check gh auth status and repository permissions in your terminal.');error.status=/HTTP 409|HTTP 422/.test(err)?409:502;reject(error);}
        else {try{resolve(JSON.parse(out));}catch{reject(Error('Unexpected GitHub response'));}}
      });
    });
    child.stdin.end(body?JSON.stringify(body):undefined);
    return result;
  };
}
export function createCompanion({api,model,staticDir}) {
  const sessions=new Map();
  let saving=false;
  const fail=(message,status=400)=>Object.assign(Error(message),{status});
  async function latest(branch){
    const file=await api(`contents/${TUNE_PATH}?ref=${encodeURIComponent(branch)}`);
    if(file.encoding!=='base64'||typeof file.sha!=='string')throw fail('Unexpected tune.json response',502);
    return {sha:file.sha,doc:model.parse(Buffer.from(file.content,'base64').toString('utf8'))};
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    try{
      const origin=`http://127.0.0.1:${server.address().port}`;
      if(req.headers.host!==new URL(origin).host)throw fail('Invalid host',403);
      const url=new URL(req.url,origin);
      if(url.pathname.startsWith('/api/')){
        if(req.method!=='POST'||req.headers.origin!==origin||req.headers['content-type']!=='application/json'||req.headers['x-punchies-local']!=='1')throw fail('Same-origin local requests only',403);
        if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')throw fail('Cross-site request rejected',403);
        let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>256*1024)throw fail('Request too large',413);}
        let body;try{body=JSON.parse(text);}catch{throw fail('Invalid JSON');}
        if(url.pathname==='/api/load'){
          const {default_branch:branch}=await api('');
          if(typeof branch!=='string')throw fail('No default branch',502);
          const file=await latest(branch),session=randomBytes(32).toString('hex');
          if(sessions.size>=32)sessions.delete(sessions.keys().next().value);
          sessions.set(session,{branch,...file});
          return json(200,{session,branch,...file,repo:REPO});
        }
        const baseline=sessions.get(body.session);
        if(!baseline)throw fail('Load latest before saving or checking builds',409);
        if(url.pathname==='/api/status'){
          if(!baseline.commit)return json(200,{runs:[]});
          const result=await api(`actions/runs?head_sha=${baseline.commit}&per_page=20`);
          return json(200,{runs:result.workflow_runs.map(run=>({name:run.name,status:run.status,conclusion:run.conclusion,url:run.html_url}))});
        }
        if(url.pathname!=='/api/save')throw fail('Not found',404);
        if(saving)throw fail('Another save is in progress. Try again when it finishes.',409);
        saving=true;
        try{
          const {default_branch:branch}=await api('');
          if(branch!==baseline.branch)throw fail('Default branch changed. Load latest before saving.',409);
          let draft;try{draft=model.parse(JSON.stringify(body.draft));}catch(error){throw fail(error.message);}
          const file=await latest(branch);
          let merged;try{merged=model.mergeSave(baseline.doc,draft,file.doc);}catch(error){throw fail(error.message,409);}
          const edited=model.saveChanges(file.doc,merged);
          if(!edited.length){baseline.doc=file.doc;baseline.sha=file.sha;return json(200,{doc:file.doc,sha:file.sha,commit:null,edited:[]});}
          const result=await api(`contents/${TUNE_PATH}`,{message:`Tune Punchies balance (${edited.length} values)`,branch,sha:file.sha,content:Buffer.from(JSON.stringify(merged,null,2)+'\n').toString('base64')});
          baseline.doc=merged;baseline.sha=result.content.sha;baseline.commit=result.commit.sha;
          return json(200,{doc:merged,sha:baseline.sha,commit:{sha:result.commit.sha,url:result.commit.html_url},edited});
        }finally{saving=false;}
      }
      if(req.method!=='GET')throw fail('Method not allowed',405);
      if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
      if(url.pathname==='/local-mode.json')return json(200,{github:true,repo:REPO});
      // Only serve the dedicated tuner build. Never serve repo files or credentials.
      const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(!/^(index\.html|assets\/[a-zA-Z0-9_.-]+)$/.test(relative))throw fail('Not found',404);
      const data=await readFile(path.join(staticDir,relative));
      const ext=path.extname(relative);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[ext]??'application/octet-stream'});res.end(data);
    }catch(error){json(error.status??(error.code==='ENOENT'?404:500),{error:error.status?error.message:'Local companion failed. See terminal / check GitHub access.'});}
  });
  return server;
}
