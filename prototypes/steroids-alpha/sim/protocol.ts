// Binary wire format between client and planet room. Little-endian.
//
// Client -> server
//   INPUT     u8 type, u32 seq, f32 turn, f32 aim, f32 thrust, u8 flags (bit0 dash, bit1 fire)
//   PING      u8 type, f64 clientTimeMs
// Server -> client
//   WELCOME   u8 type, u16 yourId, u32 tick
//   SNAPSHOT  u8 type, u32 tick, u32 ackSeq, u16 count, count x SHIP
//             SHIP = u16 id, f32 x, f32 y, f32 heading, f32 speed, f32 dashTime, f32 dashCd,
//                    f32 hp, u8 fireCd, u16 shots
//   PONG      u8 type, f64 clientTimeMs
//   ASTEROIDS u8 type, u16 count, count x (u16 id, u8 size, f32 x, f32 y, f32 vx, f32 vy, u32 t0, f32 hp)
//             New asteroids, or ones whose hp changed. Sent in full to a client when it joins.
//   GONE      u8 type, u16 count, count x (u16 id, f32 x, f32 y)   asteroids destroyed, and where
//   SHOTS     u8 type, u32 tick, u16 count, count x (u16 owner, f32 x, f32 y, f32 vx, f32 vy, i8 side)
import type { ShipInput, ShipState } from './ship';
import type { Asteroid } from './asteroids';
import type { ShotEvent } from './world';

export const PROTOCOL_VERSION = 3;

export const MSG = {
  INPUT: 1,
  PING: 2,
  WELCOME: 10,
  SNAPSHOT: 11,
  PONG: 12,
  ASTEROIDS: 13,
  GONE: 14,
  SHOTS: 15,
} as const;

/** WebSocket close codes the room uses. */
export const CLOSE = {
  ROOM_FULL: 4001,
  BAD_PROTOCOL: 4002,
  DESTROYED: 4003,
} as const;

export interface SnapshotShip extends ShipState {
  id: number;
}

export interface GoneAsteroid {
  id: number;
  x: number;
  y: number;
}

export type ServerMessage =
  | { type: typeof MSG.WELCOME; id: number; tick: number }
  | { type: typeof MSG.SNAPSHOT; tick: number; ackSeq: number; ships: SnapshotShip[] }
  | { type: typeof MSG.PONG; clientTime: number }
  | { type: typeof MSG.ASTEROIDS; asteroids: Asteroid[] }
  | { type: typeof MSG.GONE; gone: GoneAsteroid[] }
  | { type: typeof MSG.SHOTS; tick: number; shots: ShotEvent[] };

export type ClientMessage =
  | { type: typeof MSG.INPUT; input: ShipInput }
  | { type: typeof MSG.PING; clientTime: number };

const INPUT_BYTES = 18;
const SHIP_BYTES = 2 + 4 * 7 + 1 + 2;
const ASTEROID_BYTES = 2 + 1 + 4 * 4 + 4 + 4;
const GONE_BYTES = 2 + 4 * 2;
const SHOT_BYTES = 2 + 4 * 4 + 1;

export function encodeInput(input: ShipInput): ArrayBuffer {
  const buf = new ArrayBuffer(INPUT_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MSG.INPUT);
  v.setUint32(1, input.seq >>> 0, true);
  v.setFloat32(5, input.turn, true);
  v.setFloat32(9, input.aim, true);
  v.setFloat32(13, input.thrust, true);
  v.setUint8(17, (input.dash ? 1 : 0) | (input.fire ? 2 : 0));
  return buf;
}

export function encodePing(type: typeof MSG.PING | typeof MSG.PONG, clientTime: number): ArrayBuffer {
  const buf = new ArrayBuffer(9);
  const v = new DataView(buf);
  v.setUint8(0, type);
  v.setFloat64(1, clientTime, true);
  return buf;
}

