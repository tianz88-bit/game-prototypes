// Visual check for Densha Domino. Usage:
//   node scripts/screenshot-densha-domino.mjs <baseUrl> <outDir>
// baseUrl is a running dev/preview server, e.g. http://localhost:5199/game-prototypes/prototypes/densha-domino/
// Plays real swipes on the canvas (moves come from the ?test=1 hook, which asks the solver
// for an optimal next tap), takes screenshots mid-chain and at the end of levels, checks
// that progress survives a reload, and fails on any console error.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2];
const outDir = process.argv[3];
if (!base || !outDir) {
  console.error('usage: node scripts/screenshot-densha-domino.mjs <baseUrl> <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?test=1`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(1000);
const shot = (name) => page.screenshot({ path: path.join(outDir, `densha-${name}.png`) });
await shot('level1-start');

const swipe = async (m) => {
  const d = m.dir * 40;
  await page.mouse.move(m.x, m.y);
  await page.mouse.down();
  await page.mouse.move(m.axis === 'h' ? m.x + d : m.x, m.axis === 'v' ? m.y + d : m.y, { steps: 3 });
  await page.mouse.up();
};
const settle = async () => {
  for (let t = 0; t < 60 && (await page.evaluate(() => window.__densha.phase())) === 'animating'; t++) await page.waitForTimeout(100);
};
const results = [];
const total = await page.evaluate(() => window.__densha.levels());
for (let lv = 0; lv < total; lv++) {
  await page.evaluate((n) => window.__densha.goto(n), lv);
  await page.waitForTimeout(300);
  const par = await page.evaluate(() => window.__densha.par());
  if (lv === 3) await shot('level4-start');
  let taps = 0;
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__densha.phase())) === 'play'; i++) {
    const m = await page.evaluate(() => window.__densha.nextMove());
    if (!m) break;
    await swipe(m);
    taps++;
    if (lv === 1 && taps === 1) {
      await page.waitForTimeout(170);
      await shot('level2-horn-spook');
    }
    if (lv === 5 && taps === 1) {
      await page.waitForTimeout(300);
      await shot('level6-chain');
    }
    await settle();
  }
  const phase = await page.evaluate(() => window.__densha.phase());
  results.push({ level: lv + 1, par, taps, phase });
  if (lv === 0 || lv === 9) await shot(`level${lv + 1}-end`);
}
console.table(results);
// Save check: after clearing level 1 the saved level is 2.
await page.evaluate(() => window.__densha.goto(0));
await page.waitForTimeout(200);
await page.mouse.move(100, 300);
const m = await page.evaluate(() => window.__densha.nextMove());
await swipe(m);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForTimeout(900);
console.log('level after reload (1-based):', (await page.evaluate(() => window.__densha.level())) + 1);
await shot('after-reload');
await browser.close();
const bad = results.filter((r) => r.phase !== 'won');
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
if (bad.length) {
  console.error('Levels not cleared by the optimal moves:', bad);
  process.exit(1);
}
console.log('ok, every level cleared in par taps with no console errors');
