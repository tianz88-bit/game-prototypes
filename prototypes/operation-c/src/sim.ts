import tuneJson from '../tune.json';
import type { Building, CardKind, Hex, Placement, Player, Shot, Tune, Unit } from './model';
export type { Building, CardKind, Hex, Placement, Player, Shot, Tune, Unit } from './model';

export const DEFAULT_TUNE: Tune = tuneJson as Tune;
// Axial direction order is also the deterministic BFS tie-break.
const DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const;
export const hexId = (q: number, r: number): string => `${q},${r}`;
export const distance = (a: Pick<Hex, 'q' | 'r'>, b: Pick<Hex, 'q' | 'r'>): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

/** Renderer-independent deterministic rules. Public DTOs are mutable for dev fixtures;
 * the game should issue place/setTarget commands rather than mutate them directly.
 * Provisional slice rules: no terrain obstacles; all ground types capture; no LOS test;
 * HQ pressure can retake unoccupied enemy land; eliminated buildings disappear unburnt.
 */
export class OperationSim {
  readonly tune: Tune;
  readonly hexes: Hex[] = [];
  readonly buildings: Building[] = [];
  readonly units: Unit[] = [];
  readonly shots: Shot[] = [];
  readonly players: Player[] = [
    { id: 0, name: 'You', alive: true, targetId: 0 },
    { id: 1, name: 'Rival', alive: true, targetId: 1 },
  ];
  timeMs = 0;
  winner: number | null = null;
  private accumulatorMs = 0;
  private serial = 0;
  private shotSerial = 0;
  private readonly byHex = new Map<string, Hex>();
  private readonly botEnabled: boolean;
  private nextBotBuildMs: number;
  private botCard = 0;

  constructor(options: { tune?: Tune; bot?: boolean } = {}) {
    this.tune = structuredClone(options.tune ?? DEFAULT_TUNE);
    if (!Number.isFinite(this.tune.stepMs) || this.tune.stepMs <= 0) throw new Error('stepMs must be positive');
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

  resources(playerId: number): { committed: number; capacity: number } {
    const hqs = new Set(this.buildings.filter(b => b.kind === 'hq').map(b => b.hexId));
    const capacity = this.hexes.filter(h => h.owner === playerId && !h.burnt && !hqs.has(h.id)).length;
    const committed = this.buildings.reduce((sum, b) => sum + (b.owner === playerId && b.kind !== 'hq' ? this.tune.cards[b.kind].cost : 0), 0);
    return { committed, capacity: Math.min(capacity, this.tune.resources.capacityCap) };
  }

  placement(playerId: number, id: string, kind: CardKind): Placement {
    const fail = (reason: string): Placement => ({ ok: false, reason, hexes: [] });
    if (this.winner !== null) return fail('Match ended');
    if (!this.players.find(p => p.id === playerId)?.alive) return fail('Player eliminated');
    const card = this.tune.cards[kind];
    if (!card) return fail('Unknown building');
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
      hp: card.buildingHp, maxHp: card.buildingHp, readyAtMs: this.timeMs, unitId: null };
    this.buildings.push(building);
    for (const support of result.hexes) this.byHex.get(support)!.lockedBy = building.id;
    this.spawn(building);
    return { ok: true };
  }

  setTarget(playerId: number, targetPlayerId: number): void {
    const p = this.players.find(x => x.id === playerId), target = this.players.find(x => x.id === targetPlayerId);
    if (this.winner === null && p?.alive && target?.alive) p.targetId = targetPlayerId;
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
    if (b.kind === 'hq' || b.unitId !== null || this.timeMs < b.readyAtMs) return;
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
    const card = this.tune.cards[b.kind];
    const u: Unit = { id: `u${++this.serial}`, owner: b.owner, kind: b.kind, hexId: destination,
      hp: card.unitHp, maxHp: card.unitHp, attacking: false, buildingId: b.id, nextAttackAtMs: this.timeMs };
    this.units.push(u); b.unitId = u.id; b.readyAtMs = this.timeMs + card.productionMs;
  }

  private step(): void {
    this.cleanDead();
    if (this.winner !== null) return;
    this.bot();
    for (const b of [...this.buildings]) this.spawn(b);
    const damage = new Map<Building | Unit, number>();
    // Decide all attacks first, so damage does not grant first-iteration survival.
    for (const u of this.units) {
      u.attacking = false;
      delete u.attackTargetHexId;
      if ((u.movingUntilMs ?? 0) > this.timeMs) continue;
      const target = this.attackTarget(u);
      if (!target) continue;
      u.attacking = true;
      u.attackTargetHexId = target.hexId;
      if (this.timeMs < u.nextAttackAtMs) continue;
      u.nextAttackAtMs = this.timeMs + this.tune.cards[u.kind].attackMs;
      damage.set(target, (damage.get(target) ?? 0) + this.tune.cards[u.kind].damage);
      this.shots.push({ id: ++this.shotSerial, unitId: u.id, owner: u.owner, kind: u.kind,
        fromHexId: u.hexId, targetHexId: target.hexId, timeMs: this.timeMs });
      const cap = Math.max(0, Math.floor(this.tune.presentation.maxShotEvents));
      if (this.shots.length > cap) this.shots.splice(0, this.shots.length - cap);
    }
    // Capture before damage: being hit alone never cancels that step's progress.
    this.capture();
    for (const [target, amount] of damage) target.hp -= amount;
    this.cleanDead();
    if (this.winner !== null) return;
    const blocked = this.occupied();
    for (const u of this.units) {
      if (u.attacking || (u.movingUntilMs ?? 0) > this.timeMs) continue;
      // Hold non-owned land until capture finishes, including under unanswered fire.
      if (this.byHex.get(u.hexId)!.owner !== u.owner) continue;
      const next = this.nextMove(u, blocked);
      if (!next) continue;
      const from = u.hexId;
      // Reserve destination and origin for the entire animation; no crossing/swap.
      blocked.add(next); blocked.add(from);
      u.hexId = next; u.fromHexId = from; u.movedAtMs = this.timeMs;
      u.movingUntilMs = this.timeMs + this.tune.cards[u.kind].moveMs;
    }
  }

