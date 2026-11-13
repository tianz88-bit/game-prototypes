// Ship movement. Pure and deterministic: the client runs it to predict its own
// ship and the server runs it as the authority, so both must call it the same way.
import type { Tune } from './tune';
import { angleDelta, wrap, wrapDelta } from './wrap';

export interface ShipState {
  x: number;
  y: number;
  /** Radians, 0 = facing +x, y grows downward. */
  heading: number;
  /** Forward speed in px/s, between ship.minSpeed and ship.maxSpeed. A ship never stops. */
  speed: number;
  /** Seconds of dash charge left (the 0.5 s wind-up before the boost); 0 when not charging. */
  dashCharge: number;
  /** Seconds of dash boost left. */
  dashTime: number;
  /** Seconds until dash is available again. */
  dashCd: number;
  /** Hull points now. Changed only by the server; 0 means destroyed. */
  hp: number;
  /**
   * Hull maximum, which is the ship's power: minerals raise it (after repairing any damage), shop
   * purchases spend it. hp never exceeds it. Speed, size and the leaderboard follow it.
   */
  hullMax: number;
  /** Shield points, taken before the hull. Changed only by the server. */
  shield: number;
  /** Knockback velocity (from ramming an asteroid), added to forward motion and decaying away. */
  kx: number;
  ky: number;
  /** Whole steps until the guns can fire again. */
  fireCd: number;
  /** Gun heat, 0..1. Each shot adds weapon.heatPerShot; it cools at weapon.coolPerSecond. */
  heat: number;
  /** Overheated: the guns are locked until heat falls to weapon.unlockHeat. */
  overheated: boolean;
  /** Shop upgrades bought (0-4 each); see sim/shop.ts. */
  turrets: number;
  shieldTier: number;
  damageTier: number;
  missileTier: number;
  mineTier: number;
  /** Missile and mine charges held (up to the tier) and seconds until the next one refills. */
  missileCharges: number;
  mineCharges: number;
  missileCd: number;
  mineCd: number;
  /** Missiles launched and mines dropped so far (wrap at 65536); the world spawns one per step. */
  missileShots: number;
  mineShots: number;
  /** Shots fired so far (wraps at 65536). Odd shots use the right gun, even the left. */
  shots: number;
  /** Seconds of lockdown left after dropping in: the warp is offline until it reaches 0. */
  lockdown: number;
  /** In warp mode: accelerating to warp speed, steering limited, no firing. */
  warping: boolean;
  /** Distance travelled in warp mode; reaching warp.distance extracts the ship. Any damage resets it. */
  warpDist: number;
}

export interface ShipInput {
  /** Increasing per client. The server acknowledges the last one it applied. */
  seq: number;
  /** Craft-relative steering, -1 (left) .. 1 (right). Ignored when aim is set. */
  turn: number;
  /** Direction-marker target heading in radians, or NaN for none. */
  aim: number;
  /** -1 (brake) .. 1 (accelerate); 0 holds the current speed. */
  thrust: number;
  /** Dash requested on this step. */
  dash: boolean;
  /**
   * Dash direction held this step (radians), or NaN for straight ahead. Sent every step while the
   * dash charges; the direction held when the charge completes is where the boost goes.
   */
  dashAim: number;
  /** Fire held on this step. */
  fire: boolean;
  /** Launch a missile / drop a mine this step (pressed once). */
  missile: boolean;
  mine: boolean;
  /** Warp pressed this step: starts warp mode once lockdown is over, or cancels it. */
  warp: boolean;
}

/**
 * Power: minerals are the hull. A ship starts at ship.maxHp and grows by collecting minerals up to
 * ship.powerCap. Growth has diminishing returns (square root): the ship gets slower and bigger (an
 * easier target). Firepower and shield come from shop upgrades bought with minerals (sim/shop.ts).
 * Returns 0 for a fresh ship and 1 at the cap.
 */
export function powerLevel(hp: number, tune: Tune): number {
  const base = tune.ship.maxHp;
  const span = tune.ship.powerCap - base;
  if (span <= 0) return 0;
  return Math.sqrt(Math.max(0, Math.min(1, (hp - base) / span)));
}

