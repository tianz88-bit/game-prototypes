import type { Look } from './unlocks';
// Protocol v13: binary game frames are little-endian. The server also sends JSON text frames:
//   {type:'config',record:ConfigRecord}            before welcome/cutover snapshots
//   {type:'roster',players:[{id,name,kills,power}]} on join/leave, and when anyone's power changes (2 Hz max)
//   {type:'deaths',deaths:[{id,x,y,killer}]}       ships destroyed (killer 0 = an asteroid)
//   {type:'rams',rams:[{id,target,x,y}]}            dash rams (rammer, rammed, where)
//   {type:'hits',hits:[{id,x,y,shielded}]}         where ships were hit, and whether the shield took it
//   {type:'pickups',add:[{id,x,y,kind,value}],remove:[{id,by}]} health boosts and minerals dropped, taken (by = ship id) or expired (by 0)
// Clients never send configuration; their socket accepts only bounded intent/ping frames.
//
// Client -> server
//   INPUT     u8 type, u32 seq, f32 turn, f32 aim, f32 thrust, u8 flags (bit0 dash, bit1 fire, bit2 missile, bit3 mine, bit4 warp), f32 dashAim (NaN = straight)
//   BUY       u8 type, u8 item (index in sim/shop.ts SHOP_ITEMS), u8 tier (the tier being bought, so a repeated tap cannot buy twice)
//   PING      u8 type, f64 clientTimeMs
// Server -> client
//   WELCOME   u8 type, u16 yourId, u32 tick
//   SNAPSHOT  u8 type, u32 tick, u32 ackSeq, u16 count, count x SHIP
//             SHIP = u16 id, f32 x, f32 y, f32 heading, f32 speed, f32 dashTime, f32 dashCd,
//                    f32 hp, f32 shield, f32 kx, f32 ky, u8 fireCd, u16 shots, f32 heat, u8 overheated, u8 turrets, u8 shieldTier, u8 damageTier, f32 dashCharge, f32 hullMax,
//                    u8 missileTier, u8 mineTier, u8 missileCharges, u8 mineCharges, f32 missileCd, f32 mineCd,
//                    u16 missileShots, u16 mineShots, f32 lockdown, u8 warping, f32 warpDist, f32 salvage, u8 chassis, f32 shieldCd
//   ORDNANCE  u8 type, u16 count, count x (u16 id, u8 kind 0 missile / 1 mine, u16 owner, f32 x, f32 y,
//             f32 heading, u8 hp percent, u8 armed, u16 target): missiles and mines near you, every snapshot
//   PONG      u8 type, f64 clientTimeMs
//   ASTEROIDS u8 type, u16 count, count x (u16 id, u8 size, f32 x, f32 y, f32 vx, f32 vy, u32 t0, f32 hp, u8 family)
//             New asteroids, or ones whose hp changed. Sent in full to a client when it joins.
//   GONE      u8 type, u16 count, count x (u16 id, f32 x, f32 y)   asteroids destroyed, and where
//   SHOTS     u8 type, u32 tick, u16 count, count x (u16 owner, f32 x, f32 y, f32 vx, f32 vy, i8 side)
//             side: -1/1 main guns, 10+i turret i (sim/turrets.ts)
import type { ShipInput, ShipState } from './ship';
import type { Asteroid } from './asteroids';
import type { ShotEvent } from './world';

export const PROTOCOL_VERSION = 19;

export const MSG = {
  INPUT: 1,
  PING: 2,
  BUY: 3,
  WELCOME: 10,
  SNAPSHOT: 11,
  PONG: 12,
  ASTEROIDS: 13,
  GONE: 14,
  SHOTS: 15,
  ORDNANCE: 16,
} as const;

/** WebSocket close codes the room uses. */
export const CLOSE = {
  ROOM_FULL: 4001,
  BAD_PROTOCOL: 4002,
  DESTROYED: 4003,
  /** The ship completed its warp run and left the planet. */
  EXTRACTED: 4004,
} as const;

export interface SnapshotShip extends ShipState {
  id: number;
}

