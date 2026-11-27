// 3D attack effects played on the receiver (and, for breath, from the
// attacker). The attacker's own motion is the arena's lunge; these sell
// what landed: fangs snapping shut, claw streaks, shockwaves, a goring horn,
// a stream of fire. All built from primitives with the toon kit.
import * as THREE from 'three';
import type { MoveId } from '../sim/content';
import { cone, part, toon, type ToonMat, type Vfx } from './toon';

interface Fx {
  obj: THREE.Object3D;
  age: number;
  life: number;
  tick: (t: number, dt: number) => void;
}

const streakGeo = new THREE.BoxGeometry(0.16, 1.2, 0.02);
const ringGeo = new THREE.TorusGeometry(0.5, 0.06, 6, 32);

function glowMat(color: string) {
  // Glow overlays draw on top of the monsters, like slash flashes in most action games.
  return new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
}

export class AttackFx {
  private list: Fx[] = [];
  private fangMat: ToonMat = toon('#f6efd9', { gloss: 70, spec: 1, wear: 0.03 });
  private hornMat: ToonMat = toon('#e9dcc0', { gloss: 60, spec: 0.9 });

  constructor(private scene: THREE.Scene, private vfx: Vfx) {}

  private add(obj: THREE.Object3D, life: number, tick: Fx['tick']) {
    this.scene.add(obj);
    this.list.push({ obj, age: 0, life, tick });
  }

  /**
   * Play `move` landing at `to`, coming from `from` (attacker head).
   * `power` scales the effect (1 normal, ~1.6 super, ~0.7 burn).
   */
  play(move: MoveId, from: THREE.Vector3, to: THREE.Vector3, power: number) {
    const dir = to.clone().sub(from).setY(0).normalize();
    const face = Math.atan2(dir.x, dir.z);
    switch (move) {
      case 'bite': return this.bite(to, face, power);
      case 'claw': return this.slashes(to, face, power, 3, '#ffffff', false);
      case 'rend': return this.slashes(to, face, power * 1.3, 2, '#ffd0a0', true);
      case 'slam': return this.shock(to, power, false);
      case 'quake': return this.shock(to, power * 1.3, true);
      case 'gore': return this.gore(from, to, power);
      case 'breath': return this.fire(from, to, power, false);
      case 'inferno': return this.fire(from, to, power * 1.3, true);
    }
  }

