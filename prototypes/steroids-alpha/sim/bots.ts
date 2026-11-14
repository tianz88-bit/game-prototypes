// AI pilots (owner request: bots on Planet A). Pure decision rules: each tick, given the world, a bot
// produces the same ShipInput a player would send, plus an optional shop purchase. The server runs
// them; nothing here touches the network.
//
// Bots are beatable by playing worse, not by weaker stats (owner, 14 November 2026): they only see
// a screen's worth around them and take a moment to react to a newcomer; they read a target's
// position a few times a second and aim where it was (weaving makes them miss); they lose interest
// after a while and wander off to mine; only one bot hunts a pilot at a time; guns fire in bursts
// that respect overheat; a badly hurt bot runs.
import type { Tune } from './tune';
import type { ShipInput, ShipState } from './ship';
import { topSpeed } from './ship';
import { asteroidPos } from './asteroids';
import type { World } from './world';
import { angleDelta, wrapDelta } from './wrap';
import { SHOP_ITEMS, canBuy, shopTier } from './shop';

export const BOT_NAMES = ['Vega', 'Orion', 'Lyra', 'Draco', 'Nova', 'Cygnus', 'Rigel', 'Altair'];

/** What a bot remembers between ticks. */
export interface BotBrain {
  /** Current aim error (radians), drifting slowly so shots wobble around the target. */
  aimError: number;
  /** Holding fire until the guns cool after a burst. */
  cooling: boolean;
  /** Wander heading when there is nothing to do. */
  wander: number;
  /** Next shop item to try (round robin). */
  nextBuy: number;
  /** The ship it is after (0: none), when it first noticed it and when it can react. */
  target: number;
  reactAt: number;
  engagedSince: number;
  /** Ignoring fights until this tick (bored of the last one). */
  distractedUntil: number;
  /** Where it last read its target to be, and how it was moving (aim uses this, not the truth). */
  seen: { x: number; y: number; vx: number; vy: number; at: number } | null;
}

export function newBrain(rng: () => number): BotBrain {
  return { aimError: 0, cooling: false, wander: rng() * Math.PI * 2, nextBuy: Math.floor(rng() * 3), target: 0, reactAt: 0, engagedSince: 0, distractedUntil: 0, seen: null };
}

const idleInput = (): ShipInput => ({ seq: 0, turn: 0, aim: NaN, thrust: 0, dash: false, fire: false, dashAim: NaN, missile: false, mine: false, warp: false });

