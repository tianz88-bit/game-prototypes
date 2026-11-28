import {pickupHasRoom} from './pickups';
import type {PickupKind} from './pickups';
// Everything that happens on a planet besides moving ships: bullets, asteroids, damage and deaths.
// Pure game rules with no networking, so it runs in the Cloudflare room and in Node tests alike.
// The room steps each ship with its input, then calls step() once per tick and sends out the events.
import type { Tune } from './tune';
import { walletCap, damageScale, primaryDamageScale, maxShield, mineralBalance, hullCapacity, shieldRegen, shipVelocity, muzzleShot, newShip, shipRadius, stepShip } from './ship';
import type { AssistTarget, ShipInput, ShipState } from './ship';
import { asteroidMass, asteroidPos, splitAsteroid } from './asteroids';
import type { Asteroid } from './asteroids';
import { wrap, wrapDelta, angleDelta } from './wrap';
import { TURRET_SIDE, turretCount, turretPosition } from './turrets';
import { SHOP_ITEMS, buy, EVOLVE_ITEM, evolve } from './shop';
import { applyCard, drawCards, pendingPicks } from './levels';
import {MISSILE_CRUISER,isCapital,upgradeTotal} from './chassis';
import { missileLock,missileStructureLock } from './ordnance';
import { BASE_OWNER, BASE_TURRET_SIDE, baseLayout, insideDome, isDocked, speedFloor, freeHomeWarp } from './clanBase';
import type { BaseLayout } from './clanBase';
import { isWarPlanet } from './planets';

interface Bullet {
  owner: number;
  /** Damage, fixed when fired from the shooter's power at that moment. */
  damage: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface ShotEvent {
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  side: number;
}

/**
 * Something lying on the planet to fly into: a health boost (heals), or wallet minerals
 * (dropped by asteroids and spilled by damaged or destroyed ships).
 */
export interface Pickup {
  id: number;
  x: number;
  y: number;
  /** heal: repairs; mineral: power (hull); salvage: gold dropped by a destroyed ship (salvage only). */
  kind: PickupKind;
  /** Mined cargo is separate from death salvage; bots do not take this bankable reward. */
  mined?:boolean;
  value: number;
}

/** The moving hot zone (BRIEF.md): asteroid minerals mined inside it pay hotZone.mineralMultiplier. */
export interface HotZone {
  x: number;
  y: number;
  r: number;
  /** Tick when it moves on. */
  until: number;
}

/** A homing missile or a mine, owned by a ship. Shootable (hp); ships only are its targets. */
export interface Ordnance {
  heavy?:boolean;
  id: number;
  kind: 'missile' | 'mine';
  owner: number;
  x: number;
  y: number;
  heading: number;
  returnHeading?: number;
  speed: number;
  hp: number;
  /** Steps left before it fizzles out. */
  life: number;
  /** Tick it arms (mines). */
  armAt: number;
  /** Locked ship (missiles), 0 for none. */
  target: number;
  damage: number;
  /** Blast radius (mines). */
  blast: number;
  /** Turn rate, radians a second (missiles). */
  turn: number;
}

export interface DeathEvent {
  id: number;
  x: number;
  y: number;
  /** The ship whose bullet did it, or 0 (an asteroid). */
  killer: number;
}

/**
 * Siege v0 (owner, 16 November 2026), on the Warzone planet. Attackers (the other clan) destroy the
 * base turrets, break the shield and destroy the treasury, in any order the rules allow: bullets stop
 * at the shield while it holds, and each live turret regenerates it (siege.shieldRegenPerTurret a
 * second); once fully depleted it stays down for the round. The treasury never recovers. Each attacker
 * death costs a ticket. Defenders win at 0 tickets or when the round timer runs out.
 */
export interface SiegeState {
  phase: 'peace' | 'war' | 'over';
  turretHp: number[];
  shield: number;
  /** The shield was fully depleted this round: it no longer regenerates. */
  shieldBroken: boolean;
  treasury: number;
  tickets: number;
  /** Tick the round timer runs out. */
  endsAt: number;
  /** Winning clan once over (0 before). */
  winner: number;
  reason: '' | 'treasury' | 'tickets' | 'time';
}

export interface WorldEvents {
  /** New asteroids and asteroids whose hp changed. */
  asteroids: Asteroid[];
  /** Asteroids that no longer exist, with where they were. */
  gone: { id: number; x: number; y: number }[];
  shots: ShotEvent[];
  /** Ships destroyed this tick. */
  deaths: DeathEvent[];
  /** Hits on ships: where the hit landed, and whether the shield took it (for the shield effect). */
  /** by: the attacker (0 = none), so a client knows which ships it has hit (target health bar). */
  hits: { id: number; x: number; y: number; shielded: boolean; hull: boolean; broke?: boolean; by: number }[];
  /** Health boosts dropped, and boosts taken (by = ship id) or expired (by = 0). */
  pickups: Pickup[];
  pickupsGone: { id: number; by: number }[];
  pickupsMoved: {id:number;x:number;y:number;value:number}[];
  /** Dash rams: who rammed whom, and where they met. */
  rams: { id: number; target: number; x: number; y: number }[];
  /** Missile and mine explosions (r = blast radius), and ordnance shot down (shot: true). */
  blasts: { x: number; y: number; r: number; kind: 'missile' | 'mine'; shot: boolean }[];
  /** Ships that completed their warp run this tick (extracted). The room removes them. */
  extracted: { id: number; x: number; y: number }[];
  /** Set when the hot zone moved this tick. */
  hotZone: HotZone | null;
  /** Clan home planets: fuel unloaded by docked members into the clan treasury. */
  deposits: { id: number; amount: number }[];
  /** Siege: a round ended this tick. */
  siegeOver: { winner: number; reason: 'treasury' | 'tickets' | 'time' } | null;
  /** Siege: structures hit (turret index, or 'shield' / 'treasury'), for effects. */
  structureHits: { what: number | 'shield' | 'treasury'; x: number; y: number; destroyed: boolean }[];
}

const noEvents = (): WorldEvents => ({ asteroids: [], gone: [], shots: [], deaths: [], hits: [], pickups: [], pickupsGone: [], pickupsMoved: [], rams: [], blasts: [], extracted: [], hotZone: null, deposits: [], siegeOver: null, structureHits: [] });

export class World {
  tick = 0;
  readonly ships = new Map<number, ShipState>();
  readonly asteroids = new Map<number, Asteroid>();
  private bullets: Bullet[] = [];
  /** Steps of contact immunity left per ship. */
  private grace = new Map<number, number>();
  private nextAsteroidId = 1;
  /** from: the ship that spilled it, which cannot take it back until lockedUntil (a tick). */
  readonly pickups = new Map<number, Pickup & { expires: number; from: number; lockedUntil: number }>();
  /** Ships that are bots: they never earn salvage and drop less (salvage.botDropFactor). Set by the room. */
  readonly botIds = new Set<number>();
  /** Tutorial practice ships whose turret drones never fire (a drone or chaser that must not shoot). */
  readonly quiet = new Set<number>();
  /** Tick each ship dropped in, for fresh-spawn kill payout tracking. */
  private spawnedAt = new Map<number, number>();
  /** Seconds since ship id spawned on this planet (its run time, for the haul bonus). */
  runSeconds(id: number): number {
    const at = this.spawnedAt.get(id);
    return at === undefined ? 0 : (this.tick - at) / this.tune.net.tickHz;
  }
  /**
   * Share of the kill payout (power gold) a kill earns: the room lowers it for repeat kills of the
   * same pilot by the same killer. Default: full.
   */
  payoutFactor: (victim: number, killer: number) => number = () => 1;
  hotZone: HotZone = { x: 0, y: 0, r: 0, until: 0 };
  private nextPickupId = 1;
  /** Turret aim (radians, world) and steps until each can fire again, per ship. */
  private turrets = new Map<number, { angle: number[]; cd: number[]; left:number[]; lock:string[] }>();
  readonly ordnance = new Map<number, Ordnance>();
  private nextOrdnanceId = 1;
  /** Where each ship was before its last step, so fast (dashing) ships collide along their path. */
  private prev = new Map<number, { x: number; y: number }>();
  /** Ships whose current dash has already rammed someone. */
  private rammed = new Set<number>();
  /** Ship bumps: tick until which a pair ("lowId:highId") cannot bump again. */
  private bumpUntil = new Map<string, number>();
  /** Tick of the last damage each ship took, for shield regeneration. */
  private lastHit = new Map<number, number>();
  /**
   * Warzone allies (owner, 21 November 2026): two ships on the same side of a Warzone never hurt each
   * other. Bullets and missiles pass through allies, mines ignore them, and rams and bumps do no damage.
   */
  allies(a: number, b: number): boolean {
    if (!this.siege || !a || !b || a === b) return false;
    const ca = this.clanOf.get(a) ?? 0;
    return ca > 0 && ca === (this.clanOf.get(b) ?? 0);
  }

