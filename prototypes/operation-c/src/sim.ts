import tuneJson from '../tune.json';
import type { Building, CardKind, CardTune, DamageClass, Hex, NuclearImpact, NukeFlight, PendingRelease, Placement, Player, Reinforcement, Retirement, Shot, Tune, Unit, UnitDomain } from './model';
export type { Building, CardKind, CardTune, DamageClass, Hex, NuclearImpact, NukeFlight, PendingRelease, Placement, Player, Reinforcement, Retirement, Research, Shot, Tune, Unit, UnitDomain } from './model';

export const DEFAULT_TUNE: Tune = tuneJson as Tune;
export const BASE_CARDS: readonly CardKind[] = ['infantry', 'tank', 'artillery', 'helicopter', 'fighter', 'scout', 'gunner', 'flak', 'walker', 'destroyer', 'carrier', 'bunker', 'silo'];
export const DEFAULT_LOADOUT: readonly CardKind[] = ['infantry', 'tank', 'artillery', 'helicopter', 'fighter', 'scout', 'bunker', 'silo'];
// Axial direction order is also the deterministic BFS tie-break.
const DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
export const hexId = (q: number, r: number): string => `${q},${r}`;
export const distance = (a: Pick<Hex, 'q' | 'r'>, b: Pick<Hex, 'q' | 'r'>): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

/** Private persistence format; never accept a checkpoint from a game client. */
export interface OperationCheckpoint {
  version: 4; tune: Tune; loadouts: CardKind[][]; hexes: Hex[]; buildings: Building[]; units: Unit[];
  shots: Shot[]; reinforcements: Reinforcement[]; retirements: Retirement[]; pendingReleases: PendingRelease[]; players: Player[];
  timeMs: number; winner: number | null; accumulatorMs: number; serial: number; shotSerial: number;
  reinforcementSerial: number; retirementSerial: number; strandedDebt: [number, number][];
  botEnabled: boolean; nextBotBuildMs: number; botCard: number;
  nukeFlights: NukeFlight[]; nuclearImpacts: NuclearImpact[]; nukeSerials: number[]; nuclearImpactSerial: number;
}

/** Renderer-independent deterministic rules. Public DTOs are mutable for dev fixtures;
 * the game should issue place/setTarget commands rather than mutate them directly.
 * Provisional slice rules: no terrain obstacles/LOS; capture strength does not scale
 * with squad size; HQ pressure retakes empty enemy land; eliminated buildings vanish.
 */
export class OperationSim {
  readonly tune: Tune;
  readonly hexes: Hex[] = [];
  readonly buildings: Building[] = [];
  readonly units: Unit[] = [];
  readonly shots: Shot[] = [];
  readonly reinforcements: Reinforcement[] = [];
  readonly retirements: Retirement[] = [];
  readonly pendingReleases: PendingRelease[] = [];
  readonly nukeFlights: NukeFlight[] = [];
  readonly nuclearImpacts: NuclearImpact[] = [];
  readonly loadouts: CardKind[][];
  readonly players: Player[] = [
    { id: 0, name: 'You', alive: true, targetId: 0, techTier: 1, research: null },
    { id: 1, name: 'Rival', alive: true, targetId: 1, techTier: 1, research: null },
  ];
  timeMs = 0;
  winner: number | null = null;
  private accumulatorMs = 0;
  private serial = 0;
  private shotSerial = 0;
  private reinforcementSerial = 0;
  private retirementSerial = 0;
  private nukeSerials = [0, 0];
  private nuclearImpactSerial = 0;
  private readonly strandedDebt = new Map<number, number>();
  private readonly byHex = new Map<string, Hex>();
  private readonly botEnabled: boolean;
  private nextBotBuildMs: number;
  private botCard = 0;

