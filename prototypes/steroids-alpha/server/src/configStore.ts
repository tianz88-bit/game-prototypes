import { bundledRecord, validateConfig } from '../../sim/liveConfig';
import type { ConfigRecord } from '../../sim/liveConfig';
export interface ConfigStorage {
  get<T>(key:string):Promise<T|undefined>;
  put(key:string,value:unknown):Promise<void>;
  transaction<T>(fn:(tx:ConfigStorage)=>Promise<T>):Promise<T>;
}
interface Saved { active:ConfigRecord; history:ConfigRecord[] }
export async function publishConfig(storage:ConfigStorage,expected:string,input:unknown,actor:string):Promise<ConfigRecord> {
  const data=validateConfig(input),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
  const version=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  return storage.transaction(async tx=>{
    const old=await tx.get<Saved>('settings')??{active:bundledRecord(),history:[]};
    if(old.active.version!==expected)throw Error('Live settings changed; reload and review before publishing');
    if(old.active.version===version)return old.active;
    const active={version,publishedAt:new Date().toISOString(),actor,data};
    await tx.put('settings',{active,history:[old.active,...old.history].slice(0,10)});return active;
  });
}
/** This namespace is reachable only through the Worker's fixed, authenticated routes. */
export class PlanetConfig {
  constructor(private state:{storage:ConfigStorage}){}
  async fetch(request:Request):Promise<Response>{
    if(request.method==='GET')return Response.json((await this.state.storage.get<Saved>('settings'))?.active??bundledRecord());
    if(request.method!=='POST')return new Response('Not found',{status:404});
    try{
      const p=await request.json() as {expectedVersion:string;data:unknown;actor:string};
      return Response.json(await publishConfig(this.state.storage,p.expectedVersion,p.data,p.actor));
    }catch(e){return Response.json({error:(e as Error).message},{status:409});}
  }
}