  /** Whether ship id took a hit in the last seconds (for the disconnect rules). */
  hitWithin(id: number, seconds: number): boolean {
    const at = this.lastHit.get(id);
    return at !== undefined && this.tick - at <= seconds * this.tune.net.tickHz;
  }
  /** Shield break grace (owner, 14 November 2026): hull safe until this tick after the shield breaks. */
  private graceUntil = new Map<number, number>();
  /** The shield can save its ship (absorb the breaking hit, then grace) once per recharge cycle. */
  private graceSpent = new Set<number>();
  private events: WorldEvents = noEvents();
  private readonly dt: number;
  /** Test servers only (TEST_SHIP_HP): ships take no damage, so a browser check can fly freely. */
  invulnerable = false;
  /** Clan home planet layout (sim/clanBase.ts), or null on open planets. */
  layout: BaseLayout | null = null;
  /** Each ship's clan (0: none). Set by the room on joining. */
  readonly clanOf = new Map<number, number>();
  private baseAim: number[] = [];
  private baseCd: number[] = [];
  private baseBurst:number[]=[];
  /** Siege state on the Warzone planet (null elsewhere). */
  siege: SiegeState | null = null;

  /** At war right now (siege rules apply). */
  get atWar(): boolean {
    return this.siege?.phase === 'war';
  }

  /** The attacking clan on a war planet (the other demo clan). */
  get attackerClan(): number {
    return this.layout ? (this.layout.clan === 1 ? 2 : 1) : 0;
  }

  /** Start a siege round: full turrets, shield and treasury, fresh tickets and timer. */
  startWar(): void {
    const s = this.siege;
    if (!s || !this.layout) return;
    const g = this.tune.siege;
    this.baseCd.fill(0);this.baseBurst.fill(0);
    Object.assign(s, { phase: 'war', turretHp: this.layout.turrets.map(() => g.turretHp), shield: g.shieldHp, shieldBroken: false, treasury: g.treasuryHp, tickets: g.attackerTickets, endsAt: this.tick + Math.round(g.roundSeconds * this.tune.net.tickHz), winner: 0, reason: '' });
  }

  /** Back to peace (lockdown released): structures full again, nothing at stake. */
  endPeace(): void {
    if (!this.siege) return;
    this.startWar();
    this.siege.phase = 'peace';
  }

  private finishWar(winner: number, reason: 'treasury' | 'tickets' | 'time'): void {
    const s = this.siege;
    if (!s || s.phase !== 'war') return;
    s.phase = 'over';
    s.winner = winner;
    s.reason = reason;
    this.events.siegeOver = { winner, reason };
  }

  /** Make this world a clan home planet (or not), from the planet id. */
  setPlanet(planet: string): void {
    this.tutorial=planet==='tutorial';this.tutorialMinerals=!this.tutorial;
    if (this.tutorial) this.asteroids.clear();
    this.layout = baseLayout(planet, this.tune);
    this.baseAim = (this.layout?.turrets ?? []).map(() => -Math.PI / 2);
    this.baseCd = (this.layout?.turrets ?? []).map(() => 0);
    this.baseBurst=this.baseCd.map(()=>0);
    this.siege = this.layout && isWarPlanet(planet) ? { phase: 'peace', turretHp: [], shield: 0, shieldBroken: false, treasury: 0, tickets: 0, endsAt: 0, winner: 0, reason: '' } : null;
    this.endPeace();
  }
  private tutorial=false;
  private tutorialMinerals=true;
  private tutorialRock: { id: number; reward: number } | null = null;

  setTutorialRock(x: number, y: number, reward: number): number {
    if (!this.tutorial) return 0;
    this.clearTutorialRock();
    const id = this.spawnAsteroid(2, x, y);
    this.tutorialRock = { id, reward };
    return id;
  }

  clearTutorialRock(): void {
    const id = this.tutorialRock?.id;
    this.tutorialRock = null;
    if (id === undefined) return;
    const rock = this.asteroids.get(id);
    if (!rock) return;
    this.asteroids.delete(id);
    this.events.gone.push({ id, x: rock.x, y: rock.y });
  }
  setTutorialMinerals(enabled:boolean):void {
    if(!this.tutorial)return;this.tutorialMinerals=enabled;
    if(!enabled)for(const [id,p] of this.pickups)if(p.kind==='mineral'){
      this.pickups.delete(id);this.events.pickupsGone.push({id,by:0});
    }
  }
  clearTutorialShots():void {if(this.tutorial)this.bullets.length=0;}

  /** A ship dropping in at a given point (clan home planets: members by the pads, others at the gate). */
  addShipNear(id: number, x: number, y: number, spread: number): ShipState {
    const a = this.rng() * Math.PI * 2;
    const d = this.rng() * spread;
    return this.placeNewShip(id, { x: wrap(x + Math.cos(a) * d, this.tune.world.width), y: wrap(y + Math.sin(a) * d, this.tune.world.height) });
  }

  /** Docked on a pad of its own clan's home planet (safe, repairing, unloading). */
  docked(id: number): boolean {
    const s = this.ships.get(id);
    // At war the pads are only spawn points (owner): no safety, no repair.
    return !!s && !this.atWar && isDocked(this.layout, this.clanOf.get(id) ?? 0, s, this.tune);
  }

  constructor(
    private readonly tune: Tune,
    private readonly rng: () => number = Math.random,
  ) {
    this.dt = 1 / tune.net.tickHz;
    this.populate();
  }

  /**
   * spread: anywhere on the planet, as far as possible from every other ship (bots, owner request:
   * they must not arrive on top of a player). Otherwise the drop zone near the map centre.
   */
  addShip(id: number, spread = false): ShipState {
    const t = this.tune;
    // Occupied open planets need the same ship/rock clearance as bot arrivals, including retries.
    if (spread || this.ships.size > 0) return this.placeNewShip(id, this.spreadPoint());
    // Players drop in near the map centre for now; real spawn points come with loot.
    // Pick the candidate point farthest from any asteroid, so nobody arrives beside a rock.
    let best = { x: t.world.width / 2, y: t.world.height / 2, clear: -1 };
    for (let i = 0; i < 12; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = this.rng() * t.net.interestRadius * 0.3;
      const x = t.world.width / 2 + Math.cos(a) * d;
      const y = t.world.height / 2 + Math.sin(a) * d;
      let clear = Infinity;
      for (const rock of this.asteroids.values()) {
        const p = asteroidPos(rock, this.tick, t);
        clear = Math.min(clear, Math.hypot(wrapDelta(x, p.x, t.world.width), wrapDelta(y, p.y, t.world.height)) - t.asteroid.radius[rock.size]);
      }
      if (clear > best.clear) best = { x, y, clear };
    }
    return this.placeNewShip(id, best);
  }

  /** Clearance from the nearest asteroid edge at (x, y). */
  private rockClearance(x: number, y: number): number {
    const t = this.tune;
    let clear = Infinity;
    for (const rock of this.asteroids.values()) {
      const p = asteroidPos(rock, this.tick, t);
      clear = Math.min(clear, Math.hypot(wrapDelta(x, p.x, t.world.width), wrapDelta(y, p.y, t.world.height)) - t.asteroid.radius[rock.size]);
    }
    return clear;
  }

  /**
   * Best of many random points on the whole planet: the one farthest from the nearest ship, among
   * those clear of asteroids (spawn.rockClearance) when any are.
   */
  private spreadPoint(): { x: number; y: number } {
    const t = this.tune;
    let best = { x: this.rng() * t.world.width, y: this.rng() * t.world.height, score: -Infinity };
    for (let i = 0; i < 32; i++) {
      const x = this.rng() * t.world.width;
      const y = this.rng() * t.world.height;
      let near = t.world.width + t.world.height;
      for (const s of this.ships.values()) near = Math.min(near, Math.hypot(wrapDelta(x, s.x, t.world.width), wrapDelta(y, s.y, t.world.height)));
      const rock = this.rockClearance(x, y);
      const score = rock >= t.bots.spawnRockClearance ? near : near - 1e6;
      if (score > best.score) best = { x, y, score };
    }
    return best;
  }

  private placeNewShip(id: number, best: { x: number; y: number }): ShipState {
    const t = this.tune;
    const ship = newShip(best.x, best.y, this.rng() * Math.PI * 2 - Math.PI, t.ship.cruiseSpeed);
    ship.hp = t.ship.maxHp;
    ship.hullMax = t.ship.maxHp;
    ship.shield = maxShield(ship, t);
    ship.arrival = t.warp.arrivalSeconds;
    if (ship.arrival > 0) ship.speed = t.ship.maxSpeed;
    this.ships.set(id, ship);
    // A moment of immunity so nobody is destroyed by an asteroid drifting through the drop zone.
    this.grace.set(id, Math.round(2 * t.net.tickHz));
    this.spawnedAt.set(id, this.tick);
    // Lockdown (brief): the warp stays offline for the first warp.lockdownSeconds after dropping in.
    ship.lockdown = t.warp.lockdownSeconds;
    return ship;
  }

  /** What a ship's aim assist may pick: other living ships, and asteroids where they are now. */
  assistTargets(id: number): AssistTarget[] {
    const out: AssistTarget[] = [];
    for (const [oid, o] of this.ships) if (oid !== id && o.hp > 0 && !(o.arrival ?? 0) && !this.allies(id, oid)) out.push({ x: o.x, y: o.y, ship: true, ...shipVelocity(o) });
    for (const a of this.asteroids.values()) {
      const p = asteroidPos(a, this.tick, this.tune);
      out.push({ x: p.x, y: p.y, ship: false, vx: a.vx, vy: a.vy });
    }
    return out;
  }