/** Top speed after the power penalty. Never below the minimum speed. Takes hullMax (power). */
export function topSpeed(hp: number, tune: Tune): number {
  return Math.max(tune.ship.minSpeed, tune.ship.maxSpeed * (1 - tune.ship.speedPenaltyAtCap * powerLevel(hp, tune)));
}

/** Dash boost speed: dashSpeedFactor times this ship's top speed. */
export function dashSpeed(hp: number, tune: Tune): number {
  return topSpeed(hp, tune) * tune.ship.dashSpeedFactor;
}

/** How much heat the guns hold: gun upgrades add shop.gunHeatPerTier each (more shots before locking). */
export function heatCapacity(s: ShipState, tune: Tune): number {
  return 1 + s.damageTier * tune.shop.gunHeatPerTier;
}

/** Hit radius: bigger ships are easier to hit and to ram with. */
export function shipRadius(hp: number, tune: Tune): number {
  return tune.ship.radius * (1 + tune.ship.radiusBonusAtCap * powerLevel(hp, tune));
}

/** Gun (and dash ram) damage multiplier: bought in the shop, damagePerTier per tier. */
export function damageScale(s: ShipState, tune: Tune): number {
  return 1 + s.damageTier * tune.shop.damagePerTier;
}

/** Shield maximum: the base shield plus shieldPerTier for each shield upgrade bought. */
export function maxShield(s: ShipState, tune: Tune): number {
  return tune.ship.maxShield + s.shieldTier * tune.shop.shieldPerTier;
}

export function newShip(x: number, y: number, heading: number, speed: number): ShipState {
  return { x, y, heading, speed, dashCharge: 0, dashTime: 0, dashCd: 0, hp: 0, hullMax: 0, shield: 0, kx: 0, ky: 0, fireCd: 0, shots: 0, heat: 0, overheated: false, turrets: 0, shieldTier: 0, damageTier: 0, missileTier: 0, mineTier: 0, missileCharges: 0, mineCharges: 0, missileCd: 0, mineCd: 0, missileShots: 0, mineShots: 0, lockdown: 0, warping: false, warpDist: 0 };
}

/** Warp top speed: warp.topSpeedFactor times this ship's top speed (only slightly faster, so pursuit is possible). */
export function warpSpeed(hp: number, tune: Tune): number {
  return topSpeed(hp, tune) * tune.warp.topSpeedFactor;
}

export function copyShip(s: ShipState): ShipState {
  return { x: s.x, y: s.y, heading: s.heading, speed: s.speed, dashCharge: s.dashCharge, dashTime: s.dashTime, dashCd: s.dashCd, hp: s.hp, hullMax: s.hullMax, shield: s.shield, kx: s.kx, ky: s.ky, fireCd: s.fireCd, shots: s.shots, heat: s.heat, overheated: s.overheated, turrets: s.turrets, shieldTier: s.shieldTier, damageTier: s.damageTier, missileTier: s.missileTier, mineTier: s.mineTier, missileCharges: s.missileCharges, mineCharges: s.mineCharges, missileCd: s.missileCd, mineCd: s.mineCd, missileShots: s.missileShots, mineShots: s.mineShots, lockdown: s.lockdown, warping: s.warping, warpDist: s.warpDist };
}

