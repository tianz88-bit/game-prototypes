import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Mock tests for the portal layer. The portal SDKs are replaced by small fakes
// that follow the documented APIs; nothing here talks to a real portal.
const load = async (portalId, ads = true) => {
  const out = await build({
    stdin: { contents: `export * from './prototypes/punchies/src/portal/index'; export { setGameplay } from './prototypes/punchies/src/portal/gameplay'; export { KEYS, MASTER_KEYS, DEV_KEYS } from './prototypes/punchies/src/portal/keys'; export { track, getEventLog, clearEventLog } from './prototypes/punchies/src/portal/analytics';`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', write: false,
    define: { __PUNCHIES_PORTAL__: JSON.stringify(portalId), __PUNCHIES_PORTAL_ADS__: JSON.stringify(ads) },
  });
  const text = out.outputFiles[0].text;
  bundles[portalId] = text;
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}#${portalId}${ads}${Math.random()}`);
};
const bundles = {};
// Script tags "load" instantly.
globalThis.document = { createElement: () => ({}), head: { appendChild(s) { queueMicrotask(() => s.onload?.()); } } };

// ---- web (default): memory fallback without localStorage, preview ads ----
{
  const m = await load('web');
  await m.initPortal();
  m.store.setItem('a', '1');
  assert.equal(m.store.getItem('a'), '1');
  m.store.removeItem('a');
  assert.equal(m.store.getItem('a'), null);
  assert.equal(m.portal.ads.kind, 'preview');
  assert.equal(await m.showRewardedAd('shop_token'), 'rewarded');
}

// ---- CrazyGames ----
{
  const calls = [];
  const data = new Map();
  let nextAd = 'finish';
  globalThis.CrazyGames = { SDK: {
    init: async () => calls.push('init'),
    game: { gameplayStart: () => calls.push('start'), gameplayStop: () => calls.push('stop'), loadingStop: () => calls.push('loaded') },
    ad: { requestAd(type, cb) { calls.push(`ad:${type}`); cb.adStarted(); if (nextAd === 'finish') { cb.adFinished(); cb.adFinished(); } else cb.adError({ reason: 'unfilled' }); } },
    data: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) },
  } };
  const m = await load('crazygames');
  await m.initPortal();
  assert.deepEqual(calls, ['init']);
  m.loadingFinished(); m.loadingFinished();
  m.setGameplay(true); m.setGameplay(true); m.setGameplay(false); m.setGameplay(false); m.setGameplay(true);
  assert.deepEqual(calls.slice(1), ['loaded', 'start', 'stop', 'start'], 'loaded once, start/stop de-duplicated');
  m.store.setItem('k', 'v');
  assert.equal(data.get('k'), 'v', 'saves go to the portal data module');
  assert.equal(m.store.getItem('k'), 'v');
  assert.equal(await m.showRewardedAd('shop_token'), 'rewarded');
  assert.ok(calls.includes('ad:rewarded'));
  assert.equal(calls.filter((c) => c === 'stop').length, 2, 'showing an ad stops gameplay first');
  nextAd = 'error';
  assert.equal(await m.showRewardedAd('shop_token'), 'failed', 'adError never rewards');
  const off = await load('crazygames', false);
  await off.initPortal();
  assert.equal(off.portal.ads.available, false);
  assert.equal(await off.showRewardedAd('shop_token'), 'unavailable');
  // SDK failing to load falls back to local storage and no ads
  globalThis.document.head.appendChild = (s) => queueMicrotask(() => s.onerror?.());
  const broken = await load('crazygames');
  await broken.initPortal();
  assert.equal(broken.portal.ads.available, false);
  broken.store.setItem('x', '2');
  assert.equal(broken.store.getItem('x'), '2');
  globalThis.document.head.appendChild = (s) => queueMicrotask(() => s.onload?.());
  delete globalThis.CrazyGames;
}

// ---- Poki ----
{
  const calls = [];
  let reward = true;
  globalThis.PokiSDK = {
    init: () => Promise.reject(new Error('init failed, load anyway')),
    gameLoadingFinished: () => calls.push('loaded'), gameplayStart: () => calls.push('start'), gameplayStop: () => calls.push('stop'),
    rewardedBreak: async (before) => { before(); calls.push('rewardedBreak'); return reward; },
  };
  const m = await load('poki');
  await m.initPortal();
  m.loadingFinished();
  m.setGameplay(true); m.setGameplay(false);
  assert.deepEqual(calls, ['loaded', 'start', 'stop']);
  assert.equal(await m.showRewardedAd('shop_token'), 'rewarded');
  reward = false;
  assert.equal(await m.showRewardedAd('shop_token'), 'failed', 'a skipped ad gives no reward');
  delete globalThis.PokiSDK;
}

