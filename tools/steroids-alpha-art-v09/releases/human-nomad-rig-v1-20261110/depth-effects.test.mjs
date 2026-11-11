import assert from 'node:assert/strict';
import fs from 'node:fs';
import {modules,seed,validate} from './rig.mjs';
import {drawDepth,layerBrightness} from './depth-effects.mjs';
const cal=seed();
for(let angle=0;angle<=360;angle++){
 const ordered=modules.slice().sort((a,b)=>drawDepth(b,angle,cal)-drawDepth(a,angle,cal));
 for(let i=0;i<ordered.length;i++){
  assert.ok(Math.abs(layerBrightness(ordered[i],angle,cal)-.97**i)<1e-10);
  assert.equal(drawDepth(ordered[i],angle,cal),drawDepth(ordered[i],0,cal));
 }
}
const previous=JSON.parse(fs.readFileSync(new URL('./calibration-before-fixed-z-v11.json',import.meta.url),'utf8')),migrated=validate(previous);
for(const m of modules){assert.deepEqual(migrated.modules[m.id].offsets,previous.modules[m.id].offsets);assert.equal(migrated.modules[m.id].width,previous.modules[m.id].width);}
assert.deepEqual(migrated.shadow,previous.shadow);assert.equal(migrated.hoverLift,previous.hoverLift);
console.log('PASS: fixed depth and 3% shading through 360°, migration preserves user positions, widths, shadow and lift');
