import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain'};
const port=Number(process.env.PORT||5337);
// Keep the draft outside the app folder so replacing code/assets doesn't erase it.
const draftPath=path.join(root,'..','punchies-rig-tuning-draft.json');
const baselinePath=path.join(root,'..','rig-calibration','marco-boxer','approved-2026-10-27.json');
const gapKeys=['footAbdomen','abdomenTorso','torsoHead','headHair'];
function validateDraft(input,targetDraftPath=draftPath){
 if(input?.version!==1)throw Error('Unsupported tuning version');
 const offsets={};
 let previous={};try{previous=JSON.parse(fs.readFileSync(targetDraftPath,'utf8').replace(/^\uFEFF/,''));}catch{}
 for(const direction of ['down','side','up']){offsets[direction]={};for(const key of gapKeys){const value=input.offsets?.[direction]?.[key];if(typeof value!=='number'||!Number.isFinite(value)||value< -10||value>80)throw Error('Invalid '+direction+' '+key);offsets[direction][key]=value;}}
 offsets.left={};for(const key of gapKeys){const value=input.offsets?.left?.[key]??previous.offsets?.left?.[key]??offsets.side[key];if(!Number.isFinite(value)||value< -10||value>80)throw Error('Invalid left '+key);offsets.left[key]=value;}
 if(!['split','merged'].includes(input.headMode)||!Number.isFinite(input.zoom)||input.zoom<1||input.zoom>3)throw Error('Invalid display settings');
 const existingSide=previous.sideX||{};
 const sideX={};for(const key of ['abdomen','torso','head','hair']){const value=input.sideX?.[key]??existingSide[key]??0;if(!Number.isFinite(value)||Math.abs(value)>40)throw Error('Invalid horizontal '+key);sideX[key]=value;}
 const leftX={};for(const key of ['abdomen','torso','head','hair']){const value=input.leftX?.[key]??previous.leftX?.[key]??-sideX[key];if(!Number.isFinite(value)||Math.abs(value)>40)throw Error('Invalid left horizontal '+key);leftX[key]=value;}
 const breathMode=input.breathMode??previous.breathMode??'slow';if(!['off','slow','fast'].includes(breathMode))throw Error('Invalid breathing mode');
 return {version:1,offsets,sideX,leftX,zoom:input.zoom,headMode:input.headMode,breathMode,savedAt:new Date().toISOString()};
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
http.createServer((req,res)=>{let name,requestUrl;try{requestUrl=new URL(req.url,'http://localhost');name=decodeURIComponent(requestUrl.pathname);}catch{res.writeHead(400);res.end();return;}
if(name==='/api/comparison-video'){
 const allowed=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
 if(req.method!=='POST'||!allowed.has('http://'+req.headers.host)||!allowed.has(req.headers.origin)){json(res,403,{error:'Local capture only'});return;}
 const extension=req.headers['content-type']?.startsWith('video/mp4')?'mp4':req.headers['content-type']?.startsWith('video/webm')?'webm':null;
 if(!extension){json(res,415,{error:'Video required'});return;}
 let size=0,oversize=false;const chunks=[];
 req.on('data',chunk=>{size+=chunk.length;if(size>=20000000){oversize=true;return;}chunks.push(chunk);});
 req.on('end',()=>{if(oversize){json(res,413,{error:'Video exceeds 20 MB'});return;}const file='marco-old-vs-new-turnaround.'+extension;fs.writeFileSync(path.join(root,file),Buffer.concat(chunks));json(res,200,{file,bytes:size});});return;
}
if(name==='/api/approved'){

 if(req.method!=='GET'){json(res,405,{error:'Approved baseline is read-only'});return;}
 try{json(res,200,JSON.parse(fs.readFileSync(baselinePath,'utf8').replace(/^\uFEFF/,'')));}catch{json(res,500,{error:'Approved baseline unavailable'});}return;
}
if(name==='/api/tuning'){
 const profile=requestUrl.searchParams.get('profile')||'boxer';
 if(!['boxer','casual','dummy'].includes(profile)){json(res,400,{error:'Unknown outfit profile'});return;}
 const targetDraftPath=profile!=='boxer'?path.join(root,'..','punchies-rig-tuning-'+profile+'-draft.json'):draftPath;
 const allowed=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
 if(!allowed.has('http://'+req.headers.host)||(req.headers.origin&&!allowed.has(req.headers.origin))){json(res,403,{error:'Local same-origin requests only'});return;}
 if(req.method==='GET'){try{const savedPath=fs.existsSync(targetDraftPath)?targetDraftPath:profile!=='boxer'?baselinePath:targetDraftPath;json(res,200,JSON.parse(fs.readFileSync(savedPath,'utf8').replace(/^\uFEFF/,'')));}catch(error){json(res,error.code==='ENOENT'?404:500,{error:'Tuning draft unavailable'});}return;}
 if(req.method!=='POST'){json(res,405,{error:'Use GET or POST'});return;}
 if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'Use JSON'});return;}
 let body='',size=0,tooLarge=false;
 req.on('data',chunk=>{size+=chunk.length;if(size>16384){tooLarge=true;return;}body+=chunk;});
 req.on('end',()=>{if(tooLarge){json(res,413,{error:'Draft too large'});return;}try{const draft=validateDraft(JSON.parse(body),targetDraftPath);fs.writeFileSync(targetDraftPath+'.tmp',JSON.stringify(draft,null,2)+'\n');fs.renameSync(targetDraftPath+'.tmp',targetDraftPath);json(res,200,{savedAt:draft.savedAt});}catch(error){json(res,400,{error:error.message});}});
 return;
}
if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
}).listen(port,'127.0.0.1',()=>console.log(`Marco rig study: http://127.0.0.1:${port}`));

