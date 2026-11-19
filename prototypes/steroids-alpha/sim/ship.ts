// Ship movement. Pure and deterministic: the client runs it to predict its own
// ship and the server runs it as the authority, so both must call it the same way.
import type { Tune } from './tune';
import { angleDelta, wrap, wrapDelta } from './wrap';
import { GUNS, SCRAPPY, SPARROW, MISSILE_CRUISER, chassisStats, shipMotion } from './chassis';

export interface ShipState {
  /** Server-authoritative arrival time remaining. Absent only in older local visual fixtures. */
  arrival?: number;
  x: number;
  y: number;
  /** Radians, 0 = facing +x, y grows downward. */
  heading: number;
  /** Authoritative travel bearing, independent of the responsive gun/nose heading. */
  travelHeading?: number;
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
   * Legacy wire name: baseline ship.maxHp + mineral wallet. Use mineralBalance for money and
   * hullCapacity for health. Carrying still affects size/speed; collecting/spending never changes HP.
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
  /**
   * Salvage carried this run (meta progression, BRIEF.md Bank and unlocks). Earned by mining and
   * picked up as gold from destroyed ships; banked on extraction, dropped as gold on death. In-run
   * upgrades never spend it. Changed only by the server.
   */
  salvage: number;
  /**
   * Fuel carried (owner, 15 November 2026): the clan resource mined on one's own clan home planet
   * (no salvage drops there). Docking unloads it into the clan treasury, which pays building upkeep.
   */
  fuel: number;
  /** Ship type (sim/chassis.ts): 0 Scrappy, 1 Interceptor, 2 Battlecruiser. Set only by the server. */
  chassis: number;
  /** Seconds until the shield starts recharging (reset by every hit). Set only by the server. */
  shieldCd: number;
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
  /** Fire held on this step. */
  fire: boolean;
  /** Launch a missile / drop a mine this step (pressed once). */
  missile: boolean;
  mine: boolean;
  /** Warp pressed this step: starts warp mode once lockdown is over, or cancels it. */
  warp: boolean;
}

/**
 * Carried resource load: minerals are independent of hull health. A ship starts at ship.maxHp and grows by collecting minerals up to
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
export function topSpeed(hp: number, tune: Tune, chassis = SCRAPPY): number {
  const m = shipMotion(chassis, tune);
  return Math.max(m.minSpeed, m.maxSpeed * (1 - tune.ship.speedPenaltyAtCap * powerLevel(hp, tune)));
}

/** Dash boost speed: dashSpeedFactor times this ship's top speed. */
export function dashSpeed(hp: number, tune: Tune, chassis = SCRAPPY): number {
  return topSpeed(hp, tune, chassis) * tune.ship.dashSpeedFactor;
}

/** How much heat the guns hold: gun upgrades add shop.gunHeatPerTier each (more shots before locking). */
export function missileRefillSeconds(s: Pick<ShipState, 'chassis'>, tune: Tune): number {
  return tune.missile.refillSeconds * (s.chassis === MISSILE_CRUISER ? tune.missileCruiser.missileRefillFactor : 1);
}

export function missileCapacity(s:ShipState,tune:Tune):number{return s.chassis===MISSILE_CRUISER?tune.missileCruiser.capacity:s.missileTier;}

export function heatCapacity(s: ShipState, tune: Tune): number {
  return 1 + s.damageTier * tune.shop.gunHeatPerTier;
}

/** Hit radius: bigger ships are easier to hit and to ram with. */
export function shipRadius(hp: number, tune: Tune, chassis = SCRAPPY): number {
  return chassisStats(chassis, tune).radius * (1 + tune.ship.radiusBonusAtCap * powerLevel(hp, tune));
}

/** How much a ship has grown with power (1 for a fresh ship): scales its art, guns and turrets. */
export function powerGrowth(hp: number, tune: Tune): number {
  return 1 + tune.ship.radiusBonusAtCap * powerLevel(hp, tune);
}

/** Gun (and dash ram) damage multiplier: bought in the shop, damagePerTier per tier. */
export function damageScale(s: ShipState, tune: Tune): number {
  return (1 + s.damageTier * tune.shop.damagePerTier) * chassisStats(s.chassis ?? SCRAPPY, tune).damage;
}

/** Shield maximum: the base shield plus shieldPerTier for each shield upgrade bought. */
/** The legacy wire hullMax field stores baseline + unspent minerals; it no longer grants health. */
export function mineralBalance(s:Pick<ShipState,'hullMax'>,tune:Tune):number{return Math.round(Math.max(0,s.hullMax-tune.ship.maxHp)*10)/10;}
/** Actual hull capacity is independent of the carried wallet. */
export function hullCapacity(_s:Pick<ShipState,'chassis'>,tune:Tune):number{return tune.ship.maxHp;}

