// A chimera assembled from its parts, one group per slot, so a hit, a
// weakspot highlight or a part break can be shown on the exact part.
import * as THREE from 'three';
import { PARTS, SLOTS, type MonsterSpec, type Slot } from '../sim/content';
import { cbox, cone, cyl, part, sphere, Spring, toon, type PartMesh, type ToonMat } from './toon';

const IVORY = '#f4ead2';
const DARK = '#3b3048';
const SPRING_STEP = 1 / 240;

interface Falling {
  group: THREE.Group;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
}

export class MonsterView {
  readonly root = new THREE.Group();
  /** Bobs, lunges and tips over; parts hang off this. */
  readonly body = new THREE.Group();
  readonly slots = {} as Record<Slot, THREE.Group>;
  readonly flying: boolean;
  private mats: ToonMat[] = [];
  private outlines = {} as Record<Slot, THREE.Mesh[]>;
  private springs: Spring[] = [];
  private hullSpring: Spring;
  private wings: THREE.Object3D[] = [];
  private falling: Falling[] = [];
  private weakSlot: Slot | null = null;
  private highlightGold = false;
  private shieldBubble: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private time = Math.random() * 10;
  private springAcc = 0;

  constructor(spec: MonsterSpec) {
    // Rarer parts reuse a common part's placeholder look at a bigger size.
    const b = {} as Record<Slot, string>;
    for (const s of SLOTS) b[s] = PARTS[spec.build[s]].look;
    const bodyMat = this.mat(toon(spec.palette.body, { wear: 0.1 }));
    const partMat = this.mat(toon(spec.palette.part, { gloss: 55, spec: 0.8 }));
    const ivory = this.mat(toon(IVORY, { gloss: 60, spec: 0.9, wear: 0.04 }));
    const dark = this.mat(toon(DARK, { wear: 0.12, rim: 0.3 }));
    this.flying = b.limbs === 'wings';

    this.root.add(this.body);
    for (const s of ['body', 'head', 'limbs', 'legs', 'skin', 'aux'] as Slot[]) {
      const g = new THREE.Group();
      g.name = s;
      this.slots[s] = g;
      this.outlines[s] = [];
    }
    const add = (slot: Slot, m: PartMesh) => {
      if (m.userData.outline) this.outlines[slot].push(m.userData.outline);
      return m;
    };

    // Legs set the body height.
    const legH = b.legs === 'stumps' ? 0.42 : 0.72;
    const torso = new THREE.Group();
    torso.position.y = legH + 0.32;
    this.body.add(torso);
    this.hullSpring = new Spring(torso, null, 9, 0.25, [0.06, 0.05, 0.04]);
    this.springs.push(this.hullSpring);

    // ---- body
    const bodySize = b.body === 'brute' ? [1.3, 0.8, 0.86] : [1.15, 0.58, 0.64];
    torso.add(this.slots.body);
    add('body', part(cbox(bodySize[0], bodySize[1], bodySize[2], 0.12), bodyMat, this.slots.body));
    add('body', part(cbox(bodySize[0] * 0.55, 0.08, bodySize[2] * 0.7, 0.03), dark, this.slots.body, [0, -bodySize[1] / 2, 0], undefined, 0));
    const top = bodySize[1] / 2;
    const front = bodySize[0] / 2;

    // ---- skin overlay
    torso.add(this.slots.skin);
    if (b.skin === 'shell') {
      for (let i = 0; i < 3; i++) {
        const plate = add('skin', part(sphere(0.34), partMat, this.slots.skin, [-0.35 + i * 0.35, top - 0.04, 0]));
        plate.scale.set(0.95, 0.45, 1.25);
      }
    } else if (b.skin === 'fur') {
      for (let i = 0; i < 6; i++) {
        add('skin', part(cone(0.12, 0.28, 6), bodyMat, this.slots.skin, [-0.5 + i * 0.2, top + 0.08, (i % 2 ? 0.12 : -0.12)], [0, 0, 0.5], 0.8));
      }
    } else {
      add('skin', part(cbox(0.5, 0.06, 0.4, 0.02), dark, this.slots.skin, [-0.2, top + 0.02, 0], undefined, 0.7));
    }

    // ---- head
    const head = this.slots.head;
    head.position.set(front + 0.18, 0.28, 0);
    torso.add(head);
    this.springs.push(new Spring(head, this.hullSpring, 7, 0.18, [0.5, 0.4, 0.3], 1.2));
    if (b.head === 'tusk') {
      add('head', part(sphere(0.38), partMat, head));
      for (const z of [-0.16, 0.16]) add('head', part(cone(0.07, 0.42), ivory, head, [0.28, -0.12, z], [0, 0, -1.2]));
      for (const z of [-0.2, 0.2]) add('head', part(cone(0.07, 0.3), ivory, head, [-0.05, 0.36, z], [0, 0, -0.35]));
      for (const z of [-0.15, 0.15]) add('head', part(sphere(0.06, 8, 6), dark, head, [0.3, 0.1, z], undefined, 0));
    } else if (b.head === 'maw') {
      add('head', part(cbox(0.58, 0.36, 0.56, 0.1), partMat, head, [0.08, 0.06, 0]));
      const jaw = add('head', part(cbox(0.5, 0.16, 0.5, 0.05), bodyMat, head, [0.12, -0.2, 0], [0, 0, -0.2]));
      for (let i = 0; i < 4; i++) part(cone(0.04, 0.12, 5), ivory, jaw, [0.1 + (i % 2) * 0.1, 0.1, -0.15 + i * 0.1], [Math.PI, 0, 0], 0);
      for (const z of [-0.16, 0.16]) add('head', part(sphere(0.06, 8, 6), dark, head, [0.32, 0.16, z], undefined, 0));
    } else {
      add('head', part(sphere(0.32), partMat, head));
      for (let i = 0; i < 3; i++) add('head', part(cbox(0.08, 0.45, 0.04, 0.015), ivory, head, [-0.12 - i * 0.05, 0.3, 0], [0, 0, 0.5 + i * 0.3], 0.8));
      for (const z of [-0.13, 0.13]) add('head', part(sphere(0.07, 8, 6), dark, head, [0.24, 0.08, z], undefined, 0));
    }

    // ---- limbs
    const limbs = this.slots.limbs;
    torso.add(limbs);
    if (b.limbs === 'wings') {
      for (const z of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(-0.05, top - 0.02, z * 0.2);
        limbs.add(pivot);
        add('limbs', part(cbox(0.7, 0.05, 0.95, 0.02), partMat, pivot, [0, 0, z * 0.48], [0, 0, 0], 0.8));
        add('limbs', part(cbox(0.35, 0.04, 0.5, 0.015), ivory, pivot, [0.15, 0.02, z * 0.75], [0, 0.3 * z, 0], 0.6));
        pivot.userData.side = z;
        this.wings.push(pivot);
      }
    } else {
      const thick = b.limbs === 'fists' ? 0.13 : 0.09;
      for (const z of [-0.3, 0.3]) {
        const arm = new THREE.Group();
        arm.position.set(front - 0.15, -0.05, z);
        limbs.add(arm);
        add('limbs', part(cyl(thick, thick * 0.8, 0.55), bodyMat, arm, [0.1, -0.3, 0], [0, 0, 0.35]));
        if (b.limbs === 'fists') add('limbs', part(sphere(0.17), partMat, arm, [0.22, -0.6, 0]));
        else for (let i = -1; i <= 1; i++) add('limbs', part(cone(0.04, 0.2, 6), ivory, arm, [0.3, -0.58, i * 0.06], [0, 0, -1.4], 0.6));
      }
    }

    // ---- legs
    const legs = this.slots.legs;
    legs.position.y = 0;
    this.body.add(legs);
    const legR = b.legs === 'stumps' ? 0.16 : 0.08;
    for (const x of [-0.42, 0.38]) {
      for (const z of [-0.26, 0.26]) {
        add('legs', part(cyl(legR, legR * 1.15, legH + 0.1), bodyMat, legs, [x, (legH + 0.1) / 2, z]));
        add('legs', part(cbox(legR * 2.6, 0.08, legR * 2.4, 0.03), dark, legs, [x + 0.04, 0.04, z], undefined, 0.6));
      }
    }

    // ---- aux
    const aux = this.slots.aux;
    torso.add(aux);
    if (b.aux === 'spines') {
      for (let i = 0; i < 4; i++) add('aux', part(cone(0.07, 0.34, 6), ivory, aux, [-0.45 + i * 0.25, top + 0.14, 0], [0, 0, 0.4]));
    } else if (b.aux === 'tailclub') {
      const tail = new THREE.Group();
      tail.position.set(-front + 0.05, 0.05, 0);
      aux.add(tail);
      this.springs.push(new Spring(tail, this.hullSpring, 4, 0.12, [0.6, 0.8, 0.1], 1.5));
      add('aux', part(cyl(0.06, 0.12, 0.7), bodyMat, tail, [-0.3, 0.12, 0], [0, 0, 1.15]));
      add('aux', part(sphere(0.18), partMat, tail, [-0.62, 0.25, 0]));
      for (let i = 0; i < 4; i++) part(cone(0.05, 0.14, 5), ivory, tail, [-0.62, 0.25, 0], [0, i * 1.57, 1.57], 0).translateY(0.2);
    } else {
      add('aux', part(sphere(0.24), partMat, aux, [-0.15, -0.08, bodySize[2] / 2 + 0.06]));
      add('aux', part(cbox(0.2, 0.05, 0.05, 0.015), dark, aux, [-0.15, 0.08, bodySize[2] / 2 + 0.25], undefined, 0));
    }
    // Short tail stub for monsters without a tail club, for silhouette.
    if (b.aux !== 'tailclub') {
      const stub = new THREE.Group();
      stub.position.set(-front + 0.05, 0.05, 0);
      torso.add(stub);
      this.springs.push(new Spring(stub, this.hullSpring, 5, 0.15, [0.5, 0.6, 0.1], 1.4));
      part(cyl(0.04, 0.1, 0.45), bodyMat, stub, [-0.2, 0.06, 0], [0, 0, 1.2]);
    }

    for (const s of SLOTS) {
      const size = PARTS[spec.build[s]].size ?? 1;
      // Legs only thicken, so the torso still sits on top of them.
      if (s === 'legs') this.slots[s].scale.set(size, 1, size);
      else this.slots[s].scale.setScalar(size);
    }

    // Shield bubble: hidden until the monster holds shield points.
    this.shieldBubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.shieldBubble.position.y = legH + 0.4;
    this.shieldBubble.scale.set(1.25, 1, 1);
    this.body.add(this.shieldBubble);
  }