  /**
   * The old mineral shop. Run levels replace it when shop.levelUp is on (owner, 19 November 2026):
   * then this refuses everything and upgrades come only from picked level cards (pick).
   */
  buy(id: number, item: number, tier: number): boolean {
    if (this.tune.shop.levelUp) return false;
    const s = this.ships.get(id);
    if (s && item === EVOLVE_ITEM) return evolve(s, this.tune,tier);
    const name = SHOP_ITEMS[item];
    if (!s || !name) return false;
    return buy(s, name, tier, this.tune);
  }

  /** Level cards on offer to each ship (sim/levels.ts), drawn when it has a level-up to pick. */
  readonly cards = new Map<number, number[]>();
  /** Evolutions each pilot owns (0 Battlecruiser, 1 Missile Cruiser), set by the room from the bank. */
  readonly evolutionsOwned = new Map<number, number[]>();

  /** Pick one of the offered level cards. Returns true if it applied. */
  pick(id: number, card: number): boolean {
    const s = this.ships.get(id), offer = this.cards.get(id);
    if (!s || !offer || !offer.includes(card) || pendingPicks(s, this.tune) <= 0 || s.hp <= 0) return false;
    if (!applyCard(s, card, this.tune)) return false;
    s.picks++;
    this.cards.delete(id);
    return true;
  }

  /** Draw cards for ships with a level-up waiting; bots pick at once (an evolution if offered). */
  private stepLevels(): void {
    if (!this.tune.shop.levelUp) return;
    for (const [id, s] of this.ships) {
      if (s.hp <= 0 || pendingPicks(s, this.tune) <= 0) continue;
      if (!this.cards.has(id)) {
        const cards = drawCards(s, this.evolutionsOwned.get(id) ?? [], this.tune, this.rng);
        if (!cards.length) continue;
        this.cards.set(id, cards);
      }
      if (this.botIds.has(id)) {
        const offer = this.cards.get(id)!;
        this.pick(id, offer.find((c) => c >= 10) ?? offer[Math.floor(this.rng() * offer.length)]);
      }
    }
  }

  removeShip(id: number): void {
    this.ships.delete(id);
    this.grace.delete(id);
    this.spawnedAt.delete(id);
    this.botIds.delete(id);
    this.quiet.delete(id);
    this.lastHit.delete(id);
    this.graceUntil.delete(id);
    this.graceSpent.delete(id);
    this.clanOf.delete(id);
    this.turrets.delete(id);
    this.rammed.delete(id);
    this.prev.delete(id);
    this.cards.delete(id);
    this.evolutionsOwned.delete(id);
  }

  /** Advance one ship by one step with the given input, spawning its bullet if it fired. */
  stepShip(id: number, input: ShipInput): void {
    const s = this.ships.get(id);
    if (!s) return;
    const before = s.shots;
    const missilesBefore = s.missileShots;
    const minesBefore = s.mineShots;
    this.prev.set(id, { x: s.x, y: s.y });
    if (this.atWar && this.layout) {
      // No warping out during a war; defenders cannot attack from inside a standing shield (owner).
      input = { ...input, warp: false };
      const sg = this.siege!;
      if ((this.clanOf.get(id) ?? 0) === this.layout.clan && sg.shield > 0 && insideDome(this.layout, s.x, s.y, this.tune)) input = { ...input, fire: false, missile: false, mine: false };
    }
    if(freeHomeWarp(this.layout,!!this.siege,this.atWar))s.lockdown=0;
    stepShip(s, input, this.dt, this.tune, speedFloor(this.layout, this.clanOf.get(id) ?? 0, s, this.tune), false);
    if (s.missileShots !== missilesBefore) this.launchMissile(id, s);
    if (s.mineShots !== minesBefore) this.dropMine(id, s);
    if (s.shots !== before) {
      // Bots aim for themselves (sim/bots.ts); the guns' lock-on assist is a pilot aid (owner).
      const shot = muzzleShot(s, this.tune, this.botIds.has(id) ? [] : this.assistTargets(id));
      this.bullets.push({ owner: id, damage: this.tune.weapon.damage * primaryDamageScale(s, this.tune), x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy, life: this.tune.weapon.bulletLifeSteps });
      this.events.shots.push({ owner: id, ...shot });
    }
  }

  /** Bullets, collisions and population for this tick. Call after every ship has stepped. */
  step(): void {
    const t = this.tune;
    const W = t.world.width;
    const H = t.world.height;
    this.tick++;
    this.stepLevels();
    // One authoritative countdown per world tick, even before the pilot's input buffer starts.
    for (const s of this.ships.values()) s.arrival = Math.max(0, (s.arrival ?? 0) - this.dt);
    const pos = new Map<number, { x: number; y: number }>();
    for (const a of this.asteroids.values()) pos.set(a.id, asteroidPos(a, this.tick, t));
    const hits = (x: number, y: number, ox: number, oy: number, r: number): boolean => {
      const dx = wrapDelta(x, ox, W);
      const dy = wrapDelta(y, oy, H);
      return dx * dx + dy * dy <= r * r;
    };

    this.stepTurrets(pos);
    this.stepBase(pos);
    this.stepOrdnance(pos);

    // Bullets.
    const kept: Bullet[] = [];
    for (const b of this.bullets) {
      b.x = wrap(b.x + b.vx * this.dt, W);
      b.y = wrap(b.y + b.vy * this.dt, H);
      let spent = --b.life <= 0;
      if (!spent) {
        for (const a of this.asteroids.values()) {
          const p = pos.get(a.id);
          if (!p || !hits(b.x, b.y, p.x, p.y, t.asteroid.radius[a.size] + t.weapon.bulletRadius)) continue;
          this.damageAsteroid(a, p, b.damage, b.vx, b.vy, pos, true, b.owner);
          spent = true;
          break;
        }
      }
      if (!spent) {
        // Enemy missiles and mines can be shot down.
        for (const o of this.ordnance.values()) {
          if (o.owner === b.owner) continue;
          const r = o.kind === 'missile' ? t.missile.radius*(o.heavy?t.missileCruiser.radiusFactor:1) : t.mine.radius;
          if (!hits(b.x, b.y, o.x, o.y, r + t.weapon.bulletRadius)) continue;
          o.hp -= b.damage;
          if (o.hp <= 0) {
            this.ordnance.delete(o.id);
            this.events.blasts.push({ x: o.x, y: o.y, r: r * 2, kind: o.kind, shot: true });
          }
          spent = true;
          break;
        }
      }
      // The clan base shield stops bullets from anyone but the clan's members. At war, attackers'
      // bullets damage live turrets, the shield while it stands, and the treasury once it is down.
      const base = this.layout;
      const hostile = !!base && b.owner !== BASE_OWNER && (this.clanOf.get(b.owner) ?? 0) !== base.clan;
      if (!spent && hostile && this.atWar) spent = this.hitStructure(b);
      if (!spent && base && hostile && (!this.atWar || this.siege!.shield > 0) && insideDome(base, b.x, b.y, t)) {
        spent = true;
        this.events.blasts.push({ x: b.x, y: b.y, r: 14, kind: 'missile', shot: true });
      }
      if (!spent) {
        for (const [id, s] of this.ships) {
          if (id === b.owner || s.hp <= 0 || (s.arrival ?? 0) > 0 || this.allies(b.owner, id)) continue;
          if (base && b.owner === BASE_OWNER && (this.clanOf.get(id) ?? 0) === base.clan) continue;
          if (!hits(b.x, b.y, s.x, s.y, shipRadius(s.hullMax, t, s.chassis) + t.weapon.bulletRadius)) continue;
          this.damageShip(id, s, b.damage, b.owner, b.x, b.y);
          spent = true;
          break;
        }
      }
      if (!spent) kept.push(b);
    }
    this.bullets = kept;

    // Dash ram: a dashing ship that hits another ship deals ram damage (scaled by its power like its
    // guns), takes a small bump itself, and both are thrown apart, the smaller one further. Once per dash.
    for (const [id, s] of this.ships) {
      if (s.dashTime <= 0) {
        this.rammed.delete(id);
        continue;
      }
      if (s.hp <= 0 || (s.arrival ?? 0) > 0 || this.rammed.has(id)) continue;
      const sr = shipRadius(s.hullMax, t, s.chassis);
      for (const [oid, o] of this.ships) {
        if (oid === id || o.hp <= 0 || (o.arrival ?? 0) > 0) continue;
        const or = shipRadius(o.hullMax, t, o.chassis);
        if (!this.sweptHit(id, s, o.x, o.y, sr + or)) continue;
        let dx = wrapDelta(o.x, s.x, W);
        let dy = wrapDelta(o.y, s.y, H);
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        this.rammed.add(id);
        const k = t.ship.knockbackSpeed;
        o.kx = dx * k * Math.min(2, sr / or);
        o.ky = dy * k * Math.min(2, sr / or);
        s.kx = -dx * k * 0.5 * Math.min(2, or / sr);
        s.ky = -dy * k * 0.5 * Math.min(2, or / sr);
        // Ram (owner, 16 November 2026): the larger of the flat ram (scaled by the rammer's power) and
        // ship.dashRamHullFraction of the target's hull maximum, so any pilot can hurt a big ship.
        // The target takes it straight to the hull; the rammer takes the same amount on its shield
        // (no overflow), or on its hull only if its shield is already down (owner, 16 November 2026).
        const ram = Math.max(t.ship.dashRamDamage * damageScale(s, t), t.ship.dashRamHullFraction * hullCapacity(o,t));
        this.damageShip(oid, o, ram, id, wrap(o.x - dx * or, W), wrap(o.y - dy * or, H), 'hull');
        this.damageShip(id, s, ram, oid, wrap(s.x + dx * sr, W), wrap(s.y + dy * sr, H), 'shield');
        this.events.rams.push({ id, target: oid, x: wrap(s.x + dx * sr, W), y: wrap(s.y + dy * sr, H) });
        break;
      }
    }

    // Ship bumps (owner, 15 November 2026): ships that touch outside a dash no longer pass through each
    // other. Both bounce apart (bumpKnockbackSpeed) and take bumpDamage (shield first, credited to the
    // other ship); the same pair cannot bump again for contactGraceSeconds.
    {
      const list = [...this.ships];
      for (let i = 0; i < list.length; i++) {
        const [ida, a] = list[i];
        if (a.hp <= 0 || a.dashTime > 0 || (a.arrival ?? 0) > 0) continue;
        const ra = shipRadius(a.hullMax, t, a.chassis);
        for (let j = i + 1; j < list.length; j++) {
          const [idb, b] = list[j];
          if (b.hp <= 0 || b.dashTime > 0 || (b.arrival ?? 0) > 0) continue;
          const rb = shipRadius(b.hullMax, t, b.chassis);
          let dx = wrapDelta(b.x, a.x, W);
          let dy = wrapDelta(b.y, a.y, H);
          const d = Math.hypot(dx, dy);
          if (d >= ra + rb) continue;
          const key = ida < idb ? `${ida}:${idb}` : `${idb}:${ida}`;
          if ((this.bumpUntil.get(key) ?? -1) > this.tick) continue;
          this.bumpUntil.set(key, this.tick + Math.round(t.ship.contactGraceSeconds * t.net.tickHz));
          if (d > 1e-6) { dx /= d; dy /= d; } else { dx = 1; dy = 0; }
          const k = t.ship.bumpKnockbackSpeed;
          a.kx = -dx * k;
          a.ky = -dy * k;
          b.kx = dx * k;
          b.ky = dy * k;
          const cx = wrap(a.x + dx * ra, W);
          const cy = wrap(a.y + dy * ra, H);
          this.damageShip(idb, b, t.ship.bumpDamage, ida, cx, cy);
          this.damageShip(ida, a, t.ship.bumpDamage, idb, cx, cy);
        }
      }
      if (this.bumpUntil.size > 256) for (const [k, until] of this.bumpUntil) if (until <= this.tick) this.bumpUntil.delete(k);
    }

    // Ships against asteroids: the ship takes contact damage, the asteroid is smashed and splits, and
    // the two are pushed apart: the ship bounces back, the pieces fly on away from it.
    for (const [id, s] of this.ships) {
      const g = this.grace.get(id) ?? 0;
      if (g > 0) {
        this.grace.set(id, g - 1);
        continue;
      }
      if (s.hp <= 0 || (s.arrival ?? 0) > 0) continue;
      for (const a of this.asteroids.values()) {
        const p = pos.get(a.id);
        const sr = shipRadius(s.hullMax, t, s.chassis);
        if (!p || !this.sweptHit(id, s, p.x, p.y, t.asteroid.radius[a.size] + sr)) continue;
        let dx = wrapDelta(p.x, s.x, W);
        let dy = wrapDelta(p.y, s.y, H);
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) {
          dx = Math.cos(s.heading);
          dy = Math.sin(s.heading);
        } else {
          dx /= len;
          dy /= len;
        }
        // A warping ship plows through (owner): the rock is smashed, the ship takes nothing and
        // keeps its course and warp distance.
        if (s.warping) {
          this.destroyAsteroid(a, p, t.asteroid.ramDamage, dx, dy, pos, id);
          break;
        }
        this.damageShip(id, s, t.asteroid.contactDamage[a.size], 0, wrap(s.x + dx * sr, W), wrap(s.y + dy * sr, H));
        s.kx = -dx * t.ship.knockbackSpeed;
        s.ky = -dy * t.ship.knockbackSpeed;
        this.destroyAsteroid(a, p, t.asteroid.ramDamage, dx, dy, pos, id);
        this.grace.set(id, Math.round(t.ship.contactGraceSeconds * t.net.tickHz));
        break;
      }
    }