export function maxShield(s: ShipState, tune: Tune): number {
  return (tune.ship.maxShield + s.shieldTier * tune.shop.shieldPerTier) * chassisStats(s.chassis ?? SCRAPPY, tune).shield;
}

/** Capacity-scaled recovery with an absolute ceiling, after the existing quiet delay. */
export function shieldRegen(s: ShipState, tune: Tune): number {
  return Math.min(maxShield(s, tune) * tune.ship.shieldRegenPerSecond, tune.ship.shieldRegenCapPerSecond);
}

/** Shared target velocity: aim assist and bots lead actual travel, including knockback. */
export function shipVelocity(s: ShipState): {vx:number;vy:number} {
  const h=s.travelHeading??s.heading;
  return {vx:Math.cos(h)*s.speed+s.kx,vy:Math.sin(h)*s.speed+s.ky};
}

/** Speed-dependent grip changes travel only; it never delays the nose/aim response. */
export function gripHeading(s:ShipState,previousSpeed:number,dt:number,tune:Tune,aligned=false):number{
  const g=tune.grip;
  if(!g.enabled||aligned||s.speed<=0)return s.heading;
  const m=shipMotion(s.chassis,tune),top=topSpeed(s.hullMax,tune,s.chassis),cruise=Math.max(m.minSpeed,top*m.cruiseSpeed/m.maxSpeed);
  const clamp=(n:number)=>Math.max(0,Math.min(1,n)),mix=(a:number,b:number,f:number)=>a+(b-a)*clamp(f);
  const fast=clamp((s.speed-cruise)/Math.max(1,top-cruise));
  let tau=s.speed<=cruise?mix(g.slowTau,g.cruiseTau,(s.speed-m.minSpeed)/Math.max(1,cruise-m.minSpeed)):mix(g.cruiseTau,g.fastTau,fast);
  if(s.dashTime>0)tau=g.dashTau;
  else if(s.speed<previousSpeed-g.decelerationEpsilon)tau=Math.min(tau,g.brakeTau);
  const before=s.travelHeading??s.heading,eased=before+angleDelta(s.heading,before)*(1-Math.exp(-dt/tau));
  const cap=g.maxSlipDeg*Math.PI/180,slip=Math.max(-cap,Math.min(cap,angleDelta(s.heading,eased)));
  return angleDelta(s.heading-slip,0);
}

export function newShip(x: number, y: number, heading: number, speed: number): ShipState {
  return { x, y, heading, travelHeading:heading, speed, arrival: 0, dashCharge: 0, dashTime: 0, dashCd: 0, hp: 0, hullMax: 0, shield: 0, kx: 0, ky: 0, fireCd: 0, shots: 0, heat: 0, overheated: false, turrets: 0, shieldTier: 0, damageTier: 0, missileTier: 0, mineTier: 0, missileCharges: 0, mineCharges: 0, missileCd: 0, mineCd: 0, missileShots: 0, mineShots: 0, lockdown: 0, warping: false, warpDist: 0, salvage: 0, fuel: 0, chassis: SPARROW, shieldCd: 0 };
}

/** Warp top speed: warp.topSpeedFactor times this ship's top speed (only slightly faster, so pursuit is possible). */
export function warpSpeed(hp: number, tune: Tune, chassis = SCRAPPY): number {
  return topSpeed(hp, tune, chassis) * tune.warp.topSpeedFactor;
}

export function copyShip(s: ShipState): ShipState {
  return { x: s.x, y: s.y, heading: s.heading, travelHeading:s.travelHeading??s.heading, speed: s.speed, arrival: s.arrival ?? 0, dashCharge: s.dashCharge, dashTime: s.dashTime, dashCd: s.dashCd, hp: s.hp, hullMax: s.hullMax, shield: s.shield, kx: s.kx, ky: s.ky, fireCd: s.fireCd, shots: s.shots, heat: s.heat, overheated: s.overheated, turrets: s.turrets, shieldTier: s.shieldTier, damageTier: s.damageTier, missileTier: s.missileTier, mineTier: s.mineTier, missileCharges: s.missileCharges, mineCharges: s.mineCharges, missileCd: s.missileCd, mineCd: s.mineCd, missileShots: s.missileShots, mineShots: s.mineShots, lockdown: s.lockdown, warping: s.warping, warpDist: s.warpDist, salvage: s.salvage, fuel: s.fuel, chassis: s.chassis, shieldCd: s.shieldCd };
}

