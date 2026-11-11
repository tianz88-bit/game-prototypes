import { defaultConfig, validateConfig, parseRecord } from '../steroids-alpha/sim/liveConfig';
import type { ConfigData } from '../steroids-alpha/sim/liveConfig';

export const CONFIG_URL = 'https://steroids-alpha-server.tianz-88.workers.dev/config';
const STORAGE = 'steroids-alpha:calibration-lab:v1';
export let draft = defaultConfig();
export let baseVersion = 'bundled';
let session = '';
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
async function localRequest(path: string, body: unknown): Promise<any> {
  const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Steroids-Local': '1' }, body: JSON.stringify(body) });
  const result = await r.json(); if (!r.ok) throw Error(result.error || 'Publisher request failed'); return result;
}
export function isPublisher(): boolean { return location.hostname === '127.0.0.1' && location.port === '5192'; }
async function publish(): Promise<void> {
  validateConfig(draft);
  if (!isPublisher()) {
    const payload = encodeURIComponent(JSON.stringify({ data: draft, baseVersion }));
    window.open('http://127.0.0.1:5192/#draft=' + payload, '_blank', 'noopener');
    message('Opened the private publisher on this PC. If it is not running, follow the Publisher setup below. No live change has been made.'); return;
  }
  const loaded = await localRequest('load', {}); session = loaded.session;
  if (loaded.version !== baseVersion) throw Error('Live settings changed since this draft. Export it, load live settings, and review your changes before publishing.');
  const result = await localRequest('publish', { session, data: draft });
  const a = document.createElement('a'); a.href = result.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'View authenticated publish run';
  $('#publishResult').replaceChildren(a);
  message('Publish queued. Waiting for validation and activation; queued does not mean live.');
  let tries = 0;
  const check = async (): Promise<void> => {
    try {
      const r = await localRequest('status', { session });
      if (r.active) { baseVersion = r.version; remember(); message(`Live settings active: ${r.version.slice(0,12)}. Connected rooms receive the update shortly.`); return; }
      if (r.failed) { message('Publish failed. Live settings remain unchanged. Open the workflow run for details.'); return; }
      if (++tries < 90) setTimeout(() => void check(), 4000);
      else message('Publish is still pending. Check the workflow link, then Load live settings to verify.');
    } catch (e) { message((e as Error).message); }
  }; setTimeout(() => void check(), 4000);
}
export function mountDraft(): void {
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
    try { const value = JSON.parse(await file.text()); replace(value); message('Imported settings as a browser draft. Live settings are unchanged.'); } catch (error) { message((error as Error).message); }
  };
}
const friendly = (s: string): string => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, x=>x.toUpperCase());
export function mountStats(): void {
  const host = $('#stats'); host.replaceChildren();
  const groups: [string,Record<string,any>][] = [['Ship',draft.tune.ship],['Weapons',draft.tune.weapon],['Asteroids',draft.tune.asteroid],['Planet',draft.tune.planet],['Visuals',draft.clientTune.render]];
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
