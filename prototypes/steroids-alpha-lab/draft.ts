import { defaultConfig, validateConfig, parseRecord } from '../steroids-alpha/sim/liveConfig';
import type { ConfigData } from '../steroids-alpha/sim/liveConfig';
import { checkCalibration } from '../steroids-alpha/src/render/shipRig';

export const CONFIG_URL = 'https://steroids-alpha-server.tianz-88.workers.dev/config';
const STORAGE = 'steroids-alpha:calibration-lab:v1';
export let draft = defaultConfig();
export let baseVersion = 'bundled';
let publishWindow:Window|null=null;
let pendingPublish:{data:ConfigData;baseVersion:string}|null=null;
const PUBLISH_ORIGIN='https://steroids-alpha-server.tianz-88.workers.dev';
const $ = (s: string) => document.querySelector(s) as HTMLElement;
export function message(text: string): void { $('#saveStatus').textContent = text; }
export function remember(): void {
  try {
    validateConfig(draft);
    localStorage.setItem(STORAGE, JSON.stringify({ data: draft, baseVersion }));
    message('Draft saved in this browser. Live settings are unchanged.');
  } catch (e) { message((e as Error).message); }
}
export function replace(next: unknown, version = baseVersion): void {
  draft = validateConfig(next); baseVersion = version;
  remember(); window.dispatchEvent(new Event('lab-config'));
}
/** Calibration exports contain only the rig. Keep the current game stats and baseline intact. */
export function importSettings(value: unknown): void {
  const rig = value as {version?:unknown;modules?:unknown} | null;
  const calibrationOnly = !!rig && typeof rig === 'object' && 'version' in rig && 'modules' in rig;
  if (calibrationOnly) checkCalibration(value);
  replace(calibrationOnly ? {...draft, calibration:value} : value);
  message(calibrationOnly ? 'Imported calibration. Game stats are unchanged; live settings are unchanged.' : 'Imported settings as a browser draft. Live settings are unchanged.');
}
export function download(value: unknown, name: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function loadLive(): Promise<void> {
  const response = await fetch(CONFIG_URL, { cache: 'no-store' });
  if (!response.ok) throw Error('Live settings unavailable; bundled defaults remain usable.');
  const record = parseRecord(await response.json()); replace(record.data, record.version);
  message(`Loaded live settings ${record.version.slice(0, 12)}. Edits remain a draft until Publish.`);
}
async function publish(): Promise<void> {
  validateConfig(draft);
  pendingPublish={data:structuredClone(draft),baseVersion};
  publishWindow=window.open(PUBLISH_ORIGIN+'/manage/#draft='+encodeURIComponent(JSON.stringify(pendingPublish)),'steroids-owner-publish');
  message(publishWindow?'Sign in on the hosted publisher, review this draft, then click Publish to live there. Nothing runs on this PC.':'Allow the publisher tab to open, then click Publish again.');
}
export function mountDraft(): void {
  window.addEventListener('message',e=>{
    if(e.origin!==PUBLISH_ORIGIN||e.source!==publishWindow||!pendingPublish)return;
    if(e.data?.type==='steroids-publisher-ready')publishWindow!.postMessage({type:'steroids-lab-draft',draft:pendingPublish},PUBLISH_ORIGIN);
    if(e.data?.type==='steroids-published'&&typeof e.data.version==='string'&&/^[a-f0-9]{64}$/.test(e.data.version)){baseVersion=e.data.version;remember();message('Live settings active: '+baseVersion.slice(0,12)+'.');}
  });
  document.querySelector('#labBuild')!.textContent='Source '+__GIT_SHA__;
  let restored=false;
  try { const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null'); if (saved) { restored=true; draft = validateConfig(saved.data); baseVersion = saved.baseVersion || 'bundled'; message('Restored browser draft. Live settings are unchanged.'); } }
  catch { message('An old draft could not be loaded; using current bundled defaults.'); }
  if (location.hash.startsWith('#draft=')) {
    try { restored=true; const incoming = JSON.parse(decodeURIComponent(location.hash.slice(7))); draft = validateConfig(incoming.data); baseVersion = incoming.baseVersion; remember(); history.replaceState(null, '', location.pathname); }
    catch (e) { message((e as Error).message); }
  }
  if(!restored)setTimeout(()=>void loadLive().catch(e=>message(e.message)),0);
  $('#save').onclick = remember;
  $('#export').onclick = () => download(draft, 'steroids-alpha-settings.json');
  $('#exportCalibration').onclick = () => download(draft.calibration, 'calibration-approved.json');
  $('#loadLive').onclick = () => void loadLive().catch(e => message(e.message));
  $('#restoreDefaults').onclick = () => replace(defaultConfig(), 'bundled');
  $('#publish').onclick = () => void publish().catch(e => message(e.message));
  (document.querySelector('#import') as HTMLInputElement).onchange = async e => {
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
    try { importSettings(JSON.parse(await file.text())); } catch (error) { message((error as Error).message); }
    finally { (e.target as HTMLInputElement).value = ''; }
  };
}
const friendly = (s: string): string => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, x=>x.toUpperCase());
export function mountStats(): void {
  const host = $('#stats'); host.replaceChildren();
  const groups: [string,Record<string,any>][] = [['Ship',draft.tune.ship],['Weapons',draft.tune.weapon],['Turrets',draft.tune.turret],['Shop',draft.tune.shop],['Missile',draft.tune.missile],['Mine',draft.tune.mine],['Bots',draft.tune.bots],['Asteroids',draft.tune.asteroid],['Planet',draft.tune.planet],['Visuals',draft.clientTune.render]];
  for (const [name, values] of groups) {
    const detail = document.createElement('details'), summary = document.createElement('summary'); summary.textContent=name; detail.append(summary); if(name==='Ship')detail.open=true;
    for (const [key, value] of Object.entries(values)) {
      if(key==='partTextureMax')continue;
      const items = Array.isArray(value) ? value : [value];
      items.forEach((n,index) => {
        const label = document.createElement('label'); label.className='row';
        const text = document.createElement('span'); text.textContent=friendly(key)+(Array.isArray(value)?` · size ${index+1}`:'');
        const input = document.createElement('input'); input.type='number'; input.className='num'; input.value=String(n); input.step=key.endsWith('Steps')?'1':'any'; input.setAttribute('aria-label',name+' '+text.textContent);
        input.oninput=()=>{const v=Number(input.value);if(!Number.isFinite(v))return message('Enter a finite number');if(Array.isArray(value))value[index]=v;else values[key]=v;remember();window.dispatchEvent(new Event('lab-stats'));};
        label.append(text,input);detail.append(label);
      });
    } host.append(detail);
  }
  $('#statSummary').textContent = `Hull ${draft.tune.ship.maxHp} · ${((draft.tune.net.tickHz/draft.tune.weapon.fireIntervalSteps)).toFixed(2)} shots/s · ${(draft.tune.weapon.damage*draft.tune.net.tickHz/draft.tune.weapon.fireIntervalSteps).toFixed(1)} damage/s · bullet life ${(draft.tune.weapon.bulletLifeSteps/draft.tune.net.tickHz).toFixed(2)}s`;
}
export const currentData = (): ConfigData => draft;
