// Title screen in 3D: "WOW! REEL CHIMERAS!" built from chunky toon voxels
// (a tiny 5x7 pixel font, so no font file is needed), the three starters on
// a turntable, and a spinning slot drum. Same toon kit as the arena.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STARTERS } from '../sim/content';
import { MonsterView } from './monsterView';
import { cbox, makeGround, part, toon, Vfx } from './toon';
import { HEIGHT, WIDTH } from './view';

const FONT: Record<string, string[]> = {
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
};

interface Letter { mesh: THREE.Object3D; baseY: number; phase: number }

/** One letter as a single merged mesh of chamfered voxels. */
function letterGeometry(ch: string, voxel: number): THREE.BufferGeometry {
  const rows = FONT[ch];
  const parts: THREE.BufferGeometry[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((bit, x) => {
      if (bit !== '1') return;
      const g = cbox(voxel * 0.96, voxel * 0.96, voxel * 1.6, voxel * 0.18).clone();
      g.translate((x - 2) * voxel, (3 - y) * voxel, 0);
      parts.push(g.index ? g.toNonIndexed() : g);
    });
  });
  return mergeGeometries(parts)!;
}

export class TitleScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, WIDTH / HEIGHT, 0.1, 100);
  private letters: Letter[] = [];
  private monsters: MonsterView[] = [];
  private turntable = new THREE.Group();
  private drums: THREE.Group[] = [];
  private vfx: Vfx;
  private time = 0;
  private sparkle = 0;

  constructor() {
    this.scene.background = new THREE.Color(0x1b1430);
    this.camera.position.set(0, 2.6, 15);
    this.camera.lookAt(0, 2.6, 0);
    this.scene.add(makeGround([new THREE.Vector2(0, -1), new THREE.Vector2(0, -1)]));
    this.vfx = new Vfx(this.scene);

    // Title: three lines, each word its own colour.
    const lines: [string, string[], number, number][] = [
      ['WOW!', ['#ffd23f'], 6.3, 0.15],
      ['REEL', ['#ff5b6e'], 4.95, 0.12],
      ['CHIMERAS!', ['#5ee6c4', '#ff8fd0'], 3.85, 0.07],
    ];
    for (const [text, colors, y, voxel] of lines) {
      const step = voxel * 6.2;
      const mats = colors.map((c) => toon(c, { gloss: 60, spec: 0.9, rim: 0.8, wear: 0.03 }));
      [...text].forEach((ch, i) => {
        const pivot = new THREE.Group();
        pivot.position.set((i - (text.length - 1) / 2) * step, y, 0);
        part(letterGeometry(ch, voxel), mats[i % mats.length], pivot, undefined, undefined, 1.4);
        this.scene.add(pivot);
        this.letters.push({ mesh: pivot, baseY: y, phase: i * 0.45 + y });
      });
    }

    // The three starters parading on a turntable.
    this.turntable.position.set(0, 0.7, -1.5);
    this.scene.add(this.turntable);
    // A round stage for the turntable so the monsters stand on something.
    part(new THREE.CylinderGeometry(2.2, 2.35, 0.35, 40), toon('#463a6b', { wear: 0.12 }), this.turntable, [0, -0.18, 0], undefined, 1.2);
    STARTERS.forEach((spec, i) => {
      const v = new MonsterView(spec);
      const a = (i / STARTERS.length) * Math.PI * 2;
      v.root.position.set(Math.sin(a) * 1.5, 0, Math.cos(a) * 1.5);
      v.root.rotation.y = a + Math.PI / 2;
      v.root.scale.setScalar(0.5);
      this.turntable.add(v.root);
      this.monsters.push(v);
    });

    // Three slot drums behind them, like a reel machine.
    const colors = ['#d4554b', '#3e6a8a', '#d9a326', '#3caf7c', '#4b9fd4', '#c44a80', '#e06a24', '#9c6436'];
    for (let d = 0; d < 3; d++) {
      const drum = new THREE.Group();
      drum.position.set((d - 1) * 1.45, 2.3, -6);
      drum.rotation.z = Math.PI / 2;
      drum.rotation.x = d * 0.7;
      this.scene.add(drum);
      this.drums.push(drum);
      colors.forEach((c, i) => {
        const a = (i / colors.length) * Math.PI * 2 + d;
        part(cbox(1.2, 0.62, 0.2, 0.06), toon(colors[(i + d * 3) % colors.length], { gloss: 50, spec: 0.7 }), drum, [Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05], [0, -a + Math.PI / 2, 0], 1);
      });
    }
  }

  dispose() {
    for (const m of this.monsters) m.dispose();
  }

  update(dt: number) {
    this.time += dt;
    for (const l of this.letters) {
      // A bouncy wave runs through the letters.
      const t = this.time * 3 - l.phase;
      l.mesh.position.y = l.baseY + Math.max(0, Math.sin(t)) * 0.25;
      l.mesh.rotation.y = Math.sin(this.time * 0.8 + l.phase) * 0.25;
      l.mesh.rotation.z = Math.sin(t) * 0.05;
    }
    this.turntable.rotation.y += dt * 0.4;
    for (const m of this.monsters) m.update(dt, false, 0);
    this.drums.forEach((d, i) => (d.rotation.x += dt * (0.5 + i * 0.25)));
    this.sparkle -= dt;
    if (this.sparkle <= 0) {
      this.sparkle = 0.25;
      const p = new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 5, 0.5);
      this.vfx.puff(p, new THREE.Vector3(0, 0.6, 0), { col: '#fff3b0', shade: '#e0a83a', life: 0.8, s0: 0.05, s1: 0.16, heat: 0.6, rise: 0.4 });
    }
    this.vfx.update(dt);
    this.camera.position.x = Math.sin(this.time * 0.3) * 0.6;
    this.camera.lookAt(0, 2.8, 0);
  }
}