/** Advance one fixed step. Mutates and returns s. */
export function stepShip(s: ShipState, input: ShipInput, dt: number, tune: Tune): ShipState {
  // Lockdown counts down from drop-in; then Warp starts warp mode, and pressing it again cancels.
  s.lockdown = Math.max(0, s.lockdown - dt);
  if (input.warp) {
    if (s.warping) {
      s.warping = false;
      s.warpDist = 0;
    } else if (s.lockdown <= 0 && s.dashCharge <= 0 && s.dashTime <= 0) {
      s.warping = true;
      s.warpDist = 0;
    }
  }
  if (s.warping) input = { ...input, dash: false, fire: false, missile: false, mine: false };
  // No steering for the whole dash, charge and boost (owner design): the ship holds course while
  // the player picks the boost direction, then commits to it. Steering returns when the boost ends.
  // In warp the heading is locked apart from slight steering (warp.steerFactor of the turn rate).
  const maxTurn = s.dashCharge > 0 || s.dashTime > 0 ? 0 : tune.ship.turnRate * dt * (s.warping ? tune.warp.steerFactor : 1);
  if (Number.isFinite(input.aim)) {
    const diff = angleDelta(input.aim, s.heading);
    s.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
  } else {
    s.heading += Math.max(-1, Math.min(1, input.turn)) * maxTurn;
  }
  s.heading = angleDelta(s.heading, 0);

  // Dash (owner design, Thunderdogs-like): pressing it starts a dashChargeSeconds wind-up. While it
  // charges the player holds a direction; when it completes the ship snaps to that direction and
  // boosts at dashSpeedFactor x top speed for dashDuration, ignoring the brake. Afterwards the extra
  // speed bleeds off at the braking rate back to top speed.
  if (input.dash && s.dashCd <= 0 && s.dashCharge <= 0 && s.dashTime <= 0) {
    s.dashCharge = tune.ship.dashChargeSeconds;
    s.dashCd = tune.ship.dashCooldown;
  }
  if (s.dashCharge > 0) {
    s.dashCharge = Math.max(0, s.dashCharge - dt);
    if (s.dashCharge <= 1e-9) {
      s.dashCharge = 0;
      s.dashTime = tune.ship.dashDuration;
      if (Number.isFinite(input.dashAim)) s.heading = angleDelta(input.dashAim, 0);
    }
  }
  // Power makes a ship slower: both caps come down as it grows.
  const top = topSpeed(s.hullMax, tune);
  if (s.dashTime > 0) s.speed = Math.max(s.speed, dashSpeed(s.hullMax, tune));
  else if (s.warping) {
    // Warp ignores the throttle: it accelerates to warp speed and holds it.
    const ws = warpSpeed(s.hullMax, tune);
    s.speed = s.speed < ws ? Math.min(ws, s.speed + tune.warp.acceleration * dt) : Math.max(ws, s.speed - tune.ship.braking * dt);
  } else {
    const thrust = Math.max(-1, Math.min(1, input.thrust));
    if (s.speed > top) s.speed = Math.max(top, s.speed - tune.ship.braking * dt + Math.min(0, thrust) * tune.ship.braking * dt);
    else s.speed = Math.max(tune.ship.minSpeed, Math.min(top, s.speed + thrust * (thrust > 0 ? tune.ship.acceleration : tune.ship.braking) * dt));
  }
  const speed = s.speed;
  if (s.warping) s.warpDist += speed * dt;
  s.dashTime = Math.max(0, s.dashTime - dt);
  s.dashCd = Math.max(0, s.dashCd - dt);

  s.x = wrap(s.x + (Math.cos(s.heading) * speed + s.kx) * dt, tune.world.width);
  s.y = wrap(s.y + (Math.sin(s.heading) * speed + s.ky) * dt, tune.world.height);
  const k = Math.exp(-tune.ship.knockbackDecayPerSecond * dt);
  s.kx = Math.abs(s.kx * k) < 0.5 ? 0 : s.kx * k;
  s.ky = Math.abs(s.ky * k) < 0.5 ? 0 : s.ky * k;

  // Guns: the cooldown counts whole steps, so client and server always agree on which step fires.
  // Heat: firing adds it, it always cools; at full the guns lock until it drops to unlockHeat.
  const w = tune.weapon;
  if (s.fireCd > 0) s.fireCd--;
  s.heat = Math.max(0, s.heat - w.coolPerSecond * dt);
  if (s.overheated && s.heat <= w.unlockHeat) s.overheated = false;
  // Missiles and mines: charges refill one at a time (refillSeconds each) up to the tier, and are
  // held until used. A press uses one charge; the world spawns the missile or mine.
  const refill = (charges: number, cd: number, tier: number, seconds: number): [number, number] => {
    if (charges >= tier) return [charges, 0];
    cd -= dt;
    if (cd <= 0) {
      charges++;
      cd = charges < tier ? seconds : 0;
    }
    return [charges, cd];
  };
  [s.missileCharges, s.missileCd] = refill(s.missileCharges, s.missileCd, s.missileTier, tune.missile.refillSeconds);
  [s.mineCharges, s.mineCd] = refill(s.mineCharges, s.mineCd, s.mineTier, tune.mine.refillSeconds);
  if (input.missile && s.missileCharges > 0) {
    s.missileCharges--;
    if (s.missileCd <= 0) s.missileCd = tune.missile.refillSeconds;
    s.missileShots = (s.missileShots + 1) & 0xffff;
  }
  if (input.mine && s.mineCharges > 0) {
    s.mineCharges--;
    if (s.mineCd <= 0) s.mineCd = tune.mine.refillSeconds;
    s.mineShots = (s.mineShots + 1) & 0xffff;
  }
  if (input.fire && s.fireCd === 0 && !s.overheated) {
    s.fireCd = w.fireIntervalSteps;
    s.shots = (s.shots + 1) & 0xffff;
    s.heat = Math.min(1, s.heat + w.heatPerShot / heatCapacity(s, tune));
    if (s.heat >= 1) s.overheated = true;
  }
  return s;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 right gun, -1 left gun. */
  side: number;
}