  /** Two rows of fangs snapping shut on the target. */
  private bite(at: THREE.Vector3, face: number, power: number) {
    const g = new THREE.Group();
    g.position.copy(at);
    g.rotation.y = face;
    g.scale.setScalar(power);
    const upper = new THREE.Group();
    const lower = new THREE.Group();
    g.add(upper, lower);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.17;
      part(cone(0.07, 0.34, 6), this.fangMat, upper, [x, 0, 0], [Math.PI, 0, 0], 0.8);
      part(cone(0.07, 0.34, 6), this.fangMat, lower, [x + 0.085, 0, 0], undefined, 0.8);
    }
    let snapped = false;
    this.add(g, 0.5, (t) => {
      // Open wide, then slam shut fast, hold, shrink away.
      const close = t < 0.15 ? 0 : Math.min(1, (t - 0.15) / 0.12);
      const gap = 0.7 * (1 - close * close);
      upper.position.y = 0.17 + gap;
      lower.position.y = -0.17 - gap;
      if (!snapped && close >= 1) {
        snapped = true;
        this.vfx.burst(at, 5, { col: '#ff6b6b', shade: '#8c1c2b', speed: 2.2, size: 0.18 });
      }
      g.scale.setScalar(power * (t > 0.38 ? Math.max(0.01, 1 - (t - 0.38) / 0.12) : 1));
    });
  }

  /** Claw or rend: bright streaks swiping across the target. */
  private slashes(at: THREE.Vector3, face: number, power: number, n: number, color: string, cross: boolean) {
    const g = new THREE.Group();
    g.position.copy(at);
    g.rotation.y = face;
    const mat = glowMat(color);
    const streaks: THREE.Mesh[] = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(streakGeo, mat);
      s.renderOrder = 10;
      s.position.x = cross ? 0 : (i - (n - 1) / 2) * 0.22;
      s.rotation.z = cross ? (i === 0 ? 0.8 : -0.8) : 0.5;
      g.add(s);
      streaks.push(s);
    }
    this.add(g, 0.3, (t) => {
      const k = Math.min(1, t / 0.12);
      streaks.forEach((s, i) => {
        const d = Math.max(0, Math.min(1, (t - i * 0.03) / 0.12));
        s.scale.set(1 + d, d * power * 1.2, 1);
        s.position.y = (0.5 - d) * 0.6;
      });
      mat.opacity = t < 0.12 ? k : Math.max(0, 1 - (t - 0.12) / 0.18);
    });
  }

  /** Slam or quake: a shockwave ring, quake adds spikes bursting from the ground. */
  private shock(at: THREE.Vector3, power: number, ground: boolean) {
    const g = new THREE.Group();
    g.position.copy(at);
    if (ground) g.position.y = 0.05;
    const mat = glowMat(ground ? '#ffb060' : '#fff0c0');
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const spikes: THREE.Object3D[] = [];
    if (ground) {
      const rock = toon('#8a6d4a', { wear: 0.2 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const s = part(cone(0.12, 0.6, 5), rock, g, [Math.cos(a) * 0.6, -0.3, Math.sin(a) * 0.6], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], 1);
        spikes.push(s);
      }
    }
    this.vfx.burst(at, ground ? 8 : 5, { col: '#d9cdb4', shade: '#7a6a55', speed: 2.6 * power, size: 0.24 });
    this.add(g, 0.5, (t) => {
      const k = t / 0.5;
      ring.scale.setScalar((0.3 + k * 2.4) * power);
      mat.opacity = 1 - k;
      spikes.forEach((s) => {
        s.position.y = -0.3 + Math.sin(Math.min(1, t / 0.35) * Math.PI) * 0.6;
      });
    });
  }

  /** Gore: a big horn thrust from the attacker into the target. */
  private gore(from: THREE.Vector3, to: THREE.Vector3, power: number) {
    const horn = new THREE.Group();
    const h = part(cone(0.22, 1.2, 8), this.hornMat, horn, undefined, [Math.PI / 2, 0, 0], 1.2);
    h.position.z = 0.3;
    horn.scale.setScalar(power);
    horn.position.copy(from);
    horn.lookAt(to);
    let hit = false;
    this.add(horn, 0.45, (t) => {
      const k = Math.min(1, t / 0.14);
      horn.position.lerpVectors(from, to, k * k);
      if (!hit && k >= 1) {
        hit = true;
        this.vfx.flash(to, 1.4 * power);
        this.vfx.burst(to, 7, { col: '#ffcf5a', shade: '#c2412d', speed: 3, size: 0.26, heat: 1 });
      }
      if (t > 0.3) horn.scale.setScalar(power * Math.max(0.01, 1 - (t - 0.3) / 0.15));
    });
  }

  /** Breath or inferno: a stream of hot puffs from the attacker's head to the target. */
  private fire(from: THREE.Vector3, to: THREE.Vector3, power: number, big: boolean) {
    const holder = new THREE.Object3D();
    const dur = big ? 0.55 : 0.35;
    let emit = 0;
    const dist = from.distanceTo(to);
    const dir = to.clone().sub(from).normalize();
    this.add(holder, dur + 0.1, (t, dt) => {
      if (t > dur) return;
      emit += dt;
      const every = big ? 0.012 : 0.02;
      while (emit > every) {
        emit -= every;
        const spread = new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
        const v = dir.clone().multiplyScalar(dist / 0.28).add(spread.multiplyScalar(2));
        this.vfx.puff(from.clone(), v, {
          col: Math.random() < 0.5 ? '#ffb02e' : '#ff7a2a', shade: '#a3261c', life: 0.35, s0: 0.08 * power, s1: (big ? 0.42 : 0.3) * power,
          heat: 1, drag: 1.5, rise: 0.8,
        });
      }
    });
    if (big) this.shock(to, power * 0.8, false);
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.age += dt;
      f.tick(f.age, dt);
      if (f.age >= f.life) {
        this.scene.remove(f.obj);
        this.list.splice(i, 1);
      }
    }
  }
}
