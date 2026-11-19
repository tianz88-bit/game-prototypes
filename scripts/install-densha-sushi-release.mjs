// Install the independently versioned sushi build beside the original Claude game.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import AdmZip from 'adm-zip';
const root=path.resolve(process.argv[2]??path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
const pin=JSON.parse(fs.readFileSync(path.join(root,'.github/densha-sushi-release.json'),'utf8'));
if(!/^[a-f0-9]{64}$/.test(pin.sha256)||pin.source_branch!=='codex/densha-domino-sushi'||pin.output_path!=='prototypes/densha-domino-sushi')throw Error('Invalid independent sushi release pin');
if(!pin.artifact_url.startsWith('https://github.com/tianz88-bit/game-prototypes/releases/download/'))throw Error('Unexpected release artifact origin');
const response=await fetch(pin.artifact_url);if(!response.ok)throw Error('Sushi release download failed: '+response.status);
const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>50*1024*1024)throw Error('Unexpectedly large sushi release');
const sha=crypto.createHash('sha256').update(bytes).digest('hex');if(sha!==pin.sha256)throw Error('Sushi release integrity mismatch');
const zip=new AdmZip(bytes),entries=zip.getEntries();
for(const e of entries){const name=e.entryName;if(name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||(!['index.html','release.json'].includes(name)&&!name.startsWith('assets/')))throw Error('Invalid release entry: '+name);}
const release=JSON.parse(zip.readAsText('release.json'));
for(const key of ['source_branch','source_commit','release_counter'])if(release[key]!==pin[key])throw Error('Sushi release provenance mismatch: '+key);
if(!zip.getEntry('index.html')||!zip.getEntry('assets/manifest.json'))throw Error('Release is missing the game or approved art manifest');
const destination=path.resolve(root,'dist',pin.output_path),parent=path.resolve(root,'dist/prototypes');
if(path.dirname(destination)!==parent||path.basename(destination)!=='densha-domino-sushi')throw Error('Output escaped the dedicated sushi directory');
if(fs.existsSync(destination))fs.rmSync(destination,{recursive:true,force:true});fs.mkdirSync(destination,{recursive:true});
zip.extractAllTo(destination,true);
console.log('Installed sushi release '+pin.release_counter+' from '+pin.source_branch+' at '+pin.output_path+' (SHA-256 verified)');