    // Nearest eligible collector attracts only nearby objects; server decides every movement/reward.
    const collectors=[...this.ships].filter(([,s])=>s.hp>0);
    for(const k of this.pickups.values()){
      if(this.tick>=k.expires){this.pickups.delete(k.id);this.events.pickupsGone.push({id:k.id,by:0});continue;}
      let target:{id:number;s:ShipState;dx:number;dy:number;d2:number;radius:number}|null=null;
      for(const[id,s]of collectors){
        if(id===k.from&&this.tick<k.lockedUntil)continue;
        if(!pickupHasRoom(k,s,t,{bot:this.botIds.has(id),clan:this.clanOf.get(id)??0,homeClan:this.layout?.clan??0,warzone:!!this.siege}))continue;
        const dx=wrapDelta(s.x,k.x,W),dy=wrapDelta(s.y,k.y,H),d2=dx*dx+dy*dy,radius=t.asteroid.pickupRadius+shipRadius(s.hullMax,t,s.chassis),reach=radius+t.asteroid.pickupMagnetReach;
        if(d2>reach*reach)continue;
        if(!target||d2<target.d2||(d2===target.d2&&id<target.id))target={id,s,dx,dy,d2,radius};
      }
      if(!target)continue;
      const{id,s,dx,dy,radius}=target;let d=Math.sqrt(target.d2),moved=false;
      if(d>radius&&t.asteroid.pickupMagnetSpeed>0&&t.asteroid.pickupMagnetReach>0){
        const step=Math.min(t.asteroid.pickupMagnetSpeed*this.dt,d-radius+1);
        k.x=wrap(k.x+dx/d*step,W);k.y=wrap(k.y+dy/d*step,H);d-=step;moved=true;
      }
      if(d<=radius){
        if(k.kind==='heal')s.hp=Math.min(hullCapacity(s,t),s.hp+t.ship.maxHp*t.asteroid.healthHealFraction);
        else if(k.kind==='mineral'){s.hullMax=Math.min(walletCap(s,t),s.hullMax+k.value);s.xp=(s.xp??0)+k.value;} // all of it levels you, even past a full hold
        else{
          const held=k.kind==='fuel'?'fuel':'salvage',taken=Math.min(k.value,Math.max(0,t.salvage.cargoMax-s[held]));
          s[held]+=taken;k.value=Math.round((k.value-taken)*10)/10;
          if(k.value>0){this.events.pickupsMoved.push({id:k.id,x:k.x,y:k.y,value:k.value});continue;}
        }
        this.pickups.delete(k.id);this.events.pickupsGone.push({id:k.id,by:id});
      }else if(moved)this.events.pickupsMoved.push({id:k.id,x:Math.round(k.x*10)/10,y:Math.round(k.y*10)/10,value:k.value});
    }

    // Shields come back after a quiet spell (shieldCd counts it down; every hit resets it).
    for (const [id, s] of this.ships) {
      const top = maxShield(s, t);
      if (s.shield > top) s.shield = top;
      s.shieldCd = Math.max(0, s.shieldCd - this.dt);
      if (s.shield >= top * t.ship.shieldGraceRechargeFraction) this.graceSpent.delete(id);
      if (s.hp <= 0 || s.shield >= top || s.shieldCd > 0) continue;
      s.shield = Math.min(top, s.shield + shieldRegen(s,t) * this.dt);
      if (s.shield >= top * t.ship.shieldGraceRechargeFraction) this.graceSpent.delete(id);
    }

    // Warp complete: the ship launches off the planet (extracted), unless destroyed this tick.
    for (const [id, s] of this.ships) {
      if (s.hp > 0 && s.warping && s.warpDist >= t.warp.distance) this.events.extracted.push({ id, x: s.x, y: s.y });
    }

    if (this.tick >= this.hotZone.until) this.moveHotZone();
    if (this.tick % t.net.tickHz === 0) {
      this.populate();
      this.keepRichRocks();
    }
  }

