// The 3D view: two placeholder chimeras built from primitives, one mesh per
// part so later steps can show hitzones and part breaks on the model.
import * as THREE from 'three';
import { tune } from '../tune';
import type { CombatEvent, Side } from '../sim/combat';
import { HEIGHT, WIDTH } from './view';

interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Object3D;
  mats: THREE.MeshStandardMaterial[];
  home: THREE.Vector3;
  facing: THREE.Vector3;
  lunge: number; // seconds left
  lungeScale: number;
  recoil: number;
  flash: number;
  spin: number;
  down: boolean;
}

/** Vertical shift (logical px) that lifts the 3D scene into the band between the two HUD panels. */
const VIEW_SHIFT_Y = 96;
const MONSTER_SCALE = 0.75;

function mat(color: number, mats: THREE.MeshStandardMaterial[]) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
  mats.push(m);
  return m;
}

function buildMonster(side: Side, bodyColor: number, partColor: number): Rig {
  const mats: THREE.MeshStandardMaterial[] = [];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.8), mat(bodyColor, mats));
  torso.position.y = 0.95;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14), mat(partColor, mats));
  head.position.set(0.85, 1.3, 0);
  body.add(head);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.4), mat(bodyColor, mats));
  jaw.position.set(1.12, 1.12, 0);
  body.add(jaw);

  for (const z of [-0.22, 0.22]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 10), mat(0xf2ead8, mats));
    horn.position.set(0.8, 1.72, z);
    horn.rotation.z = -0.35;
    body.add(horn);
  }

  // Legs: front pair carries claws, back pair is plain.
  for (const x of [-0.45, 0.45]) {
    for (const z of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 10), mat(partColor, mats));
      leg.position.set(x, 0.31, z);
      body.add(leg);
      if (x > 0) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 8), mat(0xf2ead8, mats));
        claw.position.set(x + 0.14, 0.06, z);
        claw.rotation.z = -Math.PI / 2;
        body.add(claw);
      }
    }
  }

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.9, 10), mat(partColor, mats));
  tail.position.set(-0.95, 1.05, 0);
  tail.rotation.z = Math.PI / 2.6;
  body.add(tail);

  // Portrait staging: player near the camera on the left, enemy further
  // back on the right, facing each other along the diagonal.
  root.scale.setScalar(MONSTER_SCALE);
  const home = side === 'player' ? new THREE.Vector3(-0.8, 0, 0.8) : new THREE.Vector3(0.8, 0, -1.4);
  root.position.copy(home);
  const facing = new THREE.Vector3(side === 'player' ? 1 : -1, 0, side === 'player' ? -1.4 : 1.4).normalize();
  root.rotation.y = Math.atan2(-facing.z, facing.x);

  return { root, body, head, mats, home, facing, lunge: 0, lungeScale: 1, recoil: 0, flash: 0, spin: 0, down: false };
}

export class Arena {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private rigs: Record<Side, Rig>;
  private shake = 0;
  private shakeAmp = 0;
  private time = 0;
  private camBase = new THREE.Vector3(1.4, 4.2, 13.5);

  constructor() {
    this.scene.background = new THREE.Color(0x15121f);
    this.camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.1, 100);
    this.camera.setViewOffset(WIDTH, HEIGHT, 0, VIEW_SHIFT_Y, WIDTH, HEIGHT);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0.6, 0);

    this.scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x2a2238, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshStandardMaterial({ color: 0x2b2540, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.2, 48), new THREE.MeshBasicMaterial({ color: 0x4a3f6b }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);

    this.rigs = { player: buildMonster('player', 0x3f8f7a, 0x6cc4a1), enemy: buildMonster('enemy', 0x9a4a3c, 0xd9825b) };
    this.scene.add(this.rigs.player.root, this.rigs.enemy.root);
  }

  reset() {
    for (const r of Object.values(this.rigs)) {
      r.lunge = r.recoil = r.flash = r.spin = 0;
      r.down = false;
      r.root.position.copy(r.home);
      r.body.rotation.set(0, 0, 0);
    }
  }

  onEvent(e: CombatEvent) {
    const f = tune.feel;
    if (e.type === 'action') {
      const r = this.rigs[e.side];
      r.lunge = f.lungeSec;
      r.lungeScale = e.isSuper ? 1.6 : e.burn ? 0.6 : 1;
      if (e.isSuper) r.spin = f.lungeSec * 2;
    } else if (e.type === 'hit') {
      const r = this.rigs[e.side];
      r.flash = f.hitFlashSec;
      if (!e.chip) {
        r.recoil = f.recoilSec;
        this.shake = f.recoilSec;
        this.shakeAmp = e.amount >= 25 ? f.superShakeAmp : f.shakeAmp;
      }
    } else if (e.type === 'end') {
      this.rigs[e.winner === 'player' ? 'enemy' : 'player'].down = true;
    }
  }

  update(dt: number) {
    const f = tune.feel;
    this.time += dt;
    for (const side of ['player', 'enemy'] as const) {
      const r = this.rigs[side];
      const pos = r.home.clone();
      if (r.lunge > 0) {
        r.lunge = Math.max(0, r.lunge - dt);
        const t = 1 - r.lunge / f.lungeSec;
        pos.addScaledVector(r.facing, Math.sin(t * Math.PI) * f.lungeDist * r.lungeScale);
      }
      if (r.recoil > 0) {
        r.recoil = Math.max(0, r.recoil - dt);
        const t = 1 - r.recoil / f.recoilSec;
        pos.addScaledVector(r.facing, -Math.sin(t * Math.PI) * 0.3);
      }
      r.root.position.copy(pos);
      r.body.position.y = r.down ? 0 : Math.sin(this.time * Math.PI * 2 * f.idleBobHz + (side === 'enemy' ? 1.7 : 0)) * f.idleBobAmp;
      // Knocked out: tip over onto the side.
      const targetTilt = r.down ? Math.PI / 2.2 : 0;
      r.body.rotation.x += (targetTilt - r.body.rotation.x) * Math.min(1, dt * 6);
      if (r.spin > 0) {
        r.spin = Math.max(0, r.spin - dt);
        r.body.rotation.y = (1 - r.spin / (f.lungeSec * 2)) * Math.PI * 2;
      } else r.body.rotation.y = 0;
      if (r.flash > 0) r.flash = Math.max(0, r.flash - dt);
      const glow = r.flash > 0 ? 0.9 : 0;
      for (const m of r.mats) m.emissive.setRGB(glow, glow * 0.85, glow * 0.7);
    }
    this.camera.position.copy(this.camBase);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const a = this.shakeAmp * (this.shake / Math.max(0.001, f.recoilSec));
      this.camera.position.x += (Math.random() - 0.5) * 2 * a;
      this.camera.position.y += (Math.random() - 0.5) * 2 * a;
    }
  }

  /** Logical-space screen position just above a monster's head (for popups). */
  headScreen(side: Side): { x: number; y: number } {
    const r = this.rigs[side];
    const v = new THREE.Vector3();
    r.head.getWorldPosition(v);
    v.y += 0.45;
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * WIDTH, y: (-v.y * 0.5 + 0.5) * HEIGHT };
  }
}
