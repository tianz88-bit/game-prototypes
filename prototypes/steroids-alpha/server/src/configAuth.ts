// No shared browser/admin password: trust only this repository's main-branch publish workflow.
export const AUDIENCE = 'https://steroids-alpha-server.tianz-88.workers.dev/admin/config';
const ISSUER = 'https://token.actions.githubusercontent.com';
const REPOSITORY = 'tianz88-bit/game-prototypes';
const WORKFLOW = `${REPOSITORY}/.github/workflows/publish-steroids-alpha-config.yml@refs/heads/main`;
let cached: { until:number; keys: JsonWebKey[] } | null = null;
const bytes = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export function checkClaims(c: Record<string,unknown>, now = Date.now()/1000): void {
  if(c.iss!==ISSUER || c.aud!==AUDIENCE || c.repository!==REPOSITORY || c.repository_id!=='1323842834' || c.repository_owner_id!=='280732766' || c.ref!=='refs/heads/main' || c.workflow_ref!==WORKFLOW || c.event_name!=='workflow_dispatch') throw Error('Untrusted publishing identity');
  if(typeof c.exp!=='number' || typeof c.iat!=='number' || c.exp<now-15 || c.iat>now+30 || now-c.iat>600 || c.exp-c.iat>900) throw Error('Expired publishing identity');
}
export async function authorizePublisher(header: string | null): Promise<string> {
  if(!header?.startsWith('Bearer ') || header.length>12000)throw Error('Publisher authentication required');
  const token=header.slice(7),parts=token.split('.');if(parts.length!==3)throw Error('Invalid publishing identity');
  const h=JSON.parse(new TextDecoder().decode(bytes(parts[0]))),claims=JSON.parse(new TextDecoder().decode(bytes(parts[1])));
  if(h.alg!=='RS256' || typeof h.kid!=='string')throw Error('Invalid identity algorithm');checkClaims(claims);
  const load=async():Promise<JsonWebKey[]>=>{const r=await fetch(ISSUER+'/.well-known/jwks');if(!r.ok)throw Error('Identity verification unavailable');const j=await r.json() as {keys:JsonWebKey[]};cached={until:Date.now()+300000,keys:j.keys};return j.keys;};
  let keys=cached&&cached.until>Date.now()?cached.keys:await load();
  let jwk=keys.find(k=>(k as JsonWebKey & {kid:string}).kid===h.kid);
  if(!jwk){keys=await load();jwk=keys.find(k=>(k as JsonWebKey & {kid:string}).kid===h.kid);}
  if(!jwk)throw Error('Unknown identity key');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]).buffer as ArrayBuffer,new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('Invalid identity signature');
  return typeof claims.actor==='string'&&/^[a-zA-Z0-9-]{1,39}$/.test(claims.actor)?claims.actor:'GitHub workflow';
}
export async function readBounded(request: Request, max=32768): Promise<unknown> {
  const reader=request.body?.getReader();if(!reader)throw Error('JSON body required');let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('Configuration too large');}chunks.push(value);}
  const all=new Uint8Array(size);let at=0;for(const c of chunks){all.set(c,at);at+=c.length;}return JSON.parse(new TextDecoder().decode(all));
}