  /**
   * Turrets: each turns toward the nearest enemy ship or asteroid in range (ships first), at a capped
   * rate, and fires once lined up. With nothing in range they swing back to face forward.
   */
  private stepTurrets(pos: Map<number, { x: number; y: number }>): void {
    const t = this.tune;
    const normal = t.turret;
    const W = t.world.width;
    const H = t.world.height;
    for (const [id, s] of this.ships) {
      // No firing in warp mode (brief), turrets included.
      const n = s.hp > 0 && !s.warping && !(s.arrival ?? 0) && !this.quiet.has(id) ? turretCount(s, t) : 0;
      if (!n) {
        this.turrets.delete(id);
        continue;
      }
      let st = this.turrets.get(id);
      if (!st) this.turrets.set(id, (st = { angle: [], cd: [],left:[],lock:[] }));
      for (let i = 0; i < n; i++) {
        st.angle[i] ??= s.heading;
        st.cd[i] ??= 0;
        if (st.cd[i] > 0) st.cd[i]--;
        const at = turretPosition(s, i, t),capital=isCapital(s.chassis),c=t.ciws,tt=capital?{...normal,range:c.range,turnRate:c.turnRate,fireIntervalSteps:Math.max(1,Math.round(c.intervalSeconds*t.net.tickHz)),bulletSpeed:c.speed,damage:c.damage}:normal;
        st.left[i]??=0;st.lock[i]??='';
        // Priority: incoming missiles, then ships, then mines, then asteroids; nearest within a class.
        type Target = { dx: number; dy: number; d: number; prio: number;key:string };
        let best = null as Target | null;
        const consider = (x: number, y: number, r: number, prio: number,key:string): void => {
          if(capital&&st.left[i]>0&&st.lock[i]!==key)return;
          const dx = wrapDelta(x, at.x, W);
          const dy = wrapDelta(y, at.y, H);
          const d = Math.hypot(dx, dy);
          if (d - r > tt.range) return;
          if (!best || prio > best.prio || (prio === best.prio && d < best.d)) best = { dx, dy, d, prio,key };
        };
        for (const o of this.ordnance.values()) if (o.owner !== id) consider(o.x, o.y, 0, o.kind === 'missile' ? 3 : 1,'o'+o.id);
        for (const [oid, o] of this.ships) if (oid !== id && o.hp > 0 && !this.allies(id, oid)) consider(o.x, o.y, 0, 2,'s'+oid);
        for (const a of this.asteroids.values()) {
          const p = pos.get(a.id);
          if (p) consider(p.x, p.y, t.asteroid.radius[a.size], 0,'a'+a.id);
        }
        const target = best as Target | null;
        if(capital&&!target&&st.left[i]>0){st.left[i]=0;st.lock[i]='';st.cd[i]=Math.ceil(c.pauseSeconds*t.net.tickHz);}
        if(capital&&target&&st.cd[i]===0&&st.left[i]===0){st.left[i]=c.shots;st.lock[i]=target.key;}
        const want = target ? Math.atan2(target.dy, target.dx) : s.heading;
        const diff = angleDelta(want, st.angle[i]);
        const step = tt.turnRate * this.dt;
        st.angle[i] = angleDelta(st.angle[i] + Math.max(-step, Math.min(step, diff)), 0);
        if (!target || st.cd[i] > 0 || Math.abs(angleDelta(want, st.angle[i])) > tt.aimTolerance) continue;
        if(capital){st.left[i]--;st.cd[i]=st.left[i]?tt.fireIntervalSteps:Math.ceil(c.pauseSeconds*t.net.tickHz);if(!st.left[i])st.lock[i]='';}else st.cd[i] = tt.fireIntervalSteps;
        const vx = Math.cos(st.angle[i]) * tt.bulletSpeed;
        const vy = Math.sin(st.angle[i]) * tt.bulletSpeed;
        const life = Math.ceil(((tt.range + 60) / tt.bulletSpeed) * t.net.tickHz);
        this.bullets.push({ owner: id, damage: tt.damage, x: at.x, y: at.y, vx, vy, life });
        this.events.shots.push({ owner: id, x: at.x, y: at.y, vx, vy, side: TURRET_SIDE + i });
      }
      st.angle.length = st.cd.length = st.left.length=st.lock.length=n;
    }
  }

  /**
   * Clan home planet (owner, Clan planets v0): the shield dome keeps non-members out (pushed back to
   * its edge, their missiles and mines popped), docked members are repaired and unload their fuel
   * into the treasury, and the base turrets fire on non-members in range.
   */
  private stepBase(pos: Map<number, { x: number; y: number }>): void {
    const base = this.layout;
    if (!base) return;
    void pos;
    const t = this.tune;
    const b = t.base;
    const W = t.world.width;
    const H = t.world.height;
    const member = (id: number): boolean => (this.clanOf.get(id) ?? 0) === base.clan;
    for (const [id, s] of this.ships) {
      if (s.hp <= 0 || (s.arrival ?? 0) > 0) continue;
      if (!member(id)) {
        if (this.atWar && this.siege!.shield <= 0) continue; // the shield is down: the way in is open
        const dx = wrapDelta(s.x, base.treasury.x, W);
        const dy = wrapDelta(s.y, base.treasury.y, H);
        const d = Math.hypot(dx, dy);
        if (d < b.domeRadius) {
          const ux = d > 1e-6 ? dx / d : 1;
          const uy = d > 1e-6 ? dy / d : 0;
          s.x = wrap(base.treasury.x + ux * b.domeRadius, W);
          s.y = wrap(base.treasury.y + uy * b.domeRadius, H);
          s.kx = ux * t.ship.knockbackSpeed;
          s.ky = uy * t.ship.knockbackSpeed;
        }
        continue;
      }
      if (this.siege || !isDocked(base, base.clan, s, t)) continue;
      s.hp = Math.min(hullCapacity(s,t), s.hp + hullCapacity(s,t) * b.dockRepairPerSecond * this.dt);
      s.shield = Math.min(maxShield(s, t), s.shield + maxShield(s, t) * b.dockRepairPerSecond * this.dt);
      if (s.fuel >= 1) {
        const amount = Math.floor(s.fuel);
        s.fuel -= amount;
        this.events.deposits.push({ id, amount });
      }
    }
    const sg = this.siege;
    if (sg && sg.phase === 'war') {
      // Live turrets regenerate the shield until it has been fully broken once.
      const alive = sg.turretHp.filter((v) => v > 0).length;
      if (!sg.shieldBroken) sg.shield = Math.min(t.siege.shieldHp, sg.shield + t.siege.shieldRegenPerTurret * alive * this.dt);
      if (this.tick >= sg.endsAt) this.finishWar(base.clan, 'time');
    }
    for (const o of [...this.ordnance.values()]) {
      if (member(o.owner) || !insideDome(base, o.x, o.y, t)) continue;
      if (sg && sg.phase === 'war') {
        if (sg.shield <= 0) continue; // nothing to stop it
        this.damageShield(o.damage, o.x, o.y);
      }
      this.ordnance.delete(o.id);
      this.events.blasts.push({ x: o.x, y: o.y, r: (o.kind === 'missile' ? t.missile.radius : t.mine.radius) * 2, kind: o.kind, shot: true });
    }
    // Heavy towers: telegraph, fast doublet, brief reload. Server controls cadence.
    const heavy=t.heavyTower;
    base.turrets.forEach((at, i) => {
      if (sg && sg.phase !== 'war') return; // Warzone outside a war: the towers hold fire
      if (sg && sg.turretHp[i] <= 0) return; // destroyed
      if (this.baseCd[i] > 0) this.baseCd[i]--;
      let best: { dx: number; dy: number; d: number } | null = null;
      for (const [id, s] of this.ships) {
        if (s.hp <= 0 || member(id)) continue;
        const dx = wrapDelta(s.x, at.x, W);
        const dy = wrapDelta(s.y, at.y, H);
        const d = Math.hypot(dx, dy);
        if (d <= heavy.range && (!best || d < best.d)) best = { dx, dy, d };
      }
      if (!best){this.baseBurst[i]=0;return;}
      if(!this.baseBurst[i]&&this.baseCd[i]<=0){this.baseBurst[i]=heavy.shots;this.baseCd[i]=Math.ceil(heavy.telegraphSeconds*t.net.tickHz);}
      const want = Math.atan2(best.dy, best.dx);
      const diff = angleDelta(want, this.baseAim[i]);
      const step = heavy.turnRate * this.dt;
      this.baseAim[i] = angleDelta(this.baseAim[i] + Math.max(-step, Math.min(step, diff)), 0);
      if (this.baseCd[i] > 0 || Math.abs(angleDelta(want, this.baseAim[i])) > 0.12) return;
      this.baseBurst[i]--;
      this.baseCd[i]=Math.ceil((this.baseBurst[i]?heavy.intervalSeconds:heavy.pauseSeconds)*t.net.tickHz);
      const vx = Math.cos(this.baseAim[i]) * heavy.speed;
      const vy = Math.sin(this.baseAim[i]) * heavy.speed;
      const life = Math.ceil(((heavy.range + 60) / heavy.speed) * t.net.tickHz);
      this.bullets.push({ owner: BASE_OWNER, damage: heavy.damage, x: at.x, y: at.y, vx, vy, life });
      this.events.shots.push({ owner: BASE_OWNER, x: at.x, y: at.y, vx, vy, side: BASE_TURRET_SIDE + i });
    });
  }

  private structureLock(id:number,s:ShipState):number{if(!this.layout||(this.clanOf.get(id)??0)===this.layout.clan)return 0;return missileStructureLock(s,this.layout,this.siege,this.tune)?.id??0;}

  private newOrdnanceId(): number {
    for (;;) {
      const id = this.nextOrdnanceId;
      this.nextOrdnanceId = this.nextOrdnanceId >= 0xffff ? 1 : this.nextOrdnanceId + 1;
      if (!this.ordnance.has(id)) return id;
    }
  }

