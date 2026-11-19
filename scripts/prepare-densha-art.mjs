// Copies the owner's approved local sheets into the existing ignored asset pipeline.
// Does not upload or publish. No bitmap files are committed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import AdmZip from 'adm-zip';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(process.argv[2]??path.join(root,'../../outputs/densha-domino-art-lab-v2'));
const loose=path.join(root,'prototypes/densha-domino/assets-src/loose');fs.mkdirSync(loose,{recursive:true});
const files=['train-family-atlas.png','sushi-plate-atlas.png','restaurant-atlas.png','plastic-tunnel-atlas.png'];
const zip=new AdmZip();for(const file of files){fs.copyFileSync(path.join(source,file),path.join(loose,file));zip.addLocalFile(path.join(loose,file),'loose');}
const tunnel='serving-tunnel-source.png',newTunnel=path.join(source,tunnel);if(fs.existsSync(newTunnel))fs.copyFileSync(newTunnel,path.join(loose,tunnel));if(fs.existsSync(path.join(loose,tunnel)))zip.addLocalFile(path.join(loose,tunnel),'loose');
fs.mkdirSync(path.join(root,'.cache'),{recursive:true});zip.writeZip(path.join(root,'.cache/densha-domino_assets.zip'));
execFileSync(process.execPath,[path.join(root,'scripts/pack-assets.js'),'densha-domino'],{cwd:root,stdio:'inherit'});
console.log('Prepared approved local art and .cache/densha-domino_assets.zip; no upload performed.');
