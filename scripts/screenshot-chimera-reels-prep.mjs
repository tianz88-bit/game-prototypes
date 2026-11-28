// Visual check for Chimera Reels Prep (spin, plan, clash). Usage:
//   node scripts/screenshot-chimera-reels-prep.mjs <baseUrl> <outDir>
// baseUrl e.g. http://localhost:5200/game-prototypes/prototypes/chimera-reels-prep/
// On a 390x844 phone viewport: title, starter select, prefight, then a prep
// phase with real taps (queue rows, nudge a reel, re-spin), Fight, a clash,
// then auto-plays rounds (keyboard intents) to the result and battle log.
// Fails on any console error.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2];
const outDir = process.argv[3];
if (!base || !outDir) {
  console.error('usage: node scripts/screenshot-chimera-reels-prep.mjs <baseUrl> <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const shot = (name) => page.screenshot({ path: path.join(outDir, name) });
const st = () => page.evaluate(() => {
  const r = window.__chimera();
  const c = r.combat;
  const p = c?.fighters.player;
  return {
    screen: r.screen, gold: r.gold, phase: c?.phase, round: c?.round, winner: c?.winner ?? null,
    spinning: (p?.spinLeft ?? 0) > 0 || (c?.fighters.enemy.spinLeft ?? 0) > 0, queued: p?.queued.length ?? 0,
    pos: p?.reelPos.join(','), stash: p?.pocket.length ?? 0, hp: p?.hp, enemyHp: c?.fighters.enemy.hp,
  };
});
const until = async (pred, what, tries = 200) => {
  for (let i = 0; i < tries; i++) {
    const s = await st();
    if (pred(s)) return s;
    await page.waitForTimeout(100);
  }
  throw new Error(`timed out waiting for ${what}`);
};

await page.goto(`${base}?seed=${process.env.SEED ?? 7}`);
await page.waitForTimeout(1200);
await shot('prep-title.png');
await page.mouse.click(195, 640); // tap to start
await page.waitForTimeout(400);
await page.mouse.click(195, 786); // choose starter (Tuskrel)
await until((s) => s.screen === 'prefight', 'prefight');
await page.mouse.click(195, 786); // enter fight
await until((s) => s.screen === 'fight' && !s.spinning, 'first prep');
await page.waitForTimeout(300);
await shot('prep-round1.png');
await page.mouse.click(195, 572); // queue row 0
await page.mouse.click(195, 620); // queue row 1
await page.waitForTimeout(200);
await shot('prep-queued.png');
const preNudge = await st();
await page.mouse.click(30, 537); // nudge the move reel (tiles up)
await page.waitForTimeout(60);
await shot('prep-nudging.png');
await page.waitForTimeout(300);
const postNudge = await st();
console.log('nudge: gold', preNudge.gold, '->', postNudge.gold, 'reels', preNudge.pos, '->', postNudge.pos);
await shot('prep-nudged.png');
const before = await st();
await page.mouse.click(103, 799); // re-spin (costs gold)
await page.waitForTimeout(250);
await shot('prep-respin.png');
const after = await until((s) => !s.spinning, 're-spin');
console.log('re-spin: gold', before.gold, '->', after.gold);
await page.mouse.click(195, 572);
await page.mouse.click(195, 620);
await page.mouse.click(195, 668);
await page.waitForTimeout(150);
await page.mouse.click(287, 799); // Fight
await page.waitForTimeout(1800);
await shot('prep-clash.png');
// Auto-play: queue every row, fight, repeat.
for (let i = 0; i < 400; i++) {
  const s = await st();
  if (s.screen !== 'fight' || s.winner) break;
  if (s.phase === 'prep' && !s.spinning) {
    for (const k of ['z', 'x', 'c']) await page.keyboard.press(k);
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(150);
}
const end = await until((s) => s.screen !== 'fight', 'fight end', 400);
await page.waitForTimeout(500);
await shot('prep-result.png');
await page.mouse.click(337, 493); // battle log
await page.waitForTimeout(300);
await shot('prep-log.png');
console.log('end', JSON.stringify(end));
await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok, no console errors. wrote', outDir);
