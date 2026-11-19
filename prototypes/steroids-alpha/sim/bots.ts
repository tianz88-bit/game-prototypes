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
import { topSpeed, shipVelocity, hullCapacity } from './ship';
import { asteroidPos } from './asteroids';
import type { World } from './world';
import type { BaseLayout } from './clanBase';
import { angleDelta, wrapDelta } from './wrap';
import { SHOP_ITEMS, EVOLVE_ITEM, canBuy, canEvolve, shopTier } from './shop';

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
  /** World tick it dropped in (the room sets it): bots warp out after bots.warpAfterSeconds. */
  bornAt: number;
  /** Commit to a short fly-by exit instead of steering straight into another hull. */
  peelUntil: number;
  peelHeading: number;
  /** Tutorial planet only: a scripted practice pilot (sim/bots.ts tutorialBotThink). */
  tutorial?: TutorialBotKind;
}

/**
 * Tutorial practice pilots (owner, 16 November 2026: "really really noob"). drone: drifts slowly and
 * never shoots. chaser: follows the nearest player at a distance and never shoots (mine practice).
 * noob: fights back badly: slow, wide aim error, rare short bursts, no dash, missiles or mines.
 */
export type TutorialBotKind = 'drone' | 'chaser' | 'noob' | 'target';

export function newBrain(rng: () => number): BotBrain {
  return { aimError: 0, cooling: false, wander: rng() * Math.PI * 2, nextBuy: Math.floor(rng() * 3), target: 0, reactAt: 0, engagedSince: 0, distractedUntil: 0, seen: null, bornAt: 0, peelUntil: 0, peelHeading: 0 };
}

