// Everything that happens on a planet besides moving ships: bullets, asteroids, damage and deaths.
// Pure game rules with no networking, so it runs in the Cloudflare room and in Node tests alike.
// The room steps each ship with its input, then calls step() once per tick and sends out the events.
import type { Tune } from './tune';
import { muzzleShot, newShip, stepShip } from './ship';
import type { ShipInput, ShipState } from './ship';
import { asteroidMass, asteroidPos, splitAsteroid } from './asteroids';
import type { Asteroid } from './asteroids';
import { wrap, wrapDelta } from './wrap';

interface Bullet {
  owner: number;
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

/** A health boost lying on the planet. */
export interface Pickup {
  id: number;
  x: number;
  y: number;
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
  hits: { id: number; x: number; y: number; shielded: boolean }[];
  /** Health boosts dropped, and boosts taken (by = ship id) or expired (by = 0). */
  pickups: Pickup[];
  pickupsGone: { id: number; by: number }[];
}

const noEvents = (): WorldEvents => ({ asteroids: [], gone: [], shots: [], deaths: [], hits: [], pickups: [], pickupsGone: [] });

export class World {
  tick = 0;
  readonly ships = new Map<number, ShipState>();
  readonly asteroids = new Map<number, Asteroid>();
  private bullets: Bullet[] = [];
  /** Steps of contact immunity left per ship. */
  private grace = new Map<number, number>();
  private nextAsteroidId = 1;
  readonly pickups = new Map<number, Pickup & { expires: number }>();
  private nextPickupId = 1;
  /** Tick of the last damage each ship took, for shield regeneration. */
  private lastHit = new Map<number, number>();
  private events: WorldEvents = noEvents();
  private readonly dt: number;

  constructor(
    private readonly tune: Tune,
    private readonly rng: () => number = Math.random,
  ) {
    this.dt = 1 / tune.net.tickHz;
    this.populate();
  }

  addShip(id: number): ShipState {
    const t = this.tune;
    // Everyone drops in near the map centre for now; real spawn points come with loot.
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
    const ship = newShip(best.x, best.y, this.rng() * Math.PI * 2 - Math.PI, t.ship.cruiseSpeed);
    ship.hp = t.ship.maxHp;
    ship.shield = t.ship.maxShield;
    this.ships.set(id, ship);
    // A moment of immunity so nobody is destroyed by an asteroid drifting through the drop zone.
    this.grace.set(id, Math.round(2 * t.net.tickHz));
    return ship;
  }

  removeShip(id: number): void {
    this.ships.delete(id);
    this.grace.delete(id);
    this.lastHit.delete(id);
  }

  /** Advance one ship by one step with the given input, spawning its bullet if it fired. */
  stepShip(id: number, input: ShipInput): void {
    const s = this.ships.get(id);
    if (!s) return;
    const before = s.shots;
    stepShip(s, input, this.dt, this.tune);
    if (s.shots !== before) {
      const shot = muzzleShot(s, this.tune);
      this.bullets.push({ owner: id, x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy, life: this.tune.weapon.bulletLifeSteps });
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
          this.damageAsteroid(a, p, t.weapon.damage, b.vx, b.vy, pos);
          spent = true;
          break;
        }
      }
      if (!spent) {
        for (const [id, s] of this.ships) {
          if (id === b.owner || s.hp <= 0) continue;
          if (!hits(b.x, b.y, s.x, s.y, t.ship.radius + t.weapon.bulletRadius)) continue;
          this.damageShip(id, s, t.weapon.damage, b.owner, b.x, b.y);
          spent = true;
          break;
        }
      }
      if (!spent) kept.push(b);
    }
    this.bullets = kept;

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
        if (!p || !hits(s.x, s.y, p.x, p.y, t.asteroid.radius[a.size] + t.ship.radius)) continue;
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
        this.damageShip(id, s, t.asteroid.contactDamage[a.size], 0, wrap(s.x + dx * t.ship.radius, W), wrap(s.y + dy * t.ship.radius, H));
        s.kx = -dx * t.ship.knockbackSpeed;
        s.ky = -dy * t.ship.knockbackSpeed;
        this.destroyAsteroid(a, p, t.asteroid.ramDamage, dx, dy, pos);
        this.grace.set(id, Math.round(t.ship.contactGraceSeconds * t.net.tickHz));
        break;
      }
    }

    // Health boosts: the first ship to touch one is healed; unclaimed ones fade away.
    for (const k of this.pickups.values()) {
      let by = 0;
      if (this.tick >= k.expires) by = -1;
      else {
        for (const [id, s] of this.ships) {
          if (s.hp <= 0 || !hits(s.x, s.y, k.x, k.y, t.asteroid.pickupRadius + t.ship.radius)) continue;
          s.hp = Math.min(t.ship.maxHp, s.hp + t.ship.maxHp * t.asteroid.healthHealFraction);
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
      if (s.hp <= 0 || s.shield >= t.ship.maxShield) continue;
      if (this.tick - (this.lastHit.get(id) ?? -Infinity) < quiet) continue;
      s.shield = Math.min(t.ship.maxShield, s.shield + t.ship.maxShield * t.ship.shieldRegenPerSecond * this.dt);
    }

    if (this.tick % t.net.tickHz === 0) this.populate();
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
    this.events.hits.push({ id, x: atX, y: atY, shielded: s.shield > 0 });
    const absorbed = Math.min(s.shield, damage);
    s.shield -= absorbed;
    s.hp = Math.max(0, s.hp - (damage - absorbed));
    if (s.hp === 0) this.events.deaths.push({ id, x: s.x, y: s.y, killer: attacker });
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
    if (this.rng() < this.tune.asteroid.healthDropChance) {
      const k = { id: this.nextPickupId, x: at.x, y: at.y, expires: this.tick + Math.round(this.tune.asteroid.pickupLifeSeconds * this.tune.net.tickHz) };
      this.nextPickupId = this.nextPickupId >= 0xffff ? 1 : this.nextPickupId + 1;
      this.pickups.set(k.id, k);
      this.events.pickups.push({ id: k.id, x: k.x, y: k.y });
    }
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
      const x = this.rng() * t.world.width;
      const y = this.rng() * t.world.height;
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