/** One tick of decisions for bot id. */
export function botThink(id: number, s: ShipState, world: World, brain: BotBrain, tune: Tune, rng: () => number, others: readonly BotBrain[] = []): { input: ShipInput; buy: { item: number; tier: number } | null } {
  const t = tune.bots;
  const W = tune.world.width;
  const H = tune.world.height;
  const input = idleInput();
  const rel = (x: number, y: number): { dx: number; dy: number; d: number } => {
    const dx = wrapDelta(x, s.x, W);
    const dy = wrapDelta(y, s.y, H);
    return { dx, dy, d: Math.hypot(dx, dy) };
  };
  brain.aimError = Math.max(-1, Math.min(1, brain.aimError + (rng() - 0.5) * 0.3)) ;
  const wobble = brain.aimError * ((t.aimErrorDeg * Math.PI) / 180);

  // Who it can see: ships within a screen's worth, not already hunted by enough other bots.
  const tick = world.tick;
  const hz = tune.net.tickHz;
  const hunted = (oid: number): number => others.filter((b) => b !== brain && b.target === oid).length;
  let enemy: { id: number; s: ShipState; dx: number; dy: number; d: number } | null = null;
  if (tick >= brain.distractedUntil) {
    for (const [oid, o] of world.ships) {
      if (oid === id || o.hp <= 0) continue;
      const r = rel(o.x, o.y);
      if (r.d > t.sightRange || (oid !== brain.target && hunted(oid) >= t.maxBotsPerTarget)) continue;
      // Stick with the current target while it stays in sight.
      if (!enemy || oid === brain.target || (enemy.id !== brain.target && r.d < enemy.d)) enemy = { id: oid, s: o, ...r };
    }
  }
  if (!enemy) {
    brain.target = 0;
    brain.seen = null;
  } else if (enemy.id !== brain.target) {
    // A newcomer: it takes a moment to notice and react.
    brain.target = enemy.id;
    brain.reactAt = tick + Math.round((t.reactionSeconds + (rng() * 2 - 1) * t.reactionJitterSeconds) * hz);
    brain.engagedSince = brain.reactAt;
    brain.seen = null;
  }
  // Bored of a fight that goes on too long: off to do something else for a while.
  if (enemy && tick - brain.engagedSince > t.attentionSeconds * hz) {
    brain.distractedUntil = tick + Math.round(t.distractedSeconds * hz);
    brain.target = 0;
    brain.seen = null;
    enemy = null;
  }
  // Reading the target: a few times a second; between reads it aims at the old picture.
  if (enemy && (!brain.seen || tick - brain.seen.at >= t.perceptionSeconds * hz)) {
    brain.seen = { x: enemy.s.x, y: enemy.s.y, vx: Math.cos(enemy.s.heading) * enemy.s.speed, vy: Math.sin(enemy.s.heading) * enemy.s.speed, at: tick };
  }
  const reacting = !!enemy && tick < brain.reactAt;

  // Shop: now and then, buy the next affordable upgrade.
  let buy: { item: number; tier: number } | null = null;
  if (rng() < 0.02) {
    for (let k = 0; k < SHOP_ITEMS.length && !buy; k++) {
      const item = (brain.nextBuy + k) % SHOP_ITEMS.length;
      const name = SHOP_ITEMS[item];
      if (canBuy(s, name, tune)) {
        buy = { item, tier: shopTier(s, name) };
        brain.nextBuy = (item + 1) % SHOP_ITEMS.length;
      }
    }
  }

  // Guns in bursts: stop near the heat limit, wait until they cool.
  if (s.heat >= t.burstHeat) brain.cooling = true;
  if (brain.cooling && s.heat <= t.resumeHeat) brain.cooling = false;
  const mayFire = !brain.cooling && !s.overheated;

  const hurt = s.hp < s.hullMax * t.fleeHullFraction;
  if (enemy && hurt && !reacting) {
    // Run: straight away from the threat, flat out, dashing when possible.
    const away = Math.atan2(-enemy.dy, -enemy.dx);
    input.aim = away;
    input.thrust = 1;
    if (s.dashCd <= 0 && rng() < 0.05) {
      input.dash = true;
      input.dashAim = away;
    }
    if (s.dashCharge > 0) input.dashAim = away;
    // Mines behind it for whoever is chasing.
    input.mine = s.mineCharges > 0 && enemy.d < 400 && rng() < 0.05;
    return { input, buy };
  }

  if (enemy && !reacting && brain.seen) {
    // Lead where it last saw the target, by the bullet's flight time, plus a wobble.
    const seen = rel(brain.seen.x, brain.seen.y);
    const flight = seen.d / tune.weapon.bulletSpeed;
    const lx = seen.dx + brain.seen.vx * flight;
    const ly = seen.dy + brain.seen.vy * flight;
    const aim = Math.atan2(ly, lx) + wobble;
    input.aim = aim;
    input.thrust = enemy.d > t.preferredRange ? 1 : -0.5;
    const off = Math.abs(angleDelta(aim, s.heading));
    input.fire = mayFire && off < (t.fireConeDeg * Math.PI) / 180 && enemy.d < tune.weapon.assistRange;
    // A missile when the target is in the lock cone.
    input.missile = s.missileCharges > 0 && off < (tune.missile.lockConeDeg * Math.PI) / 360 && enemy.d < tune.missile.lockRange && rng() < 0.04;
    // A dash to close in (or ram) when lined up at middle range.
    if (s.dashCd <= 0 && off < 0.3 && enemy.d > 250 && enemy.d < 600 && rng() < 0.03) {
      input.dash = true;
      input.dashAim = Math.atan2(enemy.dy, enemy.dx);
    }
    if (s.dashCharge > 0) input.dashAim = Math.atan2(enemy.dy, enemy.dx);
    return { input, buy };
  }

  // Nothing to fight: collect minerals nearby, else shoot the nearest rock, else wander.
  let pick: { dx: number; dy: number; d: number } | null = null;
  for (const k of world.pickups.values()) {
    if (k.kind !== 'mineral' || (k.from === id && world.tick < k.lockedUntil)) continue;
    const r = rel(k.x, k.y);
    if (r.d < t.collectRange && (!pick || r.d < pick.d)) pick = r;
  }
  let rock: { dx: number; dy: number; d: number; r: number } | null = null;
  for (const a of world.asteroids.values()) {
    const p = asteroidPos(a, world.tick, tune);
    const r = rel(p.x, p.y);
    if (!rock || r.d < rock.d) rock = { ...r, r: tune.asteroid.radius[a.size] };
  }
  if (rock && rock.d - rock.r < 140) {
    // Too close to a rock: veer off it (rams hurt).
    input.aim = Math.atan2(rock.dy, rock.dx) + Math.PI * 0.6;
    input.thrust = 1;
    input.fire = false;
    return { input, buy };
  }
  if (pick) {
    input.aim = Math.atan2(pick.dy, pick.dx);
    input.thrust = 1;
    return { input, buy };
  }
  if (rock && rock.d < t.engageRange) {
    const aim = Math.atan2(rock.dy, rock.dx) + wobble * 0.5;
    input.aim = aim;
    input.thrust = rock.d - rock.r > 320 ? 0.6 : -1;
    input.fire = mayFire && Math.abs(angleDelta(aim, s.heading)) < 0.25;
    return { input, buy };
  }
  brain.wander += (rng() - 0.5) * 0.1;
  input.aim = brain.wander;
  input.thrust = s.speed < topSpeed(s.hullMax, tune, s.chassis) * 0.8 ? 0.5 : 0;
  return { input, buy };
}
