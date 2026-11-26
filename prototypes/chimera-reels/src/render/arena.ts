// The 3D view: two toon chimeras built from their parts, with impact VFX,
// part breaks, weakspot highlight, flight hover and camera shake.
import * as THREE from 'three';
import { tune } from '../tune';
import { isFlying, previewExecute, shieldCap, weakspot, type Combat, type CombatEvent, type Side } from '../sim/combat';
import type { MonsterSpec, Slot } from '../sim/content';
import { MonsterView } from './monsterView';
import { makeGround, Vfx } from './toon';
import { HEIGHT, WIDTH } from './view';

/** Vertical shift (logical px) that lifts the 3D scene into the band between the two HUD panels. */
const VIEW_SHIFT_Y = 78;
const MONSTER_SCALE = 0.62;
const HOME: Record<Side, THREE.Vector3> = { player: new THREE.Vector3(-0.8, 0, 0.8), enemy: new THREE.Vector3(0.8, 0, -1.4) };
const FACING: Record<Side, THREE.Vector3> = {
  player: new THREE.Vector3(1, 0, -1.4).normalize(),
  enemy: new THREE.Vector3(-1, 0, 1.4).normalize(),
};

interface Anim {
  lunge: number;
  lungeScale: number;
  recoil: number;
  flash: number;
  spin: number;
  down: boolean;
}

const freshAnim = (): Anim => ({ lunge: 0, lungeScale: 1, recoil: 0, flash: 0, spin: 0, down: false });

export class Arena {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private views: Partial<Record<Side, MonsterView>> = {};
  private specs: Partial<Record<Side, MonsterSpec>> = {};
  private anim: Record<Side, Anim> = { player: freshAnim(), enemy: freshAnim() };
  private vfx: Vfx;
  private shake = 0;
  private shakeAmp = 0;
  private time = 0;
  private camBase = new THREE.Vector3(1.4, 4.2, 13.5);