  /** A missile from ship id: locks the ship nearest the nose (ships only), launches from the nose. */
  private launchMissile(id: number, s: ShipState): void {
    const m = this.tune.missile;
    // Missile Cruiser (owner, 21 November 2026): each missile leaves 45 degrees to the side, alternating
    // left and right, for missileCruiser.reverseSeconds, then homes on its target.
    const tier = Math.max(1, s.missileTier),heavy=s.chassis===MISSILE_CRUISER,c=this.tune.missileCruiser,h=s.heading+(heavy?(s.missileShots%2?1:-1)*Math.PI/4:0);
    const r = shipRadius(s.hullMax, this.tune, s.chassis) + m.radius;
    const o: Ordnance = {
      id: this.newOrdnanceId(),
      kind: 'missile',
      heavy,
      owner: id,
      x: wrap(s.x + Math.cos(h) * r, this.tune.world.width),
      y: wrap(s.y + Math.sin(h) * r, this.tune.world.height),
      heading: h,
      returnHeading: heavy ? s.heading : undefined,
      speed: heavy?c.launchSpeed:Math.max(m.launchSpeed, s.speed),
      hp: m.hp,
      life: Math.round((heavy?c.lifeSeconds:m.lifeSeconds) * this.tune.net.tickHz),
      armAt: this.tick+(heavy?Math.ceil(c.reverseSeconds*this.tune.net.tickHz):0),
      target: missileLock(id, s, [...this.ships].filter(([oid]) => !this.allies(id, oid)), this.tune)||(heavy?this.structureLock(id,s):0),
      damage: (m.damage + m.damagePerTier * (tier - 1))*(heavy?c.missileDamageFactor:1),
      blast: 0,
      turn: heavy?c.turnRateMissile:m.turnRate + m.turnPerTier * (tier - 1),
    };
    this.ordnance.set(o.id, o);
  }

  /** A mine dropped behind ship id; it arms after armSeconds. Oldest goes when over maxActive. */
  private dropMine(id: number, s: ShipState): void {
    const t = this.tune;
    const mn = t.mine;
    const tier = Math.max(1, s.mineTier);
    const mine = [...this.ordnance.values()].filter((o) => o.owner === id && o.kind === 'mine');
    // Live mines are capped at the mine tier (owner, 21 November 2026): one more removes the oldest.
    const cap = Math.min(mn.maxActive, Math.max(1, s.mineTier));
    while (mine.length >= cap) this.ordnance.delete(mine.shift()!.id);
    const r = shipRadius(s.hullMax, t, s.chassis) + mn.radius + 6;
    const o: Ordnance = {
      id: this.newOrdnanceId(),
      kind: 'mine',
      owner: id,
      x: wrap(s.x - Math.cos(s.heading) * r, t.world.width),
      y: wrap(s.y - Math.sin(s.heading) * r, t.world.height),
      heading: s.heading,
      speed: 0,
      hp: mn.hp,
      life: Math.round(mn.lifeSeconds * t.net.tickHz),
      armAt: this.tick + Math.round(mn.armSeconds * t.net.tickHz),
      target: 0,
      damage: mn.damage + mn.damagePerTier * (tier - 1),
      blast: mn.blastRadius + mn.blastPerTier * (tier - 1),
      turn: 0,
    };
    this.ordnance.set(o.id, o);
  }

  /**
   * Missiles home on their locked ship (turning at a capped rate, speeding up) and hit the first
   * enemy ship or asteroid they touch. Mines, once armed, creep toward the nearest enemy ship in
   * seekRange and blow up when one comes within triggerRadius, hurting every enemy ship in the blast
   * (less toward the edge). Owners are never hurt by their own.
   */
  private stepOrdnance(pos: Map<number, { x: number; y: number }>): void {
    const t = this.tune;
    const W = t.world.width;
    const H = t.world.height;
    const dt = this.dt;
    const rel = (o: Ordnance, x: number, y: number): { dx: number; dy: number; d: number } => {
      const dx = wrapDelta(x, o.x, W);
      const dy = wrapDelta(y, o.y, H);
      return { dx, dy, d: Math.hypot(dx, dy) };
    };
    for (const o of [...this.ordnance.values()]) {
      if (--o.life <= 0) {
        this.ordnance.delete(o.id);
        if (o.kind === 'missile') this.events.blasts.push({ x: o.x, y: o.y, r: t.missile.radius * 2, kind: 'missile', shot: true });
        continue;
      }
      if (o.kind === 'missile') {
        const structure=o.target<0&&this.layout&&this.siege?o.target===-1?(this.siege.treasury>0?this.layout.treasury:undefined):(this.siege.turretHp[-2-o.target]>0?this.layout.turrets[-2-o.target]:undefined):undefined;
        const target = o.target>0?this.ships.get(o.target):structure?{...structure,hp:1}:undefined;
        if (this.tick >= o.armAt) {
          let want = o.returnHeading;
          if (target && target.hp > 0) {
            const r = rel(o, target.x, target.y);
            want = Math.atan2(r.dy, r.dx);
          }
          if (want !== undefined) {
            const step = o.turn * dt;
            o.heading = angleDelta(o.heading + Math.max(-step, Math.min(step, angleDelta(want, o.heading))), 0);
          }
        }
        o.speed = Math.min(t.missile.maxSpeed, o.speed + t.missile.acceleration * dt);
        const px = o.x;
        const py = o.y;
        o.x = wrap(o.x + Math.cos(o.heading) * o.speed * dt, W);
        o.y = wrap(o.y + Math.sin(o.heading) * o.speed * dt, H);
        const hostile=this.layout&&(this.clanOf.get(o.owner)??0)!==this.layout.clan;
        let hit = !!(o.heavy&&hostile&&this.atWar&&this.hitStructure({owner:o.owner,damage:o.damage,x:o.x,y:o.y,vx:0,vy:0,life:1}));
        for (const [sid, s] of this.ships) {
          if (hit||sid === o.owner || s.hp <= 0 || (s.arrival ?? 0) > 0 || this.allies(o.owner, sid)) continue;
          // Swept: a fast missile cannot skip through a ship between ticks.
          const ex = wrapDelta(o.x, px, W);
          const ey = wrapDelta(o.y, py, H);
          const tx = wrapDelta(s.x, px, W);
          const ty = wrapDelta(s.y, py, H);
          const len2 = ex * ex + ey * ey;
          const k = len2 > 0 ? Math.max(0, Math.min(1, (tx * ex + ty * ey) / len2)) : 0;
          const rr = shipRadius(s.hullMax, t, s.chassis) + t.missile.radius*(o.heavy?t.missileCruiser.radiusFactor:1);
          if ((tx - ex * k) ** 2 + (ty - ey * k) ** 2 > rr * rr) continue;
          this.damageShip(sid, s, o.damage, o.owner, o.x, o.y);
          hit = true;
          break;
        }
        if (!hit) {
          for (const a of this.asteroids.values()) {
            const p = pos.get(a.id);
            if (!p || rel(o, p.x, p.y).d > t.asteroid.radius[a.size] + t.missile.radius*(o.heavy?t.missileCruiser.radiusFactor:1)) continue;
            this.damageAsteroid(a, p, o.damage, Math.cos(o.heading), Math.sin(o.heading), pos, false, o.owner);
            hit = true;
            break;
          }
        }
        if (hit) {
          this.ordnance.delete(o.id);
          this.events.blasts.push({ x: o.x, y: o.y, r: 40, kind: 'missile', shot: false });
        }
        continue;
      }
      // Mine.
      if (this.tick < o.armAt) continue;
      let near: { s: ShipState; dx: number; dy: number; d: number } | null = null;
      for (const [sid, s] of this.ships) {
        if (sid === o.owner || s.hp <= 0 || (s.arrival ?? 0) > 0 || this.allies(o.owner, sid)) continue;
        const r = rel(o, s.x, s.y);
        if (r.d <= t.mine.seekRange && (!near || r.d < near.d)) near = { s, ...r };
      }
      if (!near) continue;
      if (near.d <= t.mine.triggerRadius + shipRadius(near.s.hullMax, t, near.s.chassis)) {
        this.ordnance.delete(o.id);
        this.events.blasts.push({ x: o.x, y: o.y, r: o.blast, kind: 'mine', shot: false });
        for (const [sid, s] of this.ships) {
          if (sid === o.owner || s.hp <= 0 || (s.arrival ?? 0) > 0 || this.allies(o.owner, sid)) continue;
          const d = rel(o, s.x, s.y).d - shipRadius(s.hullMax, t, s.chassis);
          if (d > o.blast) continue;
          this.damageShip(sid, s, o.damage * (1 - 0.5 * Math.max(0, d) / o.blast), o.owner, o.x, o.y);
        }
        continue;
      }
      // Creep toward it.
      o.heading = Math.atan2(near.dy, near.dx);
      o.x = wrap(o.x + Math.cos(o.heading) * t.mine.seekSpeed * dt, W);
      o.y = wrap(o.y + Math.sin(o.heading) * t.mine.seekSpeed * dt, H);
    }
  }

  /**
   * Did ship id pass within r of (x, y) during its last step? Checks the whole segment it travelled,
   * so a dashing ship (about 47 px a step) cannot skip through a rock or a ship between ticks.
   */
  private sweptHit(id: number, s: ShipState, x: number, y: number, r: number): boolean {
    const W = this.tune.world.width;
    const H = this.tune.world.height;
    const from = this.prev.get(id) ?? s;
    const ex = wrapDelta(s.x, from.x, W);
    const ey = wrapDelta(s.y, from.y, H);
    const tx = wrapDelta(x, from.x, W);
    const ty = wrapDelta(y, from.y, H);
    const len2 = ex * ex + ey * ey;
    const k = len2 > 0 ? Math.max(0, Math.min(1, (tx * ex + ty * ey) / len2)) : 0;
    const dx = tx - ex * k;
    const dy = ty - ey * k;
    return dx * dx + dy * dy <= r * r;
  }

