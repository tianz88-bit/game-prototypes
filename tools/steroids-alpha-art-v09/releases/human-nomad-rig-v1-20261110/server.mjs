import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {seed,validate} from './rig.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||5340);
const draft=path.join(root,'calibration-draft.json');
const json=(r,status,obj)=>{r.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});r.end(JSON.stringify(obj));};
let writes=Promise.resolve();
const server=http.createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,'http://localhost'),name=decodeURIComponent(u.pathname);
 if(name==='/api/calibration'){
 const allowed=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 if(!allowed.has(req.headers.host)||req.headers.origin&&!allowed.has(new URL(req.headers.origin).host))return json(res,403,{error:'Local same-origin only'});
 if(req.method==='GET'){try{return json(res,200,validate(JSON.parse(await fs.readFile(draft,'utf8'))));}catch(e){if(e.code==='ENOENT')return json(res,200,seed());throw e;}}
 if(req.method==='POST'){
 if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON required'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>32768)return json(res,413,{error:'Too large'});}
 let value;try{value=validate(JSON.parse(body));}catch(e){return json(res,400,{error:e.message});}
 writes=writes.catch(()=>{}).then(async()=>{await fs.writeFile(draft+'.tmp',JSON.stringify(value,null,2)+'\n');await fs.rename(draft+'.tmp',draft);});await writes;return json(res,200,{saved:true});
 }return json(res,405,{error:'GET or POST only'});
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||path.basename(file).startsWith('.')){res.writeHead(403);res.end();return;}
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.json':'application/json','.txt':'text/plain'};
 const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:500);res.end(e.code==='ENOENT'?'Not found':'Local lab error');}
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Human Nomad rotation lab http://127.0.0.1:${port}`));