/**
 * Corner speed (owner, 16 November 2026): a ship turns best at cruise speed; slower or faster it
 * turns worse, down to ship.turnAtMinSpeed at minimum speed and ship.turnAtMaxSpeed at its own top
 * speed. Pilots who slow right down no longer win turn fights, which breaks up circling stalemates.
 */
export function cornerFactor(s: ShipState, tune: Tune): number {
  // The best-turning point is a share of this ship's own top speed (owner, 16 November 2026): its
  // cruise/top ratio, applied to its current top speed (power lowers it).
  const t = tune.ship, m = shipMotion(s.chassis, tune), top = topSpeed(s.hullMax, tune, s.chassis), v = s.speed;
  const cruise = Math.max(m.minSpeed, top * (m.cruiseSpeed / m.maxSpeed));
  if (v <= cruise) {
    const span = Math.max(1, cruise - m.minSpeed);
    return t.turnAtMinSpeed + (1 - t.turnAtMinSpeed) * Math.max(0, Math.min(1, (v - m.minSpeed) / span));
  }
  const span = Math.max(1, top - cruise);
  return 1 - (1 - t.turnAtMaxSpeed) * Math.min(1, (v - cruise) / span);
}

/** Advance one fixed step. Mutates and returns s. */
/** floor: the lowest speed allowed this step (0 over one's own clan landing pad, sim/clanBase.ts). */
export function stepShip(s: ShipState, input: ShipInput, dt: number, tune: Tune, floorIn?: number, advanceArrival = true): ShipState {
  const previousSpeed=s.speed,arriving=(s.arrival??0)>0;
  // Older local fixtures begin aligned; snapshots/new ships carry the bearing explicitly.
  s.travelHeading??=s.heading;
  const motion = shipMotion(s.chassis, tune);
  const floor = floorIn ?? motion.minSpeed;
  // Arrival holds its bearing and full normal speed. Protected ships cannot attack or start a dash/warp.
  if ((s.arrival ?? 0) > 0) {
    s.speed = topSpeed(s.hullMax, tune, s.chassis);
    input = { ...input, turn: 0, aim: NaN, thrust: 1, fire: false, dash: false, missile: false, mine: false, warp: false };
    if (advanceArrival) s.arrival = Math.max(0, (s.arrival ?? 0) - dt);
  }
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
  // Slight steering through the whole dash, charge and boost (owner, 16 November 2026:
  // ship.dashSteerFactor of the turn rate), so rams can be aimed and dashes used to evade.
  // In warp the heading is locked apart from slight steering (warp.steerFactor of the turn rate).
  const dashing = s.dashCharge > 0 || s.dashTime > 0;
  const maxTurn = motion.turnRate * dt * (dashing ? tune.ship.dashSteerFactor : cornerFactor(s, tune)) * (s.warping ? tune.warp.steerFactor : 1);
  if (Number.isFinite(input.aim)) {
    const diff = angleDelta(input.aim, s.heading);
    s.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
  } else {
    s.heading += Math.max(-1, Math.min(1, input.turn)) * maxTurn;
  }
  s.heading = angleDelta(s.heading, 0);

  // Dash (owner design, Thunderdogs-like): pressing it starts a dashChargeSeconds wind-up. While it
  // charges steering is locked; when it completes the ship boosts straight ahead (owner, 15 November
  // 2026: no direction picking) at dashSpeedFactor x top speed for dashDuration, ignoring the brake. Afterwards the extra
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
    }
  }
  // Power makes a ship slower: both caps come down as it grows.
  const top = topSpeed(s.hullMax, tune, s.chassis);
  if (s.dashTime > 0) s.speed = Math.max(s.speed, dashSpeed(s.hullMax, tune, s.chassis));
  else if (s.warping) {
    // Warp ignores the throttle: it accelerates to warp speed and holds it.
    const ws = warpSpeed(s.hullMax, tune, s.chassis);
    s.speed = s.speed < ws ? Math.min(ws, s.speed + tune.warp.acceleration * dt) : Math.max(ws, s.speed - motion.braking * dt);
  } else {
    const thrust = Math.max(-1, Math.min(1, input.thrust));
    if (s.speed > top) s.speed = Math.max(top, s.speed - motion.braking * dt + Math.min(0, thrust) * motion.braking * dt);
    else if(thrust===0){
      const cruise=Math.max(motion.minSpeed,top*motion.cruiseSpeed/motion.maxSpeed);
      s.speed=s.speed<cruise?Math.min(cruise,s.speed+motion.acceleration*dt):Math.max(cruise,s.speed-motion.braking*dt);
    } else s.speed = Math.max(floor, Math.min(top, s.speed + thrust * (thrust > 0 ? motion.acceleration : motion.braking) * dt));
  }
  const speed = s.speed;
  if (s.warping) s.warpDist += speed * dt;
  s.dashTime = Math.max(0, s.dashTime - dt);
  s.dashCd = Math.max(0, s.dashCd - dt);

  s.travelHeading=gripHeading(s,previousSpeed,dt,tune,arriving||s.warping||floor===0);
  s.x = wrap(s.x + (Math.cos(s.travelHeading) * speed + s.kx) * dt, tune.world.width);
  s.y = wrap(s.y + (Math.sin(s.travelHeading) * speed + s.ky) * dt, tune.world.height);
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
  const missileRefill = missileRefillSeconds(s, tune);
  [s.missileCharges, s.missileCd] = refill(s.missileCharges, s.missileCd, missileCapacity(s,tune), missileRefill);
  [s.mineCharges, s.mineCd] = refill(s.mineCharges, s.mineCd, s.mineTier, tune.mine.refillSeconds);
  if ((input.missile || s.chassis===MISSILE_CRUISER&&input.fire) && s.missileCharges > 0 && (s.chassis!==MISSILE_CRUISER||s.fireCd===0)) {
    if(s.chassis===MISSILE_CRUISER)s.fireCd=Math.max(1,Math.ceil(tune.missileCruiser.repeatSeconds*tune.net.tickHz));
    s.missileCharges--;
    if (s.missileCd <= 0) s.missileCd = missileRefill;
    s.missileShots = (s.missileShots + 1) & 0xffff;
  }
  if (input.mine && s.mineCharges > 0) {
    s.mineCharges--;
    if (s.mineCd <= 0) s.mineCd = tune.mine.refillSeconds;
    s.mineShots = (s.mineShots + 1) & 0xffff;
  }
  if (s.chassis!==MISSILE_CRUISER && input.fire && s.fireCd === 0 && !s.overheated) {
    s.fireCd = chassisStats(s.chassis, tune).fireIntervalSteps;
    s.shots = (s.shots + 1) & 0xffff;
    s.heat = Math.min(1, s.heat + shotHeat(s, tune));
    // Exact-capacity shots must not gain a bonus round from floating-point cooling residue.
    if (s.heat >= 1 - 1e-10) { s.heat = 1; s.overheated = true; }
  }
  return s;
}