  /** Ids travel as 16 bits: wrap around, skipping any still in use. */
  /** Tutorial planet: a scripted rock at (x, y), at rest. Returns its id. */
  spawnAsteroid(size: number, x: number, y: number): number {
    const a: Asteroid = { id: this.newAsteroidId(), size, x, y, vx: 0, vy: 0, t0: this.tick, hp: this.tune.asteroid.hp[size], family: 1 };
    this.asteroids.set(a.id, a);
    this.events.asteroids.push(a);
    return a.id;
  }

  /** Tutorial planet: a scripted pickup (minerals or a repair pod). Returns its id. */
  spawnPickup(kind: 'heal' | 'mineral', x: number, y: number, value: number): number {
    const id = this.nextPickupId;
    this.addPickup(x, y, kind, value);
    const k = this.pickups.get(id);
    if (k) k.lockedUntil = this.tick;
    return id;
  }

  /** Tutorial planet: a training shot from a fixed point (no ship fired it). */
  spawnBullet(x: number, y: number, vx: number, vy: number, damage: number, life: number): void {
    this.bullets.push({ owner: BASE_OWNER, damage, x, y, vx, vy, life });
    this.events.shots.push({ owner: BASE_OWNER, x, y, vx, vy, side: 0 });
  }

  private newAsteroidId(): number {
    for (;;) {
      const id = this.nextAsteroidId;
      this.nextAsteroidId = this.nextAsteroidId >= 0xffff ? 1 : this.nextAsteroidId + 1;
      if (!this.asteroids.has(id)) return id;
    }
  }

  /** Events since the last call. */
  /** An attacker's bullet against the base at war: a live turret, the standing shield, or the treasury. */
  private hitStructure(b: Bullet): boolean {
    const base = this.layout!, sg = this.siege!, t = this.tune, g = t.siege;
    const near = (x: number, y: number, r: number): boolean => Math.hypot(wrapDelta(b.x, x, t.world.width), wrapDelta(b.y, y, t.world.height)) <= r + t.weapon.bulletRadius;
    for (let i = 0; i < base.turrets.length; i++) {
      const at = base.turrets[i];
      if (sg.turretHp[i] <= 0 || !near(at.x, at.y, g.turretRadius)) continue;
      sg.turretHp[i] = Math.max(0, sg.turretHp[i] - b.damage);
      this.events.structureHits.push({ what: i, x: b.x, y: b.y, destroyed: sg.turretHp[i] <= 0 });
      return true;
    }
    if (sg.shield > 0) {
      if (!insideDome(base, b.x, b.y, t)) return false;
      this.damageShield(b.damage, b.x, b.y);
      return true;
    }
    if (!near(base.treasury.x, base.treasury.y, g.treasuryRadius)) return false;
    sg.treasury = Math.max(0, sg.treasury - b.damage);
    this.events.structureHits.push({ what: 'treasury', x: b.x, y: b.y, destroyed: sg.treasury <= 0 });
    if (sg.treasury <= 0) this.finishWar(this.attackerClan, 'treasury');
    return true;
  }

  private damageShield(damage: number, x: number, y: number): void {
    const sg = this.siege!;
    sg.shield = Math.max(0, sg.shield - damage);
    if (sg.shield <= 0) sg.shieldBroken = true;
    this.events.structureHits.push({ what: 'shield', x, y, destroyed: sg.shield <= 0 });
  }

  drain(): WorldEvents {
    const e = this.events;
    this.events = noEvents();
    return e;
  }

  /** The shield takes damage first; what it cannot hold goes to the hull. */
  /**
   * mode (owner, 16 November 2026, dash rams): 'hull' goes straight to the hull past the shield (the
   * rammed ship); 'shield' is taken by the shield with nothing spilling over to the hull, or by the
   * hull only when the shield is already down and recharging (the rammer).
   */
  private damageShip(id: number, s: ShipState, damage: number, attacker: number, atX: number, atY: number, mode: 'normal' | 'hull' | 'shield' = 'normal'): void {
    if (s.hp <= 0 || (s.arrival ?? 0) > 0 || this.allies(attacker, id)) return;
    // Docked on its clan's pad: safe (owner, Clan planets v0).
    if (this.docked(id)) return;
    const t = this.tune;
    this.lastHit.set(id, this.tick);
    s.shieldCd = t.ship.shieldRegenDelaySeconds;
    // Any damage in warp mode resets the warp distance (brief); warp mode itself continues.
    if (s.warping && damage > 0) s.warpDist = 0;
    // Forgiving shield (owner, 14 November 2026): the hit that breaks the shield is absorbed in full,
    // then the hull is safe for shieldBreakGraceSeconds, so a burst breaks the shield and leaves the
    // pilot a moment to get away. Once per recharge cycle: it is ready again only after the shield
    // recharges past shieldGraceRechargeFraction of its maximum.
    const inGrace = this.tick < (this.graceUntil.get(id) ?? -1);
    const saves = mode === 'normal' && s.shield > 0 && !this.graceSpent.has(id);
    const breaks = saves && damage >= s.shield;
    const absorbed = mode === 'hull' ? 0 : saves ? damage : Math.min(s.shield, damage);
    const toHull = mode === 'hull' ? damage : mode === 'shield' ? (s.shield > 0 ? 0 : damage) : inGrace ? 0 : damage - absorbed;
    this.events.hits.push({ id, x: atX, y: atY, shielded: s.shield > 0 || inGrace, hull: !this.invulnerable && toHull > 0, broke: breaks, by: attacker });
    if (this.invulnerable) return;
    s.shield = Math.max(0, s.shield - absorbed);
    if (breaks) {
      this.graceUntil.set(id, this.tick + Math.round(t.ship.shieldBreakGraceSeconds * t.net.tickHz));
      this.graceSpent.add(id);
    }
    const before = s.hp;
    s.hp = Math.max(0, s.hp - toHull);
    // Hull damage spills some carried minerals, bounded by the wallet; starting HP is never loot.
    // A destroyed ship drops a share of its wallet.
    const purse=mineralBalance(s,t);
    const spill = Math.floor(Math.min(purse,s.hp===0?purse*t.ship.deathSpillFraction:(before-s.hp)*t.ship.hullSpillFraction)*10+1e-8)/10;
    s.hullMax-=spill;
    this.spillMinerals(s.x, s.y, spill, s.hp === 0 ? 90 : 40, id);
    if (s.hp === 0) {
      // Gold (BRIEF.md): everything the ship carried, plus a share of its power above the start as
      // the kill payout. No power gold from a ship still in its spawn protection; less for repeat
      // kills of the same pilot (payoutFactor); bots carry no salvage and drop a reduced share.
      const sv = t.salvage;
      const fresh = this.tick - (this.spawnedAt.get(id) ?? -Infinity) <= 2 * t.net.tickHz;
      let payout = fresh ? 0 : sv.killPowerShare * purse * this.payoutFactor(id, attacker);
      if (this.botIds.has(id)) payout *= sv.botDropFactor;
      // No salvage on clan home planets (owner): no gold drops there; carried fuel is simply lost.
      if (!this.layout) this.dropGold(s.x, s.y, s.salvage + payout, id);
      s.fuel = 0;
      s.salvage = 0;
      this.events.deaths.push({ id, x: s.x, y: s.y, killer: attacker });
      // Siege: every attacker death costs a ticket; none left and the defenders win.
      const sg = this.siege;
      if (sg && sg.phase === 'war' && (this.clanOf.get(id) ?? 0) !== this.layout!.clan) {
        sg.tickets = Math.max(0, sg.tickets - 1);
        if (sg.tickets <= 0) this.finishWar(this.layout!.clan, 'tickets');
      }
    }
  }

  /** Gold salvage scattered around (x, y) for anyone to collect. */
  private dropGold(x: number, y: number, value: number, from: number): void {
    const t = this.tune;
    if (value < 1) return;
    const chunks = Math.min(t.salvage.goldChunksMax, Math.ceil(value / t.salvage.goldChunkValue));
    const each = value / chunks;
    for (let i = 0; i < chunks; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = (chunks === 1 ? 0 : 0.4 + this.rng() * 0.6) * 100;
      this.addPickup(wrap(x + Math.cos(a) * d, t.world.width), wrap(y + Math.sin(a) * d, t.world.height), 'salvage', each, from);
    }
  }

  /** Is (x, y) inside the hot zone? */
  inHotZone(x: number, y: number): boolean {
    const z = this.hotZone;
    if (z.r <= 0) return false;
    const dx = wrapDelta(x, z.x, this.tune.world.width);
    const dy = wrapDelta(y, z.y, this.tune.world.height);
    return dx * dx + dy * dy <= z.r * z.r;
  }