  constructor(options: { tune?: Tune; bot?: boolean; loadouts?: CardKind[][] } = {}) {
    this.tune = structuredClone(options.tune ?? DEFAULT_TUNE);
    if (!Number.isFinite(this.tune.stepMs) || this.tune.stepMs <= 0) throw new Error('stepMs must be positive');
    if (this.tune.movement && (!Number.isFinite(this.tune.movement.friendlySpeedMultiplier) || this.tune.movement.friendlySpeedMultiplier <= 0)) throw new Error('friendlySpeedMultiplier must be finite and positive');
    for (const card of Object.values(this.tune.cards)) if (!['light', 'armoured', 'structure'].includes(card.damageClass)) throw new Error('Damage-class rules require current tuning; reload the current game version');
    for (const card of Object.values(this.tune.cards)) if (!Number.isFinite(card.sightRange) || card.sightRange < 0) throw new Error('Individual sight rules require current tuning; reload the current game version');
    this.loadouts = this.players.map((p, i) => {
      const cards = options.loadouts?.[i] ?? [...DEFAULT_LOADOUT];
      if (!Array.isArray(cards) || cards.length > 8 || new Set(cards).size !== cards.length ||
        cards.some(k => !BASE_CARDS.includes(k)) || !cards.some(k => this.tune.cards[k].tier === 1 && this.tune.cards[k].domain === 'ground' && !this.tune.cards[k].utility)) {
        throw new Error(`Invalid loadout for player ${p.id}: choose up to eight unique base cards including a T1 ground producer`);
      }
      return [...cards];
    });
    this.botEnabled = options.bot ?? true;
    this.nextBotBuildMs = this.tune.bot.buildEveryMs;
    const radius = this.tune.map.radius;
    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        const h: Hex = { id: hexId(q, r), q, r, owner: null, burnt: false, lockedBy: null, capture: 0, capturePlayer: null };
        this.hexes.push(h); this.byHex.set(h.id, h);
      }
    }
    for (const p of this.players) {
      const q = p.id === 0 ? -this.tune.map.hqQ : this.tune.map.hqQ;
      const r = p.id === 0 ? -this.tune.map.hqR : this.tune.map.hqR;
      const h = this.byHex.get(hexId(q, r));
      if (!h) throw new Error('HQ must be inside the map');
      this.buildings.push({ id: `hq${p.id}`, hexId: h.id, owner: p.id, kind: 'hq', hp: this.tune.hq.hp,
        maxHp: this.tune.hq.hp, readyAtMs: 0, unitId: null });
      for (const land of this.hexes) if (distance(land, h) <= this.tune.hq.captureRings) land.owner = p.id;
    }
  }

  neighbors(id: string): Hex[] {
    const h = this.byHex.get(id);
    if (!h) return [];
    return DIRECTIONS.flatMap(([q, r]) => {
      const n = this.byHex.get(hexId(h.q + q, h.r + r)); return n ? [n] : [];
    });
  }

  checkpoint(): OperationCheckpoint {
    return structuredClone({ version: 4, tune: this.tune, loadouts: this.loadouts,
      hexes: this.hexes, buildings: this.buildings, units: this.units, shots: this.shots,
      reinforcements: this.reinforcements, retirements: this.retirements, pendingReleases: this.pendingReleases, players: this.players,
      timeMs: this.timeMs, winner: this.winner, accumulatorMs: this.accumulatorMs, serial: this.serial,
      shotSerial: this.shotSerial, reinforcementSerial: this.reinforcementSerial, retirementSerial: this.retirementSerial,
      strandedDebt: [...this.strandedDebt], botEnabled: this.botEnabled, nextBotBuildMs: this.nextBotBuildMs, botCard: this.botCard,
      nukeFlights: this.nukeFlights, nuclearImpacts: this.nuclearImpacts, nukeSerials: this.nukeSerials, nuclearImpactSerial: this.nuclearImpactSerial });
  }

  static restore(checkpoint: OperationCheckpoint): OperationSim {
    if (checkpoint.version !== 4) throw new Error('Unsupported Operation C checkpoint');
    const data = structuredClone(checkpoint);
    const sim = new OperationSim({ tune: data.tune, loadouts: data.loadouts, bot: data.botEnabled });
    const replace = <T>(target: T[], source: T[]) => { target.splice(0, target.length, ...source); };
    replace(sim.hexes, data.hexes); replace(sim.buildings, data.buildings); replace(sim.units, data.units);
    replace(sim.shots, data.shots); replace(sim.reinforcements, data.reinforcements); replace(sim.retirements, data.retirements);
    replace(sim.pendingReleases, data.pendingReleases); replace(sim.players, data.players);
    replace(sim.nukeFlights, data.nukeFlights); replace(sim.nuclearImpacts, data.nuclearImpacts);
    sim.nukeSerials = data.nukeSerials; sim.nuclearImpactSerial = data.nuclearImpactSerial;
    sim.byHex.clear(); for (const h of sim.hexes) sim.byHex.set(h.id, h);
    for (const [owner, debt] of data.strandedDebt) sim.strandedDebt.set(owner, debt);
    sim.timeMs = data.timeMs; sim.winner = data.winner; sim.accumulatorMs = data.accumulatorMs; sim.serial = data.serial;
    sim.shotSerial = data.shotSerial; sim.reinforcementSerial = data.reinforcementSerial; sim.retirementSerial = data.retirementSerial;
    sim.nextBotBuildMs = data.nextBotBuildMs; sim.botCard = data.botCard;
    return sim;
  }

  resources(playerId: number): { committed: number; capacity: number; stranded: number } {
    const hqs = new Set(this.buildings.filter(b => b.kind === 'hq').map(b => b.hexId));
    const capacity = this.hexes.filter(h => h.owner === playerId && !h.burnt && !hqs.has(h.id)).length;
    const stranded = this.strandedDebt.get(playerId) ?? 0;
    const committed = stranded + this.buildings.reduce((sum, b) => sum + (b.owner === playerId && b.kind !== 'hq' ?
      (b.committedCost ?? this.tune.cards[b.kind].cost) + (b.upgradeCost ?? 0) : 0), 0) +
      (this.players.find(p => p.id === playerId)?.research ? this.tune.research.cost : 0) +
      this.pendingReleases.filter(r => r.owner === playerId).reduce((n, r) => n + r.supportIds.length, 0);
    return { committed, capacity: Math.min(capacity, this.tune.resources.capacityCap), stranded };
  }

  placement(playerId: number, id: string, kind: CardKind): Placement {
    const fail = (reason: string): Placement => ({ ok: false, reason, hexes: [] });
    if (this.winner !== null) return fail('Match ended');
    if (!this.players.find(p => p.id === playerId)?.alive) return fail('Player eliminated');
    const card = this.tune.cards[kind];
    if (!card) return fail('Unknown building');
    if (!BASE_CARDS.includes(kind) || !this.loadouts[playerId]?.includes(kind)) return fail('Building is not in the base-card loadout');
    if (this.players.find(p => p.id === playerId)!.techTier < card.tier) return fail(`Requires technology tier ${card.tier}`);
    const h = this.byHex.get(id);
    if (!h) return fail('Outside map');
    if (this.buildings.some(b => b.hexId === id) || this.units.some(u => u.hexId === id || this.reservedFrom(u) === id)) return fail('Hex occupied');
    const open = (x: Hex) => x.owner === playerId && !x.burnt && x.lockedBy === null && !this.buildings.some(b => b.hexId === x.id);
    if (!open(h)) return fail('Requires open owned unburnt territory');
    const { committed, capacity } = this.resources(playerId);
    if (committed + card.cost > capacity) return fail('Insufficient global capacity');
    const queue = [h], seen = new Set([id]);
    for (let i = 0; i < queue.length && queue.length < card.cost; i++) {
      for (const n of this.neighbors(queue[i].id)) {
        if (seen.has(n.id) || !open(n)) continue;
        seen.add(n.id); queue.push(n);
        if (queue.length === card.cost) break;
      }
    }
    if (queue.length < card.cost) return fail(`Needs ${card.cost} connected open hexes`);
    return { ok: true, hexes: queue.slice(0, card.cost).map(x => x.id) };
  }

  place(playerId: number, id: string, kind: CardKind): { ok: boolean; reason?: string } {
    const result = this.placement(playerId, id, kind);
    if (!result.ok) return { ok: false, reason: result.reason };
    const card = this.tune.cards[kind];
    const building: Building = { id: `b${++this.serial}`, owner: playerId, hexId: id, kind,
      hp: card.buildingHp, maxHp: card.buildingHp, readyAtMs: this.timeMs, unitId: null,
      completeAtMs: this.timeMs + card.buildMs, committedCost: card.cost };
    this.buildings.push(building);
    for (const support of result.hexes) { const h = this.byHex.get(support)!; h.lockedBy = building.id; h.commitment = 'building'; }
    this.spawn(building);
    return { ok: true };
  }

  private openSupports(playerId: number): Hex[] {
    return this.hexes.filter(h => h.owner === playerId && !h.burnt && h.lockedBy === null && !this.buildings.some(b => b.hexId === h.id));
  }

  startResearch(playerId: number): { ok: boolean; reason?: string } {
    const p = this.players.find(x => x.id === playerId);
    if (this.winner !== null || !p?.alive) return { ok: false, reason: 'Player cannot research' };
    if (p.research || p.techTier === 3) return { ok: false, reason: p.research ? 'Research already running' : 'Maximum technology reached' };
    const cost = this.tune.research.cost, r = this.resources(playerId), supports = this.openSupports(playerId);
    if (r.committed + cost > r.capacity || supports.length < cost) return { ok: false, reason: 'Research needs twenty open resources and global capacity' };
    p.research = { fromTier: p.techTier, toTier: p.techTier === 1 ? 2 : 3, startedAtMs: this.timeMs,
      completeAtMs: this.timeMs + (p.techTier === 1 ? this.tune.research.tier2Ms : this.tune.research.tier3Ms),
      supportIds: supports.slice(0, cost).map(h => h.id) };
    for (const id of p.research.supportIds) { const h = this.byHex.get(id)!; h.lockedBy = `research-${playerId}`; h.commitment = 'research'; }
    return { ok: true };
  }

  cancelResearch(playerId: number): { ok: boolean; reason?: string } {
    const p = this.players.find(x => x.id === playerId);
    if (!p?.research) return { ok: false, reason: 'No research to cancel' };
    for (const h of this.hexes) if (h.lockedBy === `research-${playerId}`) { h.lockedBy = null; delete h.commitment; }
    p.research = null;
    return { ok: true };
  }

  canUpgrade(playerId: number, id: string): { ok: boolean; reason?: string } {
    const b = this.buildings.find(x => x.id === id), p = this.players.find(x => x.id === playerId);
    if (this.winner !== null || !p?.alive || !b || b.owner !== playerId || b.kind === 'hq' || b.hp <= 0) return { ok: false, reason: 'Select your living producer' };
    const card = this.tune.cards[b.kind], next = card.upgradeTo;
    if (!next) return { ok: false, reason: 'No further upgrade' };
    if ((b.completeAtMs ?? 0) > this.timeMs || b.upgradeKind) return { ok: false, reason: 'Construction or conversion still running' };
    if (p.techTier < this.tune.cards[next].tier) return { ok: false, reason: `Requires technology tier ${this.tune.cards[next].tier}` };
    const extra = Math.max(0, this.tune.cards[next].cost - card.cost), r = this.resources(playerId);
    if (extra > 0 && (r.committed + extra > r.capacity || this.openSupports(playerId).length < extra)) return { ok: false, reason: 'Upgrade needs additional open resources' };
    return { ok: true };
  }

  upgrade(playerId: number, id: string): { ok: boolean; reason?: string } {
    const check = this.canUpgrade(playerId, id); if (!check.ok) return check;
    const b = this.buildings.find(x => x.id === id)!, card = this.tune.cards[b.kind as CardKind], next = card.upgradeTo!;
    b.upgradeKind = next; b.upgradeStartedAtMs = this.timeMs; b.upgradeCompleteAtMs = this.timeMs + (card.upgradeMs ?? 0);
    b.upgradeCost = Math.max(0, this.tune.cards[next].cost - card.cost);
    for (const h of this.openSupports(playerId).slice(0, b.upgradeCost)) { h.lockedBy = b.id; h.commitment = 'upgrade'; }
    this.retireProducer(b);
    return { ok: true };
  }

  cancelUpgrade(playerId: number, id: string): { ok: boolean; reason?: string } {
    const b = this.buildings.find(x => x.id === id);
    if (this.winner !== null || !b || b.owner !== playerId || b.kind === 'hq' || !b.upgradeKind || (b.upgradeCompleteAtMs ?? 0) <= this.timeMs) return { ok: false, reason: 'No unfinished upgrade to cancel' };
    let released = 0;
    for (const h of this.hexes) if (h.lockedBy === b.id && h.commitment === 'upgrade') { h.lockedBy = null; delete h.commitment; released++; }
    this.addStranded(playerId, (b.upgradeCost ?? 0) - released);
    delete b.upgradeKind; delete b.upgradeStartedAtMs; delete b.upgradeCompleteAtMs; delete b.upgradeCost;
    b.readyAtMs = this.timeMs + this.tune.cards[b.kind].productionMs;
    b.cooldownActive = true; b.productionStartedAtMs = this.timeMs;
    return { ok: true };
  }

  sell(playerId: number, id: string): { ok: boolean; reason?: string } {
    const b = this.buildings.find(x => x.id === id);
    if (this.winner !== null || !b || b.owner !== playerId || b.kind === 'hq' || b.hp <= 0) return { ok: false, reason: 'Select your living non-HQ building' };
    this.retireProducer(b); this.releaseBuilding(b);
    this.buildings.splice(this.buildings.indexOf(b), 1);
    const p = this.players.find(p => p.id === playerId); if (p?.defendTargetId === id) p.defendTargetId = null;
    return { ok: true };
  }

  private addStranded(playerId: number, amount: number): void {
    this.strandedDebt.set(playerId, (this.strandedDebt.get(playerId) ?? 0) + Math.max(0, amount));
  }

  private releaseBuilding(b: Building, delayed = false): void {
    const supports = this.hexes.filter(h => h.lockedBy === b.id);
    if (b.kind !== 'hq') this.addStranded(b.owner, (b.committedCost ?? this.tune.cards[b.kind].cost) + (b.upgradeCost ?? 0) - supports.length);
    if (delayed && supports.length) {
      const release: PendingRelease = { id: `release-${b.id}`, owner: b.owner,
        releaseAtMs: this.timeMs + this.tune.resources.destroyReleaseMs, supportIds: supports.map(h => h.id) };
      this.pendingReleases.push(release);
      for (const h of supports) { h.lockedBy = release.id; h.commitment = 'release'; h.releaseAtMs = release.releaseAtMs; }
    } else for (const h of supports) { h.lockedBy = null; delete h.commitment; delete h.releaseAtMs; }
  }

  private loseAssignment(h: Hex): void {
    if (h.commitment === 'release') {
      const release = this.pendingReleases.find(r => r.id === h.lockedBy);
      if (release && release.supportIds.includes(h.id)) {
        release.supportIds.splice(release.supportIds.indexOf(h.id), 1); this.addStranded(release.owner, 1);
      }
    }
    h.lockedBy = null; delete h.commitment; delete h.releaseAtMs;
  }

  private retireProducer(b: Building): void {
    const u = this.units.find(x => x.id === b.unitId);
    if (u) {
      this.retirements.push({ id: ++this.retirementSerial, unitId: u.id, kind: u.kind, owner: u.owner,
        hexId: u.hexId, members: u.members ? [...u.members] : undefined, timeMs: this.timeMs });
      if (this.retirements.length > 128) this.retirements.splice(0, this.retirements.length - 128);
      u.hp = 0;
    }
    for (let i = this.reinforcements.length - 1; i >= 0; i--) if (this.reinforcements[i].buildingId === b.id) this.reinforcements.splice(i, 1);
    this.cleanDead(); b.unitId = null;
  }

  private advanceLifecycles(): void {
    for (let i = this.pendingReleases.length - 1; i >= 0; i--) {
      const release = this.pendingReleases[i];
      if (this.timeMs < release.releaseAtMs) continue;
      for (const id of release.supportIds) {
        const h = this.byHex.get(id)!;
        if (h.lockedBy === release.id) { h.lockedBy = null; delete h.commitment; delete h.releaseAtMs; }
      }
      this.pendingReleases.splice(i, 1);
    }
    for (const p of this.players) if (p.research && this.timeMs >= p.research.completeAtMs) {
      p.techTier = p.research.toTier; this.cancelResearch(p.id);
    }
    for (const b of this.buildings) if (b.upgradeKind && this.timeMs >= (b.upgradeCompleteAtMs ?? Infinity)) {
      const base = b.committedCost ?? this.tune.cards[b.kind as CardKind].cost;
      b.kind = b.upgradeKind; b.committedCost = base + (b.upgradeCost ?? 0);
      delete b.upgradeKind; delete b.upgradeStartedAtMs; delete b.upgradeCompleteAtMs; delete b.upgradeCost;
      b.readyAtMs = this.timeMs;
      b.cooldownActive = false; delete b.productionStartedAtMs;
    }
    for (let i = this.reinforcements.length - 1; i >= 0; i--) {
      const r = this.reinforcements[i], u = this.units.find(x => x.id === r.unitId && x.hp > 0);
      if (!u) { this.reinforcements.splice(i, 1); continue; }
      if (this.timeMs < r.arriveAtMs) continue;
      const card = this.tune.cards[u.kind];
      if (u.members) {
        const count = Math.min(r.count, (card.squadSize ?? 1) - u.members.length);
        u.members.push(...Array<number>(count).fill(card.unitHp)); u.hp = u.members.reduce((a, v) => a + v, 0);
      }
      this.reinforcements.splice(i, 1);
    }
  }

  setTarget(playerId: number, targetPlayerId: number): void {
    const p = this.players.find(x => x.id === playerId), target = this.players.find(x => x.id === targetPlayerId);
    if (this.winner === null && p?.alive && target?.alive) { p.targetId = targetPlayerId; p.defendTargetId = null; }
  }

  setDefendTarget(playerId: number, entityId: string): { ok: boolean; reason?: string } {
    const p = this.players.find(x => x.id === playerId), b = this.buildings.find(x => x.id === entityId && x.owner === playerId && x.hp > 0);
    if (this.winner !== null || !p?.alive || !b) return { ok: false, reason: 'Select a living friendly building' };
    p.targetId = playerId; p.defendTargetId = entityId; return { ok: true };
  }

  canLaunchNuke(playerId: number, buildingId: string): { ok: boolean; reason?: string } {
    const p = this.players.find(x => x.id === playerId), b = this.buildings.find(x => x.id === buildingId);
    if (this.winner !== null || !p?.alive || !b || b.owner !== playerId || b.hp <= 0 || b.kind === 'hq' || this.tune.cards[b.kind].utility !== 'silo') return { ok: false, reason: 'Select your living nuclear silo' };
    if ((b.completeAtMs ?? 0) > this.timeMs || b.nukeReadyAtMs === undefined || b.nukeReadyAtMs > this.timeMs) return { ok: false, reason: 'Nuclear payload is not ready' };
    return { ok: true };
  }

  launchNuke(playerId: number, buildingId: string, targetHexId: string): { ok: boolean; reason?: string } {
    const check = this.canLaunchNuke(playerId, buildingId); if (!check.ok) return check;
    if (!this.byHex.has(targetHexId)) return { ok: false, reason: 'Target is outside the map' };
    const b = this.buildings.find(x => x.id === buildingId)!;
    this.nukeFlights.push({ id: `nuke-${playerId}-${++this.nukeSerials[playerId]}`, owner: playerId, buildingId,
      fromHexId: b.hexId, targetHexId, launchedAtMs: this.timeMs, impactAtMs: this.timeMs + this.tune.nuclear.flightMs });
    b.nukeReadyAtMs = this.timeMs + this.tune.cards[b.kind as CardKind].productionMs; return { ok: true };
  }

  private homeHex(owner: number): Hex | undefined {
    const p = this.players.find(x => x.id === owner), chosen = this.buildings.find(b => b.id === p?.defendTargetId && b.owner === owner && b.hp > 0);
    const home = chosen ?? this.buildings.find(b => b.owner === owner && b.kind === 'hq');
    return home ? this.byHex.get(home.hexId) : undefined;
  }

  private triggerProduction(b: Building): void {
    if (b.kind === 'hq' || b.upgradeKind || b.cooldownActive || this.tune.cards[b.kind].utility) return;
    b.cooldownActive = true; b.productionStartedAtMs = this.timeMs; b.readyAtMs = this.timeMs + this.tune.cards[b.kind].productionMs;
  }

  targetDamageClass(target: Building | Unit): DamageClass {
    return 'buildingId' in target ? this.tune.cards[target.kind].damageClass : 'structure';
  }

  weaponDamage(card: CardKind | CardTune, target: Building | Unit): number {
    const weapon = typeof card === 'string' ? this.tune.cards[card] : card;
    return weapon.damage + (weapon.damageBonus?.[this.targetDamageClass(target)] ?? 0);
  }

  private applyDamage(target: Building | Unit, amount: number, splash: boolean): number {
    const before = target.hp;
    if ('buildingId' in target && target.members && target.hp > 0) {
      const count = target.members.length;
      if (splash) target.members = target.members.map(hp => hp - amount).filter(hp => hp > 0);
      else { if (target.members.length) target.members[0] -= amount; target.members = target.members.filter(hp => hp > 0); }
      target.hp = target.members.reduce((n, hp) => n + hp, 0);
      if (target.members.length < count) {
        const b = this.buildings.find(b => b.id === target.buildingId); if (b) this.triggerProduction(b);
      }
    } else if (!('buildingId' in target && target.members)) target.hp -= amount;
    return Math.max(0, before - target.hp);
  }

  private advanceNukes(): void {
    const due = this.nukeFlights.filter(f => f.impactAtMs <= this.timeMs && this.players.find(p => p.id === f.owner)?.alive);
    for (const flight of due) {
      const centre = this.byHex.get(flight.targetHexId)!;
      for (const target of [...this.units, ...this.buildings]) {
        const d = distance(centre, this.byHex.get(target.hexId)!);
        if (d <= this.tune.nuclear.radius) this.applyDamage(target, d === 0 ? this.tune.nuclear.centreDamage : this.tune.nuclear.outerDamage, true);
      }
      this.nuclearImpacts.push({ id: ++this.nuclearImpactSerial, owner: flight.owner, hexId: flight.targetHexId, timeMs: this.timeMs, radius: this.tune.nuclear.radius });
      if (this.nuclearImpacts.length > 128) this.nuclearImpacts.splice(0, this.nuclearImpacts.length - 128);
    }
    for (let i = this.nukeFlights.length - 1; i >= 0; i--) if (this.nukeFlights[i].impactAtMs <= this.timeMs) this.nukeFlights.splice(i, 1);
    this.cleanDead();
  }

  private recordShot(source: Unit | Building, target: Unit, kind: CardKind, sourceKind?: 'hq' | 'bunker'): void {
    this.shots.push({ id: ++this.shotSerial, unitId: source.id, owner: source.owner, kind,
      fromHexId: source.hexId, targetHexId: target.hexId, targetDomain: this.tune.cards[target.kind].domain,
      timeMs: this.timeMs, ...(sourceKind ? { sourceKind } : {}) });
    const cap = Math.max(0, Math.floor(this.tune.presentation.maxShotEvents));
    if (this.shots.length > cap) this.shots.splice(0, this.shots.length - cap);
  }

  tick(dtMs: number): void {
    if (!Number.isFinite(dtMs) || dtMs < 0) throw new Error('tick requires finite nonnegative milliseconds');
    this.accumulatorMs += dtMs;
    while (this.accumulatorMs >= this.tune.stepMs && this.winner === null) {
      this.accumulatorMs -= this.tune.stepMs;
      this.timeMs += this.tune.stepMs;
      this.step();
    }
  }

  private reservedFrom(u: Unit): string | undefined {
    return (u.movingUntilMs ?? 0) > this.timeMs ? u.fromHexId : undefined;
  }

  private occupied(): Set<string> {
    const blocked = new Set(this.buildings.map(b => b.hexId));
    for (const u of this.units) {
      blocked.add(u.hexId);
      const from = this.reservedFrom(u); if (from) blocked.add(from);
    }
    return blocked;
  }

  private spawn(b: Building): void {
    if (b.kind === 'hq' || b.upgradeKind || this.timeMs < (b.completeAtMs ?? 0) || this.timeMs < b.readyAtMs) return;
    const card = this.tune.cards[b.kind];
    if (card.utility) {
      b.readyAtMs = 0; b.cooldownActive = false; delete b.productionStartedAtMs;
      if (card.utility === 'silo' && b.nukeReadyAtMs === undefined) b.nukeReadyAtMs = (b.completeAtMs ?? this.timeMs) + card.productionMs;
      return;
    }
    if (b.unitId !== null) {
      const squad = this.units.find(u => u.id === b.unitId);
      if (!squad?.members || !card.squadSize || !b.cooldownActive) return;
      const incoming = this.reinforcements.filter(r => r.unitId === squad.id).reduce((n, r) => n + r.count, 0);
      const missing = card.squadSize - squad.members.length - incoming;
      if (missing > 0) {
        const travel = Math.max(this.tune.reinforcements.minTravelMs,
          distance(this.byHex.get(b.hexId)!, this.byHex.get(squad.hexId)!) * this.tune.reinforcements.msPerHex);
        this.reinforcements.push({ id: `r${++this.reinforcementSerial}`, unitId: squad.id, buildingId: b.id, owner: b.owner,
          count: missing, fromHexId: b.hexId, startedAtMs: this.timeMs, arriveAtMs: this.timeMs + travel });
        b.readyAtMs = 0; b.cooldownActive = false; delete b.productionStartedAtMs;
      }
      return;
    }
    const blocked = this.occupied();
    // The first free cell reached from the producer is the nearest reachable ring.
    // Occupants block traversal; never search through a complete encirclement.
    const queue = [b.hexId], seen = new Set(queue);
    let destination: string | undefined;
    for (let i = 0; i < queue.length && !destination; i++) {
      for (const n of this.neighbors(queue[i])) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        if (blocked.has(n.id)) continue;
        queue.push(n.id); destination = n.id; break;
      }
    }
    if (!destination) return;
    const size = card.squadSize ?? 1;
    const u: Unit = { id: `u${++this.serial}`, owner: b.owner, kind: b.kind, hexId: destination,
      hp: card.unitHp * size, maxHp: card.unitHp * size, attacking: false, buildingId: b.id, nextAttackAtMs: this.timeMs };
    if (card.squadSize) u.members = Array<number>(size).fill(card.unitHp);
    this.units.push(u); b.unitId = u.id; b.readyAtMs = 0; b.cooldownActive = false; delete b.productionStartedAtMs;
  }

  private step(): void {
    this.cleanDead();
    if (this.winner !== null) return;
    this.advanceLifecycles();
    this.advanceNukes();
    if (this.winner !== null) return;
    this.bot();
    for (const b of [...this.buildings]) this.spawn(b);
    const damage: { target: Building | Unit; amount: number; splash: boolean; source: Unit | Building }[] = [];
    const damageSources = new Map<Unit, (Unit | Building)[]>();
    for (const b of this.buildings) {
      const hq = b.kind === 'hq', card = hq ? null : this.tune.cards[b.kind as CardKind];
      if ((!hq && card?.utility !== 'bunker') || (b.completeAtMs ?? 0) > this.timeMs || this.timeMs < (b.defenseNextAtMs ?? 0)) continue;
      const range = hq ? this.tune.hq.defenseRange : card!.range, amount = hq ? this.tune.hq.defenseDamage : card!.damage;
      if (amount <= 0) continue;
      const centre = this.byHex.get(b.hexId)!;
      const target = this.units.filter(u => u.owner !== b.owner && u.hp > 0 &&
        (hq ? this.tune.cards[u.kind].domain === 'ground' : card!.targets.includes(this.tune.cards[u.kind].domain)) &&
        distance(centre, this.byHex.get(u.hexId)!) <= range).sort((a, z) => distance(centre, this.byHex.get(a.hexId)!) - distance(centre, this.byHex.get(z.hexId)!))[0];
      if (!target) continue;
      b.defenseNextAtMs = this.timeMs + (hq ? this.tune.hq.defenseAttackMs : card!.attackMs);
      damage.push({ target, amount, splash: false, source: b }); this.recordShot(b, target, hq ? 'infantry' : 'bunker', hq ? 'hq' : 'bunker');
    }
    // Decide all attacks first, so damage does not grant first-iteration survival.
    for (const u of this.units) {
      u.attacking = false;
      delete u.attackTargetHexId;
      if ((u.movingUntilMs ?? 0) > this.timeMs) continue;
      if ((u.retreatUntilMs ?? 0) > this.timeMs) continue;
      if (this.tune.cards[u.kind].capturePriority && this.shouldCapture(u)) continue;
      const target = this.attackTarget(u);
      if (!target) continue;
      u.attacking = true;
      u.attackTargetHexId = target.hexId;
      if (this.timeMs < u.nextAttackAtMs) continue;
      u.nextAttackAtMs = this.timeMs + this.tune.cards[u.kind].attackMs;
      const card = this.tune.cards[u.kind];
      for (let i = 0; i < (u.members?.length ?? 1); i++) {
        damage.push({ target, amount: this.weaponDamage(card, target), splash: (card.splashRadius ?? 0) > 0, source: u });
        if (card.splashRadius) for (const nearby of [...this.units, ...this.buildings]) {
          if (nearby === target || nearby.owner === u.owner || nearby.hp <= 0 || !this.canTarget(u, nearby)) continue;
          if (distance(this.byHex.get(nearby.hexId)!, this.byHex.get(target.hexId)!) <= card.splashRadius) {
            damage.push({ target: nearby, amount: this.weaponDamage(card, nearby) * (card.splashDamageFraction ?? 0), splash: true, source: u });
          }
        }
      }
      this.shots.push({ id: ++this.shotSerial, unitId: u.id, owner: u.owner, kind: u.kind,
        fromHexId: u.hexId, targetHexId: target.hexId,
        targetDomain: 'buildingId' in target ? this.tune.cards[target.kind].domain : 'ground', timeMs: this.timeMs });
      const cap = Math.max(0, Math.floor(this.tune.presentation.maxShotEvents));
      if (this.shots.length > cap) this.shots.splice(0, this.shots.length - cap);
    }
    // Capture before damage: being hit alone never cancels that step's progress.
    this.capture();
    for (const hit of damage) {
      const { target, amount, source, splash } = hit;
      if (this.applyDamage(target, amount, splash) > 0 && 'buildingId' in target) {
        const sources = damageSources.get(target) ?? []; sources.push(source); damageSources.set(target, sources);
      }
    }
    for (const [target, sources] of damageSources) if (target.kind === 'artillery') {
      const here = this.byHex.get(target.hexId)!;
      sources.sort((a, b) => distance(here, this.byHex.get(a.hexId)!) - distance(here, this.byHex.get(b.hexId)!));
      target.retreatFromHexId = sources[0].hexId;
      target.retreatUntilMs = this.timeMs + (this.tune.cards.artillery.retreatMs ?? 0);
    }
    this.cleanDead();
    if (this.winner !== null) return;
    const blocked = this.occupied();
    for (const u of this.units) {
      if ((u.movingUntilMs ?? 0) > this.timeMs) continue;
      const retreating = (u.retreatUntilMs ?? 0) > this.timeMs;
      if (u.attacking && !retreating) continue;
      // Hold non-owned land until capture finishes, including under unanswered fire.
      if (!retreating && this.shouldCapture(u)) continue;
      // Capture-first squads secure the hex, then hold to retaliate on the next
      // decision rather than immediately marching away on the capture-flip step.
      if (!retreating && this.tune.cards[u.kind].capturePriority && this.attackTarget(u)) continue;
      const next = retreating ? this.retreatMove(u, blocked) : this.nextMove(u, blocked);
      if (!next) continue;
      if (retreating) { u.attacking = false; delete u.attackTargetHexId; }
      const from = u.hexId;
      // Reserve destination and origin for the entire animation; no crossing/swap.
      blocked.add(next); blocked.add(from);
      u.hexId = next; u.fromHexId = from; u.movedAtMs = this.timeMs;
      // Sample the source once and latch arrival; later ownership/tune changes
      // cannot accelerate or slow an already-reserved movement segment.
      const speed = this.byHex.get(from)!.owner === u.owner ? this.tune.movement?.friendlySpeedMultiplier ?? 1 : 1;
      u.movingUntilMs = this.timeMs + this.tune.cards[u.kind].moveMs / speed;
    }
  }

  private visibleTargets(u: Unit): (Building | Unit)[] {
    const here = this.byHex.get(u.hexId)!, card = this.tune.cards[u.kind];
    const player = this.players.find(p => p.id === u.owner)!;
    const targets: (Building | Unit)[] = [...this.units, ...this.buildings].filter(t =>
      t.owner !== u.owner && t.hp > 0 && this.canTarget(u, t) &&
      distance(here, this.byHex.get(t.hexId)!) <= card.sightRange);
    // An attack order prioritizes the selected faction's structures. Defense
    // retains troop-first reactions instead of ignoring a nearby attacker.
    return targets.sort((a, b) => {
      const score = (t: Building | Unit) => {
        const isUnit = 'buildingId' in t;
        if (player.targetId === player.id) return isUnit && this.byHex.get(t.hexId)!.owner === u.owner ? 0 : isUnit ? 1 : 2;
        return !isUnit && t.owner === player.targetId ? 0 : isUnit ? 1 : 2;
      };
      return score(a) - score(b) || distance(here, this.byHex.get(a.hexId)!) - distance(here, this.byHex.get(b.hexId)!);
    });
  }

  private attackTarget(u: Unit): Building | Unit | undefined {
    const here = this.byHex.get(u.hexId)!, card = this.tune.cards[u.kind];
    return this.visibleTargets(u).find(t => {
      const d = distance(here, this.byHex.get(t.hexId)!);
      return d >= card.minRange && d <= card.range;
    });
  }

  private canTarget(u: Unit, target: Building | Unit): boolean {
    const domain = 'buildingId' in target ? this.tune.cards[target.kind].domain : 'ground';
    return this.tune.cards[u.kind].targets.includes(domain);
  }

  private retreatMove(u: Unit, blocked: Set<string>): string | undefined {
    const threat = this.byHex.get(u.retreatFromHexId ?? ''), here = this.byHex.get(u.hexId)!;
    if (!threat) return;
    return this.neighbors(u.hexId).filter(h => !blocked.has(h.id) && distance(h, threat) > distance(here, threat))
      .sort((a, b) => distance(b, threat) - distance(a, threat))[0]?.id;
  }

  private nextMove(u: Unit, blocked: Set<string>): string | undefined {
    const local = this.visibleTargets(u)[0];
    if (local) {
      const card = this.tune.cards[u.kind], target = this.byHex.get(local.hexId)!;
      const goals = new Set(this.hexes.filter(h => !blocked.has(h.id) &&
        distance(h, target) >= card.minRange && distance(h, target) <= card.range).map(h => h.id));
      return this.pathToGoals(u, blocked, goals);
    }
    if (this.tune.cards[u.kind].domain === 'air') return this.strategicMove(u, blocked);
    const player = this.players.find(p => p.id === u.owner)!;
    const here = this.byHex.get(u.hexId)!;
    const enemy = this.buildings.filter(b => b.kind === 'hq' && b.owner === player.targetId && b.owner !== u.owner);
    const enemyHq = enemy.find(b => b.kind === 'hq');
    const targetHex = enemyHq ? this.byHex.get(enemyHq.hexId)! : undefined;
    const range = this.tune.cards[u.kind].range;
    if (this.tune.cards[u.kind].captureRate <= 0) return this.strategicMove(u, blocked);
    const goals = new Set<string>();
    if (enemy.length) {
      // Search for free attack positions rather than pathing into a blocked HQ.
      for (const h of this.hexes) if (!blocked.has(h.id) && enemy.some(b => this.canTarget(u, b) &&
        distance(h, this.byHex.get(b.hexId)!) <= range && distance(h, this.byHex.get(b.hexId)!) >= this.tune.cards[u.kind].minRange)) goals.add(h.id);
    }
    const queue = [here.id], first = new Map<string, string>(), seen = new Set(queue);
    let expansion: string | undefined;
    const homeHex = this.homeHex(u.owner) ?? here;
    let expansionRank = [Infinity, Infinity];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i], h = this.byHex.get(id)!;
      if (i > 0 && goals.has(id)) return first.get(id);
      if (i > 0 && h.owner !== u.owner && !h.burnt) {
        const rank = [h.owner === null ? 0 : 1, distance(h, homeHex)];
        if (!enemy.length && (rank[0] < expansionRank[0] || rank[0] === expansionRank[0] && rank[1] < expansionRank[1])) {
          expansion = first.get(id); expansionRank = rank;
        } else if (enemy.length && !expansion) expansion = first.get(id);
      }
      const neighbors = this.neighbors(id);
      if (targetHex) neighbors.sort((a, b) => distance(a, targetHex) - distance(b, targetHex));
      for (const n of neighbors) {
        if (seen.has(n.id) || blocked.has(n.id)) continue;
        seen.add(n.id); first.set(n.id, first.get(id) ?? n.id); queue.push(n.id);
      }
    }
    return expansion;
  }

  private shouldCapture(u: Unit): boolean {
    const card = this.tune.cards[u.kind], h = this.byHex.get(u.hexId)!;
    if (card.domain !== 'ground' || card.captureRate <= 0 || h.owner === u.owner || h.burnt) return false;
    if (card.capturePriority) return true;
    return this.players.find(p => p.id === u.owner)!.targetId === u.owner && this.visibleTargets(u).length === 0;
  }

  private pathToGoals(u: Unit, blocked: Set<string>, goals: Set<string>): string | undefined {
    const queue = [u.hexId], seen = new Set(queue), first = new Map<string, string>();
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]; if (i > 0 && goals.has(id)) return first.get(id);
      for (const n of this.neighbors(id)) {
        if (seen.has(n.id) || blocked.has(n.id)) continue;
        seen.add(n.id); first.set(n.id, first.get(id) ?? n.id); queue.push(n.id);
      }
    }
  }

  private strategicMove(u: Unit, blocked: Set<string>): string | undefined {
    const player = this.players.find(p => p.id === u.owner)!, here = this.byHex.get(u.hexId)!;
    const defense = player.targetId === player.id;
    const card = this.tune.cards[u.kind];
    const goals = new Set<string>();
    const enemyHq = this.buildings.find(b => b.owner === player.targetId && b.kind === 'hq');
    const centre = defense ? this.homeHex(u.owner) : enemyHq ? this.byHex.get(enemyHq.hexId) : undefined;
    if (!centre) return;
    // A selected HQ is a strategic destination even unseen; aircraft without a
    // ground weapon approach it but cannot shoot it. Idle defense holds home.
    const holdRange = defense ? 1 : card.range;
    const minRange = defense || !card.targets.includes('ground') ? 1 : card.minRange;
    if (distance(here, centre) >= minRange && distance(here, centre) <= holdRange) return;
    for (const h of this.hexes) if (!blocked.has(h.id) && distance(h, centre) >= minRange && distance(h, centre) <= holdRange) goals.add(h.id);
    return this.pathToGoals(u, blocked, goals);
  }

  private capture(): void {
    const pressure = new Map<string, { owner: number; rate: number; unitId?: string }>();
    for (const u of this.units) if (this.shouldCapture(u) && !u.attacking && (u.movingUntilMs ?? 0) <= this.timeMs) {
      if (!this.byHex.get(u.hexId)!.burnt) pressure.set(u.hexId, { owner: u.owner, rate: this.tune.cards[u.kind].captureRate, unitId: u.id });
    }
    for (const b of this.buildings) if (b.kind === 'hq') {
      const centre = this.byHex.get(b.hexId)!;
      for (const h of this.hexes) {
        const d = distance(h, centre);
        if (d === 0 || d > this.tune.hq.captureRings || this.units.some(u => u.owner !== b.owner &&
          (u.hexId === h.id || this.reservedFrom(u) === h.id)) || this.buildings.some(x => x.owner !== b.owner && x.hexId === h.id)) continue;
        if (!pressure.has(h.id)) pressure.set(h.id, { owner: b.owner, rate: this.tune.capture.hqRate });
      }
    }
    for (const [id, p] of pressure) {
      const h = this.byHex.get(id)!;
      if (h.owner === p.owner || p.rate <= 0) continue;
      if (h.capturePlayer !== p.owner) { h.capture = 0; h.capturePlayer = p.owner; }
      h.captureUnitId = p.unitId; delete h.captureReversing;
      const duration = this.tune.capture.neutralMs * (h.owner === null ? 1 : this.tune.capture.ownedMultiplier);
      h.capture += this.tune.stepMs * p.rate / duration;
      if (h.capture + Number.EPSILON >= 1) {
        h.owner = p.owner; this.loseAssignment(h); h.capture = 0; h.capturePlayer = null;
        delete h.captureUnitId; delete h.captureReversing;
      }
    }
    for (const h of this.hexes) if (h.captureReversing && h.capture > 0) {
      const duration = this.tune.capture.neutralMs * (h.owner === null ? 1 : this.tune.capture.ownedMultiplier);
      h.capture = Math.max(0, h.capture - this.tune.stepMs * this.tune.capture.rollbackRate / duration);
      if (h.capture < Number.EPSILON) { h.capture = 0; h.capturePlayer = null; delete h.captureUnitId; delete h.captureReversing; }
    }
  }

  private cleanDead(): void {
    const eliminated = new Set(this.buildings.filter(b => b.kind === 'hq' && b.hp <= 0).map(b => b.owner));
    for (const p of this.players) if (eliminated.has(p.id)) p.alive = false;
    for (const p of this.players) if (eliminated.has(p.id)) this.cancelResearch(p.id);
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];
      if (b.hp > 0 && !eliminated.has(b.owner)) continue;
      if (b.hp <= 0 && b.kind !== 'hq' && !eliminated.has(b.owner)) this.byHex.get(b.hexId)!.burnt = true;
      this.releaseBuilding(b, b.kind !== 'hq' && b.hp <= 0 && !eliminated.has(b.owner));
      for (const u of this.units) if (u.buildingId === b.id) u.buildingId = null;
      this.buildings.splice(i, 1);
    }
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.hp > 0 && !eliminated.has(u.owner)) continue;
      // Casualty triggers reversal; attacking, retreating or mere absence does not.
      for (const h of this.hexes) if (h.captureUnitId === u.id && h.capture > 0) h.captureReversing = true;
      const b = this.buildings.find(x => x.id === u.buildingId);
      if (b) { b.unitId = null; this.triggerProduction(b); }
      for (let j = this.reinforcements.length - 1; j >= 0; j--) if (this.reinforcements[j].unitId === u.id) this.reinforcements.splice(j, 1);
      this.units.splice(i, 1);
    }
    for (const h of this.hexes) if (h.owner !== null && eliminated.has(h.owner)) {
      h.owner = null; h.lockedBy = null; delete h.commitment; delete h.releaseAtMs; h.capture = 0; h.capturePlayer = null;
      delete h.captureUnitId; delete h.captureReversing;
    }
    for (const id of eliminated) this.strandedDebt.delete(id);
    for (let i = this.nukeFlights.length - 1; i >= 0; i--) if (eliminated.has(this.nukeFlights[i].owner)) this.nukeFlights.splice(i, 1);
    for (const p of this.players) if (p.defendTargetId && !this.buildings.some(b => b.id === p.defendTargetId && b.owner === p.id && b.hp > 0)) p.defendTargetId = null;
    for (let i = this.pendingReleases.length - 1; i >= 0; i--) if (eliminated.has(this.pendingReleases[i].owner)) {
      const r = this.pendingReleases[i];
      for (const h of this.hexes) if (h.lockedBy === r.id) { h.lockedBy = null; delete h.commitment; delete h.releaseAtMs; }
      this.pendingReleases.splice(i, 1);
    }
    if (eliminated.size) {
      const survivors = this.players.filter(p => p.alive);
      this.winner = survivors.length === 1 ? survivors[0].id : survivors.length === 0 ? -1 : null;
    }
  }

  private bot(): void {
    const p = this.players[1];
    if (!this.botEnabled || !p.alive) return;
    if (this.timeMs >= this.tune.bot.attackAtMs) p.targetId = 0;
    if (this.timeMs < this.nextBotBuildMs) return;
    this.nextBotBuildMs = this.timeMs + this.tune.bot.buildEveryMs;
    if (!p.research && this.buildings.filter(b => b.owner === p.id && b.kind !== 'hq').length >= 2) this.startResearch(p.id);
    // Check conversions independently of the build cycle; locked tiers never stall it.
    const convertible = this.buildings.find(b => b.owner === p.id && this.canUpgrade(p.id, b.id).ok);
    if (convertible) this.upgrade(p.id, convertible.id);
    const cycle = this.tune.bot.cardCycle;
    let kind: CardKind | undefined;
    for (let i = 0; i < cycle.length; i++) {
      const candidate = cycle[this.botCard++ % cycle.length];
      if (BASE_CARDS.includes(candidate) && this.loadouts[p.id].includes(candidate) && this.tune.cards[candidate].tier <= p.techTier) { kind = candidate; break; }
    }
    const hq = this.buildings.find(b => b.owner === p.id && b.kind === 'hq');
    if (!hq || !kind) return;
    const centre = this.byHex.get(hq.hexId)!;
    const candidates = this.hexes.filter(h => h.owner === p.id).sort((a, b) => distance(a, centre) - distance(b, centre));
    for (const h of candidates) if (this.place(p.id, h.id, kind).ok) break;
  }
}