/** Heat cost matches the requested cold-to-lock shot count despite cooling and a slower cadence.
 * Integer ammo rounds to the nearest whole shot. Pausing still recovers with the normal animation.
 * If Falcon's upgraded gun cools faster than it heats, both remain sustainable. */
export function shotHeat(s: ShipState, tune: Tune): number {
  const heat = tune.weapon.heatPerShot / heatCapacity(s, tune);
  if (s.chassis !== SPARROW) return heat;
  const cool = tune.weapon.coolPerSecond / tune.net.tickHz;
  const falconCool = cool * tune.weapon.fireIntervalSteps;
  const sparrowCool = cool * tune.sparrow.fireIntervalSteps;
  if (heat >= 1) return 1;
  if (heat <= falconCool) return heat * tune.sparrow.fireIntervalSteps / tune.weapon.fireIntervalSteps;
  const falconShots = Math.ceil((1 - falconCool) / (heat - falconCool) - 1e-10);
  const shots = Math.max(1, Math.round(falconShots * tune.sparrow.ammoRatio));
  return shots === 1 ? 1 : sparrowCool + (1 - sparrowCool) / (shots - .5);
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 centre, 1 right, -1 left (capital outer pair: +/-2). */
  side: number;
}

/** The bullet a ship has just fired (call right after a step in which shots increased). */
/** Something the aim assist may bend shots toward: position, and whether it is a ship (preferred). */
export interface AssistTarget {
  x: number;
  y: number;
  ship: boolean;
  /** Velocity (world units a second), so both guns can lead a moving target. */
  vx?: number;
  vy?: number;
}

/**
 * The target the aim assist locks onto: within assistRange and assistConeDeg of the nose, seen from
 * the ship's centre; ships before asteroids, then the smallest angle off the nose.
 */
