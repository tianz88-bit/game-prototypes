// Binary wire format between client and planet room. Little-endian.
//
// Client -> server
//   INPUT    u8 type, u32 seq, f32 turn, f32 aim, f32 thrust, u8 flags (bit0 dash)
//   PING     u8 type, f64 clientTimeMs
// Server -> client
//   WELCOME  u8 type, u16 yourId, u32 tick
//   SNAPSHOT u8 type, u32 tick, u32 ackSeq, u16 count, count x SHIP
//            SHIP = u16 id, f32 x, f32 y, f32 heading, f32 speed, f32 dashTime, f32 dashCd
//   PONG     u8 type, f64 clientTimeMs
import type { ShipInput, ShipState } from './ship';

export const PROTOCOL_VERSION = 2;

export const MSG = {
  INPUT: 1,
  PING: 2,
  WELCOME: 10,
  SNAPSHOT: 11,
  PONG: 12,
} as const;

/** WebSocket close codes the room uses. */
export const CLOSE = {
  ROOM_FULL: 4001,
  BAD_PROTOCOL: 4002,
} as const;

export interface SnapshotShip extends ShipState {
  id: number;
}

export type ServerMessage =
  | { type: typeof MSG.WELCOME; id: number; tick: number }
  | { type: typeof MSG.SNAPSHOT; tick: number; ackSeq: number; ships: SnapshotShip[] }
  | { type: typeof MSG.PONG; clientTime: number };

export type ClientMessage =
  | { type: typeof MSG.INPUT; input: ShipInput }
  | { type: typeof MSG.PING; clientTime: number };

const SHIP_BYTES = 2 + 4 * 6;
const INPUT_BYTES = 18;

export function encodeInput(input: ShipInput): ArrayBuffer {
  const buf = new ArrayBuffer(INPUT_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MSG.INPUT);
  v.setUint32(1, input.seq >>> 0, true);
  v.setFloat32(5, input.turn, true);
  v.setFloat32(9, input.aim, true);
  v.setFloat32(13, input.thrust, true);
  v.setUint8(17, input.dash ? 1 : 0);
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
    o += SHIP_BYTES;
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
    return {
      type,
      input: {
        seq: v.getUint32(1, true),
        // Never trust a client float: clamp steering, and drop anything that is not a real angle.
        turn: Number.isFinite(turn) ? Math.max(-1, Math.min(1, turn)) : 0,
        aim: Number.isFinite(aim) && Math.abs(aim) <= Math.PI * 2 ? aim : NaN,
        thrust: Number.isFinite(thrust) ? Math.max(-1, Math.min(1, thrust)) : 0,
        dash: (v.getUint8(17) & 1) === 1,
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
      });
      o += SHIP_BYTES;
    }
    return { type, tick: v.getUint32(1, true), ackSeq: v.getUint32(5, true), ships };
  }
  return null;
}
