// Steroids-Alpha milestone 1 check: real clients against a real planet room.
//
// Needs the server and a client build running first:
//   npx --yes wrangler@4.143.0 dev --config prototypes/steroids-alpha/server/wrangler.jsonc --ip 127.0.0.1 --port 8787 --var TEST_SHIP_HP:100000
//   (any TEST_SHIP_HP makes test ships take no damage; deaths are covered by test-steroids-alpha-sim.mjs)
//   npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort
// Then:
//   node scripts/screenshot-steroids-alpha.mjs http://127.0.0.1:4173/prototypes/steroids-alpha/ <output-dir>
//
// Needs a machine that keeps both headless clients near 30 FPS (a GPU helps). On an overloaded
// box (software WebGL in a small container ran at about 6 FPS with 1-2 s of input backlog) the
// prediction and planet-rotation checks fail because the clients starve, not because of the game.
//
// One desktop client (menu -> Planet B, keyboard) and one phone client (touch joystick
// fire and dash buttons, with 120 ms of simulated round-trip lag) share a planet. Checks that
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
  const named = async (ctx, name) => {
    await ctx.addInitScript((n) => localStorage.setItem('steroids-alpha:save:v1', JSON.stringify({ name: n })), name);
    return ctx;
  };
  const desk = await (await named(await deskBrowser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), 'Desk Ace')).newPage();
  watch('desktop', desk);
  await desk.goto(url('debug=1'), { waitUntil: 'networkidle' });
  await desk.waitForFunction(() => window.__steroids?.menuButtons().length === 2);
  await desk.screenshot({ path: path.join(outDir, 'desktop-menu.png') });
  // Planet B: no bots, whose shots would knock the test ships about and cloud the prediction check.
  const btn = (await api(desk, () => window.__steroids.menuButtons()))[1];
  assert.equal(btn.id, 'beta');
  await desk.mouse.click(btn.x, btn.y);
  await desk.waitForFunction(() => window.__steroids.scene() === 'flight' && window.__steroids.own() !== null, null, { timeout: 10000 });
  // The approved Human Nomad rig is drawn (not the placeholder triangles), unless EXPECT_PLACEHOLDER=1.
  const expectArt = process.env.EXPECT_PLACEHOLDER === '1' ? 'placeholder' : 'ready';
  assert.equal(await api(desk, () => window.__steroids.shipArt()), expectArt, 'desktop ship art');

  // Ships never stop, so the desktop holds turn-right while the others join: it circles in the
  // drop zone (turn radius = speed / turn rate, about 80 px) and stays in view range of newcomers.
  // The turn is summed inside the page every frame (each frame turns far less than half a circle), so
  // neither a near-full turn nor a slow screenshot between samples can alias it to a small angle.
  await api(desk, () => {
    const wrap = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    let last = window.__steroids.own().heading;
    window.__turned = 0;
    const tick = () => {
      if (window.__turned === null) return;
      const h = window.__steroids.own()?.heading;
      if (h !== undefined) { window.__turned += wrap(h - last); last = h; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await desk.keyboard.down('ArrowRight');
  // Close-ups of your own ship through the turn: eight headings for the rig check.
  const turnShots = [];
  for (let i = 0; i < 8; i++) {
    const heading = (await api(desk, () => window.__steroids.own())).heading;
    const file = `desktop-ship-${i}.png`;
    await desk.screenshot({ path: path.join(outDir, file), clip: { x: 640 - 90, y: 360 - 90, width: 180, height: 180 } });
    turnShots.push({ file, rigDeg: Math.round((((heading * 180) / Math.PI + 90) % 360 + 360) % 360) });
    await wait(150);
  }
  const turned = Math.abs(await api(desk, () => { const t = window.__turned; window.__turned = null; return t; }));
  assert(turned > 1, `desktop keyboard turned the ship (${turned.toFixed(2)} rad)`);

  // Drop in and out: a third client joins, the desktop draws it, it leaves, the desktop stops drawing it.
  // Tracked by the third ship's id, not a count of remotes.
  const thirdCtx = await phoneBrowser.newContext({ viewport: { width: 800, height: 600 } });
  const third = await thirdCtx.newPage();
  watch('third', third);
  await third.goto(url('debug=1&planet=beta'), { waitUntil: 'networkidle' });
  await third.waitForFunction(() => window.__steroids.myId() > 0, null, { timeout: 10000 });
  const thirdId = await api(third, () => window.__steroids.myId());
  await desk.waitForFunction((id) => window.__steroids.remotes().some((r) => r.id === id), thirdId, { timeout: 5000 });
  await thirdCtx.close();
  await desk.waitForFunction((id) => !window.__steroids.remotes().some((r) => r.id === id), thirdId, { timeout: 5000 });

  // Phone: straight in, touch controls, simulated lag.
  // Phones held upright are never blocked (owner decision): the landscape game is drawn turned a
  // quarter, and taps land where the turned buttons are drawn.
  const uprightCtx = await phoneBrowser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const upright = await uprightCtx.newPage();
  watch('upright', upright);
  await upright.goto(url('debug=1'), { waitUntil: 'networkidle' });
  await upright.waitForFunction(() => window.__steroids?.menuButtons().length === 2);
  assert.equal(await api(upright, () => window.__steroids.sideways()), true, 'upright phone draws the game sideways');
  await upright.screenshot({ path: path.join(outDir, 'phone-upright-sideways.png') });
  const b0 = (await api(upright, () => window.__steroids.menuButtons()))[1];
  const uprightH = await api(upright, () => window.innerHeight);
  await upright.touchscreen.tap(b0.y, uprightH - b0.x);
  await upright.waitForFunction(() => window.__steroids.own() !== null, null, { timeout: 10000 });
  await upright.screenshot({ path: path.join(outDir, 'phone-upright-flight.png') });
  await uprightCtx.close();

  const phoneCtx = await named(await phoneBrowser.newContext({ ...devices['iPhone 13 landscape'], deviceScaleFactor: 1 }), 'Phone Pilot');
  const phone = await phoneCtx.newPage();
  watch('phone', phone);
  await phone.goto(url('debug=1&planet=beta&lag=120'), { waitUntil: 'networkidle' });
  await phone.waitForFunction(() => window.__steroids.own() !== null, null, { timeout: 10000 });
  assert.equal(await api(phone, () => window.__steroids.shipArt()), expectArt, 'phone ship art');
  assert.equal(await api(phone, () => window.__steroids.sideways()), false, 'landscape phone is drawn as is');

  // Each sees the other.
  await desk.waitForFunction(() => window.__steroids.remotes().length >= 1, null, { timeout: 5000 });
  await phone.waitForFunction(() => window.__steroids.remotes().length >= 1, null, { timeout: 5000 });
  const ids = { desk: await api(desk, () => window.__steroids.myId()), phone: await api(phone, () => window.__steroids.myId()) };
  assert.notEqual(ids.desk, ids.phone);

  // Names reach everyone, and the leaderboard lists both pilots.
  // Planet A also has bots ("BOT <name>") while players are on; only the humans are checked here.
  const humans = () => window.__steroids.roster().filter((r) => !r.name.startsWith('BOT '));
  await desk.waitForFunction((f) => new Function(`return (${f})()`)().length >= 2, humans.toString(), { timeout: 5000 });
  const roster = await api(desk, humans);
  assert.deepEqual(roster.map((r) => r.name).sort(), ['Desk Ace', 'Phone Pilot'], 'player names on the roster');
  assert(roster.every((r) => r.kills === 0));
  await desk.waitForFunction(() => window.__steroids.board().length >= 2, null, { timeout: 3000 });

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
  // The planet's turn comes from the server clock, so both players are on the same time of day.
  const [lightDesk, lightPhone] = await Promise.all([api(desk, () => window.__steroids.light()), api(phone, () => window.__steroids.light())]);
  assert(Math.abs(lightDesk.rotationDeg - lightPhone.rotationDeg) < 1, `planet rotation agrees between players (${lightDesk.rotationDeg.toFixed(2)} vs ${lightPhone.rotationDeg.toFixed(2)})`);
  assert(lightDesk.brightness >= 0.3 && lightDesk.brightness <= 1, 'brightness in range');
  await desk.screenshot({ path: path.join(outDir, 'desktop-flight.png') });
  await phone.screenshot({ path: path.join(outDir, 'phone-sees-desktop.png') });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await desk.keyboard.up('ArrowRight');

  // Keyboard throttle (craft-relative): S brakes toward the minimum speed, W accelerates toward the maximum.
  await desk.keyboard.down('s');
  await wait(900);
  await desk.keyboard.up('s');
  const slow = (await api(desk, () => window.__steroids.own())).speed;
  assert(slow < 160, `desktop S braked to near minimum speed (${slow.toFixed(0)})`);
  await desk.keyboard.down('w');
  await wait(1400);
  await desk.keyboard.up('w');
  const fast = (await api(desk, () => window.__steroids.own())).speed;
  // Collected minerals lower the top speed (power), so compare with this ship's own top speed.
  const top = await api(desk, () => window.__steroids.topSpeed());
  assert(fast > top - 20, `desktop W accelerated to near its top speed (${fast.toFixed(0)} of ${top.toFixed(0)})`);

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
  // Direction marker: a stick pushed most of the way accelerates hard toward the maximum speed.
  assert.equal(await api(phone, () => window.__steroids.scheme()), 'marker');
  assert(steered.speed > 320, `marker stick pushed far accelerates (${steered.speed.toFixed(0)})`);
  await phone.screenshot({ path: path.join(outDir, 'phone-joystick.png') });
  // Letting the stick go eases the ship back down to minimum speed.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(1200);
  const eased = (await api(phone, () => window.__steroids.own())).speed;
  assert(eased < 160, `stick at rest decelerates to minimum speed (${eased.toFixed(0)})`);

  // Phones always steer with the direction marker (owner decision): no STEER button, no craft mode.
  assert.equal((await api(phone, () => window.__steroids.zones())).scheme, null, 'no STEER button on phones');
  assert.equal(await api(phone, () => window.__steroids.scheme()), 'marker', 'phone stays on the marker');

  const dashBtn = (await api(phone, () => window.__steroids.zones())).dash;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: dashBtn.x, y: dashBtn.y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await phone.waitForFunction(() => window.__steroids.own().dashCd > 0, null, { timeout: 2000 });
  await wait(150);
  await phone.screenshot({ path: path.join(outDir, 'phone-dash.png') });

  // Shooting: the phone makes strafing runs on the nearest asteroid (marker stick plus the fire
  // button held) until one is shot down and splits. Both clients must see the split.
  const zones = await api(phone, () => window.__steroids.zones());
  const rocksBefore = await api(phone, () => window.__steroids.asteroids());
  assert(rocksBefore.length >= 10 && rocksBefore.every((r) => r.size === 0 || r.size === 1 || r.size === 2), `asteroids on the planet (${rocksBefore.length})`);
  const deskSplits0 = await api(desk, () => window.__steroids.splits());
  const touches = (dir, mag) => [
    { x: sx + Math.cos(dir) * 64 * mag, y: sy + Math.sin(dir) * 64 * mag, id: 11 },
    { x: zones.fire.x, y: zones.fire.y, id: 12 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 11 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 11 }, { x: zones.fire.x, y: zones.fire.y, id: 12 }] });
  let retreat = false;
  let sawBullets = 0;
  let shotPic = false;
  for (let i = 0; i < 450; i++) {
    const v = await api(phone, () => ({ own: window.__steroids.own(), rocks: window.__steroids.asteroids(), splits: window.__steroids.splits(), bullets: window.__steroids.bullets(), status: window.__steroids.status() }));
    assert.equal(v.status, 'open', 'phone ship still alive while hunting');
    sawBullets = Math.max(sawBullets, v.bullets);
    if (v.splits >= 1) break;
    let best = null;
    for (const r of v.rocks) {
      const dx = d(r.x, v.own.x);
      const dy = d(r.y, v.own.y);
      const dist = Math.hypot(dx, dy);
      if (!best || dist < best.dist) best = { dx, dy, dist, r };
    }
    const reach = best.dist - [70, 42, 22][best.r.size];
    if (reach < 230) retreat = true;
    if (reach > 430) retreat = false;
    const toRock = Math.atan2(best.dy, best.dx);
    // Approach slowly while firing; break away at right angles when close.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(retreat ? toRock + Math.PI * 0.6 : toRock, retreat ? 1 : 0.4) });
    if (!shotPic && v.bullets >= 1 && best.dist < 330) {
      await phone.screenshot({ path: path.join(outDir, 'phone-shooting.png') });
      shotPic = true;
    }
    await wait(100);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await api(phone, () => ({ splits: window.__steroids.splits(), rocks: window.__steroids.asteroids(), hp: window.__steroids.own().hp }));
  assert(after.splits >= 1, 'phone shot an asteroid down and it split');
  assert(sawBullets >= 1, `bullets were drawn (${sawBullets})`);
  assert(after.rocks.some((r) => r.size > 0), 'smaller pieces exist after the split');
  await phone.screenshot({ path: path.join(outDir, 'phone-after-split.png') });
  // The desktop only hears about rocks inside its interest radius (1400 px), and the hunt can take the
  // phone anywhere on the planet, so the desktop must see the split only when it was in range.
  const [pAt, dAt] = await Promise.all([api(phone, () => window.__steroids.own()), api(desk, () => window.__steroids.own())]);
  const apart = Math.hypot(d(pAt.x, dAt.x), d(pAt.y, dAt.y));
  const deskSawSplit = apart < 1100;
  if (deskSawSplit) await desk.waitForFunction((n) => window.__steroids.splits() > n, deskSplits0, { timeout: 8000 });

  // Fly straight for a while. Prediction should agree with the server: corrections rare, and
  // never more than a couple of steps (one step at cruise speed is 260/30 = 8.7px). A jittery
  // network occasionally costs one step; anything bigger means client and server diverged.
  // A bump (rock contact) knocks a ship about 64 px (knockback 320 / decay 5) against rocks the
  // client sees slightly late, so that correction is expected: a window in which either ship carried
  // any knockback (watched every frame, shield up or down) is flown again.
  const watchBumps = (page) => api(page, () => {
    window.__bumped = false;
    const tick = () => {
      const o = window.__steroids.own();
      if (o && Math.hypot(o.kx, o.ky) > 1) window.__bumped = true;
      if (!window.__bumpDone) requestAnimationFrame(tick);
    };
    window.__bumpDone = false;
    requestAnimationFrame(tick);
  });
  const bumped = (page) => api(page, () => { window.__bumpDone = true; return window.__bumped; });
  let cleanWindow = false;
  for (let tries = 0; tries < 8 && !cleanWindow; tries++) {
    // Let any knockback from before the window die away first (it decays to under 1 px/s in about 1.2 s).
    await wait(1200);
    await Promise.all([watchBumps(phone), watchBumps(desk)]);
    await Promise.all([api(phone, () => window.__steroids.resetCorrections()), api(desk, () => window.__steroids.resetCorrections())]);
    await wait(3000);
    cleanWindow = !(await bumped(phone)) && !(await bumped(desk));
  }
  assert(cleanWindow, 'a 3 s window without bumps for the prediction check');
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

  console.log(JSON.stringify({ fps, turnShots, ids, turned: Number(turned.toFixed(2)), phoneHeading: Number(steered.heading.toFixed(2)), phoneStats: pStats, deskStats: dStats, remoteGapPx: Math.round(gap), dropInOut: 'ok', deskSplitCheck: deskSawSplit ? 'seen' : `skipped, ${Math.round(apart)} px apart`, hunt: { splits: after.splits, hp: after.hp, rocks: after.rocks.length } }));
} finally {
  await deskBrowser.close();
  await phoneBrowser.close();
}
assert.deepEqual(errors, [], 'browser console/page errors');
console.log('Steroids-Alpha milestone 1 check passed.');