const idleInput = (): ShipInput => ({ seq: 0, turn: 0, aim: NaN, thrust: 0, dash: false, fire: false, missile: false, mine: false, warp: false });

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
  // Siege (owner, 16 November 2026): at war, bots fight the other clan only; attackers go for the
  // base (turrets, then the shield, then the treasury), defenders guard it from outside the shield.
  // Sides hold through the short round-over pause too.
  const war = (world.atWar || world.siege?.phase === 'over') && world.layout ? world.layout : null;
  const myClan = world.clanOf.get(id) ?? 0;
  const defending = !!war && myClan === war.clan;
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
      if (war && (world.clanOf.get(oid) ?? 0) === myClan) continue;
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
  if (!war && enemy && tick - brain.engagedSince > t.attentionSeconds * hz) {
    brain.distractedUntil = tick + Math.round(t.distractedSeconds * hz);
    brain.target = 0;
    brain.seen = null;
    enemy = null;
  }
  // Reading the target: a few times a second; between reads it aims at the old picture.
  if (enemy && (!brain.seen || tick - brain.seen.at >= t.perceptionSeconds * hz)) {
    brain.seen = { x: enemy.s.x, y: enemy.s.y, ...shipVelocity(enemy.s), at: tick };
  }
  const reacting = !!enemy && tick < brain.reactAt;

  // Shop: now and then, buy the next affordable upgrade.
  // Bots leave like players do (owner, 15 November 2026): strong enough (bots.warpPower) or long
  // enough on the planet (bots.warpAfterSeconds), a bot warps out once its lockdown is over and a
  // fresh one replaces it, so no bot snowballs forever. While warping it just flies on (warp mode
  // limits steering and firing anyway); damage resets its warp as for anyone.
  if (s.warping) {
    input.thrust = 1;
    return { input, buy: null };
  }
  const leaving = !war && s.hullMax >= t.warpPower || tick - brain.bornAt >= t.warpAfterSeconds * hz;
  if (leaving && s.lockdown <= 0) {
    input.warp = true;
    input.thrust = 1;
    return { input, buy: null };
  }

  let buy: { item: number; tier: number } | null = null;
  // Evolve into the Battlecruiser as soon as it qualifies (owner: bots should know how).
  if (canEvolve(s, tune) && rng() < 0.05) buy = { item: EVOLVE_ITEM, tier: 0 };
  else if (rng() < 0.02) {
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

  // Attackers respawn at once at the gate, so they press on instead of running.
  const hurt = !(war && !defending) && s.hp < hullCapacity(s,tune) * t.fleeHullFraction;
  if (enemy && hurt && !reacting) {
    // Run: straight away from the threat, flat out, dashing when possible.
    const away = Math.atan2(-enemy.dy, -enemy.dx);
    input.aim = away;
    input.thrust = 1;
    // Dashes go straight ahead, so only once it faces away.
    if (s.dashCd <= 0 && Math.abs(angleDelta(away, s.heading)) < 0.4 && rng() < 0.05) input.dash = true;
    // Mines behind it for whoever is chasing.
    input.mine = s.mineCharges > 0 && enemy.d < 400 && rng() < 0.05;
    return { input, buy };
  }

  // Ordinary encounters use readable attack passes; siege attackers keep their existing commitment.
  if (!war && tick < brain.peelUntil) {
    input.aim = brain.peelHeading; input.thrust = 1;
    return { input, buy };
  }

  if (enemy && !reacting && brain.seen) {
    // Lead where it last saw the target, by the bullet's flight time, plus a wobble.
    const seen = rel(brain.seen.x, brain.seen.y);
    const flight = seen.d / tune.weapon.bulletSpeed;
    const lx = seen.dx + brain.seen.vx * flight;
    const ly = seen.dy + brain.seen.vy * flight;
    const aim = Math.atan2(ly, lx) + wobble;
    if (!war && enemy.d < t.preferredRange + 40) {
      brain.peelHeading = aim + (id % 2 ? 1 : -1) * Math.PI * .65;
      brain.peelUntil = tick + Math.round(1.2 * hz);
      input.aim = brain.peelHeading; input.thrust = 1;
      return { input, buy };
    }
    input.aim = aim;
    input.thrust = enemy.d > t.preferredRange ? 1 : -0.5;
    const off = Math.abs(angleDelta(aim, s.heading));
    input.fire = mayFire && off < (t.fireConeDeg * Math.PI) / 180 && enemy.d < tune.weapon.assistRange;
    // A missile when the target is in the lock cone.
    input.missile = s.missileCharges > 0 && off < (tune.missile.lockConeDeg * Math.PI) / 360 && enemy.d < tune.missile.lockRange && rng() < 0.04;
    // A dash to close in (or ram) when lined up at middle range.
    if (s.dashCd <= 0 && off < 0.3 && enemy.d > 250 && enemy.d < 600 && rng() < 0.03) input.dash = true;
    return { input, buy };
  }

  if (war) {
    // Minerals spilled nearby (from destroyed ships or rocks) are worth a short detour: power moves to
    // whoever cleans up after a fight (owner, 16 November 2026).
    let spill: { dx: number; dy: number; d: number } | null = null;
    for (const k of world.pickups.values()) {
      if (k.kind !== 'mineral' || (k.from === id && world.tick < k.lockedUntil)) continue;
      const r = rel(k.x, k.y);
      if (r.d < 320 && (!spill || r.d < spill.d)) spill = r;
    }
    if (spill) {
      input.aim = Math.atan2(spill.dy, spill.dx);
      input.thrust = 1;
      return { input, buy };
    }
    const siege = siegeGoal(s, world, war, defending, tune, rel);
    if (siege) {
      const avoid = nearestRock(s, world, tune, rel);
      if (avoid && avoid.d - avoid.r < 140) {
        input.aim = Math.atan2(avoid.dy, avoid.dx) + Math.PI * 0.6;
        input.thrust = 1;
        return { input, buy };
      }
      const g = siege;
      const aimAt = Math.atan2(g.dy, g.dx) + wobble * 0.5;
      if (g.d < g.standoff) {
        // Too close: swing round (ships never stop), holding fire until lined up again.
        input.aim = aimAt + Math.PI / 2;
        input.thrust = -1;
      } else {
        input.aim = aimAt;
        input.thrust = g.d > g.standoff + 150 ? 1 : 0;
        input.fire = g.shoot && mayFire && Math.abs(angleDelta(aimAt, s.heading)) < (t.fireConeDeg * Math.PI) / 180 && g.d < tune.weapon.assistRange;
      }
      return { input, buy };
    }
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

type Rel = (x: number, y: number) => { dx: number; dy: number; d: number };

function nearestRock(s: ShipState, world: World, tune: Tune, rel: Rel): { dx: number; dy: number; d: number; r: number } | null {
  let rock: { dx: number; dy: number; d: number; r: number } | null = null;
  for (const a of world.asteroids.values()) {
    const p = asteroidPos(a, world.tick, tune);
    const r = rel(p.x, p.y);
    if (!rock || r.d < rock.d) rock = { ...r, r: tune.asteroid.radius[a.size] };
  }
  void s;
  return rock;
}

/**
 * Where a bot heads at war with no enemy ship in sight. Attackers: the nearest live base turret, else
 * the treasury (bullets break the shield on the way while it stands). Defenders: the turret ring, on
 * the side of the nearest attacker (they cannot shoot from inside a standing shield).
 */
function siegeGoal(s: ShipState, world: World, base: BaseLayout, defending: boolean, tune: Tune, rel: Rel): { dx: number; dy: number; d: number; standoff: number; shoot: boolean } | null {
  const sg = world.siege;
  if (!sg) return null;
  const b = tune.base;
  if (!defending) {
    let best: { dx: number; dy: number; d: number } | null = null;
    base.turrets.forEach((at, i) => {
      if (sg.turretHp[i] <= 0) return;
      const r = rel(at.x, at.y);
      if (!best || r.d < best.d) best = r;
    });
    if (best) return { ...(best as { dx: number; dy: number; d: number }), standoff: 380, shoot: true };
    const r = rel(base.treasury.x, base.treasury.y);
    return { ...r, standoff: sg.shield > 0 ? b.domeRadius + 200 : 260, shoot: true };
  }
  let threat: { x: number; y: number; d: number } | null = null;
  for (const [oid, o] of world.ships) {
    if (o.hp <= 0 || (world.clanOf.get(oid) ?? 0) === base.clan) continue;
    const d = rel(o.x, o.y).d;
    if (!threat || d < threat.d) threat = { x: o.x, y: o.y, d };
  }
  const W = tune.world.width, H = tune.world.height;
  const a = threat ? Math.atan2(wrapDelta(threat.y, base.treasury.y, H), wrapDelta(threat.x, base.treasury.x, W)) : world.tick / (tune.net.tickHz * 20);
  const post = rel(base.treasury.x + Math.cos(a) * b.turretRing, base.treasury.y + Math.sin(a) * b.turretRing);
  return { ...post, standoff: 0, shoot: false };
}

/** One tick for a tutorial practice pilot. */
export function tutorialBotThink(id: number, s: ShipState, world: World, brain: BotBrain, tune: Tune, rng: () => number): ShipInput {
  const input = idleInput();
  const W = tune.world.width, H = tune.world.height;
  const rel = (x: number, y: number): { dx: number; dy: number; d: number } => {
    const dx = wrapDelta(x, s.x, W), dy = wrapDelta(y, s.y, H);
    return { dx, dy, d: Math.hypot(dx, dy) };
  };
  // Keep clear of rocks, like everyone.
  const rock = nearestRock(s, world, tune, rel);
  if (rock && rock.d - rock.r < 120) {
    input.aim = Math.atan2(rock.dy, rock.dx) + Math.PI * 0.6;
    input.thrust = 0.3;
    return input;
  }
  let player: { dx: number; dy: number; d: number } | null = null;
  for (const [oid, o] of world.ships) {
    if (oid === id || o.hp <= 0 || world.botIds.has(oid)) continue;
    const r = rel(o.x, o.y);
    if (!player || r.d < player.d) player = r;
  }
  if (brain.tutorial === 'chaser' && player) {
    input.aim = Math.atan2(player.dy, player.dx);
    input.thrust = player.d > 260 ? 1 : -1;
    return input;
  }
  if (brain.tutorial === 'noob' && player && player.d < 700) {
    // Turns toward the player with a wide drifting error; fires rare, short bursts.
    brain.aimError = Math.max(-1, Math.min(1, brain.aimError + (rng() - 0.5) * 0.4));
    const aim = Math.atan2(player.dy, player.dx) + brain.aimError * 0.45;
    input.aim = aim;
    input.thrust = player.d > 380 ? 0.3 : -1;
    input.fire = Math.abs(angleDelta(aim, s.heading)) < 0.2 && rng() < 0.12 && s.heat < 0.4;
    return input;
  }
  // Drones (and idle noobs) drift around slowly.
  brain.wander += (rng() - 0.5) * 0.06;
  input.aim = brain.wander;
  input.thrust = -1;
  return input;
}
