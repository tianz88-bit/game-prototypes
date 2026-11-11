// Ship movement. Pure and deterministic: the client runs it to predict its own
// ship and the server runs it as the authority, so both must call it the same way.
import type { Tune } from './tune';
import { angleDelta, wrap } from './wrap';

export interface ShipState {
  x: number;
  y: number;
  /** Radians, 0 = facing +x, y grows downward. */
  heading: number;
  /** Forward speed in px/s, between ship.minSpeed and ship.maxSpeed. A ship never stops. */
  speed: number;
  /** Seconds of dash left. */
  dashTime: number;
  /** Seconds until dash is available again. */
  dashCd: number;
  /** Hull points. Changed only by the server; 0 means destroyed. */
  hp: number;
  /** Whole steps until the guns can fire again. */
  fireCd: number;
  /** Shots fired so far (wraps at 65536). Odd shots use the right gun, even the left. */
  shots: number;
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
}

export function newShip(x: number, y: number, heading: number, speed: number): ShipState {
  return { x, y, heading, speed, dashTime: 0, dashCd: 0, hp: 0, fireCd: 0, shots: 0 };
}

export function copyShip(s: ShipState): ShipState {
  return { x: s.x, y: s.y, heading: s.heading, speed: s.speed, dashTime: s.dashTime, dashCd: s.dashCd, hp: s.hp, fireCd: s.fireCd, shots: s.shots };
}

/** Advance one fixed step. Mutates and returns s. */
export function stepShip(s: ShipState, input: ShipInput, dt: number, tune: Tune): ShipState {
  const maxTurn = tune.ship.turnRate * dt;
  if (Number.isFinite(input.aim)) {
    const diff = angleDelta(input.aim, s.heading);
    s.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
  } else {
    s.heading += Math.max(-1, Math.min(1, input.turn)) * maxTurn;
  }
  s.heading = angleDelta(s.heading, 0);

  if (input.dash && s.dashCd <= 0) {
    s.dashTime = tune.ship.dashDuration;
    s.dashCd = tune.ship.dashCooldown;
  }
  const thrust = Math.max(-1, Math.min(1, input.thrust));
  s.speed += thrust * (thrust > 0 ? tune.ship.acceleration : tune.ship.braking) * dt;
  s.speed = Math.max(tune.ship.minSpeed, Math.min(tune.ship.maxSpeed, s.speed));
  const speed = s.dashTime > 0 ? Math.max(tune.ship.dashSpeed, s.speed) : s.speed;
  s.dashTime = Math.max(0, s.dashTime - dt);
  s.dashCd = Math.max(0, s.dashCd - dt);

  s.x = wrap(s.x + Math.cos(s.heading) * speed * dt, tune.world.width);
  s.y = wrap(s.y + Math.sin(s.heading) * speed * dt, tune.world.height);

  // Guns: the cooldown counts whole steps, so client and server always agree on which step fires.
  if (s.fireCd > 0) s.fireCd--;
  if (input.fire && s.fireCd === 0) {
    s.fireCd = tune.weapon.fireIntervalSteps;
    s.shots = (s.shots + 1) & 0xffff;
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
export function muzzleShot(s: ShipState, tune: Tune): Shot {
  const side = s.shots % 2 === 1 ? 1 : -1;
  const c = Math.cos(s.heading);
  const sn = Math.sin(s.heading);
  const f = tune.weapon.muzzleForward;
  const l = tune.weapon.muzzleSide * side;
  const v = tune.weapon.bulletSpeed + s.speed;
  // The guns sit out on the wings, so each is angled slightly inward: the two streams cross at
  // convergeDistance ahead of the nose instead of passing either side of a target dead ahead.
  const dir = s.heading - side * Math.atan2(tune.weapon.muzzleSide, tune.weapon.convergeDistance);
  return {
    x: wrap(s.x + c * f - sn * l, tune.world.width),
    y: wrap(s.y + sn * f + c * l, tune.world.height),
    vx: Math.cos(dir) * v,
    vy: Math.sin(dir) * v,
    side,
  };
}
