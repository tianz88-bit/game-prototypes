// Ship movement. Pure and deterministic: the client runs it to predict its own
// ship and the server runs it as the authority, so both must call it the same way.
import type { Tune } from './tune';
import { angleDelta, wrap } from './wrap';

export interface ShipState {
  x: number;
  y: number;
  /** Radians, 0 = facing +x, y grows downward. */
  heading: number;
  /** Seconds of dash left. */
  dashTime: number;
  /** Seconds until dash is available again. */
  dashCd: number;
}

export interface ShipInput {
  /** Increasing per client. The server acknowledges the last one it applied. */
  seq: number;
  /** Keyboard steering, -1 (left) .. 1 (right). Ignored when aim is set. */
  turn: number;
  /** Joystick target heading in radians, or NaN for none. */
  aim: number;
  /** Dash requested on this step. */
  dash: boolean;
}

export function newShip(x: number, y: number, heading: number): ShipState {
  return { x, y, heading, dashTime: 0, dashCd: 0 };
}

export function copyShip(s: ShipState): ShipState {
  return { x: s.x, y: s.y, heading: s.heading, dashTime: s.dashTime, dashCd: s.dashCd };
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
  const speed = s.dashTime > 0 ? tune.ship.dashSpeed : tune.ship.baseSpeed;
  s.dashTime = Math.max(0, s.dashTime - dt);
  s.dashCd = Math.max(0, s.dashCd - dt);

  s.x = wrap(s.x + Math.cos(s.heading) * speed * dt, tune.world.width);
  s.y = wrap(s.y + Math.sin(s.heading) * speed * dt, tune.world.height);
  return s;
}
