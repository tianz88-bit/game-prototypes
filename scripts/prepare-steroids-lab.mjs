// Reuse the verified production loose art, never add PNGs to Git.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const root=process.cwd(),manifest=JSON.parse(await fs.readFile('prototypes/steroids-alpha/art/human-nomad-v1/ship-assets.json','utf8'));
const dest=path.join(root,'public/prototypes/steroids-alpha-lab/ship-art');await fs.mkdir(dest,{recursive:true});
for(const a of manifest.assets){const name=`human-nomad-v1-${a.asset}.png`,source=path.join(root,'public/prototypes/steroids-alpha/assets/loose',name),b=await fs.readFile(source);if(createHash('sha256').update(b).digest('hex')!==a.sha256)throw Error('Lab art checksum mismatch: '+a.asset);await fs.writeFile(path.join(dest,name),b);}
console.log('Prepared '+manifest.assets.length+' verified ship textures for permanent lab');

// Review-only Missile Cruiser kit. This does not stage assets into the live game.
const missile=JSON.parse(await fs.readFile('prototypes/steroids-alpha-lab/evolution/assets.json','utf8'));
const {default:AdmZip}=await import('adm-zip');
const response=await fetch(missile.url);if(!response.ok)throw Error(`Missile Cruiser review art HTTP ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==missile.zipSha256)throw Error('Missile Cruiser zip checksum mismatch');
const zip=new AdmZip(bytes);
for(const a of missile.assets){const data=zip.getEntry(a.deliveryPath)?.getData();if(!data||createHash('sha256').update(data).digest('hex')!==a.sha256)throw Error('Missile Cruiser part checksum mismatch: '+a.asset);await fs.writeFile(path.join(dest,`missile-cruiser-v1-${a.asset}.png`),data);}
console.log('Prepared '+missile.assets.length+' verified Missile Cruiser review parts');
