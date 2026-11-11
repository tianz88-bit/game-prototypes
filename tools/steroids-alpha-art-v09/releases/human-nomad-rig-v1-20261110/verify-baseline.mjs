import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=p=>fs.readFile(new URL(p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await read('ship-manifest.json'));
assert.equal(hash(await read('calibration-approved.json')),manifest.calibrationSha256,'Approved calibration changed');
for(const a of manifest.assets){const bytes=await read(a.path);assert.equal(bytes.length,a.bytes,a.path+' size');assert.equal(hash(bytes),a.sha256,a.path+' checksum');}
if(await fs.stat(new URL('CHECKSUMS.json',import.meta.url)).catch(()=>null)){
 const checks=JSON.parse(await read('CHECKSUMS.json'));
 for(const item of checks.files)assert.equal(hash(await read(item.path)),item.sha256,'Frozen file changed: '+item.path);
}
console.log(`PASS: frozen calibration, ${manifest.assets.length} original art files and snapshot checksums`);
