import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import AdmZip from 'adm-zip';
const root=path.dirname(fileURLToPath(import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const ids=process.argv.slice(2);if(ids.some(id=>!['interceptor','battlecruiser'].includes(id)))throw Error('Use interceptor or battlecruiser');
for(const id of ids.length?ids:['interceptor','battlecruiser']){
 const m=JSON.parse(await fs.readFile(path.join(root,id,'ship-assets.json'),'utf8')),r=await fetch(m.url);if(!r.ok)throw Error(`${id} HTTP ${r.status}`);const bytes=Buffer.from(await r.arrayBuffer());if(hash(bytes)!==m.zipSha256)throw Error(id+' ZIP hash mismatch');const zip=new AdmZip(bytes);
 for(const a of m.assets){const e=zip.getEntry(a.deliveryPath);if(!e)throw Error('Missing '+a.deliveryPath);const b=e.getData();if(hash(b)!==a.sha256)throw Error('Asset hash mismatch');const target=path.resolve(root,id,a.localPath),allowed=path.resolve(root,id,'assets')+path.sep;if(!target.startsWith(allowed))throw Error('Unsafe local asset path');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,b);}
 console.log(`Verified and restored ${id}: ${m.assets.length} exact source PNGs`);
}