  private attackTarget(u: Unit): Building | Unit | undefined {
    const here = this.byHex.get(u.hexId)!, range = this.tune.cards[u.kind].range;
    const player = this.players.find(p => p.id === u.owner)!;
    const targets: (Building | Unit)[] = [...this.units, ...this.buildings].filter(t =>
      t.owner !== u.owner && t.hp > 0 && distance(here, this.byHex.get(t.hexId)!) <= range);
    // An attack order prioritizes the selected faction's structures. Defense
    // retains troop-first reactions instead of ignoring a nearby attacker.
    return targets.sort((a, b) => {
      const score = (t: Building | Unit) => {
        const isUnit = 'buildingId' in t;
        if (player.targetId === player.id) return isUnit ? 0 : 1;
        return !isUnit && t.owner === player.targetId ? 0 : isUnit ? 1 : 2;
      };
      return score(a) - score(b) || distance(here, this.byHex.get(a.hexId)!) - distance(here, this.byHex.get(b.hexId)!);
    })[0];
  }

  private nextMove(u: Unit, blocked: Set<string>): string | undefined {
    const player = this.players.find(p => p.id === u.owner)!;
    const here = this.byHex.get(u.hexId)!;
    const enemy = this.buildings.filter(b => b.owner === player.targetId && b.owner !== u.owner);
    const enemyHq = enemy.find(b => b.kind === 'hq');
    const targetHex = enemyHq ? this.byHex.get(enemyHq.hexId)! : undefined;
    const range = this.tune.cards[u.kind].range;
    const goals = new Set<string>();
    if (enemy.length) {
      // Search for free attack positions rather than pathing into a blocked HQ.
      for (const h of this.hexes) if (!blocked.has(h.id) && enemy.some(b => distance(h, this.byHex.get(b.hexId)!) <= range)) goals.add(h.id);
    }
    const queue = [here.id], first = new Map<string, string>(), seen = new Set(queue);
    let expansion: string | undefined;
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i], h = this.byHex.get(id)!;
      if (i > 0 && goals.has(id)) return first.get(id);
      if (i > 0 && h.owner !== u.owner && !expansion) expansion = first.get(id);
      const neighbors = this.neighbors(id);
      if (targetHex) neighbors.sort((a, b) => distance(a, targetHex) - distance(b, targetHex));
      for (const n of neighbors) {
        if (seen.has(n.id) || blocked.has(n.id)) continue;
        seen.add(n.id); first.set(n.id, first.get(id) ?? n.id); queue.push(n.id);
      }
      // Defense mode searches only as far as its first expansion tile.
      if (!enemy.length && expansion) return expansion;
    }
    return expansion;
  }

  private capture(): void {
    const pressure = new Map<string, { owner: number; rate: number }>();
    for (const u of this.units) if (!u.attacking && (u.movingUntilMs ?? 0) <= this.timeMs) {
      pressure.set(u.hexId, { owner: u.owner, rate: this.tune.cards[u.kind].captureRate });
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
      const duration = this.tune.capture.neutralMs * (h.owner === null ? 1 : this.tune.capture.ownedMultiplier);
      h.capture += this.tune.stepMs * p.rate / duration;
      if (h.capture + Number.EPSILON >= 1) {
        h.owner = p.owner; h.lockedBy = null; h.capture = 0; h.capturePlayer = null;
      }
    }
  }

  private cleanDead(): void {
    const eliminated = new Set(this.buildings.filter(b => b.kind === 'hq' && b.hp <= 0).map(b => b.owner));
    for (const p of this.players) if (eliminated.has(p.id)) p.alive = false;
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];
      if (b.hp > 0 && !eliminated.has(b.owner)) continue;
      if (b.hp <= 0 && b.kind !== 'hq' && !eliminated.has(b.owner)) this.byHex.get(b.hexId)!.burnt = true;
      for (const h of this.hexes) if (h.lockedBy === b.id) h.lockedBy = null;
      for (const u of this.units) if (u.buildingId === b.id) u.buildingId = null;
      this.buildings.splice(i, 1);
    }
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.hp > 0 && !eliminated.has(u.owner)) continue;
      const b = this.buildings.find(x => x.id === u.buildingId);
      if (b) b.unitId = null;
      this.units.splice(i, 1);
    }
    for (const h of this.hexes) if (h.owner !== null && eliminated.has(h.owner)) {
      h.owner = null; h.lockedBy = null; h.capture = 0; h.capturePlayer = null;
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
    const kind = this.tune.bot.cardCycle[this.botCard % this.tune.bot.cardCycle.length];
    const hq = this.buildings.find(b => b.owner === p.id && b.kind === 'hq');
    if (!hq || !kind) return;
    const centre = this.byHex.get(hq.hexId)!;
    const candidates = this.hexes.filter(h => h.owner === p.id).sort((a, b) => distance(a, centre) - distance(b, centre));
    for (const h of candidates) if (this.place(p.id, h.id, kind).ok) { this.botCard++; break; }
  }
}
