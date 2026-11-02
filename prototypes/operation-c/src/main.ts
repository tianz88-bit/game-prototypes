import Phaser from 'phaser';
import type { Pane } from 'tweakpane';
import { OperationSim, DEFAULT_TUNE, BASE_CARDS, DEFAULT_LOADOUT } from './sim';
import type { Building, Unit, CardKind, Hex, Tune } from './model';
import { drawHex, drawBuilding, drawUnit, drawExplosion, drawCaptureFlip, drawBuildConfirmation, drawBulletTrace, drawCommitmentMarker, drawReleaseCountdown, drawRetreat, playerColor, hexPoints } from './art';
import { Intents } from './input';
import { VERSION_STAMP } from './version.generated';
import { NAMES, UNIT_NAMES, NOTES } from './catalog';

const CARDS = BASE_CARDS;
const STARTER = [...DEFAULT_LOADOUT];
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
  private loadout = new Set<CardKind>(STARTER);
  private previewUpgrade = new Set<CardKind>();
  private flips = new Map<CardKind, { born: number; toUpgrade: boolean }>();
  private unitPortraits = false;
  private loadoutScroll = 0; private loadoutMaxScroll = 0;
  private loadoutTop = 0; private loadoutEnd = 0;
  private cardArt!: Phaser.GameObjects.Graphics;
  private cardMaskArt!: Phaser.GameObjects.Graphics;
  private cardMask!: Phaser.Display.Masks.GeometryMask;
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
    this.cardArt = this.add.graphics(); this.cardMaskArt = this.make.graphics({ x: 0, y: 0 });
    this.cardMask = this.cardMaskArt.createGeometryMask(); this.cardArt.setMask(this.cardMask);
    this.hud = this.add.graphics();
    this.indexHexes(); this.resize(true);
    this.inputs = new Intents(this.game.canvas, () => ({ w: this.w, h: this.h }));
    const resize = () => this.resize(false);
    window.addEventListener('resize', resize);
    this.events.once('shutdown', () => { this.inputs.destroy(); window.removeEventListener('resize', resize); this.pane?.dispose(); });
    if (new URLSearchParams(location.search).has('debug')) void this.debugPanel();
    if (new URLSearchParams(location.search).get('test') === '1') {
      window.__operationC = {
        snapshot: () => ({ page: this.page, paused: this.paused, loadout: [...this.loadout], unitPortraits: this.unitPortraits, previewUpgrades: [...this.previewUpgrade], loadoutScroll: this.loadoutScroll, loadoutMaxScroll: this.loadoutMaxScroll, inspected: this.inspected, inspectorKind: this.inspectedSnapshot?.kind, panel: this.panel, players: this.sim.players, reinforcements: this.sim.reinforcements, timeMs: this.sim.timeMs, buildings: this.sim.buildings, units: this.sim.units,
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
    capture.addBinding(values.resources, 'destroyReleaseMs', { min: 1000, max: 30000, step: 1000 });
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
    for (const kind of Object.keys(values.cards) as CardKind[]) {
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
    this.sim = new OperationSim({ tune, bot: !(new URLSearchParams(location.search).get('test') === '1' && new URLSearchParams(location.search).get('bot') === '0'), loadouts: [[...this.loadout], STARTER] }); this.page = 'battle'; this.indexHexes(); this.terrainSignature = '';
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
    this.top = this.h < 520 ? 82 : 98;
    this.bottom = this.w < 600 ? 298 : this.h < 520 ? 154 : 220;
    this.sideW = this.w / 2; this.boardW = this.w;
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
    if (this.page !== 'battle' || x >= this.boardW || y < this.top || y >= this.h - this.bottom) return;
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
    const b = this.sim.buildings.find(b => b.hexId === hex.id);
    const u = this.sim.units.find(u => u.hexId === hex.id);
    if (this.selected && !b && !u && !hex.lockedBy && !hex.burnt) {
      if (this.chosenHex === hex.id) this.build();
      else { this.chosenHex = hex.id; const p = this.sim.placement(0, hex.id, this.selected); this.message = p.ok ? `${p.hexes.length} connected hexes · tap the hammer hex again to build.` : p.reason ?? 'Invalid placement.'; }
      return;
    }
    this.selected = null; this.chosenHex = null;
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
      else if (event.type === 'pan') { if(this.page==='loadout') this.loadoutScroll=Phaser.Math.Clamp(this.loadoutScroll-event.dy,0,this.loadoutMaxScroll);else {this.panX += event.dx; this.panY += event.dy;} }
      else if (event.type === 'zoom') {
        if(this.page==='loadout') {this.loadoutScroll=Phaser.Math.Clamp(this.loadoutScroll-Math.log(event.factor)*500,0,this.loadoutMaxScroll);continue;}
        const before = this.zoomLevel; this.zoomLevel = Phaser.Math.Clamp(before * event.factor, 0.24, 2.4);
        this.panX *= this.zoomLevel / before; this.panY *= this.zoomLevel / before;
      } else if (event.type === 'key') {
        if(this.page==='loadout'&&event.key==='home')this.loadoutScroll=0;
        if(this.page==='loadout'&&event.key==='end')this.loadoutScroll=this.loadoutMaxScroll;
        if (event.key === ' ') this.paused = !this.paused;
        if (event.key === 'h') this.home();
        if (event.key === 'escape') { this.selected = null; this.chosenHex = null; }
        if(this.page==='loadout'&&(event.key==='arrowdown'||event.key==='arrowup')) this.loadoutScroll=Phaser.Math.Clamp(this.loadoutScroll+(event.key==='arrowdown'?100:-100),0,this.loadoutMaxScroll);
        const index = Number(event.key) - 1; const deck=[...this.loadout];if(this.page==='battle'&&index>=0&&index<deck.length)this.chooseCard(deck[index]);
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
    for (const h of this.sim.hexes) if (h.commitment === 'release' && h.releaseAtMs !== undefined) {
      const p = this.position(h);
      drawReleaseCountdown(this.overlay, p.x, p.y, this.radius, 1 - Math.max(0, h.releaseAtMs - this.sim.timeMs) / this.sim.tune.resources.destroyReleaseMs);
    }
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
    object.setVisible(true).setPosition(x, y).setOrigin(origin, 0).setColor(color).setFontSize(size).setScale(1).setAlpha(1).setFontStyle('normal');
    if (object.text !== text) object.setText(text);
    return object;
  }
  private button(id: string, title: string, x: number, y: number, w: number, h: number, run: () => void, active = false, disabled = false) {
    this.hud.fillStyle(disabled ? 0xc6cdc3 : active ? 0x218d98 : 0xe2e8d8).fillRoundedRect(x, y, w, h, 9);
    this.hud.lineStyle(active ? 2 : 1, active ? 0x146571 : 0xc1cbbb).strokeRoundedRect(x, y, w, h, 9);
    this.label(id, title, x + w / 2, y + (h - 16) / 2, 13, active ? '#fff7e5' : disabled ? '#78887e' : INK, 0.5);
    this.buttons.push({ id, x, y, w, h, run: disabled ? () => {} : run });
  }
  private chooseCard(kind: CardKind) {
    this.selected=this.selected===kind?null:kind;
    this.chosenHex=null;this.inspected=null;this.inspectedSnapshot=null;this.panel='build';
    this.message=this.selected?'Choose open territory · tap its hammer again to build.':'Select a card or a force on the map.';
  }
  /** Same miniature factories for deck portraits and battlefield entities. */
  private miniCard(id:string,kind:CardKind,x:number,y:number,w:number,h:number,run:()=>void,active=false,disabled=false) {
    const c=this.sim.tune.cards[kind];this.button(id,'',x,y,w,h,run,active,disabled);
    const r=Math.min(20,h*0.25,w*0.22),cx=x+w/2,cy=y+r+8;
    if(this.unitPortraits)drawUnit(this.hud,cx,cy,r,0,kind,{members:c.squadSize?Array(c.squadSize).fill(c.unitHp):undefined});
    else drawBuilding(this.hud,cx,cy,r,0,kind);
    const color=disabled?MUTED:active?'#fff7e5':INK;
    this.label(`${id}-name`,this.unitPortraits?UNIT_NAMES[kind]:NAMES[kind],cx,y+h-28,w<100?8:10,color,0.5).setWordWrapWidth(w-4).setAlign('center');
    this.label(`${id}-cost`,`${c.cost} ◇ · ${c.buildMs/1000}s`,cx,y+h-12,9,color,0.5);
  }
  private drawHud() {
    this.hud.clear();this.cardArt.clear();this.buttons=[];
    for(const text of this.texts.values())text.setVisible(false);
    if(this.page==='loadout'){this.drawLoadout();return;}
    const narrow=this.w<600,compact=this.h<520,pad=10,p=this.sim.players[0],r=this.sim.resources(0),bottomY=this.h-this.bottom;
    for(const hex of this.sim.hexes)if(hex.commitment==='release'&&hex.releaseAtMs!==undefined){
      const point=this.toScreen(hex);
      if(point.x>12&&point.x<this.w-12&&point.y>this.top+12&&point.y<bottomY-12)
        this.label(`release-${hex.id}`,`${Math.ceil(Math.max(0,hex.releaseAtMs-this.sim.timeMs)/1000)}s`,point.x,point.y+9*this.zoomLevel,Math.max(8,10*this.zoomLevel),'#fff7e5',0.5);
    }
    this.hud.fillStyle(CREAM).fillRect(0,0,this.w,this.top).fillRect(0,bottomY,this.w,this.bottom);
    this.hud.lineStyle(2,0xa8bbaa).lineBetween(0,this.top,this.w,this.top).lineBetween(0,bottomY,this.w,bottomY).lineBetween(this.w/2,bottomY,this.w/2,this.h-32);
    this.label('title','OPERATION C',pad,8,narrow?18:22).setFontStyle('bold');
    this.label('version',VERSION_STAMP,pad,32,9,'#84938c');
    this.label('resources',`${r.committed} / ${r.capacity} ◇`,this.w-pad,7,narrow?21:25,r.committed>r.capacity?'#b44739':'#187e88',1).setFontStyle('bold');
    this.label('resourceLabel',`COMMITTED / CAPACITY${r.stranded?` · ${r.stranded} LOST`:''}`,this.w-pad,35,8,MUTED,1);
    const research=p.research,ry=this.top-34;
    const researchLabel=research?`T${research.fromTier} → T${research.toTier} · ${Math.ceil((research.completeAtMs-this.sim.timeMs)/1000)}s · CANCEL`:p.techTier<3?`RESEARCH T${p.techTier+1} · ${this.sim.tune.research.cost} TILES · ${(p.techTier===1?this.sim.tune.research.tier2Ms:this.sim.tune.research.tier3Ms)/1000}s`:'T3 TECHNOLOGY READY';
    this.button('research',researchLabel,pad,ry,this.w-pad*2,26,()=>{const result=research?this.sim.cancelResearch(0):this.sim.startResearch(0);this.message=result.ok?(research?'Research cancelled.':'Research started.'):result.reason??'Research unavailable.';},!!research,p.techTier===3&&!research);
    if(research)this.hud.fillStyle(0x218d98).fillRect(pad,this.top-5,(this.w-pad*2)*Phaser.Math.Clamp((this.sim.timeMs-research.startedAtMs)/(research.completeAtMs-research.startedAtMs),0,1),3);
    const half=this.w/2,leftW=half-pad*2;
    this.label('deckTitle','BUILD',pad,bottomY+7,10,MUTED).setFontStyle('bold');
    this.button('portrait-toggle',this.unitPortraits?'UNITS':'BUILDINGS',Math.max(55,half-100),bottomY+4,90,22,()=>{this.unitPortraits=!this.unitPortraits;},this.unitPortraits);
    const deck=[...this.loadout],cols=narrow?2:4,rows=Math.ceil(deck.length/cols),gap=4,cardY=bottomY+31,cw=(leftW-gap*(cols-1))/cols,ch=Math.min(narrow?62:76,(this.bottom-67-gap*(rows-1))/Math.max(rows,1));
    deck.forEach((kind,i)=>this.miniCard(`card-${kind}`,kind,pad+i%cols*(cw+gap),cardY+Math.floor(i/cols)*(ch+gap),cw,ch,()=>this.chooseCard(kind),this.selected===kind,this.sim.tune.cards[kind].tier>p.techTier));
    const x=half+pad,w=half-pad*2;
    if(this.selected){
      const c=this.sim.tune.cards[this.selected];
      this.label('buildTitle',NAMES[this.selected],x,bottomY+9,narrow?12:16).setFontStyle('bold').setWordWrapWidth(w);
      drawBuilding(this.hud,x+w/2,bottomY+(compact?60:80),compact?24:34,0,this.selected);
      this.label('buildInfo',`${c.cost} tiles · ${c.buildMs/1000}s construction`,x,bottomY+(compact?84:117),narrow?10:12,MUTED).setWordWrapWidth(w);
      this.label('buildHint',this.chosenHex?'Tap the hammer again to build.':'Choose an open owned hex.',x,bottomY+(compact?100:143),10,MUTED).setWordWrapWidth(w);
      this.button('cancel','CANCEL',x,this.h-66,w,27,()=>{this.selected=null;this.chosenHex=null;});
    }else if(this.inspectedSnapshot)this.drawInspector(x,bottomY+9,w,this.bottom-45);
    else{
      this.label('contextHint','COMMAND',x,bottomY+8,10,MUTED).setFontStyle('bold');
      this.label('status','Select a force for its commands.\n\nYour HQ: expand & defend\nEnemy HQ: attack',x,bottomY+34,compact?10:12,MUTED).setWordWrapWidth(w);
    }
    const navW=Math.min(80,(this.w-36)/4),navY=this.h-28;
    this.button('home','MY HQ',pad,navY,navW,23,()=>this.home());
    this.button('overview','MAP',pad+navW+4,navY,navW,23,()=>{this.zoomLevel=this.fitZoom();this.panX=0;this.panY=0;});
    this.button('pause',this.paused?'PLAY':'PAUSE',pad+(navW+4)*2,navY,navW,23,()=>{this.paused=!this.paused;});
    this.button('restart','LOADOUT',pad+(navW+4)*3,navY,navW,23,()=>{this.page='loadout';this.selected=null;this.chosenHex=null;});
    if(!narrow)this.label('mapHint',`${Math.floor(this.sim.timeMs/60000)}:${String(Math.floor(this.sim.timeMs/1000)%60).padStart(2,'0')} · T${p.techTier} · ${p.targetId===0?'EXPAND / DEFEND':'ATTACK HQ'}`,this.w-pad,this.h-23,10,MUTED,1);
    if(this.sim.winner!==null){
      const width=Math.min(350,this.boardW-20),x=(this.boardW-width)/2,mid=(this.top+bottomY)/2;
      this.hud.fillStyle(0x153d4b,0.4).fillRect(0,this.top,this.boardW,bottomY-this.top);
      this.hud.fillStyle(CREAM).fillRoundedRect(x,mid-65,width,130,16);
      this.label('winner',this.sim.winner===0?'YOUR HQ STANDS':this.sim.winner===-1?'MUTUAL DESTRUCTION':'HQ DESTROYED',this.boardW/2,mid-44,narrow?15:22,INK,0.5).setFontStyle('bold');
      this.button('playAgain','NEW MATCH',this.boardW/2-65,mid+6,130,35,()=>{this.page='loadout';});
    }
  }
  private drawInspector(x:number,y:number,w:number,h:number){
    const live=this.inspectedUnit?this.sim.units.find(u=>u.id===this.inspected):this.sim.buildings.find(b=>b.id===this.inspected);
    if(live)this.inspectedSnapshot=structuredClone(live);
    const e=this.inspectedSnapshot;if(!e)return;
    const compact=this.h<520,small=this.w<600,fs=small?11:14,building='unitId' in e;
    this.label('inspectTitle',e.kind==='hq'?'Headquarters':building?NAMES[e.kind]:UNIT_NAMES[e.kind],x,y,fs).setFontStyle('bold').setWordWrapWidth(w);
    this.label('inspectType',`${e.owner===0?'YOUR':'RIVAL'} ${building?'BUILDING':'UNIT'}${live?'':' · DESTROYED'}`,x,y+22,8,MUTED);
    this.label('inspectHealth',`HP ${Math.max(0,Math.ceil(e.hp))} / ${e.maxHp}${'members' in e&&e.members?` · ${e.members.length} members`:''}`,x,y+37,10,MUTED);
    if(e.kind==='hq'){
      const own=e.owner===0;
      this.label('hqOrder',own?'Expand territory & defend intruders.':'Direct your forces at this HQ.',x,y+56,10,MUTED).setWordWrapWidth(w);
      this.button(own?'defend':'attack',own?'EXPAND / DEFEND':'ATTACK THIS HQ',x,y+h-34,w,28,()=>{this.sim.setTarget(0,e.owner);this.selected=null;this.chosenHex=null;},this.sim.players[0].targetId===e.owner);return;
    }
    const c=this.sim.tune.cards[e.kind];
    if(!building){
      this.label('inspectUnit',`${c.domain==='air'?'AIR':'GROUND'} → ${c.targets.map(t=>t==='air'?'AIR':'GROUND').join(' / ')}\n${NOTES[e.kind]}`,x,y+57,compact?9:11,MUTED).setWordWrapWidth(w);return;
    }
    const progress=e.completeAtMs&&e.completeAtMs>this.sim.timeMs?`Constructing ${Math.ceil((e.completeAtMs-this.sim.timeMs)/1000)}s`:e.upgradeKind?`Converting ${Math.max(0,Math.ceil(((e.upgradeCompleteAtMs??0)-this.sim.timeMs)/1000))}s`:`${c.cost} tiles · ${c.buildMs/1000}s construction`;
    this.label('inspectProgress',progress,x,y+55,small?9:11,MUTED).setWordWrapWidth(w);
    if(!live||e.owner!==0)return;
    const commandY=y+h-34,buttonW=(w-5)/2;
    if(e.upgradeKind)this.button('cancel-upgrade','CANCEL ↑',x,commandY,buttonW,28,()=>{const r=this.sim.cancelUpgrade(0,e.id);this.message=r.ok?'Conversion cancelled; base production restarted.':r.reason??'Cannot cancel.';});
    else if(c.upgradeTo){
      const target=this.sim.tune.cards[c.upgradeTo],result=this.sim.canUpgrade(0,e.id);
      if(!compact)this.label('upgradeHint',`↑ ${NAMES[c.upgradeTo]}\n+${target.cost-c.cost} tiles · ${(c.upgradeMs??0)/1000}s · T${target.tier}`,x,y+81,9,MUTED).setWordWrapWidth(w);
      this.button('upgrade','UPGRADE ↑',x,commandY,buttonW,28,()=>{const r=this.sim.upgrade(0,e.id);this.message=r.ok?'Conversion started; previous forces recalled.':r.reason??'Cannot upgrade.';},false,!result.ok);
    }
    this.button('sell','SELL',x+buttonW+5,commandY,buttonW,28,()=>{const r=this.sim.sell(0,e.id);this.message=r.ok?'Sold. Remaining support released.':r.reason??'Cannot sell.';});
  }
  private flipCard(kind:CardKind){
    if(!this.flips.has(kind))this.flips.set(kind,{born:performance.now(),toUpgrade:!this.previewUpgrade.has(kind)});
  }
  private drawLoadout(){
    const small=this.w<600,compact=this.h<520,pad=small?10:22,gap=small?10:16;
    const header=compact?116:158,footer=49,cols=small?2:this.w<1000?3:4,cw=(this.w-pad*2-gap*(cols-1))/cols,ch=small?294:300;
    this.loadoutTop=header;this.loadoutEnd=this.h-footer;
    this.cardMaskArt.clear().fillStyle(0xffffff).fillRect(0,header,this.w,this.h-header-footer);
    this.cardArt.fillStyle(CREAM).fillRect(0,header,this.w,this.h-header-footer);
    this.hud.fillStyle(CREAM).fillRect(0,0,this.w,header).fillRect(0,this.h-footer,this.w,footer);
    const now=performance.now();let offset=header+12-this.loadoutScroll;
    for(const tier of [1,2,3] as const){
      const kinds=CARDS.filter(k=>this.sim.tune.cards[k].tier===tier),sectionY=offset;
      this.cardArt.fillStyle(0xdce7d6).fillRoundedRect(pad,sectionY,this.w-pad*2,32,7);
      this.loadLabel(`load-tier-${tier}`,`TIER ${tier}  ·  ${tier===1?'MOBILISE':tier===2?'ADAPT':'BREAK THE LINE'}`,pad+10,sectionY+8,12,INK).setFontStyle('bold');
      offset+=42;
      kinds.forEach((kind,i)=>{
        const base=this.sim.tune.cards[kind],flip=this.flips.get(kind);let scale=1;
        if(flip){
          const progress=this.reducedMotion?1:Math.min(1,(now-flip.born)/this.sim.tune.presentation.captureFlipMs);
          if(progress>=0.5){if(flip.toUpgrade)this.previewUpgrade.add(kind);else this.previewUpgrade.delete(kind);}
          scale=Math.abs(Math.cos(progress*Math.PI));if(progress===1)this.flips.delete(kind);
        }
        const variant=this.previewUpgrade.has(kind)&&base.upgradeTo?base.upgradeTo:kind,c=this.sim.tune.cards[variant];
        const x=pad+i%cols*(cw+gap),y=offset+Math.floor(i/cols)*(ch+gap),active=this.loadout.has(kind),center=x+cw/2,fx=center-cw*scale/2;
        if(y+ch<header||y>this.h-footer)return;
        this.cardArt.fillStyle(variant!==kind?0xe3eadf:0xfffdf2).fillRoundedRect(fx,y,cw*scale,ch,10);
        this.cardArt.lineStyle(active?3:1,active?0x218d98:0xbacbbd).strokeRoundedRect(fx,y,cw*scale,ch,10);
        const pick=()=>{if(this.loadout.has(kind))this.loadout.delete(kind);else if(this.loadout.size<8)this.loadout.add(kind);};
        const hitY=Math.max(header,y),hitEnd=Math.min(this.h-footer,y+ch);
        if(scale>0.5&&hitEnd>hitY)this.buttons.push({id:`loadout-${kind}`,x,y:hitY,w:cw,h:hitEnd-hitY,run:pick});
        if(scale<0.13)return;
        const lx=(v:number)=>center+(v-cw/2)*scale;
        const label=(id:string,text:string,dx:number,dy:number,size=10,color=MUTED)=>this.loadLabel(`load-${kind}-${id}`,text,lx(dx),y+dy,size,color).setScale(scale,1).setWordWrapWidth(cw-18);
        label('name',NAMES[variant],9,9,small?11:14,INK).setFontStyle('bold').setWordWrapWidth(cw-(base.upgradeTo?44:18));
        label('tier',`${active?'✓ SELECTED · ':''}T${c.tier}${variant!==kind?' · UPGRADE PREVIEW':''}`,9,41,8,active?'#187e88':MUTED);
        this.cardArt.lineStyle(1,0xd6dfcf).lineBetween(fx+7*scale,y+145,fx+(cw-7)*scale,y+145);
        drawBuilding(this.cardArt,lx(35),y+91,24*scale,0,variant);
        label('building','BUILDING',68,63,8,MUTED);
        label('cost',`${c.cost} tiles · ${c.buildMs/1000}s build`,68,78,small?9:11,INK).setWordWrapWidth(cw-75);
        label('hp',`HP ${c.buildingHp}`,68,99,10);
        label('production',`Production ${c.productionMs/1000}s`,9,125,10);
        drawUnit(this.cardArt,lx(34),y+187,22*scale,0,variant,{members:c.squadSize?Array(c.squadSize).fill(c.unitHp):undefined});
        label('unit',UNIT_NAMES[variant],67,155,small?10:12,INK).setFontStyle('bold').setWordWrapWidth(cw-73);
        const count=c.squadSize??1;
        label('unit-hp',`HP ${count>1?`${count} × `:''}${c.unitHp}`,67,191,10);
        label('stats',`DMG ${count>1?`${count} × `:''}${c.damage} · range ${c.minRange}–${c.range}\n${(1000/c.moveMs).toFixed(1)} hex/s · ${c.domain==='air'?'AIR':'GROUND'} → ${c.targets.map(t=>t==='air'?'A':'G').join('/')}\n${NOTES[variant]}`,9,218,small?9:10).setLineSpacing(2);
        if(base.upgradeTo&&y+8>=header&&y+38<=this.h-footer){
          const bx=x+cw-35;
          this.cardArt.fillStyle(0xd2e5cd).fillRoundedRect(bx,y+7,27,29,6);
          this.loadLabel(`load-${kind}-arrow`,variant===kind?'↑':'↓',bx+8,y+10,18,INK);
          this.buttons.push({id:`preview-${kind}`,x:bx,y:y+7,w:27,h:29,run:()=>this.flipCard(kind)});
        }
      });
      offset+=Math.ceil(kinds.length/cols)*(ch+gap)+14;
    }
    this.loadoutMaxScroll=Math.max(0,offset+this.loadoutScroll-(this.h-footer));this.loadoutScroll=Math.min(this.loadoutScroll,this.loadoutMaxScroll);
    this.label('loadoutTitle','OPERATION C · LOADOUT',pad,10,compact?17:22).setFontStyle('bold');
    this.button('portrait-toggle',this.unitPortraits?'UNIT PORTRAITS':'BUILDING PORTRAITS',this.w-(small?154:184)-pad,compact?8:42,small?154:184,25,()=>{this.unitPortraits=!this.unitPortraits;},this.unitPortraits);
    if(!compact)this.label('loadoutHint','8 unique base cards · include a T1 ground producer',pad,45,small?9:12,MUTED);
    const socketY=compact?43:77,socketH=compact?58:67,socketGap=small?3:7,socketW=(this.w-pad*2-socketGap*7)/8,deck=[...this.loadout];
    for(let i=0;i<8;i++){
      const x=pad+i*(socketW+socketGap),kind=deck[i];
      if(kind){
        this.button(`socket-${i}`,'',x,socketY,socketW,socketH,()=>{this.loadout.delete(kind);});
        const r=Math.min(19,socketW*0.34),cx=x+socketW/2;
        if(this.unitPortraits)drawUnit(this.hud,cx,socketY+25,r,0,kind,{members:this.sim.tune.cards[kind].squadSize?Array(5).fill(1):undefined});else drawBuilding(this.hud,cx,socketY+25,r,0,kind);
        const c=this.sim.tune.cards[kind],name=this.unitPortraits?UNIT_NAMES[kind]:NAMES[kind];
        this.label(`socket-name-${i}`,socketW<65?name.split(' ')[0]:name,cx,socketY+socketH-27,socketW<65?6:9,INK,0.5);
        this.label(`socket-cost-${i}`,`${c.cost}◇ · ${c.buildMs/1000}s`,cx,socketY+socketH-13,socketW<65?7:9,INK,0.5);
      }else{
        this.hud.fillStyle(0xe0e7da).fillRoundedRect(x,socketY,socketW,socketH,7);
        this.label(`socket-empty-${i}`,`${i+1}`,x+socketW/2,socketY+21,15,'#9aaa9c',0.5);
      }
    }
    const valid=this.loadout.size>0&&this.loadout.size<=8&&[...this.loadout].some(k=>this.sim.tune.cards[k].tier===1&&this.sim.tune.cards[k].domain==='ground');
    this.label('loadoutCount',`${this.loadout.size} / 8${valid?' · Scroll for tiers':' · NEED T1 GROUND'}`,pad,this.h-33,small?10:12,valid?'#187e88':'#b44739');
    this.button('start-match','START MATCH',this.w-148-pad,this.h-40,148,32,()=>{this.restart();this.home();},true,!valid);
    if(this.loadoutMaxScroll>0){
      const track=this.h-header-footer,thumb=Math.max(18,track*track/(track+this.loadoutMaxScroll));
      this.hud.fillStyle(0x86a798).fillRoundedRect(this.w-5,header+(track-thumb)*this.loadoutScroll/this.loadoutMaxScroll,3,thumb,2);
    }
  }
  private loadLabel(id:string,text:string,x:number,y:number,size=10,color=MUTED){
    const label=this.label(id,text,x,y,size,color);label.setMask(this.cardMask);return label;
  }
}

new Phaser.Game({
  type:Phaser.AUTO,parent:'app',backgroundColor:'#b5d5cf',antialias:true,
  width:Math.round(window.innerWidth*DPR),height:Math.round(window.innerHeight*DPR),
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  render:{powerPreference:'low-power'},scene:Battlefield,
});
