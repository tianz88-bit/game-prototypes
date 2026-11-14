import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {remapRgba,palettes} from './palette-remap.mjs';
for(const id of ['interceptor','battlecruiser']){
 const rig=await import(`./${id}/rig.mjs`),profile=await import(`./${id}/ship-profile.mjs`),cal=JSON.parse(await fs.readFile(new URL(`./${id}/calibration-draft.json`,import.meta.url)));
 assert.deepEqual(rig.validate(cal),cal);assert.equal(rig.modules.length,id==='interceptor'?12:16);assert.equal(Object.keys(profile.textureFiles).length,id==='interceptor'?8:9);
 for(let angle=0;angle<360;angle++)for(const m of rig.modules){const p=rig.pose(m,angle,cal);assert.ok(Number.isFinite(p.x+p.y+p.rotation));assert.equal(p.depth,rig.depth(m,0,cal));if(m.asset==='gun')assert.ok(Math.abs(p.rotation-angle*Math.PI/180)<1e-10);}
 for(const field of ['ffd.mjs','flight-motion.mjs','depth-effects.mjs'])assert.deepEqual(await fs.readFile(new URL(`./interceptor/${field}`,import.meta.url)),await fs.readFile(new URL(`./battlecruiser/${field}`,import.meta.url)));
}
const sample=new Uint8ClampedArray([0,97,242,255,255,135,0,128,7,16,47,255,1,2,3,0]);assert.deepEqual(remapRgba(sample,0),sample);for(let i=0;i<palettes.length;i++){const p=remapRgba(sample,i);for(let j=3;j<p.length;j+=4)assert.equal(p[j],sample[j]);assert.deepEqual([...p.slice(8,12)],[7,16,47,255]);}assert.throws(()=>remapRgba(sample,4));
console.log('PASS: portable 12/16-module profiles, 720 headings, fixed Z/forward axes, calibration round trip, accepted motion parity and palette alpha/outline preservation');
