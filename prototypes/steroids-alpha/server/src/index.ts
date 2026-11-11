import { authorizePublisher, readBounded } from './configAuth';
import { parseRecord } from '../../sim/liveConfig';
export { PlanetConfig } from './configStore';
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
  PLANET_CONFIG: RoomNamespace;
  /** Testing only (a `--var` on `wrangler dev`): ship hull points, so the browser check's ships survive. Unset in production. */
  TEST_SHIP_HP?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/config' && request.method==='GET') {
      const r=await env.PLANET_CONFIG.get(env.PLANET_CONFIG.idFromName('active')).fetch(new Request('https://internal/config'));
      return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
    }
    if (url.pathname === '/admin/config' && request.method==='POST') {
      let actor;try{actor=await authorizePublisher(request.headers.get('Authorization'));}catch{return Response.json({error:'Publisher authentication failed'},{status:401});}
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return new Response('JSON required',{status:415});
      try{const body=await readBounded(request) as {expectedVersion:string;data:unknown};
        return env.PLANET_CONFIG.get(env.PLANET_CONFIG.idFromName('active')).fetch(new Request('https://internal/config',{method:'POST',body:JSON.stringify({...body,actor})}));
      }catch(e){return Response.json({error:(e as Error).message},{status:400});}
    }
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
  private room: Room;
  private refreshAt=0;
  private refreshing:Promise<void>|null=null;
  private async refreshConfig():Promise<void>{
    if(this.refreshing)return this.refreshing;if(Date.now()<this.refreshAt)return;this.refreshAt=Date.now()+15000;
    this.refreshing=(async()=>{try{const r=await this.env.PLANET_CONFIG.get(this.env.PLANET_CONFIG.idFromName('active')).fetch(new Request('https://internal/config'));if(r.ok)this.room.applyConfig(parseRecord(await r.json()));}catch{/* Keep last known-good settings on temporary failure. */}})().finally(()=>{this.refreshing=null;});return this.refreshing;
  }

  constructor(_state: unknown, private env: Env) {
    const hp = Number(env.TEST_SHIP_HP);
    this.room = new Room(Number.isFinite(hp) && hp > 0 ? hp : undefined,()=>void this.refreshConfig());
  }

  async fetch(request: Request): Promise<Response> {
    await this.refreshConfig();
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json({ players: this.room.playerCount });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    acceptBinary(server);
    this.room.join(server, new URL(request.url).searchParams.get('name'));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }
}
