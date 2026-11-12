// Access is a separate owner-only identity. GitHub workflow publishing keeps its existing trust.
export interface AdminEnv { ADMIN_ACCESS_TEAM?:string; ADMIN_ACCESS_AUD?:string; ADMIN_OWNER_EMAIL?:string }
const cache=new Map<string,{until:number;keys:JsonWebKey[]}>();
const decode=(s:string):Uint8Array=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export function adminConfigured(env:AdminEnv):boolean{return !!env.ADMIN_ACCESS_TEAM&&/^[a-z0-9-]{1,63}$/.test(env.ADMIN_ACCESS_TEAM)&&!!env.ADMIN_ACCESS_AUD&&/^[a-f0-9]{64}$/.test(env.ADMIN_ACCESS_AUD)&&!!env.ADMIN_OWNER_EMAIL;}
export async function authorizeAdmin(request:Request,env:AdminEnv):Promise<void>{
 if(!adminConfigured(env))throw Error('Hosted publishing is not configured.');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token||token.length>12000)throw Error('Sign in required.');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid sign-in.');
 const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
 const issuer=`https://${env.ADMIN_ACCESS_TEAM}.cloudflareaccess.com`,now=Date.now()/1000;
 if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(env.ADMIN_ACCESS_AUD)||typeof claims.exp!=='number'||claims.exp<=now||typeof claims.iat!=='number'||claims.iat>now+30||typeof claims.email!=='string'||claims.email.toLowerCase()!==env.ADMIN_OWNER_EMAIL!.trim().toLowerCase())throw Error('Owner sign-in required.');
 const load=async()=>{const r=await fetch(issuer+'/cdn-cgi/access/certs');if(!r.ok)throw Error('Sign-in verification unavailable.');const body=await r.json() as {keys:JsonWebKey[]};cache.set(issuer,{until:Date.now()+300000,keys:body.keys});return body.keys;};
 const saved=cache.get(issuer);let keys=saved&&saved.until>Date.now()?saved.keys:await load();let key=keys.find(k=>(k as JsonWebKey&{kid:string}).kid===header.kid);
 if(!key){keys=await load();key=keys.find(k=>(k as JsonWebKey&{kid:string}).kid===header.kid);}if(!key)throw Error('Unknown sign-in key.');
 const imported=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',imported,decode(parts[2]).buffer as ArrayBuffer,new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('Invalid sign-in signature.');
}
