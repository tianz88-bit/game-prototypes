import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file=new URL('./deliveries.json',import.meta.url),manifest=JSON.parse(await fs.readFile(file,'utf8'));
for(const pack of manifest.packs){const r=await fetch(pack.url);if(!r.ok)throw Error(`${pack.id}: HTTP ${r.status}`);const b=Buffer.from(await r.arrayBuffer());if(createHash('sha256').update(b).digest('hex')!==pack.zipSha256)throw Error(pack.id+' remote hash mismatch');pack.remoteVerified=true;console.log(`${pack.id}: HTTP 200, ${b.length} bytes, SHA256 verified`);}
manifest.status='All three public R2 objects downloaded and SHA256 verified';await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n');