/** Text frames from the server (besides config). */
export interface RosterEntry {
  id: number;
  name: string;
  kills: number;
  /** Hull maximum (power, the minerals invested): the leaderboard ranks by this. */
  power: number;
  /** Current upgrades across all five shop categories; absent on older servers. */
  level?: number;
  /** Authoritative roster metadata; names never determine bot identity. Absent on older servers. */
  bot?: boolean;
  /** Cosmetics worn (owned unlocks only, checked by the server). */
  look?: Look;
}

/** Player names: trimmed, printable, at most 16 characters; empty means none given. */
export function cleanName(raw: string | null | undefined): string {
  return Array.from((raw ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 16).join('');
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
  | { type: typeof MSG.SHOTS; tick: number; shots: ShotEvent[] }
  | { type: typeof MSG.ORDNANCE; items: OrdnanceView[] };

/** A missile or mine as clients see it. */
export interface OrdnanceView {
  id: number;
  kind: 0 | 1;
  owner: number;
  /** Ship a missile is locked on (0: none; always 0 for mines). */
  target: number;
  x: number;
  y: number;
  heading: number;
  /** 0..1 */
  hp: number;
  armed: boolean;
}

export type ClientMessage =
  | { type: typeof MSG.INPUT; input: ShipInput }
  | { type: typeof MSG.PING; clientTime: number }
  | { type: typeof MSG.BUY; item: number; tier: number };


export function encodeBuy(item: number, tier: number): ArrayBuffer {
  const buf = new ArrayBuffer(3);
  const v = new DataView(buf);
  v.setUint8(0, MSG.BUY);
  v.setUint8(1, item);
  v.setUint8(2, tier);
  return buf;
}

/** The only client frame sizes the server accepts: ping, input, buy. */
export const INPUT_BYTES = 22;
export const PING_BYTES = 9;
export const BUY_BYTES = 3;
const SHIP_BYTES = 2 + 4 * 10 + 1 + 2 + 4 + 1 + 3 + 8 + 4 + 8 + 4 + 9 + 4 + 1 + 4;
const ASTEROID_BYTES = 2 + 1 + 4 * 4 + 4 + 4 + 1;
const GONE_BYTES = 2 + 4 * 2;
const SHOT_BYTES = 2 + 4 * 4 + 1;
const ORDNANCE_BYTES = 2 + 1 + 2 + 4 * 3 + 1 + 1 + 2;

export function encodeInput(input: ShipInput): ArrayBuffer {
  const buf = new ArrayBuffer(INPUT_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MSG.INPUT);
  v.setUint32(1, input.seq >>> 0, true);
  v.setFloat32(5, input.turn, true);
  v.setFloat32(9, input.aim, true);
  v.setFloat32(13, input.thrust, true);
  v.setUint8(17, (input.dash ? 1 : 0) | (input.fire ? 2 : 0) | (input.missile ? 4 : 0) | (input.mine ? 8 : 0) | (input.warp ? 16 : 0));
  v.setFloat32(18, input.dashAim, true);
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
    v.setFloat32(o + 30, s.shield, true);
    v.setFloat32(o + 34, s.kx, true);
    v.setFloat32(o + 38, s.ky, true);
    v.setUint8(o + 42, s.fireCd);
    v.setUint16(o + 43, s.shots, true);
    v.setFloat32(o + 45, s.heat, true);
    v.setUint8(o + 49, s.overheated ? 1 : 0);
    v.setUint8(o + 50, s.turrets);
    v.setUint8(o + 51, s.shieldTier);
    v.setUint8(o + 52, s.damageTier);
    v.setFloat32(o + 53, s.dashCharge, true);
    v.setFloat32(o + 57, s.hullMax, true);
    v.setUint8(o + 61, s.missileTier);
    v.setUint8(o + 62, s.mineTier);
    v.setUint8(o + 63, s.missileCharges);
    v.setUint8(o + 64, s.mineCharges);
    v.setFloat32(o + 65, s.missileCd, true);
    v.setFloat32(o + 69, s.mineCd, true);
    v.setUint16(o + 73, s.missileShots, true);
    v.setUint16(o + 75, s.mineShots, true);
    v.setFloat32(o + 77, s.lockdown, true);
    v.setUint8(o + 81, s.warping ? 1 : 0);
    v.setFloat32(o + 82, s.warpDist, true);
    v.setFloat32(o + 86, s.salvage, true);
    v.setUint8(o + 90, s.chassis);
    v.setFloat32(o + 91, s.shieldCd, true);
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
    v.setUint8(o + 27, a.family ?? 0);
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

export function encodeOrdnance(items: OrdnanceView[]): ArrayBuffer {
  const buf = new ArrayBuffer(3 + items.length * ORDNANCE_BYTES);
  const v = new DataView(buf);
  v.setUint8(0, MSG.ORDNANCE);
  v.setUint16(1, items.length, true);
  let o = 3;
  for (const it of items) {
    v.setUint16(o, it.id, true);
    v.setUint8(o + 2, it.kind);
    v.setUint16(o + 3, it.owner, true);
    v.setFloat32(o + 5, it.x, true);
    v.setFloat32(o + 9, it.y, true);
    v.setFloat32(o + 13, it.heading, true);
    v.setUint8(o + 17, Math.max(0, Math.min(100, Math.round(it.hp * 100))));
    v.setUint8(o + 18, it.armed ? 1 : 0);
    v.setUint16(o + 19, it.target, true);
    o += ORDNANCE_BYTES;
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
    const dashAim = v.getFloat32(18, true);
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
        missile: (flags & 4) === 4,
        mine: (flags & 8) === 8,
        warp: (flags & 16) === 16,
        dashAim: Number.isFinite(dashAim) && Math.abs(dashAim) <= Math.PI * 2 ? dashAim : NaN,
      },
    };
  }
  if (type === MSG.BUY && v.byteLength === 3) return { type, item: v.getUint8(1), tier: v.getUint8(2) };
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
        shield: v.getFloat32(o + 30, true),
        kx: v.getFloat32(o + 34, true),
        ky: v.getFloat32(o + 38, true),
        fireCd: v.getUint8(o + 42),
        shots: v.getUint16(o + 43, true),
        heat: v.getFloat32(o + 45, true),
        overheated: v.getUint8(o + 49) === 1,
        turrets: v.getUint8(o + 50),
        shieldTier: v.getUint8(o + 51),
        damageTier: v.getUint8(o + 52),
        dashCharge: v.getFloat32(o + 53, true),
        hullMax: v.getFloat32(o + 57, true),
        missileTier: v.getUint8(o + 61),
        mineTier: v.getUint8(o + 62),
        missileCharges: v.getUint8(o + 63),
        mineCharges: v.getUint8(o + 64),
        missileCd: v.getFloat32(o + 65, true),
        mineCd: v.getFloat32(o + 69, true),
        missileShots: v.getUint16(o + 73, true),
        mineShots: v.getUint16(o + 75, true),
        lockdown: v.getFloat32(o + 77, true),
        warping: v.getUint8(o + 81) === 1,
        warpDist: v.getFloat32(o + 82, true),
        salvage: v.getFloat32(o + 86, true),
        chassis: Math.min(2, v.getUint8(o + 90)),
        shieldCd: v.getFloat32(o + 91, true),
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
        family: Math.min(2, v.getUint8(o + 27)),
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
  if (type === MSG.ORDNANCE && v.byteLength >= 3) {
    const count = v.getUint16(1, true);
    if (v.byteLength !== 3 + count * ORDNANCE_BYTES) return null;
    const items: OrdnanceView[] = [];
    let o = 3;
    for (let i = 0; i < count; i++) {
      items.push({
        id: v.getUint16(o, true),
        kind: v.getUint8(o + 2) === 1 ? 1 : 0,
        owner: v.getUint16(o + 3, true),
        x: v.getFloat32(o + 5, true),
        y: v.getFloat32(o + 9, true),
        heading: v.getFloat32(o + 13, true),
        hp: v.getUint8(o + 17) / 100,
        armed: v.getUint8(o + 18) === 1,
        target: v.getUint16(o + 19, true),
      });
      o += ORDNANCE_BYTES;
    }
    return { type, items };
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
