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

export interface WorldEvents {
  /** New asteroids and asteroids whose hp changed. */
  asteroids: Asteroid[];
  /** Asteroids that no longer exist, with where they were. */
  gone: { id: number; x: number; y: number }[];
  shots: ShotEvent[];
  /** Ships destroyed this tick. */
  deaths: number[];
}

export class World {
  tick = 0;
  readonly ships = new Map<number, ShipState>();
  readonly asteroids = new Map<number, Asteroid>();
  private bullets: Bullet[] = [];
  /** Steps of contact immunity left per ship. */
  private grace = new Map<number, number>();
  private nextAsteroidId = 1;
  private events: WorldEvents = { asteroids: [], gone: [], shots: [], deaths: [] };
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
    this.ships.set(id, ship);
    // A moment of immunity so nobody is destroyed by an asteroid drifting through the drop zone.
    this.grace.set(id, Math.round(2 * t.net.tickHz));
    return ship;
  }

  removeShip(id: number): void {
    this.ships.delete(id);
    this.grace.delete(id);
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
          this.damageShip(id, s, t.weapon.damage);
          spent = true;
          break;
        }
      }
      if (!spent) kept.push(b);
    }
    this.bullets = kept;

    // Ships against asteroids: the ship takes contact damage and the asteroid is rammed.
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
        this.damageShip(id, s, t.asteroid.contactDamage[a.size]);
        this.damageAsteroid(a, p, t.asteroid.ramDamage, Math.cos(s.heading), Math.sin(s.heading), pos);
        this.grace.set(id, Math.round(t.ship.contactGraceSeconds * t.net.tickHz));
        break;
      }
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
    this.events = { asteroids: [], gone: [], shots: [], deaths: [] };
    return e;
  }

  private damageShip(id: number, s: ShipState, damage: number): void {
    s.hp = Math.max(0, s.hp - damage);
    if (s.hp === 0) this.events.deaths.push(id);
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
