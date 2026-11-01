import Phaser from 'phaser';
import type { Pane } from 'tweakpane';
import { OperationSim, DEFAULT_TUNE } from './sim';
import type { CardKind, Hex, Tune } from './model';
import { drawHex, drawBuilding, drawUnit, drawExplosion, drawCaptureFlip, drawBuildConfirmation, drawBulletTrace, playerColor, hexPoints } from './art';
import { Intents } from './input';
import { VERSION_STAMP } from './version.generated';

const CARDS: CardKind[] = ['infantry', 'tank', 'artillery', 'helicopter', 'fighter'];
const NAMES: Record<CardKind, string> = { infantry: 'BARRACKS', tank: 'FACTORY', artillery: 'ARTILLERY', helicopter: 'HANGAR', fighter: 'AIRFIELD' };
const ROLES: Record<CardKind, string> = { infantry: 'G > G/A', tank: 'G > G', artillery: 'G > G', helicopter: 'A > G', fighter: 'A > A' };
const INK = '#203d46', MUTED = '#60767a', CREAM = 0xfff7e5;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
type Button = { id: string; x: number; y: number; w: number; h: number; run: () => void };
type QA = { snapshot: () => unknown; targets: () => unknown; advance: (ms: number) => void; captureClock: (ms: number | null) => void };
declare global { interface Window { __operationC?: QA } }

class Battlefield extends Phaser.Scene {
  sim = new OperationSim();
  private w = 0; private h = 0; private top = 0; private bottom = 0;
  private uiScale = 1;
  private world!: Phaser.GameObjects.Container;
  private terrain!: Phaser.GameObjects.Graphics;
  private live!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private feedback!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private texts = new Map<string, Phaser.GameObjects.Text>();
  private buttons: Button[] = [];
  private inputs!: Intents;
  private zoomLevel = 1; private panX = 0; private panY = 0;
  private selected: CardKind | null = null; private chosenHex: string | null = null;
  private hover: string | null = null; private inspected: string | null = null;
  private terrainSignature = ''; private paused = false; private speed = 1;
  private message = 'Choose a building card, then an open teal hex.';
  private byHex = new Map<string, Hex>();
  private seenUnits = new Set<string>();
  private seenBuildings = new Map<string, { x: number; y: number }>();
  private spawns = new Map<string, { x: number; y: number; born: number }>();
  private facingX = new Map<string, 1 | -1>();
  private lastShotId = 0;
  private traces: { id: number; fromHexId: string; targetHexId: string; kind: CardKind; targetDomain: 'ground' | 'air'; born: number }[] = [];
  private effects: { x: number; y: number; born: number }[] = [];
  private previousOwners = new Map<string, number | null>();
  private captureFlips = new Map<string, { previousOwner: number | null; born: number }>();
  private captureClockOverride: number | null = null;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private pane?: Pane;
  private radius = 31;
  private lastSimTime = 0; private lastSimFrame = 0;

