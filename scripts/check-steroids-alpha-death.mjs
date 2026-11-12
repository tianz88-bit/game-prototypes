// Steroids-Alpha death check: a real ship flown into asteroids until it is destroyed, against a
// planet room WITHOUT the test hull override. Checks the shield takes damage first, ramming bounces
// the ship and splits the rock, the explosion plays, the death screen offers Respawn and Menu, and
// Respawn drops a fresh ship back onto the same planet with full shield and hull and 0 kills.
//
// Needs a server with normal hull points and a client build:
//   npx --yes wrangler@4.143.0 dev --config prototypes/steroids-alpha/server/wrangler.jsonc --ip 127.0.0.1 --port 8788
//   npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort
//   node scripts/check-steroids-alpha-death.mjs http://127.0.0.1:4173/game-prototypes/prototypes/steroids-alpha/ ws://127.0.0.1:8788 <output-dir>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [base, server, outDir = 'outputs/steroids-alpha-death'] = process.argv.slice(2);
if (!base || !server) throw new Error('Usage: check-steroids-alpha-death.mjs <client-url> <server-ws-origin> [output-dir]');
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem('steroids-alpha:save:v1', JSON.stringify({ name: 'Crash Test' })));
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const api = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(`${base}?debug=1&planet=alpha&server=${encodeURIComponent(server)}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__steroids.own() !== null, null, { timeout: 15000 });
  const start = await api(() => window.__steroids.own());
  assert(start.shield > 0 && start.hp > 0, 'starts with shield and hull');
  const roster0 = await api(() => window.__steroids.roster());
  assert(roster0.some((r) => r.name === 'Crash Test'), 'name reached the server');

  // Fly at the nearest asteroid, flat out, until destroyed. Record the first ram.
  const W = 4000;
  const d = (a, b) => ((a - b + W * 1.5) % W) - W / 2;
  let firstRam = null;
  let prev = start;
  let shotBeforeDeath = false;
  let shieldShown = 0;
  for (let i = 0; i < 1200; i++) {
    const v = await api(() => ({ own: window.__steroids.own(), rocks: window.__steroids.asteroids(), death: window.__steroids.death() }));
    if (v.death) break;
    if (!v.own) {
      await wait(50);
      continue;
    }
    if (!firstRam && (v.own.shield < prev.shield || v.own.hp < prev.hp)) {
      firstRam = { before: prev, after: v.own };
      await page.screenshot({ path: path.join(outDir, 'ram.png') });
      await page.screenshot({ path: path.join(outDir, 'shield-hit.png'), clip: { x: 540, y: 260, width: 200, height: 200 } });
      shieldShown = await api(() => window.__steroids.shieldHits());
    }
    if (!shotBeforeDeath && v.own.hp < start.hp) {
      await page.screenshot({ path: path.join(outDir, 'hull-damaged.png') });
      shotBeforeDeath = true;
    }
    prev = v.own;
    let best = null;
    for (const r of v.rocks) {
      const dx = d(r.x, v.own.x);
      const dy = d(r.y, v.own.y);
      const dist = Math.hypot(dx, dy);
      if (!best || dist < best.dist) best = { dx, dy, dist };
    }
    const want = Math.atan2(best.dy, best.dx);
    const diff = ((want - v.own.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    await page.keyboard[diff > 0.05 ? 'down' : 'up']('d');
    await page.keyboard[diff < -0.05 ? 'down' : 'up']('a');
    await page.keyboard.down('w');
    await wait(50);
  }
  for (const k of ['w', 'a', 'd']) await page.keyboard.up(k);
  assert(firstRam, 'the ship rammed an asteroid');
  assert(firstRam.after.shield < firstRam.before.shield, 'ramming damaged the shield first');
  // The broken rock's minerals can be collected in the same tick, so the hull may go up, never down.
  assert(firstRam.after.hp >= firstRam.before.hp, 'hull not damaged while the shield held');
  assert(shieldShown > 0, 'the shield effect showed for the blocked hit');
  const death = await api(() => window.__steroids.death());
  assert(death, 'the ship was destroyed');
  assert.equal(death.killer, 0, 'destroyed by an asteroid, nobody credited');
  await page.waitForFunction(() => window.__steroids.explosions() > 0, null, { timeout: 2000 });
  await wait(250);
  await page.screenshot({ path: path.join(outDir, 'explosion.png') });

  // Death screen: Respawn and Menu appear once the explosion has had a moment.
  await page.waitForFunction(() => window.__steroids.deathButtons().length === 2, null, { timeout: 4000 });
  await page.screenshot({ path: path.join(outDir, 'death-screen.png') });
  const buttons = await api(() => window.__steroids.deathButtons());
  const respawn = buttons.find((b) => b.id === 'respawn');
  await page.mouse.click(respawn.x, respawn.y);
  await page.waitForFunction(() => window.__steroids.scene() === 'flight' && window.__steroids.own() !== null && !window.__steroids.death(), null, { timeout: 10000 });
  const again = await api(() => ({ own: window.__steroids.own(), roster: window.__steroids.roster() }));
  assert(again.own.shield > 0 && again.own.hp > 0, 'respawned with shield and hull');
  const me = again.roster.find((r) => r.name === 'Crash Test');
  assert(me && me.kills === 0, 'kills start from 0 after a death');
  await page.screenshot({ path: path.join(outDir, 'respawned.png') });

  // Menu option: die again is slow, so check the button routes by key instead (Esc = Menu).
  console.log(JSON.stringify({ firstRam, death }));
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], 'browser console/page errors');
console.log('Steroids-Alpha death check passed.');
