// Checks the TypeScript port of the approved Human Nomad rig (prototypes/steroids-alpha/src/render/shipRig.ts)
// against reference values generated from the original kit at 38e7139 (rig-parity.fixture.json).
// Run: node --experimental-strip-types scripts/test-steroids-alpha-rig.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const art = path.join(root, 'prototypes/steroids-alpha/art/human-nomad-v1');
const rig = await import(pathToFileURL(path.join(root, 'prototypes/steroids-alpha/src/render/shipRig.ts')).href);
const cal = rig.checkCalibration(JSON.parse(readFileSync(path.join(art, 'calibration-approved.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(art, 'rig-parity.fixture.json'), 'utf8'));
const byId = new Map(rig.MODULES.map((m) => [m.id, m]));
const close = (a, b, what) => assert(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

for (const c of fixture.cases) {
  const p = rig.pose(byId.get(c.id), c.angle, cal, c.time, c.motion, c.turn, c.recoil);
  close(p.x, c.x, `${c.id} @${c.angle} t${c.time} x`);
  close(p.y, c.y, `${c.id} @${c.angle} t${c.time} y`);
  close(p.rotation, c.rotation, `${c.id} @${c.angle} t${c.time} rotation`);
}
for (const m of rig.MODULES) {
  close(rig.layerBrightness(m, cal), fixture.brightness[m.id], `${m.id} brightness`);
  close(rig.depth(m, cal), fixture.depth[m.id], `${m.id} depth`);
}
for (const r of fixture.recoil) {
  const p = rig.recoilPose(r.age);
  for (const k of ['kick', 'scaleX', 'scaleY']) close(p[k], r[k], `recoil ${r.age} ${k}`);
}
// Heading mapping: game 0 rad faces +x (Right), -PI/2 faces up.
close(rig.rigAngle(0), 90, 'rigAngle right');
close(rig.rigAngle(-Math.PI / 2), 0, 'rigAngle up');
close(rig.rigAngle(Math.PI), 270, 'rigAngle left');
// Fixed Z: cockpit pod and canopy above both cowlings.
const z = (id) => rig.depth(byId.get(id), cal);
assert(z('cockpit') > z('engineCapL') && z('cockpit') > z('engineCapR') && z('canopy') > z('cockpit'), 'cockpit above cowlings');

console.log(`Steroids-Alpha rig parity: ${fixture.cases.length} poses, brightness, depth and recoil match the approved kit.`);