  /** 0..1 share of the shield cap currently held. */
  setShield(frac: number) {
    const target = frac > 0 ? 0.12 + 0.18 * frac : 0;
    const m = this.shieldBubble.material;
    m.opacity += (target - m.opacity) * 0.2;
    this.shieldBubble.visible = m.opacity > 0.01;
    this.shieldBubble.rotation.y = this.time * 0.6;
  }

  private mat(m: ToonMat) {
    this.mats.push(m);
    return m;
  }

  setFlash(v: number) {
    for (const m of this.mats) m.uniforms.uFlash.value = v;
  }

  /** Spring kick: hits shove backwards, lunges throw the head forward. */
  kick(strength: number) {
    this.hullSpring.kick(strength, strength * (Math.random() - 0.5), strength * 0.6);
  }

  /** Pulse a slot's outline: red for the weakspot, gold for the parts viewer. */
  setWeak(slot: Slot | null, gold = false) {
    this.highlightGold = gold;
    if (slot === this.weakSlot) return;
    this.weakSlot = slot;
  }

  /** Detach a broken part so it tumbles off and is gone. */
  breakSlot(slot: Slot): THREE.Vector3 {
    const g = this.slots[slot];
    const world = new THREE.Vector3();
    g.getWorldPosition(world);
    const q = new THREE.Quaternion();
    g.getWorldQuaternion(q);
    const parent = this.root.parent;
    if (parent && g.parent) {
      g.parent.remove(g);
      g.position.copy(world);
      g.quaternion.copy(q);
      parent.add(g);
      this.falling.push({
        group: g,
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, 3.2, (Math.random() - 0.5) * 2),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        age: 0,
      });
    }
    if (slot === 'limbs') this.wings.length = 0;
    return world;
  }

  slotWorld(slot: Slot): THREE.Vector3 {
    const v = new THREE.Vector3();
    (this.slots[slot].parent ? this.slots[slot] : this.slots.body).getWorldPosition(v);
    return v;
  }

  update(dt: number, flyingNow: boolean, hover: number) {
    this.time += dt;
    // Springs run at a fixed small substep; a large step makes stiff springs blow up.
    this.springAcc = Math.min(this.springAcc + dt, 0.1);
    while (this.springAcc >= SPRING_STEP) {
      for (const s of this.springs) s.step(SPRING_STEP);
      this.springAcc -= SPRING_STEP;
    }
    for (const s of this.springs) s.apply();
    // Wings flap; hover height eases out when the wings break.
    for (const w of this.wings) w.rotation.x = Math.sin(this.time * 9) * 0.5 * (w.userData.side as number);
    const targetLift = flyingNow ? hover + Math.sin(this.time * 3) * 0.08 : 0;
    this.root.userData.lift = (this.root.userData.lift ?? targetLift) + (targetLift - (this.root.userData.lift ?? targetLift)) * Math.min(1, dt * 4);
    // Weakspot: outline pulses red.
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
    for (const slot of Object.keys(this.outlines) as Slot[]) {
      const weak = slot === this.weakSlot;
      for (const o of this.outlines[slot]) {
        const u = (o.material as THREE.ShaderMaterial).uniforms;
        if (weak) {
          if (this.highlightGold) u.uColor.value.setRGB(1, 0.65 + 0.3 * pulse, 0.1);
          else u.uColor.value.setRGB(0.55 + 0.45 * pulse, 0.08, 0.1);
          u.uThick.value = 0.032;
        } else {
          u.uColor.value.copy(o.userData.base as THREE.Color);
          u.uThick.value = 0.02 * (o.userData.thick as number);
        }
      }
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.age += dt;
      f.vel.y -= 9 * dt;
      f.group.position.addScaledVector(f.vel, dt);
      f.group.rotation.x += f.spin.x * dt;
      f.group.rotation.y += f.spin.y * dt;
      if (f.group.position.y < 0.1) {
        f.group.position.y = 0.1;
        f.vel.multiplyScalar(0.4);
        f.vel.y = Math.abs(f.vel.y) * 0.3;
        f.spin.multiplyScalar(0.5);
      }
      f.group.scale.setScalar(Math.max(0.01, 1 - Math.max(0, f.age - 0.9) * 2));
      if (f.age > 1.4) {
        f.group.parent?.remove(f.group);
        this.falling.splice(i, 1);
      }
    }
  }

  dispose() {
    this.root.parent?.remove(this.root);
    for (const f of this.falling) f.group.parent?.remove(f.group);
  }
}
