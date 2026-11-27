// Visual check for Chimera Reels. Usage:
//   node scripts/screenshot-chimera-reels.mjs <baseUrl> <outDir>
// baseUrl is a running dev/preview server, e.g.
//   http://localhost:5199/game-prototypes/prototypes/chimera-reels/
// On a phone-sized portrait viewport it taps through the run: starter
// select, entry bet, a fight with real Pocket / Execute / Burn taps, then
// auto-plays (keyboard intents) until a result, level-up or game over.
// Also checks a wide desktop window with ?debug=1. Fails on console errors.
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
  const r = window.__chimera();
  const c = r.combat;
  const p = c?.fighters.player;
  return {
    screen: r.screen, gold: r.gold, floor: r.floor, level: r.level,
    landed: p?.landed ?? false, pocket: p?.pocket.length ?? 0, hp: p?.hp, enemyHp: c?.fighters.enemy.hp,
    winner: c?.winner ?? null, broken: c ? c.fighters.enemy.parts.filter((x) => x.broken).length : 0,
    line: p ? p.strips[0][p.reelPos[0]].id : null, matches: p ? p.pocket.filter((t) => t.id === p.strips[0][p.reelPos[0]].id).length : 0,
  };
});
const shot = (page, name) => page.screenshot({ path: path.join(outDir, name) });
async function waitFor(page, pred, what, tries = 150) {
  for (let i = 0; i < tries; i++) {
    const s = await state(page);
    if (pred(s)) return s;
    await page.waitForTimeout(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, 'phone');
  await page.goto(`${base}?seed=${process.env.SEED ?? 7}`);
  await page.waitForTimeout(700);
  await page.mouse.click(330, 620); // random-roll card
  await page.waitForTimeout(200);
  await page.mouse.click(330, 620); // tap again: re-roll
  await page.waitForTimeout(300);
  await shot(page, 'chimera-select-random.png');
  await page.mouse.click(150, 620); // Skyreave card
  await page.waitForTimeout(200);
  await page.mouse.click(337, 493); // open parts viewer
  await page.waitForTimeout(200);
  await page.mouse.click(90, 535 + 34 * 2); // inspect limbs
  await page.waitForTimeout(900);
  await shot(page, 'chimera-viewer.png');
  await page.mouse.click(90, 716); // inspect the Soul row
  await page.waitForTimeout(300);
  await shot(page, 'chimera-viewer-soul.png');
  await page.mouse.click(337, 493); // close viewer
  await page.waitForTimeout(200);
  await shot(page, 'chimera-select.png');
  await page.mouse.click(195, 786); // choose
  await waitFor(page, (s) => s.screen === 'prefight', 'prefight');
  await page.waitForTimeout(300);
  await shot(page, 'chimera-prefight.png');
  await page.mouse.click(195, 786); // enter fight
  await waitFor(page, (s) => s.screen === 'fight', 'fight');
  await waitFor(page, (s) => s.landed, 'first landing');
  await shot(page, 'chimera-landed.png');
  await page.mouse.click(287, 799); // Pocket
  await page.waitForTimeout(120);
  await shot(page, 'chimera-pocket-fly.png');
  const afterPocket = await state(page);
  if (!afterPocket.pocket) throw new Error('Pocket tap stored nothing');
  await waitFor(page, (s) => s.landed || s.winner, 'second landing');
  await page.mouse.click(103, 799); // Execute
  await page.waitForTimeout(200);
  await shot(page, 'chimera-execute.png');
  await waitFor(page, (s) => s.landed || s.winner, 'third landing');
  await page.mouse.click(34, 734); // burn first pocket group
  await page.waitForTimeout(150);
  // FORCE_WIN=1 weakens the enemy so the loot and level-up screens get checked.
  if (process.env.FORCE_WIN) await page.evaluate(() => { const e = window.__chimera().combat.fighters.enemy; e.hp = Math.min(e.hp, 5); });
  await shot(page, 'chimera-burn.png');
  // Auto-play: pocket until a match exists, then execute.
  let midShot = false;
  for (let i = 0; i < 2000; i++) {
    const s = await state(page);
    if (s.screen !== 'fight') break;
    if (s.landed) {
      if (s.matches === 0 && s.pocket < 4) await page.keyboard.press('k');
      else await page.keyboard.press('Space');
      if (!midShot && s.broken) {
        await page.waitForTimeout(150);
        await shot(page, 'chimera-break.png');
        midShot = true;
      }
    }
    await page.waitForTimeout(50);
  }
  const s = await waitFor(page, (x) => x.screen !== 'fight', 'fight end', 400);
  await page.waitForTimeout(500);
  await shot(page, 'chimera-result.png');
  await page.mouse.click(337, 493); // open battle log
  await page.waitForTimeout(300);
  await shot(page, 'chimera-log.png');
  await page.mouse.click(324, 790); // next page
  await page.waitForTimeout(200);
  await shot(page, 'chimera-log-2.png');
  await page.mouse.click(195, 790); // close log
  await page.waitForTimeout(200);
  await page.mouse.click(195, 786);
  await page.waitForTimeout(500);
  await shot(page, 'chimera-after-result.png');
  if ((await state(page)).screen === 'loot') {
    await page.mouse.click(105, 600); // take the dropped part
    await waitFor(page, (x) => x.screen === 'levelup', 'level-up after loot');
    await page.waitForTimeout(300);
    await shot(page, 'chimera-levelup.png');
  }
  console.log('phone run', JSON.stringify(s), '->', JSON.stringify(await state(page)));
  await ctx.close();
}

{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(`${base}?seed=3&debug=1`);
  await page.waitForTimeout(1200);
  await shot(page, 'chimera-desktop-debug.png');
  await ctx.close();
}

await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok, no console errors. wrote', outDir);