export function assistPick(x: number, y: number, heading: number, targets: readonly AssistTarget[], tune: Tune): AssistTarget | null {
  const w = tune.weapon;
  const cone = (w.assistConeDeg * Math.PI) / 180;
  if (cone <= 0) return null;
  let best: { off: number; t: AssistTarget } | null = null;
  for (const t of targets) {
    const dx = wrapDelta(t.x, x, tune.world.width);
    const dy = wrapDelta(t.y, y, tune.world.height);
    if (dx * dx + dy * dy > w.assistRange * w.assistRange) continue;
    const off = Math.abs(angleDelta(Math.atan2(dy, dx), heading));
    if (off > cone) continue;
    if (!best || (t.ship && !best.t.ship) || (t.ship === best.t.ship && off < best.off)) best = { off, t };
  }
  return best?.t ?? null;
}

/**
 * Both guns on the locked target (owner, 15 November 2026): each gun turns from its own muzzle to
 * where the target will be when the shot arrives, so both streams land, by at most
 * assistConvergeMaxDeg off the gun's resting line. No target: the resting line.
 */
function convergeOn(x: number, y: number, base: number, v: number, target: AssistTarget | null, tune: Tune): number {
  if (!target) return base;
  let px = target.x;
  let py = target.y;
  for (let i = 0; i < 2; i++) {
    const d = Math.hypot(wrapDelta(px, x, tune.world.width), wrapDelta(py, y, tune.world.height));
    const t = d / Math.max(1, v);
    px = target.x + (target.vx ?? 0) * t;
    py = target.y + (target.vy ?? 0) * t;
  }
  const aim = Math.atan2(wrapDelta(py, y, tune.world.height), wrapDelta(px, x, tune.world.width));
  const cap = (tune.weapon.assistConvergeMaxDeg * Math.PI) / 180;
  return base + Math.max(-cap, Math.min(cap, angleDelta(aim, base)));
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
  if (s.chassis === SPARROW) {
    const grow = powerGrowth(s.hullMax, tune), f = tune.sparrow.muzzleForward * grow;
    const x = wrap(s.x + Math.cos(s.heading) * f, tune.world.width);
    const y = wrap(s.y + Math.sin(s.heading) * f, tune.world.height);
    const v = tune.weapon.bulletSpeed + s.speed;
    // Shared deterministic launch drift, applied AFTER assist so distant targets cannot erase it.
    const wave = Math.sin(s.shots * 2.399963229728653);
    const dir = convergeOn(x, y, s.heading, v, assistPick(s.x, s.y, s.heading, targets, tune), tune)
      + wave * tune.sparrow.driftDeg * Math.PI / 180;
    return { x, y, vx: Math.cos(dir) * v, vy: Math.sin(dir) * v, side: 0 };
  }
  const guns = GUNS[s.chassis];
  if (guns) {
    // Interceptor and Battlecruiser: the guns fire in turn from their mounts (sim/chassis.ts), each
    // angled in to cross at convergeDistance like Scrappy's.
    const g = guns[s.shots % guns.length];
    const grow = powerGrowth(s.hullMax, tune);
    const c = Math.cos(s.heading);
    const sn = Math.sin(s.heading);
    const x = wrap(s.x + (c * g.forward - sn * g.right) * grow, tune.world.width);
    const y = wrap(s.y + (sn * g.forward + c * g.right) * grow, tune.world.height);
    const v = tune.weapon.bulletSpeed + s.speed;
    const dir = convergeOn(x, y, s.heading - Math.atan2(g.right * grow, tune.weapon.convergeDistance), v, assistPick(s.x, s.y, s.heading, targets, tune), tune);
    return { x, y, vx: Math.cos(dir) * v, vy: Math.sin(dir) * v, side: g.side };
  }
  const side = s.shots % 2 === 1 ? 1 : -1;
  const c = Math.cos(s.heading);
  const sn = Math.sin(s.heading);
  // The guns grow with the ship (see shipRadius), so shots still leave from the drawn wing tips.
  const grow = shipRadius(s.hullMax, tune, s.chassis) / tune.ship.radius;
  const f = tune.weapon.muzzleForward * grow;
  const l = tune.weapon.muzzleSide * grow * side;
  const v = tune.weapon.bulletSpeed + s.speed;
  // The guns sit out on the wings, so each is angled slightly inward: the two streams cross at
  // convergeDistance ahead of the nose instead of passing either side of a target dead ahead.
  const x = wrap(s.x + c * f - sn * l, tune.world.width);
  const y = wrap(s.y + sn * f + c * l, tune.world.height);
  const base = s.heading - side * Math.atan2(tune.weapon.muzzleSide * grow, tune.weapon.convergeDistance);
  const dir = convergeOn(x, y, base, v, assistPick(s.x, s.y, s.heading, targets, tune), tune);
  return {
    x,
    y,
    vx: Math.cos(dir) * v,
    vy: Math.sin(dir) * v,
    side,
  };
}
