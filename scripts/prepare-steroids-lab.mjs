// Reuse the verified production loose art, never add PNGs to Git.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const root=process.cwd(),manifest=JSON.parse(await fs.readFile('prototypes/steroids-alpha/art/human-nomad-v1/ship-assets.json','utf8'));
const dest=path.join(root,'public/prototypes/steroids-alpha-lab/ship-art');await fs.mkdir(dest,{recursive:true});
for(const a of manifest.assets){const name=`human-nomad-v1-${a.asset}.png`,source=path.join(root,'public/prototypes/steroids-alpha/assets/loose',name),b=await fs.readFile(source);if(createHash('sha256').update(b).digest('hex')!==a.sha256)throw Error('Lab art checksum mismatch: '+a.asset);await fs.writeFile(path.join(dest,name),b);}
console.log('Prepared '+manifest.assets.length+' verified ship textures for permanent lab');
