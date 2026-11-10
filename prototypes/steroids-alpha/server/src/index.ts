// Steroids-Alpha server: a Worker that routes /ws/<planet> to that planet's room.
// v1 runs one room per planet; the matchmaker (more rooms when full) comes later.
import { PROTOCOL_VERSION } from '../../sim/protocol';
import { isPlanetId } from '../../sim/planets';
import { Room, acceptBinary } from './room';
import type { CfSocket } from './room';

// The few Cloudflare runtime types used here, declared locally so the repo does
// not need @cloudflare/workers-types. Module-scoped to avoid clashing with other Workers' declarations.
declare const WebSocketPair: { new (): { 0: CfSocket; 1: CfSocket } };

interface RoomStub {
  fetch(request: Request): Promise<Response>;
}

interface RoomNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): RoomStub;
}

interface Env {
  PLANET_ROOMS: RoomNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'steroids-alpha-server', protocol: PROTOCOL_VERSION });
    }

    const planet = url.pathname.match(/^\/ws\/([a-z]+)$/)?.[1];
    if (!isPlanetId(planet)) return new Response('Not found', { status: 404 });
    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    if (url.searchParams.get('v') !== String(PROTOCOL_VERSION)) {
      return new Response('Client out of date, reload the page', { status: 409 });
    }
    const stub = env.PLANET_ROOMS.get(env.PLANET_ROOMS.idFromName(`${planet}:1`));
    return stub.fetch(request);
  },
};

/** Durable Object: one per running planet room. */
export class PlanetRoom {
  private room = new Room();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json({ players: this.room.playerCount });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    acceptBinary(server);
    this.room.join(server);
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }
}
