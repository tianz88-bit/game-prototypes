// Everything that happens on a planet besides moving ships: bullets, asteroids, damage and deaths.
// Pure game rules with no networking, so it runs in the Cloudflare room and in Node tests alike.
// The room steps each ship with its input, then calls step() once per tick and sends out the events.
import type { Tune } from './tune';
import { damageScale, maxShield, muzzleShot, newShip, shipRadius, stepShip } from './ship';
import type { AssistTarget, ShipInput, ShipState } from './ship';
import { asteroidMass, asteroidPos, splitAsteroid } from './asteroids';
import type { Asteroid } from './asteroids';
import { wrap, wrapDelta, angleDelta } from './wrap';
import { TURRET_SIDE, turretPosition } from './turrets';
import { SHOP_ITEMS, buy } from './shop';
import { missileLock } from './ordnance';

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
 * Something lying on the planet to fly into: a health boost (heals), or minerals (value points of
 * hull and shield; dropped by asteroids and spilled by damaged or destroyed ships).
 */
export interface Pickup {
  id: number;
  x: number;
  y: number;
  /** heal: repairs; mineral: power (hull); salvage: gold dropped by a destroyed ship (salvage only). */
  kind: 'heal' | 'mineral' | 'salvage';
  value: number;
}

/** The moving hot zone (BRIEF.md): asteroid minerals mined inside it pay hotZone.salvageMultiplier. */
export interface HotZone {
  x: number;
  y: number;
  r: number;
  /** Tick when it moves on. */
  until: number;
}

/** A homing missile or a mine, owned by a ship. Shootable (hp); ships only are its targets. */
export interface Ordnance {
  id: number;
  kind: 'missile' | 'mine';
  owner: number;
  x: number;
  y: number;
  heading: number;
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

export interface WorldEvents {
  /** New asteroids and asteroids whose hp changed. */
  asteroids: Asteroid[];
  /** Asteroids that no longer exist, with where they were. */
  gone: { id: number; x: number; y: number }[];
  shots: ShotEvent[];
  /** Ships destroyed this tick. */
  deaths: DeathEvent[];
  /** Hits on ships: where the hit landed, and whether the shield took it (for the shield effect). */
  hits: { id: number; x: number; y: number; shielded: boolean; hull: boolean }[];
  /** Health boosts dropped, and boosts taken (by = ship id) or expired (by = 0). */
  pickups: Pickup[];
  pickupsGone: { id: number; by: number }[];
  /** Dash rams: who rammed whom, and where they met. */
  rams: { id: number; target: number; x: number; y: number }[];
  /** Missile and mine explosions (r = blast radius), and ordnance shot down (shot: true). */
  blasts: { x: number; y: number; r: number; kind: 'missile' | 'mine'; shot: boolean }[];
  /** Ships that completed their warp run this tick (extracted). The room removes them. */
  extracted: { id: number; x: number; y: number }[];
  /** Set when the hot zone moved this tick. */
  hotZone: HotZone | null;
}

const noEvents = (): WorldEvents => ({ asteroids: [], gone: [], shots: [], deaths: [], hits: [], pickups: [], pickupsGone: [], rams: [], blasts: [], extracted: [], hotZone: null });

export class World {
  tick = 0;
  readonly ships = new Map<number, ShipState>();
  readonly asteroids = new Map<number, Asteroid>();
  private bullets: Bullet[] = [];
  /** Steps of contact immunity left per ship. */
  private grace = new Map<number, number>();
  private nextAsteroidId = 1;
  /** from: the ship that spilled it, which cannot take it back until lockedUntil (a tick). */
  readonly pickups = new Map<number, Pickup & { expires: number; from: number; lockedUntil: number; salvage: number }>();
  /** Ships that are bots: they never earn salvage and drop less (salvage.botDropFactor). Set by the room. */
  readonly botIds = new Set<number>();
  /** Tick each ship dropped in (its spawn protection is the first 2 s). */
  private spawnedAt = new Map<number, number>();
  /**
   * Share of the kill payout (power gold) a kill earns: the room lowers it for repeat kills of the
   * same pilot by the same killer. Default: full.
   */
  payoutFactor: (victim: number, killer: number) => number = () => 1;
  hotZone: HotZone = { x: 0, y: 0, r: 0, until: 0 };
  private nextPickupId = 1;
  /** Turret aim (radians, world) and steps until each can fire again, per ship. */
  private turrets = new Map<number, { angle: number[]; cd: number[] }>();
  readonly ordnance = new Map<number, Ordnance>();
  private nextOrdnanceId = 1;
  /** Where each ship was before its last step, so fast (dashing) ships collide along their path. */
  private prev = new Map<number, { x: number; y: number }>();
  /** Ships whose current dash has already rammed someone. */
  private rammed = new Set<number>();
  /** Tick of the last damage each ship took, for shield regeneration. */
  private lastHit = new Map<number, number>();
  private events: WorldEvents = noEvents();
  private readonly dt: number;
  /** Test servers only (TEST_SHIP_HP): ships take no damage, so a browser check can fly freely. */
  invulnerable = false;

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
    if (spread) return this.placeNewShip(id, this.spreadPoint());
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
    ship.shield = t.ship.maxShield;
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
    for (const [oid, o] of this.ships) if (oid !== id && o.hp > 0) out.push({ x: o.x, y: o.y, ship: true });
    for (const a of this.asteroids.values()) {
      const p = asteroidPos(a, this.tick, this.tune);
      out.push({ x: p.x, y: p.y, ship: false });
    }
    return out;
  }

