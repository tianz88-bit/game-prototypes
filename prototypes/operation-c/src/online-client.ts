import { OperationSim } from './sim';
import { applyOnlineState, ONLINE_PROTOCOL_VERSION } from './online-protocol';
import type { ClientMessage, OnlineCommand, OnlineLobby, OnlineState, Seat, ServerMessage } from './online-protocol';
import type { Tune, CardKind } from './model';

/** The browser only mirrors server state. It never advances an online simulation. */
export class RemoteOperationSim extends OperationSim {
  frame: OnlineState | null = null;
  constructor(tune?:Tune){super({tune,bot:false});}
  override resources(playerId:number){return this.frame?.resources[playerId]??super.resources(playerId);}
  apply(frame:OnlineState){
    this.frame=frame;this.timeMs=frame.timeMs;this.winner=frame.winner;
    // Keep the hex identities referenced by the rules' lookup map.
    const byId=new Map(frame.entities.hexes.map(h=>[h.id,h]));
    for(const hex of this.hexes){const fresh=byId.get(hex.id);if(!fresh)continue;for(const key of Object.keys(hex))delete (hex as unknown as Record<string,unknown>)[key];Object.assign(hex,structuredClone(fresh));}
    this.players.splice(0,this.players.length,...structuredClone(frame.players));
    this.loadouts.splice(0,this.loadouts.length,...structuredClone(frame.loadouts));
    this.buildings.splice(0,this.buildings.length,...structuredClone(frame.entities.buildings));
    this.units.splice(0,this.units.length,...structuredClone(frame.entities.units));
    this.shots.splice(0,this.shots.length,...structuredClone(frame.entities.shots));
    this.reinforcements.splice(0,this.reinforcements.length,...structuredClone(frame.entities.reinforcements));
    this.retirements.splice(0,this.retirements.length,...structuredClone(frame.entities.retirements));
    this.pendingReleases.splice(0,this.pendingReleases.length,...structuredClone(frame.pendingReleases));
  }
}

type Result={ok:boolean;reason?:string};
type RequestBody<T=ClientMessage>=T extends {requestId:string|number}?Omit<T,'requestId'>:never;
export class OnlineConnection {
  seat:Seat|null=null;connected=false;status='Connecting…';lobby:OnlineLobby|null=null;
  sim=new RemoteOperationSim();state:OnlineState|null=null;error:string|null=null;
  private ws:WebSocket|null=null;private token='';private requestId=0;private readonly requestPrefix=crypto.randomUUID();private stopped=false;
  private retryTimer:ReturnType<typeof setTimeout>|undefined;private retries=0;
  private waiting=new Map<string,{resolve:(result:Result)=>void;timer:ReturnType<typeof setTimeout>}>();
  private readonly storageKey:string;
  constructor(readonly endpoint:string,readonly roomCode:string,private create:boolean,invite:boolean,private changed:()=>void){
    this.storageKey=`operation-c:room:${new URL(endpoint).origin}:${roomCode}:${invite?'guest':'host'}`;
    try{this.token=sessionStorage.getItem(this.storageKey)??'';}catch{/* Storage can be unavailable in private browsing. */}
    this.connect();
  }
  private connect(){
    if(this.stopped)return;
    const url=new URL(`/ws/${this.roomCode}`,this.endpoint);url.protocol=url.protocol==='https:'?'wss:':'ws:';
    if(this.token)url.searchParams.set('token',this.token);else if(this.create)url.searchParams.set('create','1');
    this.status=this.retries?'Reconnecting…':'Connecting…';this.changed();
    const ws=new WebSocket(url);this.ws=ws;
    ws.onmessage=event=>{
      let message:ServerMessage;try{message=JSON.parse(String(event.data)) as ServerMessage;}catch{return;}
      if(message.t==='welcome'){
        if(message.v!==ONLINE_PROTOCOL_VERSION){this.error='Game versions differ. Reload both players.';this.close();this.changed();return;}
        this.seat=message.seat;this.token=message.token;this.lobby=message.lobby;this.connected=true;this.status='Connected';this.error=null;this.retries=0;this.create=false;
        try{sessionStorage.setItem(this.storageKey,this.token);}catch{/* Reconnect within this page still uses the in-memory token. */}
        if(!this.state)this.sim=new RemoteOperationSim(message.tune);
      }else if(message.t==='lobby')this.lobby=message;
      else if(message.t==='state'){
        const state=applyOnlineState(this.state,message);
        if(!state){this.send({t:'resync'});return;}
        this.state=state;this.sim.apply(state);
      }else if(message.t==='ack'){
        const pending=this.waiting.get(String(message.requestId));
        if(pending){clearTimeout(pending.timer);this.waiting.delete(String(message.requestId));pending.resolve(message);}
      }else if(message.t==='error'){this.error=message.message;this.status=message.message;this.stopped=true;ws.close();}
      this.changed();
    };
    ws.onclose=event=>{
      if(this.ws!==ws)return;this.connected=false;
      if(event.code===4001||event.code===4000){this.stopped=true;this.status=event.code===4001?'This seat is open in another tab.':'Room expired. Create a new room.';}
      for(const pending of this.waiting.values()){clearTimeout(pending.timer);pending.resolve({ok:false,reason:'Connection lost; match continues.'});}this.waiting.clear();
      if(!this.stopped&&this.retries<8){this.retries++;this.status='Reconnecting — match continues';this.retryTimer=setTimeout(()=>this.connect(),Math.min(5000,500*2**(this.retries-1)));}
      else if(!this.stopped)this.status='Disconnected. Reload to rejoin.';
      this.changed();
    };
    ws.onerror=()=>{this.status='Cannot connect to the room server.';this.changed();};
  }
  private send(message:ClientMessage){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(message));}
  private request(message:RequestBody):Promise<Result>{
    if(!this.connected)return Promise.resolve({ok:false,reason:this.status});
    const requestId=`${this.requestPrefix}:${++this.requestId}`;
    return new Promise(resolve=>{const timer=setTimeout(()=>{this.waiting.delete(requestId);resolve({ok:false,reason:'Server response delayed. Check your connection.'});},8000);this.waiting.set(requestId,{resolve,timer});this.send({...message,requestId} as ClientMessage);});
  }
  command(command:OnlineCommand){return this.request({t:'command',command});}
  async ready(cards:CardKind[]){
    const loadout=await this.request({t:'loadout',cards});
    return loadout.ok?this.request({t:'ready',ready:true}):loadout;
  }
  unready(){return this.request({t:'ready',ready:false});}
  close(){this.stopped=true;clearTimeout(this.retryTimer);this.ws?.close();this.connected=false;}
}
