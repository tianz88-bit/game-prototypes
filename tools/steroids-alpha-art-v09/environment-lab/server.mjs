import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here),port=5342;
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&u.pathname==='/api/still'){
  if(req.headers.origin!==`http://127.0.0.1:${port}`||req.headers['content-type']!=='image/png'){res.writeHead(403);return res.end();}
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>8e6)throw Error('Too large');chunks.push(c);}
  const mode=u.searchParams.get('mode');const name=mode==='comparison'?'planet-comparison-v09.png':u.searchParams.get('curved')!=='true'?'planet-flat-v09.png':mode==='edge'?'planet-edge-v09.png':mode==='horizon'?'planet-horizon-v09.png':'planet-circular-v09.png';
  await fs.writeFile(path.join(here,name),Buffer.concat(chunks));res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({saved:name}));
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const f=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/environment-lab/index.html':u.pathname));
 if(!f.startsWith(root+path.sep)||path.relative(root,f).split(path.sep).some(x=>x.startsWith('.'))){res.writeHead(403);return res.end();}
 const types={'.html':'text/html','.mjs':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
 const data=await fs.readFile(f);res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:500);res.end(e.message);}}).listen(port,'127.0.0.1',()=>console.log('Environment lab http://127.0.0.1:'+port));