  /** A shop purchase from ship id (item: index in SHOP_ITEMS). Returns true if it went through. */
  buy(id: number, item: number, tier: number): boolean {
    const s = this.ships.get(id);
    const name = SHOP_ITEMS[item];
    if (!s || !name) return false;
    return buy(s, name, tier, this.tune);
  }

  removeShip(id: number): void {
    this.ships.delete(id);
    this.grace.delete(id);
    this.spawnedAt.delete(id);
    this.botIds.delete(id);
    this.lastHit.delete(id);
    this.turrets.delete(id);
    this.rammed.delete(id);
    this.prev.delete(id);
  }

  /** Advance one ship by one step with the given input, spawning its bullet if it fired. */
  stepShip(id: number, input: ShipInput): void {
    const s = this.ships.get(id);
    if (!s) return;
    const before = s.shots;
    const missilesBefore = s.missileShots;
    const minesBefore = s.mineShots;
    this.prev.set(id, { x: s.x, y: s.y });
    stepShip(s, input, this.dt, this.tune);
    if (s.missileShots !== missilesBefore) this.launchMissile(id, s);
    if (s.mineShots !== minesBefore) this.dropMine(id, s);
    if (s.shots !== before) {
      const shot = muzzleShot(s, this.tune, this.assistTargets(id));
      this.bullets.push({ owner: id, damage: this.tune.weapon.damage * damageScale(s, this.tune), x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy, life: this.tune.weapon.bulletLifeSteps });
      this.events.shots.push({ owner: id, ...shot });
    }
  }

