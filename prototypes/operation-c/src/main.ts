import Phaser from 'phaser';
import type { Pane } from 'tweakpane';
import { OperationSim, DEFAULT_TUNE, BASE_CARDS } from './sim';
import type { Building, Unit, CardKind, Hex, Tune } from './model';
import { drawHex, drawBuilding, drawUnit, drawExplosion, drawCaptureFlip, drawBuildConfirmation, drawBulletTrace, drawCommitmentMarker, drawRetreat, playerColor, hexPoints } from './art';
import { Intents } from './input';
import { VERSION_STAMP } from './version.generated';

const CARDS: CardKind[] = ['infantry', 'tank', 'artillery', 'helicopter', 'fighter', 'mlrs'];
const NAMES: Record<CardKind, string> = { infantry: 'BARRACKS', tank: 'FACTORY', artillery: 'ARTILLERY', helicopter: 'HANGAR', fighter: 'AIRFIELD', missile: 'ARMOURY', bomber: 'BOMBER AIRFIELD', mlrs: 'MLRS WORKS' };
const ROLES: Record<CardKind, string> = { infantry: 'G > G/A', tank: 'G > G', artillery: 'G > G', helicopter: 'A > G', fighter: 'A > A', missile: 'G > G', bomber: 'A > G', mlrs: 'G > G' };
const UNIT_NAMES: Record<CardKind,string> = { infantry:'INFANTRY SQUAD', missile:'MISSILE SQUAD', tank:'TANK', artillery:'ARTILLERY', helicopter:'HELICOPTER', fighter:'FIGHTER', bomber:'BOMBER', mlrs:'MLRS' };
const INK = '#203d46', MUTED = '#60767a', CREAM = 0xfff7e5;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
type Button = { id: string; x: number; y: number; w: number; h: number; run: () => void };
type QA = { snapshot: () => unknown; targets: () => unknown; advance: (ms: number) => void; captureClock: (ms: number | null) => void };
declare global { interface Window { __operationC?: QA } }