  /** Move the hot zone somewhere new, away from the drop zone at the map centre. */
  moveHotZone(): void {
    const t = this.tune;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 20; i++) {
      x = this.rng() * t.world.width;
      y = this.rng() * t.world.height;
      if (Math.hypot(wrapDelta(x, t.world.width / 2, t.world.width), wrapDelta(y, t.world.height / 2, t.world.height)) > t.hotZone.radius + t.asteroid.spawnClearRadius) break;
    }
    this.hotZone = { x, y, r: t.hotZone.radius, until: this.tick + Math.round(t.hotZone.moveSeconds * t.net.tickHz) };
    this.events.hotZone = { ...this.hotZone };
  }

  /** Drop value points of minerals around (x, y), in a few chunks scattered within reach. */
  private spillMinerals(x: number, y: number, value: number, reach: number, from = 0, salvagePer = 0, mineralFactor = 1): void {
    if(this.tutorial&&!this.tutorialMinerals)return;
    const t = this.tune;
    if (value <= 0) return;
    const mineralUnits = Math.floor(value * mineralFactor * 10 + 1e-8);
    const cargo = salvagePer > 0 && !this.siege && !this.tutorial;
    const chunks = Math.min(t.asteroid.mineralChunksMax, Math.ceil((cargo ? value : mineralUnits / 10) / t.asteroid.mineralChunkValue));
    if (chunks === 0) return;
    // Split one quantized budget instead of rounding every chunk upward independently.
    const units=Math.floor(value*10+1e-8),baseUnits=Math.floor(units/chunks),remainder=units%chunks;
    for (let i = 0; i < chunks; i++) {
      const each=(baseUnits+(i<remainder?1:0))/10;
      const a = this.rng() * Math.PI * 2;
      const d = (chunks === 1 ? 0 : 0.4 + this.rng() * 0.6) * reach;
      const px=wrap(x+Math.cos(a)*d,t.world.width),py=wrap(y+Math.sin(a)*d,t.world.height);
      const mineral = (Math.floor(mineralUnits / chunks) + (i < mineralUnits % chunks ? 1 : 0)) / 10;
      if (mineral > 0) this.addPickup(px, py, 'mineral', mineral, from);
      if (cargo) {
        const kind=this.layout?'fuel':'salvage';
        this.addPickup(wrap(px-Math.sin(a)*32,t.world.width),wrap(py+Math.cos(a)*32,t.world.height),kind,each*salvagePer,0,true);
      }
    }
  }

  private addPickup(x: number, y: number, kind: Pickup['kind'], value: number, from = 0, mined = false): void {
    const t = this.tune;
    // Keep the planet from filling with pickups: the oldest go first. Gold is never pushed out early.
    if (this.pickups.size >= t.asteroid.pickupsMax) {
      let oldest = 0;
      for (const k of this.pickups.values()) if (k.kind !== 'salvage'||k.mined) { oldest = k.id; break; }
      if (!oldest) oldest=this.pickups.keys().next().value??0;
      if (oldest) {
        this.pickups.delete(oldest);
        this.events.pickupsGone.push({ id: oldest, by: 0 });
      }
    }
    const id = this.nextPickupId;
    this.nextPickupId = this.nextPickupId >= 0xffff ? 1 : this.nextPickupId + 1;
    const life = kind === 'salvage'&&!mined ? t.salvage.goldLifeSeconds : t.asteroid.pickupLifeSeconds;
    const k = { id, x, y, kind, value: Math.round(value * 10) / 10, expires: this.tick + Math.round(life * t.net.tickHz), from, lockedUntil: this.tick + Math.round(t.ship.spillLockSeconds * t.net.tickHz), mined };
    this.pickups.set(id, k);
    this.events.pickups.push({ id, x, y, kind, value: k.value, mined });
  }

  /** Smash an asteroid outright (a ship flew into it): it splits as if this hit had destroyed it. */
  private destroyAsteroid(a: Asteroid, at: { x: number; y: number }, splitDamage: number, dirX: number, dirY: number, pos: Map<number, { x: number; y: number }>, by = 0): void {
    if (a.id === this.tutorialRock?.id) return;
    a.hp = 0;
    this.damageAsteroid(a, at, splitDamage, dirX, dirY, pos, false, by);
  }

  private damageAsteroid(a: Asteroid, at: { x: number; y: number }, damage: number, dirX: number, dirY: number, pos: Map<number, { x: number; y: number }>, mainShot = false, by = 0): void {
    const practice = this.tutorialRock?.id === a.id ? this.tutorialRock : null;
    if (practice && !mainShot) return;
    a.hp -= damage;
    if (a.hp > 0) {
      this.events.asteroids.push({ ...a }); // a copy: the record keeps changing
      return;
    }
    this.asteroids.delete(a.id);
    pos.delete(a.id);
    this.events.gone.push({ id: a.id, x: at.x, y: at.y });
    if (practice) {
      this.tutorialRock = null;
      this.spawnPickup('mineral', at.x, at.y, practice.reward);
      return;
    }
    // Every destroyed asteroid leaves minerals, the one run currency (owner, 19 November 2026);
    // sometimes a health boost as well. More inside the hot zone. Clan home planets
    // also leave fuel for the clan treasury; nowhere else leaves a second cargo.
    const hot = this.inHotZone(at.x, at.y) ? this.tune.hotZone.mineralMultiplier : 1;
    const fuel = this.layout && !this.siege ? this.tune.salvage.perMineral : 0;
    this.spillMinerals(at.x, at.y, this.tune.asteroid.mineralYield[a.size] * (a.rich ? this.tune.asteroid.richMineralFactor : 1), this.tune.asteroid.radius[a.size] * 0.5, 0, fuel, this.tune.asteroid.miningMineralFactor * hot);
    if ((!this.tutorial||this.tutorialMinerals)&&this.rng() < this.tune.asteroid.healthDropChance) this.addPickup(at.x, at.y, 'heal', 0);
    for (const child of splitAsteroid(a, at, dirX, dirY, damage, this.tick, () => this.newAsteroidId(), this.rng, this.tune)) {
      this.asteroids.set(child.id, child);
      pos.set(child.id, { x: child.x, y: child.y });
      this.events.asteroids.push(child);
    }
  }

  /** Keep the planet stocked: add large asteroids, away from ships, until the target mass is reached. */
  /** Tick the next mineral-rich rock may appear (0: none waiting). */
  private richAt = 0;

  /**
   * Mineral-rich asteroids (owner, 17 November 2026): up to asteroid.richMax alive (fragments
   * included), each new one asteroid.richRespawnSeconds after a slot opens, spawned in or just
   * beside the hot zone (it does not follow the zone afterwards).
   */
  private keepRichRocks(): void {
    if (this.tutorial) return;
    const t = this.tune, ta = t.asteroid;
    let rich = 0;
    for (const a of this.asteroids.values()) if (a.rich) rich++;
    if (rich >= ta.richMax || this.hotZone.r <= 0) {
      this.richAt = 0;
      return;
    }
    if (!this.richAt) this.richAt = this.tick + Math.round(ta.richRespawnSeconds * t.net.tickHz);
    if (this.tick < this.richAt) return;
    for (let tries = 0; tries < 12; tries++) {
      const za = this.rng() * Math.PI * 2;
      const zd = Math.sqrt(this.rng()) * this.hotZone.r * 1.2;
      const x = wrap(this.hotZone.x + Math.cos(za) * zd, t.world.width);
      const y = wrap(this.hotZone.y + Math.sin(za) * zd, t.world.height);
      let clear = true;
      for (const s of this.ships.values()) if (Math.hypot(wrapDelta(x, s.x, t.world.width), wrapDelta(y, s.y, t.world.height)) < ta.spawnClearRadius * 0.6) clear = false;
      if (!clear) continue;
      const dir = this.rng() * Math.PI * 2;
      const a: Asteroid = { id: this.newAsteroidId(), size: 0, x, y, vx: Math.cos(dir) * ta.speedMin, vy: Math.sin(dir) * ta.speedMin, t0: this.tick, hp: ta.hp[0] * ta.richHpFactor, family: 0, rich: true };
      a.family = a.id % 3;
      this.asteroids.set(a.id, a);
      this.events.asteroids.push(a);
      this.richAt = 0;
      return;
    }
  }

  private populate(): void {
    if (this.tutorial) return;
    const t = this.tune;
    let mass = 0;
    for (const a of this.asteroids.values()) mass += asteroidMass(a.size);
    let tries = 0;
    while (mass + asteroidMass(0) <= t.asteroid.targetMass && tries++ < 50) {
      // Part of the new rock spawns inside the hot zone, so it is richer.
      const inZone = this.hotZone.r > 0 && this.rng() < t.hotZone.spawnShare;
      const za = this.rng() * Math.PI * 2;
      const zd = Math.sqrt(this.rng()) * this.hotZone.r;
      const x = inZone ? wrap(this.hotZone.x + Math.cos(za) * zd, t.world.width) : this.rng() * t.world.width;
      const y = inZone ? wrap(this.hotZone.y + Math.sin(za) * zd, t.world.height) : this.rng() * t.world.height;
      let clear = true;
      for (const s of this.ships.values()) {
        const dx = wrapDelta(x, s.x, t.world.width);
        const dy = wrapDelta(y, s.y, t.world.height);
        if (dx * dx + dy * dy < t.asteroid.spawnClearRadius ** 2) clear = false;
      }
      // The drop zone stays clear too, so nobody arrives inside a rock.
      const cx = wrapDelta(x, t.world.width / 2, t.world.width);
      const cy = wrapDelta(y, t.world.height / 2, t.world.height);
      if (cx * cx + cy * cy < t.asteroid.spawnClearRadius ** 2) clear = false;
      if (!clear) continue;
      const dir = this.rng() * Math.PI * 2;
      const speed = t.asteroid.speedMin + this.rng() * (t.asteroid.speedMax - t.asteroid.speedMin);
      const a: Asteroid = { id: this.newAsteroidId(), size: 0, x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, t0: this.tick, hp: t.asteroid.hp[0], family: 0 };
      a.family = a.id % 3; // colour family from the id: no extra random draws
      this.asteroids.set(a.id, a);
      this.events.asteroids.push(a);
      mass += asteroidMass(0);
    }
  }
}