  /** Bullets, collisions and population for this tick. Call after every ship has stepped. */
  step(): void {
    const t = this.tune;
    const W = t.world.width;
    const H = t.world.height;
    this.tick++;
    const pos = new Map<number, { x: number; y: number }>();
    for (const a of this.asteroids.values()) pos.set(a.id, asteroidPos(a, this.tick, t));
    const hits = (x: number, y: number, ox: number, oy: number, r: number): boolean => {
      const dx = wrapDelta(x, ox, W);
      const dy = wrapDelta(y, oy, H);
      return dx * dx + dy * dy <= r * r;
    };

    this.stepTurrets(pos);
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
          this.damageAsteroid(a, p, b.damage, b.vx, b.vy, pos);
          spent = true;
          break;
        }
      }
      if (!spent) {
        // Enemy missiles and mines can be shot down.
        for (const o of this.ordnance.values()) {
          if (o.owner === b.owner) continue;
          const r = o.kind === 'missile' ? t.missile.radius : t.mine.radius;
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
      if (!spent) {
        for (const [id, s] of this.ships) {
          if (id === b.owner || s.hp <= 0) continue;
          if (!hits(b.x, b.y, s.x, s.y, shipRadius(s.hullMax, t) + t.weapon.bulletRadius)) continue;
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
      if (s.hp <= 0 || this.rammed.has(id)) continue;
      const sr = shipRadius(s.hullMax, t);
      for (const [oid, o] of this.ships) {
        if (oid === id || o.hp <= 0) continue;
        const or = shipRadius(o.hullMax, t);
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
        this.damageShip(oid, o, t.ship.dashRamDamage * damageScale(s, t), id, wrap(o.x - dx * or, W), wrap(o.y - dy * or, H));
        this.damageShip(id, s, t.ship.dashRamSelfDamage, oid, wrap(s.x + dx * sr, W), wrap(s.y + dy * sr, H));
        this.events.rams.push({ id, target: oid, x: wrap(s.x + dx * sr, W), y: wrap(s.y + dy * sr, H) });
        break;
      }
    }

    // Ships against asteroids: the ship takes contact damage, the asteroid is smashed and splits, and
    // the two are pushed apart: the ship bounces back, the pieces fly on away from it.
    for (const [id, s] of this.ships) {
      const g = this.grace.get(id) ?? 0;
      if (g > 0) {
        this.grace.set(id, g - 1);
        continue;
      }
      if (s.hp <= 0) continue;
      for (const a of this.asteroids.values()) {
        const p = pos.get(a.id);
        const sr = shipRadius(s.hullMax, t);
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
          this.destroyAsteroid(a, p, t.asteroid.ramDamage, dx, dy, pos);
          break;
        }
        this.damageShip(id, s, t.asteroid.contactDamage[a.size], 0, wrap(s.x + dx * sr, W), wrap(s.y + dy * sr, H));
        s.kx = -dx * t.ship.knockbackSpeed;
        s.ky = -dy * t.ship.knockbackSpeed;
        this.destroyAsteroid(a, p, t.asteroid.ramDamage, dx, dy, pos);
        this.grace.set(id, Math.round(t.ship.contactGraceSeconds * t.net.tickHz));
        break;
      }
    }

    // Pickups: the first ship to touch one takes it; unclaimed ones fade away. A health boost heals a
    // share of the starting hull; minerals add their value to hull and shield, up to the power cap.
    for (const k of this.pickups.values()) {
      let by = 0;
      if (this.tick >= k.expires) by = -1;
      else {
        for (const [id, s] of this.ships) {
          if (s.hp <= 0 || (id === k.from && this.tick < k.lockedUntil)) continue;
          if (!hits(s.x, s.y, k.x, k.y, t.asteroid.pickupRadius + shipRadius(s.hullMax, t))) continue;
          // A health boost repairs (up to the hull maximum).
          if (k.kind === 'heal') s.hp = Math.min(s.hullMax, s.hp + t.ship.maxHp * t.asteroid.healthHealFraction);
          else if (k.kind === 'salvage') s.salvage += k.value;
          else {
            // Minerals repair damage first; the rest grows the hull maximum (power), up to the cap.
            const repair = Math.min(k.value, Math.max(0, s.hullMax - s.hp));
            const grow = Math.min(k.value - repair, Math.max(0, t.ship.powerCap - s.hullMax));
            s.hullMax += grow;
            s.hp += repair + grow;
            s.shield = Math.min(maxShield(s, t), s.shield + k.value);
            // Mined minerals also add salvage (bots never earn it); minerals spilled by ships do not.
            if (!this.botIds.has(id)) s.salvage += k.salvage;
          }
          by = id;
          break;
        }
      }
      if (by !== 0) {
        this.pickups.delete(k.id);
        this.events.pickupsGone.push({ id: k.id, by: Math.max(0, by) });
      }
    }

    // Shields come back after a quiet spell.
    const quiet = Math.round(t.ship.shieldRegenDelaySeconds * t.net.tickHz);
    for (const [id, s] of this.ships) {
      const top = maxShield(s, t);
      if (s.shield > top) s.shield = top;
      if (s.hp <= 0 || s.shield >= top) continue;
      if (this.tick - (this.lastHit.get(id) ?? -Infinity) < quiet) continue;
      s.shield = Math.min(top, s.shield + top * t.ship.shieldRegenPerSecond * this.dt);
    }

    // Warp complete: the ship launches off the planet (extracted), unless destroyed this tick.
    for (const [id, s] of this.ships) {
      if (s.hp > 0 && s.warping && s.warpDist >= t.warp.distance) this.events.extracted.push({ id, x: s.x, y: s.y });
    }

    if (this.tick >= this.hotZone.until) this.moveHotZone();
    if (this.tick % t.net.tickHz === 0) this.populate();
  }

  /**
   * Turrets: each turns toward the nearest enemy ship or asteroid in range (ships first), at a capped
   * rate, and fires once lined up. With nothing in range they swing back to face forward.
   */
  private stepTurrets(pos: Map<number, { x: number; y: number }>): void {
    const t = this.tune;
    const tt = t.turret;
    const W = t.world.width;
    const H = t.world.height;
    for (const [id, s] of this.ships) {
      // No firing in warp mode (brief), turrets included.
      const n = s.hp > 0 && !s.warping ? Math.min(4, s.turrets) : 0;
      if (!n) {
        this.turrets.delete(id);
        continue;
      }
      let st = this.turrets.get(id);
      if (!st) this.turrets.set(id, (st = { angle: [], cd: [] }));
      for (let i = 0; i < n; i++) {
        st.angle[i] ??= s.heading;
        st.cd[i] ??= 0;
        if (st.cd[i] > 0) st.cd[i]--;
        const at = turretPosition(s, i, t);
        // Priority: incoming missiles, then ships, then mines, then asteroids; nearest within a class.
        type Target = { dx: number; dy: number; d: number; prio: number };
        let best = null as Target | null;
        const consider = (x: number, y: number, r: number, prio: number): void => {
          const dx = wrapDelta(x, at.x, W);
          const dy = wrapDelta(y, at.y, H);
          const d = Math.hypot(dx, dy);
          if (d - r > tt.range) return;
          if (!best || prio > best.prio || (prio === best.prio && d < best.d)) best = { dx, dy, d, prio };
        };
        for (const o of this.ordnance.values()) if (o.owner !== id) consider(o.x, o.y, 0, o.kind === 'missile' ? 3 : 1);
        for (const [oid, o] of this.ships) if (oid !== id && o.hp > 0) consider(o.x, o.y, 0, 2);
        for (const a of this.asteroids.values()) {
          const p = pos.get(a.id);
          if (p) consider(p.x, p.y, t.asteroid.radius[a.size], 0);
        }
        const target = best as Target | null;
        const want = target ? Math.atan2(target.dy, target.dx) : s.heading;
        const diff = angleDelta(want, st.angle[i]);
        const step = tt.turnRate * this.dt;
        st.angle[i] = angleDelta(st.angle[i] + Math.max(-step, Math.min(step, diff)), 0);
        if (!target || st.cd[i] > 0 || Math.abs(angleDelta(want, st.angle[i])) > tt.aimTolerance) continue;
        st.cd[i] = tt.fireIntervalSteps;
        const vx = Math.cos(st.angle[i]) * tt.bulletSpeed;
        const vy = Math.sin(st.angle[i]) * tt.bulletSpeed;
        const life = Math.ceil(((tt.range + 60) / tt.bulletSpeed) * t.net.tickHz);
        this.bullets.push({ owner: id, damage: tt.damage, x: at.x, y: at.y, vx, vy, life });
        this.events.shots.push({ owner: id, x: at.x, y: at.y, vx, vy, side: TURRET_SIDE + i });
      }
      st.angle.length = st.cd.length = n;
    }
  }

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
    const tier = Math.max(1, s.missileTier);
    const r = shipRadius(s.hullMax, this.tune) + m.radius;
    const o: Ordnance = {
      id: this.newOrdnanceId(),
      kind: 'missile',
      owner: id,
      x: wrap(s.x + Math.cos(s.heading) * r, this.tune.world.width),
      y: wrap(s.y + Math.sin(s.heading) * r, this.tune.world.height),
      heading: s.heading,
      speed: Math.max(m.launchSpeed, s.speed),
      hp: m.hp,
      life: Math.round(m.lifeSeconds * this.tune.net.tickHz),
      armAt: this.tick,
      target: missileLock(id, s, this.ships, this.tune),
      damage: m.damage + m.damagePerTier * (tier - 1),
      blast: 0,
      turn: m.turnRate + m.turnPerTier * (tier - 1),
    };
    this.ordnance.set(o.id, o);
  }

  /** A mine dropped behind ship id; it arms after armSeconds. Oldest goes when over maxActive. */
  private dropMine(id: number, s: ShipState): void {
    const t = this.tune;
    const mn = t.mine;
    const tier = Math.max(1, s.mineTier);
    const mine = [...this.ordnance.values()].filter((o) => o.owner === id && o.kind === 'mine');
    if (mine.length >= mn.maxActive) this.ordnance.delete(mine[0].id);
    const r = shipRadius(s.hullMax, t) + mn.radius + 6;
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
        const target = o.target ? this.ships.get(o.target) : undefined;
        if (target && target.hp > 0) {
          const r = rel(o, target.x, target.y);
          const want = Math.atan2(r.dy, r.dx);
          const step = o.turn * dt;
          o.heading = angleDelta(o.heading + Math.max(-step, Math.min(step, angleDelta(want, o.heading))), 0);
        }
        o.speed = Math.min(t.missile.maxSpeed, o.speed + t.missile.acceleration * dt);
        const px = o.x;
        const py = o.y;
        o.x = wrap(o.x + Math.cos(o.heading) * o.speed * dt, W);
        o.y = wrap(o.y + Math.sin(o.heading) * o.speed * dt, H);
        let hit = false;
        for (const [sid, s] of this.ships) {
          if (sid === o.owner || s.hp <= 0) continue;
          // Swept: a fast missile cannot skip through a ship between ticks.
          const ex = wrapDelta(o.x, px, W);
          const ey = wrapDelta(o.y, py, H);
          const tx = wrapDelta(s.x, px, W);
          const ty = wrapDelta(s.y, py, H);
          const len2 = ex * ex + ey * ey;
          const k = len2 > 0 ? Math.max(0, Math.min(1, (tx * ex + ty * ey) / len2)) : 0;
          const rr = shipRadius(s.hullMax, t) + t.missile.radius;
          if ((tx - ex * k) ** 2 + (ty - ey * k) ** 2 > rr * rr) continue;
          this.damageShip(sid, s, o.damage, o.owner, o.x, o.y);
          hit = true;
          break;
        }
        if (!hit) {
          for (const a of this.asteroids.values()) {
            const p = pos.get(a.id);
            if (!p || rel(o, p.x, p.y).d > t.asteroid.radius[a.size] + t.missile.radius) continue;
            this.damageAsteroid(a, p, o.damage, Math.cos(o.heading), Math.sin(o.heading), pos);
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
        if (sid === o.owner || s.hp <= 0) continue;
        const r = rel(o, s.x, s.y);
        if (r.d <= t.mine.seekRange && (!near || r.d < near.d)) near = { s, ...r };
      }
      if (!near) continue;
      if (near.d <= t.mine.triggerRadius + shipRadius(near.s.hullMax, t)) {
        this.ordnance.delete(o.id);
        this.events.blasts.push({ x: o.x, y: o.y, r: o.blast, kind: 'mine', shot: false });
        for (const [sid, s] of this.ships) {
          if (sid === o.owner || s.hp <= 0) continue;
          const d = rel(o, s.x, s.y).d - shipRadius(s.hullMax, t);
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
  private newAsteroidId(): number {
    for (;;) {
      const id = this.nextAsteroidId;
      this.nextAsteroidId = this.nextAsteroidId >= 0xffff ? 1 : this.nextAsteroidId + 1;
      if (!this.asteroids.has(id)) return id;
    }
  }

  /** Events since the last call. */
  drain(): WorldEvents {
    const e = this.events;
    this.events = noEvents();
    return e;
  }

  /** The shield takes damage first; what it cannot hold goes to the hull. */
  private damageShip(id: number, s: ShipState, damage: number, attacker: number, atX: number, atY: number): void {
    if (s.hp <= 0) return;
    this.lastHit.set(id, this.tick);
    // Any damage in warp mode resets the warp distance (brief); warp mode itself continues.
    if (s.warping && damage > 0) s.warpDist = 0;
    this.events.hits.push({ id, x: atX, y: atY, shielded: s.shield > 0, hull: !this.invulnerable && damage > s.shield });
    if (this.invulnerable) return;
    const absorbed = Math.min(s.shield, damage);
    s.shield -= absorbed;
    const before = s.hp;
    s.hp = Math.max(0, s.hp - (damage - absorbed));
    // Hull is minerals: some of what is knocked off spills where the ship is, for anyone to collect.
    // A destroyed ship loses everything and spills a share of all it carried.
    const t = this.tune;
    // Destroyed: a share of everything carried (the hull maximum) spills.
    const spill = s.hp === 0 ? s.hullMax * t.ship.deathSpillFraction : (before - s.hp) * t.ship.hullSpillFraction;
    this.spillMinerals(s.x, s.y, spill, s.hp === 0 ? 90 : 40, id);
    if (s.hp === 0) {
      // Gold (BRIEF.md): everything the ship carried, plus a share of its power above the start as
      // the kill payout. No power gold from a ship still in its spawn protection; less for repeat
      // kills of the same pilot (payoutFactor); bots carry no salvage and drop a reduced share.
      const sv = t.salvage;
      const fresh = this.tick - (this.spawnedAt.get(id) ?? -Infinity) <= 2 * t.net.tickHz;
      let payout = fresh ? 0 : sv.killPowerShare * Math.max(0, s.hullMax - t.ship.maxHp) * this.payoutFactor(id, attacker);
      if (this.botIds.has(id)) payout *= sv.botDropFactor;
      this.dropGold(s.x, s.y, s.salvage + payout, id);
      s.salvage = 0;
      this.events.deaths.push({ id, x: s.x, y: s.y, killer: attacker });
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
  private spillMinerals(x: number, y: number, value: number, reach: number, from = 0, salvagePer = 0): void {
    const t = this.tune;
    if (value < 1) return;
    const chunks = Math.min(t.asteroid.mineralChunksMax, Math.ceil(value / t.asteroid.mineralChunkValue));
    const each = value / chunks;
    for (let i = 0; i < chunks; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = (chunks === 1 ? 0 : 0.4 + this.rng() * 0.6) * reach;
      this.addPickup(wrap(x + Math.cos(a) * d, t.world.width), wrap(y + Math.sin(a) * d, t.world.height), 'mineral', each, from, each * salvagePer);
    }
  }

  private addPickup(x: number, y: number, kind: Pickup['kind'], value: number, from = 0, salvage = 0): void {
    const t = this.tune;
    // Keep the planet from filling with pickups: the oldest go first. Gold is never pushed out early.
    if (this.pickups.size >= t.asteroid.pickupsMax) {
      let oldest = 0;
      for (const k of this.pickups.values()) if (k.kind !== 'salvage') { oldest = k.id; break; }
      if (oldest) {
        this.pickups.delete(oldest);
        this.events.pickupsGone.push({ id: oldest, by: 0 });
      }
    }
    const id = this.nextPickupId;
    this.nextPickupId = this.nextPickupId >= 0xffff ? 1 : this.nextPickupId + 1;
    const life = kind === 'salvage' ? t.salvage.goldLifeSeconds : t.asteroid.pickupLifeSeconds;
    const k = { id, x, y, kind, value: Math.round(value * 10) / 10, expires: this.tick + Math.round(life * t.net.tickHz), from, lockedUntil: this.tick + Math.round(t.ship.spillLockSeconds * t.net.tickHz), salvage };
    this.pickups.set(id, k);
    this.events.pickups.push({ id, x, y, kind, value: k.value });
  }

  /** Smash an asteroid outright (a ship flew into it): it splits as if this hit had destroyed it. */
  private destroyAsteroid(a: Asteroid, at: { x: number; y: number }, splitDamage: number, dirX: number, dirY: number, pos: Map<number, { x: number; y: number }>): void {
    a.hp = 0;
    this.damageAsteroid(a, at, splitDamage, dirX, dirY, pos);
  }

  private damageAsteroid(a: Asteroid, at: { x: number; y: number }, damage: number, dirX: number, dirY: number, pos: Map<number, { x: number; y: number }>): void {
    a.hp -= damage;
    if (a.hp > 0) {
      this.events.asteroids.push({ ...a }); // a copy: the record keeps changing
      return;
    }
    this.asteroids.delete(a.id);
    pos.delete(a.id);
    this.events.gone.push({ id: a.id, x: at.x, y: at.y });
    // Every destroyed asteroid leaves minerals; sometimes a health boost as well.
    // Mined minerals carry salvage too: salvage.perMineral each, more inside the hot zone.
    const per = this.tune.salvage.perMineral * (this.inHotZone(at.x, at.y) ? this.tune.hotZone.salvageMultiplier : 1);
    this.spillMinerals(at.x, at.y, this.tune.asteroid.mineralYield[a.size], this.tune.asteroid.radius[a.size] * 0.5, 0, per);
    if (this.rng() < this.tune.asteroid.healthDropChance) this.addPickup(at.x, at.y, 'heal', 0);
    for (const child of splitAsteroid(a, at, dirX, dirY, damage, this.tick, () => this.newAsteroidId(), this.rng, this.tune)) {
      this.asteroids.set(child.id, child);
      pos.set(child.id, { x: child.x, y: child.y });
      this.events.asteroids.push(child);
    }
  }

  /** Keep the planet stocked: add large asteroids, away from ships, until the target mass is reached. */
  private populate(): void {
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
      const a: Asteroid = { id: this.newAsteroidId(), size: 0, x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, t0: this.tick, hp: t.asteroid.hp[0] };
      this.asteroids.set(a.id, a);
      this.events.asteroids.push(a);
      mass += asteroidMass(0);
    }
  }
}
