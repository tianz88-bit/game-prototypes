// Steroids-Alpha milestone 1 check: real clients against a real planet room.
//
// Needs the server and a client build running first:
//   npx --yes wrangler@4.143.0 dev --config prototypes/steroids-alpha/server/wrangler.jsonc --ip 127.0.0.1 --port 8787
//   npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort
// Then:
//   node scripts/screenshot-steroids-alpha.mjs http://127.0.0.1:4173/prototypes/steroids-alpha/ <output-dir>
//
// One desktop client (menu -> Planet A, keyboard) and one phone client (touch joystick
// and dash button, with 120 ms of simulated round-trip lag) share a planet. Checks that
// each sees the other, that prediction stays in step with the server, and that there are
// no console errors.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const [base, outDir = 'outputs/steroids-alpha'] = process.argv.slice(2);
if (!base) throw new Error('Usage: screenshot-steroids-alpha.mjs <client-url> [output-dir]');
fs.mkdirSync(outDir, { recursive: true });
const url = (q) => `${base}${base.includes('?') ? '&' : '?'}${q}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Each client gets its own browser, like separate devices. Pages sharing one headless browser
// get their frames throttled when not in front, which starves the input stream and tests the harness, not the game.
const launchArgs = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const deskBrowser = await chromium.launch({ args: launchArgs });
const phoneBrowser = await chromium.launch({ args: launchArgs });
const errors = [];
const watch = (name, page) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
};
const api = (page, expr, arg) => page.evaluate(expr, arg);

try {
  // Desktop: through the menu.
  const desk = await (await deskBrowser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  watch('desktop', desk);
  await desk.goto(url('debug=1'), { waitUntil: 'networkidle' });
  await desk.waitForFunction(() => window.__steroids?.menuButtons().length === 2);
  await desk.screenshot({ path: path.join(outDir, 'desktop-menu.png') });
  const btn = (await api(desk, () => window.__steroids.menuButtons()))[0];
  assert.equal(btn.id, 'alpha');
  await desk.mouse.click(btn.x, btn.y);
  await desk.waitForFunction(() => window.__steroids.scene() === 'flight' && window.__steroids.own() !== null, null, { timeout: 10000 });

  // Ships never stop, so the desktop holds turn-right while the others join: it circles in the
  // drop zone (turn radius = speed / turn rate, about 80 px) and stays in view range of newcomers.
  const h0 = (await api(desk, () => window.__steroids.own())).heading;
  await desk.keyboard.down('ArrowRight');
  await wait(700);
  const h1 = (await api(desk, () => window.__steroids.own())).heading;
  const turned = Math.abs(((h1 - h0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  assert(turned > 1, `desktop keyboard turned the ship (${turned.toFixed(2)} rad)`);

  // Drop in and out: a third client joins, the desktop draws it, it leaves, the desktop stops drawing it.
  const before = (await api(desk, () => window.__steroids.remotes())).length;
  const thirdCtx = await phoneBrowser.newContext({ viewport: { width: 800, height: 600 } });
  const third = await thirdCtx.newPage();
  watch('third', third);
  await third.goto(url('debug=1&planet=alpha'), { waitUntil: 'networkidle' });
  await desk.waitForFunction((n) => window.__steroids.remotes().length === n + 1, before, { timeout: 5000 });
  await thirdCtx.close();
  await desk.waitForFunction((n) => window.__steroids.remotes().length === n, before, { timeout: 5000 });

  // Phone: straight in, touch controls, simulated lag.
  const phoneCtx = await phoneBrowser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const phone = await phoneCtx.newPage();
  watch('phone', phone);
  await phone.goto(url('debug=1&planet=alpha&lag=120'), { waitUntil: 'networkidle' });
  await phone.waitForFunction(() => window.__steroids.own() !== null, null, { timeout: 10000 });

  // Each sees the other.
  await desk.waitForFunction(() => window.__steroids.remotes().length >= 1, null, { timeout: 5000 });
  await phone.waitForFunction(() => window.__steroids.remotes().length >= 1, null, { timeout: 5000 });
  const ids = { desk: await api(desk, () => window.__steroids.myId()), phone: await api(phone, () => window.__steroids.myId()) };
  assert.notEqual(ids.desk, ids.phone);

  // While both are close: the desktop's interpolated view of the phone ship is near where the
  // phone predicts it. It trails by the interpolation delay plus network time, so allow a few
  // hundred ms of travel (base speed 260 px/s).
  await wait(300);
  const [phoneOwn, deskSees] = await Promise.all([
    api(phone, () => window.__steroids.own()),
    api(desk, (id) => window.__steroids.remotes().find((r) => r.id === id)?.s ?? null, ids.phone),
  ]);
  assert(deskSees, 'desktop sees the phone ship');
  const W = 4000;
  const d = (a, b) => ((a - b + W * 1.5) % W) - W / 2;
  const gap = Math.hypot(d(phoneOwn.x, deskSees.x), d(phoneOwn.y, deskSees.y));
  assert(gap < 260, `remote view within expected delay (${gap.toFixed(0)}px apart)`);
  // Pursuit: the phone steers at the circling desktop ship with the joystick until both ships
  // are on both screens, so the screenshots show a remote ship actually being drawn.
  const cdp = await phoneCtx.newCDPSession(phone);
  const vp = phone.viewportSize();
  const stick = { x: vp.width * 0.25, y: vp.height * 0.7 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...stick, id: 1 }] });
  let together = false;
  for (let i = 0; i < 60 && !together; i++) {
    const v = await api(phone, (id) => ({ own: window.__steroids.own(), them: window.__steroids.remotes().find((r) => r.id === id)?.s ?? null }), ids.desk);
    const dv = await api(desk, (id) => window.__steroids.remotes().find((r) => r.id === id)?.s ?? null, ids.phone);
    if (v.them) {
      const dx = d(v.them.x, v.own.x);
      const dy = d(v.them.y, v.own.y);
      const a = Math.atan2(dy, dx);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: stick.x + Math.cos(a) * 50, y: stick.y + Math.sin(a) * 50, id: 1 }] });
      // On the phone's screen (390 x 664) and on the desktop's (1280 x 720), with a margin.
      const deskOwn = await api(desk, () => window.__steroids.own());
      together = Math.abs(dx) < 150 && Math.abs(dy) < 280 && dv !== null && Math.abs(d(dv.x, deskOwn.x)) < 600 && Math.abs(d(dv.y, deskOwn.y)) < 320;
    }
    if (!together) await wait(100);
  }
  assert(together, 'phone caught up with the desktop ship using the joystick');
  await desk.screenshot({ path: path.join(outDir, 'desktop-flight.png') });
  await phone.screenshot({ path: path.join(outDir, 'phone-sees-desktop.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await desk.keyboard.up('ArrowRight');

  // Phone steers with the joystick (real touch events) toward screen-up, then taps dash.
  const sx = vp.width * 0.25;
  const sy = vp.height * 0.7;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - i * 10, id: 1 }] });
    await wait(16);
  }
  await wait(1500);
  const steered = await api(phone, () => window.__steroids.own());
  const upErr = Math.abs(steered.heading - -Math.PI / 2);
  assert(upErr < 0.15, `phone joystick steered toward up (heading ${steered.heading.toFixed(2)})`);
  await phone.screenshot({ path: path.join(outDir, 'phone-joystick.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  const dashBtn = { x: vp.width - 34 - 46, y: vp.height - 34 - 46 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...dashBtn, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await phone.waitForFunction(() => window.__steroids.own().dashCd > 0, null, { timeout: 2000 });
  await wait(150);
  await phone.screenshot({ path: path.join(outDir, 'phone-dash.png') });

  // Fly straight for a while. Prediction should agree with the server: corrections rare, and
  // never more than a couple of steps (one step at base speed is 260/30 = 8.7px). A jittery
  // network occasionally costs one step; anything bigger means client and server diverged.
  await Promise.all([api(phone, () => window.__steroids.resetCorrections()), api(desk, () => window.__steroids.resetCorrections())]);
  await wait(3000);
  const pStats = await api(phone, () => window.__steroids.stats());
  const dStats = await api(desk, () => window.__steroids.stats());
  for (const [name, page] of [['phone', phone], ['desktop', desk]]) {
    const c = await api(page, () => window.__steroids.corrections());
    assert(c.snapshots >= 30, `${name}: received own-ship snapshots (${c.snapshots})`);
    assert(c.max <= 18, `${name}: largest correction within two steps (${c.max.toFixed(1)}px)`);
    assert(c.count / c.snapshots <= 0.2, `${name}: corrections are rare (${c.count}/${c.snapshots})`);
    (name === 'phone' ? pStats : dStats).corrections = c;
  }
  assert(pStats.rttMs >= 100, `simulated lag visible in phone RTT (${pStats.rttMs} ms)`);

  await phone.screenshot({ path: path.join(outDir, 'phone-flight.png') });
  const fpsOf = (page) => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  const fps = { desk: await fpsOf(desk), phone: await fpsOf(phone) };

  console.log(JSON.stringify({ fps, ids, turned: Number(turned.toFixed(2)), phoneHeading: Number(steered.heading.toFixed(2)), phoneStats: pStats, deskStats: dStats, remoteGapPx: Math.round(gap), dropInOut: 'ok' }));
} finally {
  await deskBrowser.close();
  await phoneBrowser.close();
}
assert.deepEqual(errors, [], 'browser console/page errors');
console.log('Steroids-Alpha milestone 1 check passed.');
