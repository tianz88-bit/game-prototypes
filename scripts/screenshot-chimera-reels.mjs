// Visual check for Chimera Reels. Usage:
//   node scripts/screenshot-chimera-reels.mjs <baseUrl> <outDir>
// baseUrl is a running dev/preview server, e.g.
//   http://localhost:5199/game-prototypes/prototypes/chimera-reels/
// Plays real taps (Pocket, then Execute, then a burn) on a phone-sized
// portrait viewport, also checks a wide desktop window and ?debug=1, and
// fails on any console error.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2];
const outDir = process.argv[3];
if (!base || !outDir) {
  console.error('usage: node scripts/screenshot-chimera-reels.mjs <baseUrl> <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const watch = (page, tag) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${tag}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
};
const state = (page) => page.evaluate(() => {
  const c = window.__chimera();
  const p = c.fighters.player;
  return { landed: p.landed, pocket: p.pocket.length, hp: p.hp, enemyHp: c.fighters.enemy.hp, winner: c.winner };
});
async function waitLanded(page) {
  for (let i = 0; i < 100; i++) {
    const s = await state(page);
    if (s.landed || s.winner) return s;
    await page.waitForTimeout(100);
  }
  throw new Error('player reels never landed');
}

// Phone portrait: tap through a few decisions.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, 'phone');
  await page.goto(`${base}?seed=7`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'chimera-boot.png') });
  await waitLanded(page);
  await page.screenshot({ path: path.join(outDir, 'chimera-landed.png') });
  await page.mouse.click(287, 774); // Pocket
  const afterPocket = await state(page);
  if (!afterPocket.pocket) throw new Error('Pocket tap stored nothing');
  await waitLanded(page);
  await page.mouse.click(103, 774); // Execute
  await waitLanded(page);
  await page.mouse.click(258, 582); // burn first pocket slot's group
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, 'chimera-midfight.png') });
  const s = await state(page);
  console.log('phone state', JSON.stringify(s));
  await ctx.close();
}

// Wide desktop window: must pillarbox, never block.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(`${base}?seed=3&debug=1`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, 'chimera-desktop-debug.png') });
  await ctx.close();
}

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok, no console errors. wrote', outDir);