/** The bullet a ship has just fired (call right after a step in which shots increased). */
/** Something the aim assist may bend shots toward: position, and whether it is a ship (preferred). */
export interface AssistTarget {
  x: number;
  y: number;
  ship: boolean;
}

/**
 * Aim assist (owner request): within a narrow cone ahead of a shot, bend it slightly toward a target,
 * ships before asteroids, by at most weapon.assistMaxDeg. Returns the adjusted direction (radians).
 */
export function assistDirection(x: number, y: number, dir: number, targets: readonly AssistTarget[], tune: Tune): number {
  const w = tune.weapon;
  const cone = (w.assistConeDeg * Math.PI) / 180;
  const maxBend = (w.assistMaxDeg * Math.PI) / 180;
  if (cone <= 0 || maxBend <= 0 || !targets.length) return dir;
  let best: { off: number; ship: boolean } | null = null;
  for (const t of targets) {
    const dx = wrapDelta(t.x, x, tune.world.width);
    const dy = wrapDelta(t.y, y, tune.world.height);
    if (dx * dx + dy * dy > w.assistRange * w.assistRange) continue;
    const off = angleDelta(Math.atan2(dy, dx), dir);
    if (Math.abs(off) > cone) continue;
    if (!best || (t.ship && !best.ship) || (t.ship === best.ship && Math.abs(off) < Math.abs(best.off))) best = { off, ship: t.ship };
  }
  return best ? dir + Math.max(-maxBend, Math.min(maxBend, best.off)) : dir;
}

export function muzzleShot(s: ShipState, tune: Tune, targets: readonly AssistTarget[] = []): Shot {
  const side = s.shots % 2 === 1 ? 1 : -1;
  const c = Math.cos(s.heading);
  const sn = Math.sin(s.heading);
  // The guns grow with the ship (see shipRadius), so shots still leave from the drawn wing tips.
  const grow = shipRadius(s.hullMax, tune) / tune.ship.radius;
  const f = tune.weapon.muzzleForward * grow;
  const l = tune.weapon.muzzleSide * grow * side;
  const v = tune.weapon.bulletSpeed + s.speed;
  // The guns sit out on the wings, so each is angled slightly inward: the two streams cross at
  // convergeDistance ahead of the nose instead of passing either side of a target dead ahead.
  const x = wrap(s.x + c * f - sn * l, tune.world.width);
  const y = wrap(s.y + sn * f + c * l, tune.world.height);
  const base = s.heading - side * Math.atan2(tune.weapon.muzzleSide * grow, tune.weapon.convergeDistance);
  const dir = assistDirection(x, y, base, targets, tune);
  return {
    x,
    y,
    vx: Math.cos(dir) * v,
    vy: Math.sin(dir) * v,
    side,
  };
}