class Battlefield extends Phaser.Scene {
  sim = new OperationSim();
  private w = 0; private h = 0; private top = 0; private bottom = 0;
  private boardW = 0; private sideW = 0;
  private page: 'loadout' | 'battle' = 'loadout';
  private loadout = new Set<CardKind>(CARDS);
  private previewUpgrade = new Set<CardKind>();
  private panel: 'build' | 'details' = 'build';
  private inspectedUnit = false;
  private inspectedSnapshot: Building | Unit | null = null;
  private retiredSeen = 0;
  private retreats: { kind: CardKind; owner: number; hexId: string; members?: number[]; born: number }[] = [];
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
        snapshot: () => ({ page: this.page, paused: this.paused, loadout: [...this.loadout], inspected: this.inspected, inspectorKind: this.inspectedSnapshot?.kind, panel: this.panel, players: this.sim.players, reinforcements: this.sim.reinforcements, timeMs: this.sim.timeMs, buildings: this.sim.buildings, units: this.sim.units,
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
        targets: () => ({ board: { top: this.top * this.uiScale, bottom: (this.h - this.bottom) * this.uiScale, right: this.boardW * this.uiScale }, buttons: this.buttons.map(({ id, x, y, w, h }) => ({ id, x: (x + w / 2) * this.uiScale, y: (y + h / 2) * this.uiScale, left: x * this.uiScale, top: y * this.uiScale, w: w * this.uiScale, h: h * this.uiScale })),
          hexes: this.sim.hexes.map(h => { const p = this.toScreen(h); return { id: h.id, x: p.x * this.uiScale, y: p.y * this.uiScale, owner: h.owner,
            valid: this.selected ? this.sim.placement(0, h.id, this.selected).ok : false }; }) }),
        advance: ms => { this.paused = true; this.sim.tick(ms); },
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
    const research = this.pane.addFolder({title:'Technology',expanded:false});
    research.addBinding(values.research,'cost',{min:1,max:100,step:1});
    research.addBinding(values.research,'tier2Ms',{min:1000,max:120000,step:1000});
    research.addBinding(values.research,'tier3Ms',{min:1000,max:120000,step:1000});
    const reinforcements = this.pane.addFolder({title:'Reinforcements',expanded:false});
    reinforcements.addBinding(values.reinforcements,'msPerHex',{min:50,max:2000,step:50});
    reinforcements.addBinding(values.reinforcements,'minTravelMs',{min:100,max:5000,step:100});
    const presentation = this.pane.addFolder({ title: 'Capture animation', expanded: false });
    presentation.addBinding(values.presentation, 'captureFlipMs', { min: 100, max: 1500, step: 50 });
    presentation.addBinding(values.presentation, 'captureLift', { min: 0.1, max: 1.4, step: 0.02 });
    presentation.addBinding(values.presentation, 'retreatMs', {min:200,max:1500,step:50});
    presentation.addBinding(values.presentation, 'shotTraceMs', { min: 100, max: 600, step: 20 });
    for (const kind of CARDS) {
      const folder = this.pane.addFolder({ title: NAMES[kind], expanded: false });
      for (const key of ['cost', 'damage', 'unitHp', 'moveMs', 'productionMs', 'attackMs', 'captureRate', 'minRange', 'range', 'buildMs'] as const)
        folder.addBinding(values.cards[kind], key, { min: key.endsWith('Ms') ? 100 : 0.1, max: key.endsWith('Ms') ? 30000 : 300 });
      if (values.cards[kind].upgradeMs !== undefined) folder.addBinding(values.cards[kind], 'upgradeMs', { min: 100, max: 30000, step: 100 });
      if (values.cards[kind].retreatMs !== undefined) folder.addBinding(values.cards[kind], 'retreatMs', { min: 100, max: 10000, step: 100 });
    }
    this.pane.addButton({ title: 'Apply and restart sandbox' }).on('click', () => this.restart(values));
    this.pane.addButton({ title: 'Copy tuning JSON' }).on('click', () => {
      void navigator.clipboard.writeText(JSON.stringify(values, null, 2)).then(() => { this.message = 'Tuning copied.'; }).catch(() => { this.message = 'Clipboard blocked by browser.'; });
    });
  }
  private restart(tune?: Tune) {
    this.sim = new OperationSim({ tune, bot: !(new URLSearchParams(location.search).get('test') === '1' && new URLSearchParams(location.search).get('bot') === '0'), loadouts: [[...this.loadout], [...BASE_CARDS]] }); this.page = 'battle'; this.indexHexes(); this.terrainSignature = '';
    this.seenUnits.clear(); this.seenBuildings.clear(); this.spawns.clear(); this.effects = [];
    this.facingX.clear(); this.traces = []; this.lastShotId = 0; this.retiredSeen = 0; this.retreats = []; this.inspectedSnapshot = null; this.panel = 'build';
    this.selected = null; this.chosenHex = null; this.inspected = null; this.paused = false;
    this.message = 'Fresh battlefield. Choose a building card to begin.';
  }
  private resize(first: boolean) {
    // Narrow landscape keeps the same spacing in a slightly larger logical canvas.
    // This prevents the two command buttons colliding with the capacity display.
    this.uiScale = window.innerHeight < 520 && window.innerWidth >= 640 && window.innerWidth < 840 ? window.innerWidth / 840 : 1;
    this.w = Math.max(320, window.innerWidth) / this.uiScale; this.h = Math.max(320, window.innerHeight) / this.uiScale;
    this.top = this.h < 520 ? 94 : this.w < 760 ? 138 : 110;
    this.bottom = 0; this.sideW = this.w < 600 ? 150 : this.h < 520 ? 246 : 284; this.boardW = this.w - this.sideW;
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
    return Math.max(0.2, Math.min((this.boardW - 38) / (Math.max(...xs) - Math.min(...xs) + this.radius * 2),
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
    return { x: this.boardW / 2 + this.panX + p.x * this.zoomLevel, y: (this.top + this.h - this.bottom) / 2 + this.panY + p.y * this.zoomLevel };
  }
  private at(x: number, y: number): Hex | undefined {
    if (this.page !== 'battle' || x >= this.boardW || y < this.top || y > this.h) return;
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
    this.message = result.ok ? `${NAMES[this.selected]} constructing.` : result.reason ?? 'Cannot build here.';
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
    const u = this.sim.units.find(u => u.hexId === hex.id);
    this.inspected = b?.id ?? u?.id ?? null; this.inspectedUnit = !b && !!u;
    this.inspectedSnapshot = b ?? u ?? null; this.panel = 'details';
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
    if (this.page === 'battle' && !this.paused) this.sim.tick(Math.min(delta, 100) * this.speed);
    this.world.setVisible(this.page === 'battle');
    if (this.page === 'battle') this.drawWorld(); this.drawHud();
  }
  private drawWorld() {
    this.world.setPosition(this.boardW / 2 + this.panX, (this.top + this.h - this.bottom) / 2 + this.panY).setScale(this.zoomLevel);
    const now = performance.now(), captureNow = this.captureNow(), duration = this.sim.tune.presentation.captureFlipMs;
    for (const h of this.sim.hexes) {
      const oldOwner = this.previousOwners.get(h.id);
      if (oldOwner !== undefined && oldOwner !== h.owner && h.owner !== null && !h.burnt && !this.reducedMotion) {
        const p = this.toScreen(h), margin = this.radius * this.zoomLevel * 2;
        if (p.x > -margin && p.x < this.boardW + margin && p.y > this.top - margin && p.y < this.h - this.bottom + margin)
          this.captureFlips.set(h.id, { previousOwner: oldOwner, born: captureNow });
      }
      this.previousOwners.set(h.id, h.owner);
    }
    for (const [id, flip] of this.captureFlips) {
      const h = this.byHex.get(id)!;
      if (captureNow - flip.born >= duration || h.burnt || h.owner === null) this.captureFlips.delete(id);
    }
    const signature = this.sim.hexes.map(h => `${h.owner}:${h.burnt}:${h.lockedBy}:${h.commitment}`).join('|') + [...this.captureFlips.keys()].join(';');
    if (signature !== this.terrainSignature) {
      this.terrain.clear();
      for (const h of this.sim.hexes) {
        if (this.captureFlips.has(h.id)) continue;
        const p = this.position(h); drawHex(this.terrain, p.x, p.y, this.radius, { owner: h.owner, burnt: h.burnt, committed: !!h.lockedBy, commitment: h.commitment });
      }
      this.terrainSignature = signature;
    }
    this.overlay.clear(); this.live.clear(); this.feedback.clear();
    for (const h of this.sim.hexes) if (h.commitment === 'research') { const p = this.position(h); drawCommitmentMarker(this.overlay, p.x, p.y, this.radius, 'research', now); }
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
        drawBuilding(this.live, p.x, p.y, this.radius * 0.8, e.owner, e.kind, { hp: e.hp, maxHp: e.maxHp, progress, selected: this.inspected === e.id, construction: e.completeAtMs && e.completeAtMs > this.sim.timeMs && e.kind !== 'hq' ? 1 - (e.completeAtMs - this.sim.timeMs) / this.sim.tune.cards[e.kind].buildMs : undefined, upgrading: e.upgradeCompleteAtMs && e.upgradeKind && e.kind !== 'hq' ? 1 - (e.upgradeCompleteAtMs - this.sim.timeMs) / (this.sim.tune.cards[e.kind].upgradeMs || 1) : undefined });
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
        drawUnit(this.live, x, y, this.radius * (e.members ? 0.85 : 0.69), e.owner, e.kind,
          { hp: e.hp, maxHp: e.maxHp, attacking: e.attacking, moving: (e.movingUntilMs ?? 0) > this.sim.timeMs,
            phase: now / (e.attacking ? 100 : 130), angle, facingX, members: e.members });
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
    if (this.page === 'loadout') { this.drawLoadout(); return; }
    const narrow = this.w < 600, compact = this.h < 520, pad = 12, r = this.sim.resources(0), p = this.sim.players[0];
    this.hud.fillStyle(CREAM).fillRect(0,0,this.w,this.top).fillRect(this.boardW,this.top,this.sideW,this.h-this.top);
    this.hud.lineStyle(1,0xbfc8b6).lineBetween(0,this.top,this.w,this.top).lineBetween(this.boardW,this.top,this.boardW,this.h);
    this.label('title','OPERATION C',pad,10,narrow?20:24).setFontStyle('bold');
    this.label('version',VERSION_STAMP,pad,38,9,'#84938c');
    const rx = narrow ? this.w-pad : 250;
    this.label('resources',`${r.committed} / ${r.capacity}`,rx,10,22,r.committed>r.capacity?'#b44739':'#187e88',narrow?1:0).setFontStyle('bold');
    this.label('resourceLabel',`COMMITTED / CAPACITY${r.stranded ? ` · ${r.stranded} LOST` : ''}`,rx,36,8,MUTED,narrow?1:0);
    const commandY = narrow ? 58 : 12, commandX = narrow ? pad : this.w-365, commandW = narrow ? (this.w-32)/2 : 166;
    this.button('defend','HOME · EXPAND',commandX,commandY,commandW,32,()=>{this.sim.setTarget(0,0);this.selected=null;this.chosenHex=null;},p.targetId===0);
    this.button('attack','ATTACK RIVAL HQ',commandX+commandW+8,commandY,commandW,32,()=>{this.sim.setTarget(0,1);this.selected=null;this.chosenHex=null;},p.targetId===1);
    const research = p.research;
    const researchLabel = research ? `T${research.fromTier} → T${research.toTier} · ${Math.ceil((research.completeAtMs-this.sim.timeMs)/1000)}s · CANCEL` : p.techTier<3 ? `RESEARCH T${p.techTier+1} · ${this.sim.tune.research.cost} TILES · ${(p.techTier===1?this.sim.tune.research.tier2Ms:this.sim.tune.research.tier3Ms)/1000}s` : 'T3 TECHNOLOGY READY';
    this.button('research',researchLabel,pad,this.top-30,this.w-24,23,()=>{ const result=research?this.sim.cancelResearch(0):this.sim.startResearch(0);this.message=result.ok?(research?'Research cancelled.':'Research started.'):result.reason??'Research unavailable.'; },!!research,p.techTier===3&&!research);
    if (research) {
      const progress=1-(research.completeAtMs-this.sim.timeMs)/(research.completeAtMs-research.startedAtMs);
      this.hud.fillStyle(0x218d98).fillRect(pad,this.top-5,(this.w-24)*Phaser.Math.Clamp(progress,0,1),3);
    }
    const sx=this.boardW+10, sw=this.sideW-20, by=this.top+9;
    this.button('panel-build','BUILD',sx,by,(sw-6)/2,27,()=>{this.panel='build';},this.panel==='build');
    this.button('panel-details','DETAILS',sx+(sw+6)/2,by,(sw-6)/2,27,()=>{this.panel='details';this.selected=null;this.chosenHex=null;},this.panel==='details');
    let y=by+38;
    if (this.panel==='build') {
      const columns=compact?2:1, gap=6, cw=(sw-gap*(columns-1))/columns, ch=compact?40:49;
      const visibleCards = this.selected && this.h < 740 ? [this.selected] : CARDS.filter(k=>this.loadout.has(k));
      visibleCards.forEach((kind,i)=>{
        const c=this.sim.tune.cards[kind],x=sx+(i%columns)*(cw+gap),cy=y+Math.floor(i/columns)*(ch+gap),locked=c.tier>p.techTier;
        this.button(`card-${kind}`,'',x,cy,cw,ch,()=>{this.selected=this.selected===kind?null:kind;this.chosenHex=null;this.message=this.selected?'Choose an open owned hex, then tap its hammer again.':'Choose a building.';},this.selected===kind,locked);
        drawBuilding(this.hud,x+17,cy+27,12,0,kind);
        this.label(`cardName${i}`,NAMES[kind],x+32,cy+5,narrow||compact?9:12,locked?MUTED:this.selected===kind?'#fff7e5':INK).setFontStyle('bold');
        this.label(`cardInfo${i}`,`${c.cost} tiles · T${c.tier}${locked?' · LOCKED':''}`,x+32,cy+22,narrow||compact?8:10,locked?MUTED:this.selected===kind?'#fff7e5':'#187e88');
      });
      y+=Math.ceil(visibleCards.length/columns)*(ch+gap)+5;
      if (this.selected) {
        const c=this.sim.tune.cards[this.selected];
        this.label('cardDescription',`${ROLES[this.selected]} · R${c.minRange>1?`${c.minRange}-`:''}${c.range}\nBuild ${c.buildMs/1000}s · unit ${c.productionMs/1000}s`,sx,y,10,MUTED).setWordWrapWidth(sw);y+=39;
        const valid=this.chosenHex?this.sim.placement(0,this.chosenHex,this.selected).ok:false;
        this.button('build','BUILD HERE',sx,y,sw,30,()=>this.build(),true,!valid);y+=36;
        this.button('cancel','CANCEL',sx,y,sw,27,()=>{this.selected=null;this.chosenHex=null;});y+=33;
      }
      this.label('status',this.message,sx,y,compact?9:10,MUTED).setWordWrapWidth(sw);
    } else this.drawInspector(sx,y,sw);
    const fy=this.h-72, half=(sw-6)/2;
    this.button('home','MY HQ',sx,fy,half,27,()=>this.home());
    this.button('overview','MAP',sx+half+6,fy,half,27,()=>{this.zoomLevel=this.fitZoom();this.panX=0;this.panY=0;});
    this.button('pause',this.paused?'PLAY':'PAUSE',sx,fy+33,half,27,()=>{this.paused=!this.paused;});
    this.button('restart','LOADOUT',sx+half+6,fy+33,half,27,()=>{this.page='loadout';this.selected=null;this.chosenHex=null;});
    this.label('mapHint',`${Math.floor(this.sim.timeMs/60000)}:${String(Math.floor(this.sim.timeMs/1000)%60).padStart(2,'0')} · T${p.techTier} · drag / zoom`,10,this.h-19,10,MUTED);
    if (this.sim.winner!==null) {
      const width=Math.min(350,this.boardW-20),x=(this.boardW-width)/2,mid=(this.top+this.h)/2;
      this.hud.fillStyle(0x153d4b,0.4).fillRect(0,this.top,this.boardW,this.h-this.top);
      this.hud.fillStyle(CREAM).fillRoundedRect(x,mid-65,width,130,16);
      this.label('winner',this.sim.winner===0?'YOUR HQ STANDS':this.sim.winner===-1?'MUTUAL DESTRUCTION':'HQ DESTROYED',this.boardW/2,mid-44,narrow?15:22,INK,0.5).setFontStyle('bold');
      this.button('playAgain','NEW MATCH',this.boardW/2-65,mid+6,130,35,()=>{this.page='loadout';});
    }
  }
  private drawInspector(x:number,y:number,w:number) {
    const live=this.inspectedUnit?this.sim.units.find(u=>u.id===this.inspected):this.sim.buildings.find(b=>b.id===this.inspected);
    if (live) this.inspectedSnapshot=structuredClone(live);
    const e=this.inspectedSnapshot;
    if (!e) { this.label('inspectEmpty','Select a building or unit on the map to inspect it.',x,y,11,MUTED).setWordWrapWidth(w);return; }
    const compact=this.h<520, font=this.w<600?10:12;
    this.label('inspectTitle',e.kind==='hq'?'HEADQUARTERS':'unitId' in e?NAMES[e.kind]:UNIT_NAMES[e.kind],x,y,font+1).setFontStyle('bold').setWordWrapWidth(w);y+=compact?16:32;
    this.label('inspectType',`${'unitId' in e?'BUILDING':'UNIT'} · ${e.owner===0?'YOUR':'RIVAL'}${live?'':' · DESTROYED'}`,x,y,9,MUTED).setWordWrapWidth(w);y+=compact?14:23;
    if (e.kind==='hq') {
      this.label('inspectStats',`HP ${Math.max(0,Math.ceil(e.hp))}/${e.maxHp}\nHex ${e.hexId}\nTech T${this.sim.players[e.owner].techTier}`,x,y,font).setWordWrapWidth(w);return;
    }
    const c=this.sim.tune.cards[e.kind];
    const stats='unitId' in e ? `HP ${Math.max(0,Math.ceil(e.hp))}/${e.maxHp}\nCost ${c.cost} · T${c.tier}\nProduction ${c.productionMs/1000}s\n${e.completeAtMs&&e.completeAtMs>this.sim.timeMs?`Constructing ${Math.ceil((e.completeAtMs-this.sim.timeMs)/1000)}s`:e.upgradeKind?`Upgrading ${Math.max(0,Math.ceil(((e.upgradeCompleteAtMs??0)-this.sim.timeMs)/1000))}s`:`Unit ready in ${Math.max(0,Math.ceil((e.readyAtMs-this.sim.timeMs)/1000))}s`}` : `HP ${Math.max(0,Math.ceil(e.hp))}/${e.maxHp}${e.members?` · ${e.members.length}/5`:''}\nDMG ${c.damage}${e.members?` × ${e.members.length}`:''} · ${c.attackMs/1000}s\nRange ${c.minRange}-${c.range}\nSpeed ${(1000/c.moveMs).toFixed(2)} hex/s\n${ROLES[e.kind]} · Hex ${e.hexId}`;
    this.label('inspectStats',compact?stats.replace(/\n/g,' · '):stats,x,y,compact?10:font).setLineSpacing(compact?1:3).setWordWrapWidth(w);y+=compact?50:115;
    if (live&&'unitId' in e&&e.owner===0) {
      if (e.upgradeKind) {
        this.button('cancel-upgrade','CANCEL UPGRADE',x,y,w,30,()=>{const result=this.sim.cancelUpgrade(0,e.id);this.message=result.ok?'Upgrade cancelled; production cooldown restarted.':result.reason??'Cannot cancel.';});y+=36;
      } else if (c.upgradeTo) {
        const target=this.sim.tune.cards[c.upgradeTo],result=this.sim.canUpgrade(0,e.id);
        this.label('upgradeHint',`→ ${NAMES[c.upgradeTo]}\n+${target.cost-c.cost} tiles · ${(c.upgradeMs??0)/1000}s · T${target.tier}`,x,y,9,MUTED).setWordWrapWidth(w);y+=compact?28:39;
        this.button('upgrade','UPGRADE',x,y,w,30,()=>{const r=this.sim.upgrade(0,e.id);this.message=r.ok?'Upgrade started; old forces recalled.':r.reason??'Cannot upgrade.';},false,!result.ok);y+=36;
        if (!result.ok && !compact) {this.label('upgradeReason',result.reason??'',x,y,9,MUTED).setWordWrapWidth(w);y+=27;}
      }
      this.button('sell','SELL',x,y,w,30,()=>{const result=this.sim.sell(0,e.id);this.message=result.ok?'Sold. Remaining support released.':result.reason??'Cannot sell.';});
    }
  }
  private drawLoadout() {
    const compact=this.h<520,narrow=this.w<600,pad=12,cols=narrow?2:3,gap=10,header=compact?48:76,footer=compact?48:70;
    this.hud.fillStyle(CREAM).fillRect(0,0,this.w,this.h);
    this.label('loadoutTitle','OPERATION C · LOADOUT',pad,12,compact?19:24).setFontStyle('bold');
    if (!compact) this.label('loadoutHint','Choose up to 8 unique base cards · include a T1 ground producer',pad,44,narrow?10:13,MUTED).setWordWrapWidth(this.w-24);
    const rows=Math.ceil(CARDS.length/cols),cw=(this.w-pad*2-gap*(cols-1))/cols,ch=Math.min(245,(this.h-header-footer-gap*(rows-1))/rows);
    CARDS.forEach((kind,i)=>{
      const base=this.sim.tune.cards[kind],variant=this.previewUpgrade.has(kind)&&base.upgradeTo?base.upgradeTo:kind,c=this.sim.tune.cards[variant];
      const x=pad+(i%cols)*(cw+gap),y=header+Math.floor(i/cols)*(ch+gap),active=this.loadout.has(kind),fs=compact?9:11;
      this.button(`loadout-${kind}`,'',x,y,cw,ch,()=>{if(this.loadout.has(kind))this.loadout.delete(kind);else if(this.loadout.size<8)this.loadout.add(kind);},false);
      this.hud.lineStyle(active?3:1,active?0x218d98:0xc1cbbb).strokeRoundedRect(x,y,cw,ch,9);
      drawBuilding(this.hud,x+22,y+31,compact?15:20,0,variant);
      this.label(`loadName${i}`,`${active?'✓ ':''}${NAMES[kind]}`,x+44,y+8,compact||narrow?10:14).setFontStyle('bold');
      this.label(`loadTier${i}`,variant!==kind?`${NAMES[variant]} preview · T${c.tier}`:`BASE CARD · T${c.tier}`,x+44,y+25,compact?8:9,MUTED).setWordWrapWidth(cw-50);
      const count=c.squadSize??1;
      const stats=`Cost ${c.cost} tiles · building HP ${c.buildingHp}\nConstruction ${c.buildMs/1000}s · unit ${c.productionMs/1000}s\nUnit HP ${count>1?`${count} × ${c.unitHp} = `:''}${count*c.unitHp}\nSpeed ${(1000/c.moveMs).toFixed(2)} hex/s\nRange ${c.minRange}-${c.range} · damage ${count>1?`${count} × `:''}${c.damage}\nAttack ${c.attackMs/1000}s · ${ROLES[variant]}`;
      this.label(`loadStats${i}`,stats,x+9,y+(compact?47:58),fs,MUTED).setLineSpacing(compact?1:4).setWordWrapWidth(cw-18);
      if (base.upgradeTo) this.button(`preview-${kind}`,variant===kind?'VIEW UPGRADE':'VIEW BASE',x+8,y+ch-27,cw-16,22,()=>{if(this.previewUpgrade.has(kind))this.previewUpgrade.delete(kind);else this.previewUpgrade.add(kind);});
    });
    const valid=this.loadout.size>0&&this.loadout.size<=8&&[...this.loadout].some(k=>this.sim.tune.cards[k].tier===1&&this.sim.tune.cards[k].domain==='ground');
    this.label('loadoutCount',`${this.loadout.size} / 8 unique${valid?'':' · NEED T1 GROUND'}`,pad,this.h-footer+12,compact?10:12,valid?'#187e88':'#b44739');
    this.label('loadoutNote','Upgrades stay with their base card.',pad,this.h-18,9,MUTED);
    this.button('start-match','START MATCH',this.w-156,this.h-footer+5,144,33,()=>{this.restart();this.home();},true,!valid);
  }

}

new Phaser.Game({
  type: Phaser.AUTO, parent: 'app', backgroundColor: '#b5d5cf', antialias: true,
  width: Math.round(window.innerWidth * DPR), height: Math.round(window.innerHeight * DPR),
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { powerPreference: 'low-power' }, scene: Battlefield,
});
