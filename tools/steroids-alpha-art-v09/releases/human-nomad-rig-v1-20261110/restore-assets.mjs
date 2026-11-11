// Reuse game-prototypes' existing adm-zip dependency. Full local archive needs no restore.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(root,'ship-manifest.json'),'utf8'));
if((await Promise.all([...manifest.assets.map(a=>a.path),'vendor/phaser.min.js'].map(p=>fs.access(path.join(root,p)).then(()=>true,()=>false)))).every(Boolean)){
 console.log('Assets already present; run node verify-baseline.mjs');
}else{
 const status=JSON.parse(await fs.readFile(path.join(root,'storage-status.json'),'utf8'));
 const item=status.r2?.snapshot;if(!item?.verified||!item.sha256||!item.url)throw Error('No verified snapshot download recorded');
 let AdmZip;try{AdmZip=createRequire(import.meta.url)('adm-zip');}catch{throw Error('Run from a game-prototypes checkout with its existing npm dependencies installed, or download/extract the full snapshot ZIP manually');}
 const response=await fetch(item.url);if(!response.ok)throw Error('Snapshot download failed: '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Snapshot checksum mismatch');
 for(const entry of new AdmZip(bytes).getEntries()){
  const name=entry.entryName.replaceAll('\\','/');if(entry.isDirectory||!['assets/','vendor/','review/'].some(p=>name.startsWith(p)))continue;
  const target=path.resolve(root,name);if(!target.startsWith(root+path.sep))throw Error('Unsafe archive path');
  try{await fs.access(target);continue;}catch{}
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,entry.getData());
 }
 console.log('Restored missing art/vendor/reference files only; calibration and source code were preserved. Run node verify-baseline.mjs');
}
