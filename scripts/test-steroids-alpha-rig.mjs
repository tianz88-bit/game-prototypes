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

// FFD must match the approved lab's hardline relief and heading-relative projection.
const tilt = await import(pathToFileURL(path.join(root, 'prototypes/steroids-alpha/src/render/shipTilt.ts')).href);
const reference = await import(pathToFileURL(path.join(root, 'prototypes/steroids-alpha-lab/ffd.mjs')).href);
const visual = JSON.parse(readFileSync(path.join(root, 'prototypes/steroids-alpha/client.tune.json'), 'utf8')).render;
let points = 0;
for (const angle of [0,45,90,135,180,225,270,315]) for (const m of rig.MODULES) {
  const p = rig.pose(m, angle, cal, 1530, 1, .3, m.asset === 'gun' ? 2 : 0);
  const width = cal.modules[m.id].width, height = width * .93;
  for (const [pitch,bank] of [[0,0],[-13,0],[17,0],[0,22],[0,-22],[-13,22]]) {
    const basis = tilt.tiltBasis(pitch,bank,angle);
    for (const v of [0,.2,.45,.75,1]) for (const u of [0,.22,.5,.78,1]) {
      const x=(u-.5)*width,y=(v-.5)*height,c=Math.cos(p.rotation),s=Math.sin(p.rotation);
      const actual=tilt.projectTiltPoint(p.x+c*x-s*y,p.y+s*x+c*y,tilt.panelRelief(m,u,v),basis);
      const expected=reference.projectPanelPoint(m,u,v,width,height,p,pitch,bank,angle);
      close(actual.x,expected.x,`${m.id} FFD x`);close(actual.y,expected.y,`${m.id} FFD y`);points++;
    }
  }
}
const hold = (control,accel,yaw,boost=false) => {
  const state={pitch:0,bank:0};
  for(let i=0;i<90;i++)tilt.advanceTilt(state,control,accel,yaw,boost,1/60,visual);
  return state;
};
assert.deepEqual(hold(undefined,220,180,true),{pitch:0,bank:0},'heading/speed changes without a control cue stay level');
assert.deepEqual(hold({thrust:1,turn:0,aim:NaN},0,0),{pitch:0,bank:0},'holding throttle at steady speed stays level');
assert(hold({thrust:1,turn:0,aim:NaN},220,0).pitch < -12.9,'accelerate pitches forward');
assert(hold({thrust:-1,turn:0,aim:NaN},-300,0).pitch > 16.9,'brake pitches back');
assert(hold({thrust:0,turn:-1,aim:NaN},0,-180).bank > 21.9,'left yaw keeps owner-inverted bank');
assert(hold({thrust:0,turn:1,aim:NaN},0,180).bank < -21.9,'right yaw keeps owner-inverted bank');
assert(hold({thrust:0,turn:0,aim:1},0,95).bank < -21.9,'marker yaw follows actual turning');
const remote=hold('observed',220,-95);assert(remote.pitch < -12.9 && remote.bank > 21.9,'remote observed controls');
for(let i=0;i<90;i++)tilt.advanceTilt(remote,{thrust:0,turn:0,aim:NaN},0,0,false,1/60,visual);
assert.deepEqual(remote,{pitch:0,bank:0},'released controls return exactly to the original sprite pose');
console.log(`Ship FFD: ${points} reference panel points, control gating, inverted yaw and exact return to level pass.`);