export function encodeWelcome(id: number, tick: number): ArrayBuffer {
  const buf = new ArrayBuffer(7);
  const v = new DataView(buf);
  v.setUint8(0, MSG.WELCOME);
  v.setUint16(1, id, true);
  v.setUint32(3, tick >>> 0, true);
  return buf;
}

export function encodeSnapshot(tick: number, ackSeq: number, ships: SnapshotShip[]): ArrayBuffer {
  const buf = new ArrayBuffer(11 + ships.length * SHIP_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MSG.SNAPSHOT);
  v.setUint32(1, tick >>> 0, true);
  v.setUint32(5, ackSeq >>> 0, true);
  v.setUint16(9, ships.length, true);
  let o = 11;
  for (const s of ships) {
    v.setUint16(o, s.id, true);
    v.setFloat32(o + 2, s.x, true);
    v.setFloat32(o + 6, s.y, true);
    v.setFloat32(o + 10, s.heading, true);
    v.setFloat32(o + 14, s.speed, true);
    v.setFloat32(o + 18, s.dashTime, true);
    v.setFloat32(o + 22, s.dashCd, true);
    v.setFloat32(o + 26, s.hp, true);
    v.setUint8(o + 30, s.fireCd);
    v.setUint16(o + 31, s.shots, true);
    o += SHIP_BYTES;
  }
  return buf;
}

export function encodeAsteroids(list: Asteroid[]): ArrayBuffer {
  const buf = new ArrayBuffer(3 + list.length * ASTEROID_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MSG.ASTEROIDS);
  v.setUint16(1, list.length, true);
  let o = 3;
  for (const a of list) {
    v.setUint16(o, a.id, true);
    v.setUint8(o + 2, a.size);
    v.setFloat32(o + 3, a.x, true);
    v.setFloat32(o + 7, a.y, true);
    v.setFloat32(o + 11, a.vx, true);
    v.setFloat32(o + 15, a.vy, true);
    v.setUint32(o + 19, a.t0 >>> 0, true);
    v.setFloat32(o + 23, a.hp, true);
    o += ASTEROID_BYTES;
  }
  return buf;
}

export function encodeGone(list: GoneAsteroid[]): ArrayBuffer {
  const buf = new ArrayBuffer(3 + list.length * GONE_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MSG.GONE);
  v.setUint16(1, list.length, true);
  let o = 3;
  for (const g of list) {
    v.setUint16(o, g.id, true);
    v.setFloat32(o + 2, g.x, true);
    v.setFloat32(o + 6, g.y, true);
    o += GONE_BYTES;
  }
  return buf;
}

export function encodeShots(tick: number, list: ShotEvent[]): ArrayBuffer {
  const buf = new ArrayBuffer(7 + list.length * SHOT_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MSG.SHOTS);
  v.setUint32(1, tick >>> 0, true);
  v.setUint16(5, list.length, true);
  let o = 7;
  for (const s of list) {
    v.setUint16(o, s.owner, true);
    v.setFloat32(o + 2, s.x, true);
    v.setFloat32(o + 6, s.y, true);
    v.setFloat32(o + 10, s.vx, true);
    v.setFloat32(o + 14, s.vy, true);
    v.setInt8(o + 18, s.side);
    o += SHOT_BYTES;
  }
  return buf;
}

export function decodeClient(buf: ArrayBuffer): ClientMessage | null {
  const v = new DataView(buf);
  if (v.byteLength < 1) return null;
  const type = v.getUint8(0);
  if (type === MSG.INPUT && v.byteLength === INPUT_BYTES) {
    const turn = v.getFloat32(5, true);
    const aim = v.getFloat32(9, true);
    const thrust = v.getFloat32(13, true);
    const flags = v.getUint8(17);
    return {
      type,
      input: {
        seq: v.getUint32(1, true),
        // Never trust a client float: clamp steering, and drop anything that is not a real angle.
        turn: Number.isFinite(turn) ? Math.max(-1, Math.min(1, turn)) : 0,
        aim: Number.isFinite(aim) && Math.abs(aim) <= Math.PI * 2 ? aim : NaN,
        thrust: Number.isFinite(thrust) ? Math.max(-1, Math.min(1, thrust)) : 0,
        dash: (flags & 1) === 1,
        fire: (flags & 2) === 2,
      },
    };
  }
  if (type === MSG.PING && v.byteLength === 9) return { type, clientTime: v.getFloat64(1, true) };
  return null;
}