// ---- Playgama ----
{
  const sent = [];
  const handlers = [];
  const saved = new Map([['punchies:shop-preview:v1', '{"t":1}']]);
  let states = ['opened', 'rewarded', 'closed'];
  globalThis.bridge = {
    initialize: async () => {},
    EVENT_NAME: { REWARDED_STATE_CHANGED: 'rewarded_state_changed' },
    platform: { sendMessage: (m) => sent.push(m) },
    advertisement: {
      on: (e, cb) => handlers.push(cb), off: (e, cb) => handlers.splice(handlers.indexOf(cb), 1),
      showRewarded: () => states.forEach((s) => handlers.slice().forEach((h) => h(s))),
    },
    storage: { get: async (keys) => keys.map((k) => saved.get(k) ?? null), set: async (k, v) => saved.set(k, v), delete: async (k) => saved.delete(k) },
  };
  const m = await load('playgama');
  await m.initPortal();
  assert.equal(m.store.getItem(m.KEYS.shop), '{"t":1}', 'registered keys are preloaded before the first read');
  m.store.setItem(m.KEYS.audio, 'x');
  assert.equal(m.store.getItem(m.KEYS.audio), 'x');
  assert.equal(saved.get(m.KEYS.audio), 'x');
  m.loadingFinished();
  m.setGameplay(true); m.setGameplay(false); m.setGameplay(true);
  assert.deepEqual(sent, ['game_ready', 'level_started', 'level_paused', 'level_resumed']);
  assert.equal(await m.showRewardedAd('shop_token'), 'rewarded');
  states = ['opened', 'closed'];
  assert.equal(await m.showRewardedAd('shop_token'), 'failed', 'closing without the rewarded state gives no reward');
  states = ['failed'];
  assert.equal(await m.showRewardedAd('shop_token'), 'failed');
  assert.equal(handlers.length, 0, 'listeners are removed after each ad');
  delete globalThis.bridge;
}

// ---- analytics ----
{
  const m = await load('web');
  m.clearEventLog();
  m.track('shop', 'earn_tokens', 'visible');
  m.track('match', 'VsAI', 'win', { level: 'hard' });
  const log = m.getEventLog();
  assert.deepEqual(log.map((e) => `${e.category}/${e.what}/${e.action}`), ['shop/earn_tokens/visible', 'match/VsAI/win']);
  assert.deepEqual(log[1].props, { level: 'hard' });
  for (let i = 0; i < 400; i++) m.track('x', 'y', 'z', { i });
  assert.equal(m.getEventLog().length, 300, 'the local log is capped');
  m.clearEventLog();
  assert.equal(m.getEventLog().length, 0);

  const measured = [];
  globalThis.PokiSDK = { init: async () => {}, gameLoadingFinished() {}, gameplayStart() {}, gameplayStop() {}, rewardedBreak: async () => true, measure: (...a) => measured.push(a) };
  const poki = await load('poki');
  await poki.initPortal();
  poki.track('rewarded', 'shop_token', 'visible', { extra: 1 });
  assert.deepEqual(measured, [['rewarded', 'shop_token', 'visible']], 'Poki gets category, what, action');
  assert.equal(poki.getEventLog()[0].props.extra, 1, 'extra props stay in the local log');
  globalThis.PokiSDK.measure = () => { throw new Error('sdk down'); };
  poki.track('a', 'b', 'c');
  assert.equal(poki.getEventLog().length, 2, 'an SDK error never breaks the game');
  delete globalThis.PokiSDK;

  const sent = [];
  globalThis.bridge = { initialize: async () => {}, EVENT_NAME: {}, platform: { sendMessage() {} }, advertisement: { on() {}, showRewarded() {} },
    storage: { get: async (k) => k.map(() => null), set: async () => {}, delete: async () => {} }, analytics: { send: (...a) => sent.push(a) } };
  const pg = await load('playgama');
  await pg.initPortal();
  pg.track('match', 'VsAI', 'win', { level: 'hard' });
  assert.deepEqual(sent, [['match_win', { what: 'VsAI', level: 'hard' }]], 'Playgama gets a short snake_case name and flat data');
  delete globalThis.bridge;
  // CrazyGames has no custom event module: local log only, nothing thrown
  globalThis.CrazyGames = { SDK: { init: async () => {}, game: { gameplayStart() {}, gameplayStop() {} }, ad: {}, data: { getItem: () => null, setItem() {}, removeItem() {} } } };
  const cg = await load('crazygames');
  await cg.initPortal();
  cg.track('a', 'b', 'c');
  assert.equal(cg.getEventLog().length, 1);
  delete globalThis.CrazyGames;
}

// ---- a build only carries its own portal SDK address ----
const sdkAddress = { web: [], crazygames: ['crazygames-sdk'], poki: ['poki-sdk'], playgama: ['playgama-bridge'] };
for (const [id, text] of Object.entries(bundles)) {
  for (const [other, needles] of Object.entries(sdkAddress)) for (const n of needles) assert.equal(text.includes(n), other === id, `${id} build ${other === id ? 'must' : 'must not'} contain ${n}`);
}

// ---- every save goes through the portal store, with a registered key ----
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const registry = await load('web');
const keyValues = [...Object.values(registry.KEYS), ...Object.values(registry.DEV_KEYS)];
assert.deepEqual(registry.KEYS, registry.MASTER_KEYS, 'production aliases preserve existing player saves');
assert.equal(new Set(keyValues).size, keyValues.length, 'storage keys are unique');
for (const file of walk('prototypes/punchies/src')) {
  if (file.replaceAll('\\','/').includes('/portal/') || file.replaceAll('\\','/').includes('/debug/')) continue; // debug tools keep their own local flag on purpose
  const text = readFileSync(file, 'utf8');
  const code = text.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/localStorage\./.test(code), `${file} must use the portal store, not localStorage`);
  assert.ok(!/['"`]punchies:[a-zA-Z-]+:v\d+['"`]/.test(code), `${file} must take its storage key from portal/keys.ts`);
}
console.log('PASS: portal layer: web fallback, CrazyGames/Poki/Playgama adapters against mocks (gameplay de-duplication, rewarded ads grant only on success, analytics routing and local log, save routing and preload, SDK-load failure fallback), and every save uses a registered key.');
