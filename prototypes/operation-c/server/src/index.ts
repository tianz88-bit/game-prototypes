import { ROOM_CODE_RE, ONLINE_PROTOCOL_VERSION } from '../../src/online-protocol';
import type { OnlineServerMessage, Seat } from '../../src/online-protocol';
import { OnlineRoom } from './room';
import type { RoomCheckpoint } from './room';
import type { RoomObjectState, RoomSocket, RoomWorkerEnvironment } from './runtime-types';

declare const WebSocketPair: { new(): { 0: WebSocket; 1: RoomSocket } };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'cache-control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } });
const KEY = 'operation-c-room-v1';
const CHECKPOINT_MS = 5000;
interface Attachment { connectionId: string; seat: Seat }
function rejectedSocket(code: string): Response {
  const messages: Record<string, string> = {
    invalidToken: 'This seat could not be authenticated. Use the original room tab or create a new room.',
    roomFull: 'This private room already has two players, including any disconnected seats.',
    roomNotFound: 'Room not found or expired. Ask your friend for a new invite.',
    roomExists: 'That room code is already in use. Create a new room.',
    versionMismatch: 'This room belongs to an older game version. Reload both players and create a new room.',
  };
  const pair = new WebSocketPair(); pair[1].accept();
  pair[1].send(JSON.stringify({ t: 'error', code, message: messages[code] ?? 'Unable to join this room.' }));
  pair[1].close(code === 'invalidToken' ? 4403 : code === 'roomNotFound' ? 4404 : 4409, code);
  return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit & { webSocket: WebSocket });
}

export default {
  async fetch(request: Request, env: RoomWorkerEnvironment): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'operation-c-online', protocol: ONLINE_PROTOCOL_VERSION });
    const code = url.pathname.match(/^\/ws\/([^/]+)$/)?.[1];
    if (!code || !ROOM_CODE_RE.test(code)) return json({ error: 'invalidRoom', message: 'Use a five-character room code' }, 404);
    if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocketRequired' }, 426);
    return env.OPERATION_C_ROOMS.get(env.OPERATION_C_ROOMS.idFromName(code)).fetch(request);
  },
};