  constructor() {
    this.scene.background = new THREE.Color(0x1b1629);
    this.camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.1, 100);
    this.camera.setViewOffset(WIDTH, HEIGHT, 0, VIEW_SHIFT_Y, WIDTH, HEIGHT);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0.6, 0);
    this.scene.add(makeGround([new THREE.Vector2(HOME.player.x, HOME.player.z), new THREE.Vector2(HOME.enemy.x, HOME.enemy.z)]));
    this.vfx = new Vfx(this.scene);
  }

  /** Show these monsters (rebuilds a side only if its spec changed). */
  setMonsters(player: MonsterSpec | null, enemy: MonsterSpec | null) {
    this.setSide('player', player);
    this.setSide('enemy', enemy);
  }

  private setSide(side: Side, spec: MonsterSpec | null) {
    if (this.specs[side] === (spec ?? undefined) && (spec === null || this.views[side])) return;
    this.views[side]?.dispose();
    delete this.views[side];
    this.specs[side] = spec ?? undefined;
    this.anim[side] = freshAnim();
    if (!spec) return;
    const v = new MonsterView(spec);
    v.root.scale.setScalar(MONSTER_SCALE);
    v.root.position.copy(HOME[side]);
    const f = FACING[side];
    v.root.rotation.y = Math.atan2(-f.z, f.x);
    this.scene.add(v.root);
    this.views[side] = v;
  }

  /** Rebuild both sides from scratch (new fight: broken parts come back). */
  resetFight() {
    for (const side of ['player', 'enemy'] as const) {
      const spec = this.specs[side] ?? null;
      this.specs[side] = undefined;
      this.setSide(side, spec);
    }
  }

  onEvent(e: CombatEvent, c: Combat) {
    const f = tune.feel;
    if (e.type === 'action') {
      const a = this.anim[e.side];
      a.lunge = f.lungeSec;
      a.lungeScale = e.isSuper ? 1.6 : e.burn ? 0.6 : 1;
      if (e.isSuper) a.spin = f.lungeSec * 2;
      this.views[e.side]?.kick(-f.springKick * 0.6);
    } else if (e.type === 'hit') {
      const a = this.anim[e.side];
      const v = this.views[e.side];
      a.flash = f.hitFlashSec;
      if (!v) return;
      const slot = c.fighters[e.side].parts[e.part]?.slot ?? 'body';
      const at = v.slotWorld(slot);
      const big = e.amount >= f.bigHit;
      a.recoil = f.recoilSec;
      v.kick(f.springKick * (big ? 1.8 : 1));
      this.shake = f.recoilSec;
      this.shakeAmp = big ? f.superShakeAmp : f.shakeAmp;
      this.vfx.flash(at, big ? 1.6 : 1, e.shielded >= e.amount ? '#bfefff' : '#fff2a8');
      this.vfx.burst(at, e.shielded >= e.amount ? 3 : big ? 9 : 5, e.weak
        ? { col: '#ffcf5a', shade: '#c2412d', speed: 3.2, size: 0.3, heat: 1 }
        : { col: '#f1ecff', shade: '#8f86b8', speed: 2.4, size: 0.26 });
    } else if (e.type === 'break') {
      const v = this.views[e.side];
      const slot = c.fighters[e.side].parts[e.part].slot;
      if (!v) return;
      const at = v.breakSlot(slot);
      this.vfx.burst(at, 12, { col: '#ffd66b', shade: '#a3422c', speed: 4, size: 0.35, heat: 1 });
      this.vfx.flash(at, 2.2);
      this.shake = 0.35;
      this.shakeAmp = tune.feel.superShakeAmp;
    } else if (e.type === 'shield') {
      const v = this.views[e.side];
      if (v) this.vfx.burst(v.slotWorld('body'), 4, { col: '#bfefff', shade: '#4a9cc9', speed: 1.4, size: 0.2 });
    } else if (e.type === 'drop') {
      const v = this.views[e.side];
      const slot = c.fighters[e.side].parts[e.part]?.slot ?? 'body';
      if (v) this.vfx.burst(v.slotWorld(slot), 4, { col: '#ffd66b', shade: '#a3422c', speed: 2.6, size: 0.16 });
    } else if (e.type === 'end') {
      const loser = e.winner === 'player' ? 'enemy' : 'player';
      this.anim[loser].down = c.fighters[loser].hp <= 0;
    }
  }

  /** Parts viewer: slowly turn the player-side monster and highlight one slot in gold. */
  viewer: { slot: Slot | null } | null = null;
  private viewerAngle = 0;

  update(dt: number, c: Combat | null) {
    const f = tune.feel;
    this.time += dt;
    this.viewerAngle = this.viewer ? this.viewerAngle + dt * f.viewerSpinSpeed : 0;
    for (const side of ['player', 'enemy'] as const) {
      const v = this.views[side];
      if (!v) continue;
      const a = this.anim[side];
      const fighter = c?.fighters[side];
      const pos = HOME[side].clone();
      if (a.lunge > 0) {
        a.lunge = Math.max(0, a.lunge - dt);
        const t = 1 - a.lunge / f.lungeSec;
        pos.addScaledVector(FACING[side], Math.sin(t * Math.PI) * f.lungeDist * a.lungeScale);
      }
      if (a.recoil > 0) {
        a.recoil = Math.max(0, a.recoil - dt);
        const t = 1 - a.recoil / f.recoilSec;
        pos.addScaledVector(FACING[side], -Math.sin(t * Math.PI) * 0.3);
      }
      const flying = fighter ? isFlying(fighter) : v.flying;
      v.update(dt, flying && !a.down, f.hoverHeight);
      pos.y += (v.root.userData.lift as number) ?? 0;
      v.root.position.copy(pos);
      v.body.position.y = a.down ? 0 : Math.sin(this.time * Math.PI * 2 * f.idleBobHz + (side === 'enemy' ? 1.7 : 0)) * f.idleBobAmp;
      const tilt = a.down ? Math.PI / 2.2 : 0;
      v.body.rotation.x += (tilt - v.body.rotation.x) * Math.min(1, dt * 6);
      if (a.spin > 0) {
        a.spin = Math.max(0, a.spin - dt);
        v.body.rotation.y = (1 - a.spin / (f.lungeSec * 2)) * Math.PI * 2;
      } else v.body.rotation.y = 0;
      a.flash = Math.max(0, a.flash - dt);
      v.setFlash(a.flash > 0 ? 0.85 : 0);
      v.setShield(fighter && !c?.winner ? fighter.shield / Math.max(1, shieldCap(fighter)) : 0);
      const fac = FACING[side];
      v.root.rotation.y = Math.atan2(-fac.z, fac.x) + (side === 'player' ? this.viewerAngle : 0);
      if (side === 'player' && this.viewer) {
        v.setWeak(this.viewer.slot, true);
        continue;
      }
      // Only the enemy's weakspot is highlighted (it is what the player aims for).
      if (side === 'enemy' && fighter && c && !c.winner) {
        const w = weakspot(fighter);
        v.setWeak(w >= 0 ? fighter.parts[w].slot : null);
        const aim = c.fighters.player.landed ? previewExecute(c, 'player') : null;
        v.setAim(aim ? fighter.parts[aim.hit.part].slot : null);
      } else {
        v.setWeak(null);
        v.setAim(null);
      }
    }
    this.vfx.update(dt);
    this.camera.position.copy(this.camBase);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const amp = this.shakeAmp * Math.min(1, this.shake / Math.max(0.001, f.recoilSec));
      this.camera.position.x += (Math.random() - 0.5) * 2 * amp;
      this.camera.position.y += (Math.random() - 0.5) * 2 * amp;
    }
  }

  /** Logical-space screen position just above a monster's head (for popups). */
  headScreen(side: Side): { x: number; y: number } {
    const v = this.views[side];
    const p = new THREE.Vector3();
    if (v) {
      v.root.getWorldPosition(p);
      p.y += 1.9 * MONSTER_SCALE;
    }
    p.project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * WIDTH, y: (-p.y * 0.5 + 0.5) * HEIGHT };
  }
}