  create() {
    document.getElementById('loading')?.remove();
    this.world = this.add.container();
    this.terrain = this.add.graphics(); this.overlay = this.add.graphics(); this.live = this.add.graphics(); this.feedback = this.add.graphics();
    this.world.add([this.terrain, this.overlay, this.live, this.feedback]);
    this.hud = this.add.graphics();
    this.indexHexes(); this.resize(true);
    this.inputs = new Intents(this.game.canvas, () => ({ w: this.w, h: this.h }));
    const resize = () => this.resize(false);
    window.addEventListener('resize', resize);
    this.events.once('shutdown', () => { this.inputs.destroy(); window.removeEventListener('resize', resize); this.pane?.dispose(); });
    if (new URLSearchParams(location.search).has('debug')) void this.debugPanel();
    if (new URLSearchParams(location.search).get('test') === '1') {
      window.__operationC = {
        snapshot: () => ({ timeMs: this.sim.timeMs, buildings: this.sim.buildings, units: this.sim.units,
          hexes: this.sim.hexes, resources: this.sim.resources(0), winner: this.sim.winner, target: this.sim.players[0].targetId,
          objects: this.children.length, textures: this.textures.getTextureKeys().length,
          selectedBuild: this.selected && this.chosenHex ? { hexId: this.chosenHex, valid: this.sim.placement(0, this.chosenHex, this.selected).ok } : null,
          shots: this.sim.shots,
          presentation: { durationMs: this.sim.tune.presentation.captureFlipMs, reducedMotion: this.reducedMotion,
            shotTraceMs: this.sim.tune.presentation.shotTraceMs,
            traces: this.traces.map(t => ({ ...t, progress: Phaser.Math.Clamp((this.captureNow() - t.born) / this.sim.tune.presentation.shotTraceMs, 0, 1) })),
            facings: [...this.facingX].map(([unitId, facingX]) => ({ unitId, facingX })),
            flips: [...this.captureFlips].map(([hexId, flip]) => ({ hexId,
            progress: Phaser.Math.Clamp((this.captureNow() - flip.born) / this.sim.tune.presentation.captureFlipMs, 0, 1) })),
            attackIndicators: this.sim.units.filter(u => u.attacking && u.attackTargetHexId).map(u => ({ unitId: u.id, hexId: u.hexId, targetHexId: u.attackTargetHexId })) } }),
        targets: () => ({ board: { top: this.top * this.uiScale, bottom: (this.h - this.bottom) * this.uiScale }, buttons: this.buttons.map(({ id, x, y, w, h }) => ({ id, x: (x + w / 2) * this.uiScale, y: (y + h / 2) * this.uiScale, left: x * this.uiScale, top: y * this.uiScale, w: w * this.uiScale, h: h * this.uiScale })),
          hexes: this.sim.hexes.map(h => { const p = this.toScreen(h); return { id: h.id, x: p.x * this.uiScale, y: p.y * this.uiScale, owner: h.owner,
            valid: this.selected ? this.sim.placement(0, h.id, this.selected).ok : false }; }) }),
        advance: ms => this.sim.tick(ms),
        captureClock: ms => { this.captureClockOverride = ms; },
      };
    }
  }
  private captureNow() { return this.captureClockOverride ?? performance.now(); }
  private indexHexes() {
    this.byHex = new Map(this.sim.hexes.map(h => [h.id, h]));
    this.previousOwners = new Map(this.sim.hexes.map(h => [h.id, h.owner]));
    this.captureFlips.clear();
    this.captureClockOverride = null;
  }
  private async debugPanel() {
    const { Pane } = await import('tweakpane');
    const values = structuredClone(DEFAULT_TUNE);
    this.pane = new Pane({ title: 'Operation C · provisional tuning' });
    const capture = this.pane.addFolder({ title: 'Capture', expanded: false });
    capture.addBinding(values.capture, 'neutralMs', { min: 500, max: 10000, step: 100 });
    capture.addBinding(values.capture, 'ownedMultiplier', { min: 1, max: 4, step: 0.1 });
    capture.addBinding(values.capture, 'rollbackRate', { min: 0.05, max: 1, step: 0.05 });
    const presentation = this.pane.addFolder({ title: 'Capture animation', expanded: false });
    presentation.addBinding(values.presentation, 'captureFlipMs', { min: 100, max: 1500, step: 50 });
    presentation.addBinding(values.presentation, 'captureLift', { min: 0.1, max: 1.4, step: 0.02 });
    presentation.addBinding(values.presentation, 'shotTraceMs', { min: 100, max: 600, step: 20 });
    for (const kind of CARDS) {
      const folder = this.pane.addFolder({ title: NAMES[kind], expanded: false });
      for (const key of ['cost', 'damage', 'unitHp', 'moveMs', 'productionMs', 'attackMs', 'captureRate', 'minRange', 'range'] as const)
        folder.addBinding(values.cards[kind], key, { min: key.endsWith('Ms') ? 100 : 0.1, max: key.endsWith('Ms') ? 30000 : 300 });
      if (values.cards[kind].retreatMs !== undefined) folder.addBinding(values.cards[kind], 'retreatMs', { min: 100, max: 10000, step: 100 });
    }
    this.pane.addButton({ title: 'Apply and restart sandbox' }).on('click', () => this.restart(values));
    this.pane.addButton({ title: 'Copy tuning JSON' }).on('click', () => {
      void navigator.clipboard.writeText(JSON.stringify(values, null, 2)).then(() => { this.message = 'Tuning copied.'; }).catch(() => { this.message = 'Clipboard blocked by browser.'; });
    });
  }
  private restart(tune?: Tune) {
    this.sim = new OperationSim({ tune }); this.indexHexes(); this.terrainSignature = '';
    this.seenUnits.clear(); this.seenBuildings.clear(); this.spawns.clear(); this.effects = [];
    this.facingX.clear(); this.traces = []; this.lastShotId = 0;
    this.selected = null; this.chosenHex = null; this.inspected = null; this.paused = false;
    this.message = 'Fresh battlefield. Choose a building card to begin.';
  }
  private resize(first: boolean) {
    // Narrow landscape keeps the same spacing in a slightly larger logical canvas.
    // This prevents the two command buttons colliding with the capacity display.
    this.uiScale = window.innerHeight < 520 && window.innerWidth >= 640 && window.innerWidth < 840 ? window.innerWidth / 840 : 1;
    this.w = Math.max(320, window.innerWidth) / this.uiScale; this.h = Math.max(320, window.innerHeight) / this.uiScale;
    this.top = this.h < 520 ? 76 : this.w < 760 ? 132 : 101;
    this.bottom = this.h < 520 ? 122 : this.w < 760 ? 266 : 170;
    this.scale.resize(Math.round(this.w * this.uiScale * DPR), Math.round(this.h * this.uiScale * DPR));
    this.cameras.main.setZoom(DPR * this.uiScale).centerOn(this.w / 2, this.h / 2);
    if (first) {
      this.zoomLevel = this.w < 760 || this.h < 520 ? 0.95 : Math.min(1.18, this.fitZoom());
      if (this.w < 760 || this.h < 520) this.home();
    }
    this.terrainSignature = '';
  }
  private fitZoom() {
    const xs = this.sim.hexes.map(h => this.position(h).x), ys = this.sim.hexes.map(h => this.position(h).y);
    return Math.max(0.2, Math.min((this.w - 38) / (Math.max(...xs) - Math.min(...xs) + this.radius * 2),
      (this.h - this.top - this.bottom - 30) / (Math.max(...ys) - Math.min(...ys) + this.radius * 2)));
  }
  private home() {
    const hq = this.sim.buildings.find(b => b.owner === 0 && b.kind === 'hq');
    if (!hq) return;
    const p = this.position(this.byHex.get(hq.hexId)!);
    this.panX = -p.x * this.zoomLevel; this.panY = -p.y * this.zoomLevel;
  }
  private position(h: Pick<Hex, 'q' | 'r'>) { return { x: Math.sqrt(3) * this.radius * (h.q + h.r / 2), y: 1.5 * this.radius * 0.72 * h.r }; }
  private toScreen(h: Hex) {
    const p = this.position(h);
    return { x: this.w / 2 + this.panX + p.x * this.zoomLevel, y: (this.top + this.h - this.bottom) / 2 + this.panY + p.y * this.zoomLevel };
  }
  private at(x: number, y: number): Hex | undefined {
    if (y < this.top || y > this.h - this.bottom) return;
    const localX = (x - this.world.x) / this.zoomLevel, localY = (y - this.world.y) / this.zoomLevel;
    let closest: Hex | undefined, best = Infinity;
    for (const h of this.sim.hexes) {
      const p = this.position(h), d = Math.hypot(localX - p.x, (localY - p.y) / 0.72);
      if (d < best) { closest = h; best = d; }
    }
    return best <= this.radius ? closest : undefined;
  }
  private build() {
    if (!this.selected || !this.chosenHex) return;
    const result = this.sim.place(0, this.chosenHex, this.selected);
    this.message = result.ok ? `${NAMES[this.selected]} placed. Its unit acts automatically.` : result.reason ?? 'Cannot build here.';
    if (result.ok) { this.chosenHex = null; this.inspected = null; }
  }
  private tap(x: number, y: number) {
    const button = [...this.buttons].reverse().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (button) { button.run(); return; }
    if (this.sim.winner !== null) return;
    const hex = this.at(x, y); if (!hex) return;
    if (this.selected) {
      if (this.chosenHex === hex.id) this.build();
      else { this.chosenHex = hex.id; const p = this.sim.placement(0, hex.id, this.selected); this.message = p.ok ? `${p.hexes.length} connected hexes · tap the hammer hex again to build.` : p.reason ?? 'Invalid placement.'; }
      return;
    }
    const b = this.sim.buildings.find(b => b.hexId === hex.id);
    this.inspected = b?.id ?? null;
    if (b?.kind === 'hq') {
      this.sim.setTarget(0, b.owner);
      this.message = b.owner === 0 ? 'HOME ORDER · expand territory and defend.' : 'ATTACK ORDER · advance on the rival faction.';
    } else if (b) this.message = `${b.owner === 0 ? 'Your' : 'Rival'} ${NAMES[b.kind]} · ${Math.ceil(b.hp)}/${b.maxHp} HP`;
    else this.message = hex.burnt ? 'Burnt · passable, permanently unusable for construction.' : hex.lockedBy ? 'Committed · supports a building; units may cross.' : hex.owner === 0 ? 'Open territory · choose a building card.' : 'Capture this hex to gain capacity.';
  }
  update(_time: number, delta: number) {
    if (!this.inputs) return;
    for (const event of this.inputs.drain()) {
      if (event.type === 'tap') this.tap(event.x, event.y);
      else if (event.type === 'hover') this.hover = this.at(event.x, event.y)?.id ?? null;
      else if (event.type === 'pan') { this.panX += event.dx; this.panY += event.dy; }
      else if (event.type === 'zoom') {
        const before = this.zoomLevel; this.zoomLevel = Phaser.Math.Clamp(before * event.factor, 0.24, 2.4);
        this.panX *= this.zoomLevel / before; this.panY *= this.zoomLevel / before;
      } else if (event.type === 'key') {
        if (event.key === ' ') this.paused = !this.paused;
        if (event.key === 'h') this.home();
        if (event.key === 'escape') { this.selected = null; this.chosenHex = null; }
        const index = Number(event.key) - 1; if (index >= 0 && index < CARDS.length) this.selected = CARDS[index];
      }
    }
    if (!this.paused) this.sim.tick(Math.min(delta, 100) * this.speed);
    this.drawWorld(); this.drawHud();
  }
  private drawWorld() {
    this.world.setPosition(this.w / 2 + this.panX, (this.top + this.h - this.bottom) / 2 + this.panY).setScale(this.zoomLevel);
    const now = performance.now(), captureNow = this.captureNow(), duration = this.sim.tune.presentation.captureFlipMs;
    for (const h of this.sim.hexes) {
      const oldOwner = this.previousOwners.get(h.id);
      if (oldOwner !== undefined && oldOwner !== h.owner && h.owner !== null && !h.burnt && !this.reducedMotion) {
        const p = this.toScreen(h), margin = this.radius * this.zoomLevel * 2;
        if (p.x > -margin && p.x < this.w + margin && p.y > this.top - margin && p.y < this.h - this.bottom + margin)
          this.captureFlips.set(h.id, { previousOwner: oldOwner, born: captureNow });
      }
      this.previousOwners.set(h.id, h.owner);
    }
    for (const [id, flip] of this.captureFlips) {
      const h = this.byHex.get(id)!;
      if (captureNow - flip.born >= duration || h.burnt || h.owner === null) this.captureFlips.delete(id);
    }
    const signature = this.sim.hexes.map(h => `${h.owner}:${h.burnt}:${h.lockedBy}`).join('|') + [...this.captureFlips.keys()].join(';');
    if (signature !== this.terrainSignature) {
      this.terrain.clear();
      for (const h of this.sim.hexes) {
        if (this.captureFlips.has(h.id)) continue;
        const p = this.position(h); drawHex(this.terrain, p.x, p.y, this.radius, { owner: h.owner, burnt: h.burnt, committed: !!h.lockedBy });
      }
      this.terrainSignature = signature;
    }
    this.overlay.clear(); this.live.clear(); this.feedback.clear();
    for (const [id, flip] of this.captureFlips) {
      const h = this.byHex.get(id)!, p = this.position(h);
      drawCaptureFlip(this.overlay, p.x, p.y, this.radius, { owner: h.owner, previousOwner: flip.previousOwner,
        committed: !!h.lockedBy, progress: (captureNow - flip.born) / duration, lift: this.radius * this.sim.tune.presentation.captureLift });
    }
    const previewId = this.chosenHex ?? this.hover;
    if (this.selected && previewId) {
      const placement = this.sim.placement(0, previewId, this.selected);
      for (const id of placement.ok ? placement.hexes : [previewId]) {
        const hex = this.byHex.get(id); if (!hex) continue;
        const p = this.position(hex);
        this.overlay.fillStyle(placement.ok ? 0x92cd7a : 0xe67463, 0.22).fillPoints(hexPoints(p.x, p.y, this.radius * 0.84), true);
        this.overlay.lineStyle(1.5, placement.ok ? 0xb4d8a1 : 0xffb5a8).strokePoints(hexPoints(p.x, p.y, this.radius * 0.84), true);
      }
    }
    for (const h of this.sim.hexes) if (h.capture > 0) {
      const p = this.position(h);
      this.overlay.lineStyle(3.5, playerColor(h.capturePlayer), h.captureReversing ? 0.5 : 1).beginPath().arc(p.x, p.y, this.radius * 0.48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * h.capture, false).strokePath();
      if (h.captureReversing) {
        const cx = p.x + Math.cos(-Math.PI / 2 + Math.PI * 2 * h.capture) * this.radius * 0.48;
        const cy = p.y + Math.sin(-Math.PI / 2 + Math.PI * 2 * h.capture) * this.radius * 0.48;
        this.overlay.fillStyle(playerColor(h.owner), 1).fillCircle(cx, cy, 2.8);
      }
    }
    const newBuildings = new Map<string, { x: number; y: number }>();
    if (this.lastSimTime !== this.sim.timeMs) { this.lastSimTime = this.sim.timeMs; this.lastSimFrame = now; }
    const visualMs = this.sim.timeMs + (this.paused ? 0 : Math.min(this.sim.tune.stepMs, (now - this.lastSimFrame) * this.speed));
    const entities = [...this.sim.buildings, ...this.sim.units].sort((a, b) => {
      const layer = (e: typeof a) => 'buildingId' in e && this.sim.tune.cards[e.kind].domain === 'air' ? 1 : 0;
      return layer(a) - layer(b) || this.position(this.byHex.get(a.hexId)!).y - this.position(this.byHex.get(b.hexId)!).y;
    });
    for (const e of entities) {
      const p = this.position(this.byHex.get(e.hexId)!);
      if ('unitId' in e) {
        newBuildings.set(e.id, p);
        const progress = e.kind === 'hq' ? undefined : 1 - Math.max(0, e.readyAtMs - this.sim.timeMs) / this.sim.tune.cards[e.kind].productionMs;
        drawBuilding(this.live, p.x, p.y, this.radius * 0.8, e.owner, e.kind, { hp: e.hp, maxHp: e.maxHp, progress, selected: this.inspected === e.id });
      } else {
        if (!this.seenUnits.has(e.id)) {
          this.seenUnits.add(e.id); const b = this.sim.buildings.find(b => b.id === e.buildingId);
          if (b) this.spawns.set(e.id, { ...this.position(this.byHex.get(b.hexId)!), born: now });
        }
        let x = p.x, y = p.y, movementX = 0;
        if (e.fromHexId && e.movingUntilMs && e.movedAtMs !== undefined) {
          const from = this.position(this.byHex.get(e.fromHexId)!);
          const t = Phaser.Math.Clamp((visualMs - e.movedAtMs) / (e.movingUntilMs - e.movedAtMs), 0, 1);
          x = Phaser.Math.Linear(from.x, p.x, t); y = Phaser.Math.Linear(from.y, p.y, t);
          if ((e.movingUntilMs ?? 0) > this.sim.timeMs) movementX = p.x - from.x;
        }
        const spawn = this.spawns.get(e.id);
        if (spawn && now - spawn.born < 450) {
          const t = Phaser.Math.Easing.Cubic.Out((now - spawn.born) / 450);
          x = Phaser.Math.Linear(spawn.x, x, t); y = Phaser.Math.Linear(spawn.y, y, t);
        } else this.spawns.delete(e.id);
        const attackHex = e.attackTargetHexId ? this.byHex.get(e.attackTargetHexId) : undefined;
        const target = attackHex ? this.position(attackHex) : undefined;
        const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : undefined;
        let facingX: 1 | -1 = this.facingX.get(e.id) ?? (e.owner === 0 ? 1 : -1);
        const facingDelta = e.attacking && target ? target.x - p.x : movementX;
        if (Math.abs(facingDelta) > 0.001) facingX = facingDelta < 0 ? -1 : 1;
        this.facingX.set(e.id, facingX);
        drawUnit(this.live, x, y, this.radius * (e.kind === 'infantry' ? 0.58 : 0.69), e.owner, e.kind,
          { hp: e.hp, maxHp: e.maxHp, attacking: e.attacking, moving: (e.movingUntilMs ?? 0) > this.sim.timeMs,
            phase: now / (e.attacking ? 100 : 130), angle, facingX });
      }
    }
    for (const [id, p] of this.seenBuildings) if (!newBuildings.has(id)) this.effects.push({ ...p, born: now });
    this.seenBuildings = newBuildings;
    this.seenUnits = new Set(this.sim.units.map(u => u.id));
    for (const id of this.spawns.keys()) if (!this.seenUnits.has(id)) this.spawns.delete(id);
    for (const id of this.facingX.keys()) if (!this.seenUnits.has(id)) this.facingX.delete(id);
    this.effects = this.effects.filter(e => now - e.born < 700).slice(-24);
    for (const e of this.effects) drawExplosion(this.live, e.x, e.y, this.radius, (now - e.born) / 700);
    for (const shot of this.sim.shots) {
      if (shot.id <= this.lastShotId) continue;
      this.lastShotId = shot.id;
      // A resumed/fast-forwarded view must not replay old shots as a burst.
      if (this.sim.timeMs - shot.timeMs > this.sim.tune.stepMs * 2) continue;
      this.traces.push({ id: shot.id, fromHexId: shot.fromHexId, targetHexId: shot.targetHexId, kind: shot.kind, targetDomain: shot.targetDomain, born: captureNow });
    }
    this.traces = this.traces.filter(t => captureNow - t.born < this.sim.tune.presentation.shotTraceMs).slice(-this.sim.tune.presentation.maxShotEvents);
    for (const t of this.traces) {
      const from = this.position(this.byHex.get(t.fromHexId)!), to = this.position(this.byHex.get(t.targetHexId)!);
      const sourceAir = this.sim.tune.cards[t.kind].domain === 'air';
      drawBulletTrace(this.feedback, from.x, from.y - this.radius * (sourceAir ? 0.42 : 0.2), to.x, to.y - this.radius * (t.targetDomain === 'air' ? 0.42 : 0.2), t.kind,
        (captureNow - t.born) / this.sim.tune.presentation.shotTraceMs);
    }
    if (this.selected && this.chosenHex) {
      const hex = this.byHex.get(this.chosenHex)!; const p = this.position(hex);
      drawBuildConfirmation(this.feedback, p.x, p.y, this.radius, { valid: this.sim.placement(0, hex.id, this.selected).ok, time: now });
    }
  }
  private label(id: string, text: string, x: number, y: number, size = 14, color = INK, origin = 0) {
    let object = this.texts.get(id);
    if (!object) { object = this.add.text(x, y, '', { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: size, color }).setResolution(DPR); this.texts.set(id, object); }
    object.setVisible(true).setPosition(x, y).setOrigin(origin, 0).setColor(color).setFontSize(size);
    if (object.text !== text) object.setText(text);
    return object;
  }
  private button(id: string, title: string, x: number, y: number, w: number, h: number, run: () => void, active = false, disabled = false) {
    this.hud.fillStyle(disabled ? 0xc6cdc3 : active ? 0x218d98 : 0xe2e8d8).fillRoundedRect(x, y, w, h, 9);
    this.hud.lineStyle(active ? 2 : 1, active ? 0x146571 : 0xc1cbbb).strokeRoundedRect(x, y, w, h, 9);
    this.label(id, title, x + w / 2, y + (h - 16) / 2, 13, active ? '#fff7e5' : disabled ? '#78887e' : INK, 0.5);
    this.buttons.push({ id, x, y, w, h, run: disabled ? () => {} : run });
  }
  private drawHud() {
    this.hud.clear(); this.buttons = [];
    for (const text of this.texts.values()) text.setVisible(false);
    const mobile = this.w < 760, compact = this.h < 520, pad = mobile || compact ? 12 : 24, resource = this.sim.resources(0);
    const deficit = resource.committed > resource.capacity;
    this.hud.fillStyle(CREAM, 0.98).fillRect(0, 0, this.w, this.top);
    this.hud.lineStyle(1, 0xbfc8b6).lineBetween(0, this.top, this.w, this.top);
    this.label('title', 'OPERATION C', pad, 13, mobile || compact ? 21 : 25).setFontStyle('bold');
    this.label('subtitle', 'CORE LOOP  /  YOU vs BOT', pad, mobile ? 40 : 43, compact ? 9 : 10, MUTED).setFontStyle('bold');
    const rx = mobile ? this.w - pad : 320;
    this.label('resources', `${resource.committed} / ${resource.capacity}`, rx, 14, 24, deficit ? '#b44739' : '#187e88', mobile ? 1 : 0).setFontStyle('bold');
    this.label('resourceLabel', 'COMMITTED / CAPACITY', rx, 43, 9, MUTED, mobile ? 1 : 0);
    const commandY = mobile ? 70 : 18, commandX = mobile ? pad : this.w - 400;
    this.button('defend', 'HOME · EXPAND', commandX, commandY, mobile ? (this.w - 32) / 2 : 157, 39, () => { this.sim.setTarget(0, 0); this.selected = null; this.chosenHex = null; this.message = 'HOME ORDER · expand and defend.'; }, this.sim.players[0].targetId === 0);
    this.button('attack', 'ATTACK RIVAL HQ', commandX + (mobile ? (this.w - 32) / 2 + 8 : 165), commandY, mobile ? (this.w - 32) / 2 : 173, 39, () => { this.sim.setTarget(0, 1); this.selected = null; this.chosenHex = null; this.message = 'ATTACK ORDER · advance on rival buildings.'; }, this.sim.players[0].targetId === 1);
    this.label('version', VERSION_STAMP, pad, this.top - 16, 9, '#84938c');
    this.label('timer', `${Math.floor(this.sim.timeMs / 60000)}:${String(Math.floor(this.sim.timeMs / 1000) % 60).padStart(2, '0')}  ·  LOCAL SANDBOX`, this.w - pad, this.top - 17, 10, MUTED, 1);

    const y = this.h - this.bottom;
    this.hud.fillStyle(CREAM, 0.98).fillRect(0, y, this.w, this.bottom);
    this.hud.lineStyle(1, 0xbfc8b6).lineBetween(0, y, this.w, y);
    this.label('status', this.message, pad, y + 10, mobile ? 11 : 13).setWordWrapWidth(this.w - pad * 2);
    const cardY = y + (mobile ? 48 : compact ? 29 : 38), gap = 8;
    const columns = mobile ? 3 : 5, cardH = mobile ? 62 : compact ? 67 : 78;
    const cardW = mobile ? (this.w - pad * 2 - gap * 2) / 3 : Math.min(175, (this.w - pad * 2 - 254 - gap * 4) / 5);
    CARDS.forEach((kind, i) => {
      const x = pad + (i % columns) * (cardW + gap), cy = cardY + Math.floor(i / columns) * (cardH + gap), c = this.sim.tune.cards[kind], active = this.selected === kind;
      this.button(`card-${kind}`, '', x, cy, cardW, cardH, () => { this.selected = this.selected === kind ? null : kind; this.chosenHex = null; this.message = this.selected ? `${NAMES[kind]} · ${ROLES[kind]}${kind === 'helicopter' || kind === 'fighter' ? ' · cannot capture' : ''}. Choose an open teal hex.` : 'Select a building or tap an HQ to change your order.'; }, active);
      drawBuilding(this.hud, x + 21, cy + (mobile ? 32 : compact ? 34 : 38), mobile ? 15 : 18, 0, kind);
      this.label(`cardName${i}`, NAMES[kind], x + 8, cy + 7, mobile || cardW < 130 ? 10 : 12, active ? '#fff7e5' : INK).setFontStyle('bold');
      this.label(`cardCost${i}`, `${c.cost} HEXES`, x + 43, cy + (mobile ? 27 : 30), mobile || cardW < 130 ? 10 : 12, active ? '#fff7e5' : '#187e88');
      this.label(`cardRange${i}`, `${ROLES[kind]} R${c.minRange > 1 ? `${c.minRange}-` : ''}${c.range}`, x + 8, cy + cardH - 15, 9, active ? '#d0f4e9' : MUTED);
    });
    const controlsY = mobile ? cardY + 2 * (cardH + gap) + 3 : cardY + 3, controlsX = mobile ? pad : pad + 5 * (cardW + gap) + 8;
    if (this.selected) {
      const valid = this.chosenHex ? this.sim.placement(0, this.chosenHex, this.selected).ok : false;
      this.button('build', 'BUILD HERE', controlsX, controlsY, mobile ? 122 : 136, 38, () => this.build(), true, !valid);
      this.button('cancel', 'CANCEL', controlsX + (mobile ? 130 : 144), controlsY, 74, 38, () => { this.selected = null; this.chosenHex = null; });
    } else {
      this.button('home', 'MY HQ', controlsX, controlsY, 74, 38, () => this.home());
      this.button('overview', 'MAP', controlsX + 82, controlsY, 62, 38, () => { this.zoomLevel = this.fitZoom(); this.panX = 0; this.panY = 0; });
      this.button('pause', this.paused ? 'PLAY' : 'PAUSE', controlsX + 152, controlsY, 70, 38, () => { this.paused = !this.paused; });
    }
    if (!mobile) {
      this.button('speed', `${this.speed}×`, controlsX, controlsY + (compact ? 42 : 46), 60, compact ? 26 : 32, () => { this.speed = this.speed === 4 ? 1 : this.speed * 2; });
      this.button('restart', 'RESTART', controlsX + 68, controlsY + (compact ? 42 : 46), 100, compact ? 26 : 32, () => this.restart());
    } else this.button('restart', 'RESET', this.w - pad - 67, controlsY, 67, 38, () => this.restart());
    this.label('hint', this.selected ? 'Tap the hammer hex again to build · Lock = committed' : mobile ? 'Drag · pinch · G ground / A air · Lock committed' : 'Drag to pan · Scroll zoom · 1-5 cards · G ground / A air · Lock committed · Space pauses', pad, this.h - 18, 10, MUTED);
    if (this.sim.winner !== null) {
      const width = Math.min(390, this.w - 32), x = (this.w - width) / 2, mid = (this.top + this.h - this.bottom) / 2;
      this.hud.fillStyle(0x153d4b, 0.45).fillRect(0, this.top, this.w, this.h - this.top - this.bottom);
      this.hud.fillStyle(CREAM).fillRoundedRect(x, mid - 75, width, 150, 18);
      this.label('winner', this.sim.winner === 0 ? 'YOUR HQ STANDS' : this.sim.winner === -1 ? 'MUTUAL DESTRUCTION' : 'HQ DESTROYED', this.w / 2, mid - 52, 22, INK, 0.5).setFontStyle('bold');
      this.label('winnerSub', 'Core loop complete · try another opening.', this.w / 2, mid - 18, 13, MUTED, 0.5);
      this.button('playAgain', 'PLAY AGAIN', this.w / 2 - 75, mid + 14, 150, 40, () => this.restart(), true);
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO, parent: 'app', backgroundColor: '#b5d5cf', antialias: true,
  width: Math.round(window.innerWidth * DPR), height: Math.round(window.innerHeight * DPR),
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { powerPreference: 'low-power' }, scene: Battlefield,
});