/** Isolated SQLite-backed room; never binds or forwards to Firestorm storage. */
export class OperationCRoom {
  private room: OnlineRoom | null = null;
  private sockets = new Map<string, RoomSocket>();
  private outbox: { connectionId: string; message: OnlineServerMessage }[] = [];
  private alarmAt: number | null = null;
  private lastCheckpointMs = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly ready: Promise<void>;
  private incompatible = false;
  constructor(private readonly state: RoomObjectState, _env: RoomWorkerEnvironment) {
    this.ready = state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get<RoomCheckpoint>(KEY);
      if (!saved) return;
      if (saved.version !== 6 || saved.sim && saved.sim.version !== 6) {
        this.incompatible = true; await state.storage.deleteAlarm();
        for (const socket of state.getWebSockets()) { socket.send(JSON.stringify({ t: 'error', code: 'versionMismatch', message: 'Reload both players and create a new room for this game version.' })); socket.close(4002, 'Game version changed'); }
        return;
      }
      this.room = OnlineRoom.restore(saved, this.roomEnvironment);
      for (const socket of state.getWebSockets()) {
        const a = socket.deserializeAttachment() as Attachment | null;
        if (!a || typeof a.connectionId !== 'string' || (a.seat !== 0 && a.seat !== 1)) { socket.close(4003, 'Invalid session'); continue; }
        this.sockets.set(a.connectionId, socket);
        if (!this.room.rebind(a.connectionId, a.seat)) { socket.close(4003, 'Unknown seat'); this.sockets.delete(a.connectionId); }
      }
      this.room.advance(); await this.settle(true);
    });
  }

  private readonly roomEnvironment = {
    now: () => Date.now(), token: () => crypto.randomUUID().replace(/-/g, ''),
    send: (connectionId: string, message: OnlineServerMessage) => { this.outbox.push({ connectionId, message }); },
    close: (connectionId: string, code: number, reason: string) => {
      try { this.sockets.get(connectionId)?.close(code, reason); } catch { /* already disconnected */ }
      this.sockets.delete(connectionId);
    },
  };

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => { await this.ready; return run(); });
    this.queue = result.catch(() => undefined); return result;
  }

  fetch(request: Request): Promise<Response> {
    return this.serial(async () => {
      const url = new URL(request.url), code = url.pathname.split('/').pop()!;
      if (this.incompatible) return rejectedSocket('versionMismatch');
      if (!ROOM_CODE_RE.test(code) || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'badUpgrade' }, 426);
      const token = url.searchParams.get('token') ?? undefined, create = url.searchParams.get('create') === '1';
      if (token && !/^[a-f0-9]{32}$/.test(token)) return rejectedSocket('invalidToken');
      if (this.room?.expired()) await this.expire();
      if (!this.room && !create) return rejectedSocket('roomNotFound');
      if (this.room && create && !token) return rejectedSocket('roomExists');
      if (!this.room && token) return rejectedSocket('roomNotFound');
      if (!this.room) this.room = new OnlineRoom(code, this.roomEnvironment);
      const pair = new WebSocketPair(), connectionId = crypto.randomUUID();
      const result = this.room.connect(connectionId, token);
      if (!result.ok) return rejectedSocket(result.reason!);
      this.state.acceptWebSocket(pair[1], [`seat-${result.seat}`]);
      pair[1].serializeAttachment({ connectionId, seat: result.seat! } satisfies Attachment);
      this.sockets.set(connectionId, pair[1]); this.room.advance();
      // Welcome/token/command acknowledgements are flushed only after durable save.
      await this.settle(true);
      return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit & { webSocket: WebSocket });
    });
  }

  webSocketMessage(socket: RoomSocket, message: string | ArrayBuffer): Promise<void> {
    return this.serial(async () => {
      const a = socket.deserializeAttachment() as Attachment;
      if (typeof message !== 'string') { socket.close(1003, 'Text protocol required'); return; }
      const changed = this.room?.receive(a.connectionId, message); await this.settle(!!changed);
    });
  }
  webSocketClose(socket: RoomSocket): Promise<void> { return this.closed(socket); }
  webSocketError(socket: RoomSocket): Promise<void> { return this.closed(socket); }
  private closed(socket: RoomSocket): Promise<void> {
    return this.serial(async () => {
      const a = socket.deserializeAttachment() as Attachment;
      this.room?.advance(); this.room?.disconnect(a.connectionId); this.sockets.delete(a.connectionId); await this.settle(true);
    });
  }
  alarm(): Promise<void> {
    return this.serial(async () => {
      this.alarmAt = null;
      if (this.room?.expired()) { await this.expire(); return; }
      this.room?.advance(); await this.settle(false);
    });
  }

  private async settle(forceCheckpoint: boolean): Promise<void> {
    if (!this.room) return;
    if (forceCheckpoint || Date.now() - this.lastCheckpointMs >= CHECKPOINT_MS) {
      await this.state.storage.put(KEY, this.room.checkpoint()); this.lastCheckpointMs = Date.now();
    }
    const next = this.room.nextWakeAt();
    if (next === null) { if (this.alarmAt !== null) await this.state.storage.deleteAlarm(); this.alarmAt = null; }
    else if (this.alarmAt === null || next < this.alarmAt) {
      this.alarmAt = Math.max(Date.now() + 1, next); await this.state.storage.setAlarm(this.alarmAt);
    }
    for (const { connectionId, message } of this.outbox) {
      try { this.sockets.get(connectionId)?.send(JSON.stringify(message)); } catch { /* close event reconciles connectivity */ }
    }
    this.outbox.length = 0;
  }
  private async expire(): Promise<void> {
    for (const socket of this.sockets.values()) try { socket.close(4000, 'Room expired; create a new room'); } catch { /* already closed */ }
    this.sockets.clear(); this.outbox.length = 0; this.room = null; this.alarmAt = null;
    await this.state.storage.deleteAlarm(); await this.state.storage.deleteAll();
  }
}