export function decodeServer(buf: ArrayBuffer): ServerMessage | null {
  const v = new DataView(buf);
  if (v.byteLength < 1) return null;
  const type = v.getUint8(0);
  if (type === MSG.WELCOME && v.byteLength === 7) return { type, id: v.getUint16(1, true), tick: v.getUint32(3, true) };
  if (type === MSG.PONG && v.byteLength === 9) return { type, clientTime: v.getFloat64(1, true) };
  if (type === MSG.SNAPSHOT && v.byteLength >= 11) {
    const count = v.getUint16(9, true);
    if (v.byteLength !== 11 + count * SHIP_BYTES) return null;
    const ships: SnapshotShip[] = [];
    let o = 11;
    for (let i = 0; i < count; i++) {
      ships.push({
        id: v.getUint16(o, true),
        x: v.getFloat32(o + 2, true),
        y: v.getFloat32(o + 6, true),
        heading: v.getFloat32(o + 10, true),
        speed: v.getFloat32(o + 14, true),
        dashTime: v.getFloat32(o + 18, true),
        dashCd: v.getFloat32(o + 22, true),
        hp: v.getFloat32(o + 26, true),
        fireCd: v.getUint8(o + 30),
        shots: v.getUint16(o + 31, true),
      });
      o += SHIP_BYTES;
    }
    return { type, tick: v.getUint32(1, true), ackSeq: v.getUint32(5, true), ships };
  }
  if (type === MSG.ASTEROIDS && v.byteLength >= 3) {
    const count = v.getUint16(1, true);
    if (v.byteLength !== 3 + count * ASTEROID_BYTES) return null;
    const asteroids: Asteroid[] = [];
    let o = 3;
    for (let i = 0; i < count; i++) {
      asteroids.push({
        id: v.getUint16(o, true),
        size: v.getUint8(o + 2),
        x: v.getFloat32(o + 3, true),
        y: v.getFloat32(o + 7, true),
        vx: v.getFloat32(o + 11, true),
        vy: v.getFloat32(o + 15, true),
        t0: v.getUint32(o + 19, true),
        hp: v.getFloat32(o + 23, true),
      });
      o += ASTEROID_BYTES;
    }
    return { type, asteroids };
  }
  if (type === MSG.GONE && v.byteLength >= 3) {
    const count = v.getUint16(1, true);
    if (v.byteLength !== 3 + count * GONE_BYTES) return null;
    const gone: GoneAsteroid[] = [];
    let o = 3;
    for (let i = 0; i < count; i++) {
      gone.push({ id: v.getUint16(o, true), x: v.getFloat32(o + 2, true), y: v.getFloat32(o + 6, true) });
      o += GONE_BYTES;
    }
    return { type, gone };
  }
  if (type === MSG.SHOTS && v.byteLength >= 7) {
    const count = v.getUint16(5, true);
    if (v.byteLength !== 7 + count * SHOT_BYTES) return null;
    const shots: ShotEvent[] = [];
    let o = 7;
    for (let i = 0; i < count; i++) {
      shots.push({
        owner: v.getUint16(o, true),
        x: v.getFloat32(o + 2, true),
        y: v.getFloat32(o + 6, true),
        vx: v.getFloat32(o + 10, true),
        vy: v.getFloat32(o + 14, true),
        side: v.getInt8(o + 18),
      });
      o += SHOT_BYTES;
    }
    return { type, tick: v.getUint32(1, true), shots };
  }
  return null;
}
