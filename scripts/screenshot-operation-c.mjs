// Real canvas input -> rule state -> rendered feedback, on desktop and touch.
// Windows uses Brave exclusively. CI Linux uses its isolated test Chromium.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(process.env.OPERATION_C_BROWSER_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const [base, outDir = 'outputs/operation-c'] = process.argv.slice(2);
if (!base) throw new Error('Usage: node scripts/screenshot-operation-c.mjs <url> <output-dir>');
fs.mkdirSync(outDir, { recursive: true });
const executablePath = process.platform === 'win32'
  ? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe' : undefined;
if (executablePath && !fs.existsSync(executablePath)) throw new Error('Brave unavailable; reconnect/install Brave instead of switching browser.');
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];
try {
  for (const profile of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, touch: false },
    { name: 'phone-portrait', viewport: { width: 390, height: 844 }, touch: true },
    { name: 'phone-landscape', viewport: { width: 844, height: 390 }, touch: true },
    { name: 'phone-small-landscape', viewport: { width: 667, height: 375 }, touch: true },
  ]) {
    const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: 2, hasTouch: profile.touch, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`${profile.name}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${profile.name}: ${e.message}`));
    await page.goto(`${base}${base.includes('?') ? '&' : '?'}test=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__operationC?.targets().buttons.length > 0);
    const tap = async (x, y) => profile.touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
    const press = async id => {
      const b = await page.evaluate(id => window.__operationC.targets().buttons.find(b => b.id === id), id);
      assert(b, `button ${id}`); await tap(b.x, b.y); await page.waitForTimeout(80);
    };
    await page.screenshot({ path: path.join(outDir, `${profile.name}-start.png`) });
    await press('card-infantry');
    const candidate = await page.evaluate(() => window.__operationC.targets().hexes.find(h => h.valid && h.x > 25 && h.x < innerWidth - 25 && h.y > 145 && h.y < innerHeight - 205));
    assert(candidate, `${profile.name}: visible legal building location`);
    await tap(candidate.x, candidate.y); await page.waitForTimeout(100);
    let state = await page.evaluate(() => window.__operationC.snapshot());
    assert.equal(state.buildings.filter(b => b.owner === 0 && b.kind !== 'hq').length, 0, 'first tap previews without spending');
    assert.equal(state.selectedBuild?.hexId, candidate.id);
    assert.equal(state.selectedBuild?.valid, true);
    await page.screenshot({ path: path.join(outDir, `${profile.name}-placement.png`) });
    if (profile.name === 'desktop' || profile.name === 'phone-portrait') {
      await tap(candidate.x, candidate.y); await page.waitForTimeout(100);
    } else await press('build');
    state = await page.evaluate(() => window.__operationC.snapshot());
    assert.equal(state.buildings.filter(b => b.owner === 0 && b.kind !== 'hq').length, 1);
    assert.equal(state.resources.committed, 8);
    assert.equal(state.units.filter(u => u.owner === 0).length, 1);
    assert.equal(state.selectedBuild, null);
    assert.equal(state.hexes.filter(h => h.lockedBy && state.buildings.some(b => b.id === h.lockedBy && b.owner === 0)).length, 8);
    await press('cancel');
    if (profile.name === 'desktop' || profile.name === 'phone-portrait') {
      // Observe a real ownership transition, not a fabricated visual fixture.
      const capture = await page.evaluate(async () => {
        const qa = window.__operationC;
        // Hold only the cosmetic clock: simulation still reaches capture through
        // ordinary fixed-step rules. This works even on a slow CI software GPU.
        qa.captureClock(0);
        for (let frame = 0; frame < 120; frame++) {
          qa.advance(100);
          await new Promise(requestAnimationFrame);
          const state = qa.snapshot(), flip = state.presentation.flips[0];
          if (flip) {
            qa.captureClock(state.presentation.durationMs * 0.35);
            await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
            return { id: flip.hexId, owner: state.hexes.find(h => h.id === flip.hexId).owner, duration: state.presentation.durationMs };
          }
        }
        const state = qa.snapshot();
        throw new Error(`No real capture flip after ${state.timeMs}ms sim time; reducedMotion=${state.presentation.reducedMotion}`);
      });
      await page.screenshot({ path: path.join(outDir, `${profile.name}-capture-flip.png`) });
      assert(await page.evaluate(id => window.__operationC.snapshot().presentation.flips.some(f => f.hexId === id && f.progress > 0.3 && f.progress < 0.4), capture.id));
      await page.evaluate(duration => window.__operationC.captureClock(duration + 1), capture.duration);
      await page.waitForFunction(id => !window.__operationC.snapshot().presentation.flips.some(f => f.hexId === id), capture.id);
      assert.equal(await page.evaluate(id => window.__operationC.snapshot().hexes.find(h => h.id === id).owner, capture.id), capture.owner);
      await page.screenshot({ path: path.join(outDir, `${profile.name}-capture-landed.png`) });
      await page.evaluate(() => window.__operationC.captureClock(null));
      console.log(`PASS ${profile.name}: real capture flip completes without changing its authoritative owner`);
    }
    await press('attack');
    state = await page.evaluate(() => window.__operationC.snapshot());
    assert.equal(state.target, 1);
    // Accelerate the same public sim tick rather than granting fabricated units.
    await page.evaluate(() => window.__operationC.advance(45000));
    await page.waitForTimeout(500);
    state = await page.evaluate(() => window.__operationC.snapshot());
    assert.equal(new Set(state.units.map(u => u.hexId)).size, state.units.length);
    assert(state.hexes.some(h => h.owner === 1), 'bot territory visible');
    if (profile.name === 'desktop') {
      const shot = await page.evaluate(async () => {
        const qa = window.__operationC, anchor = performance.now();
        qa.captureClock(anchor);
        for (let frame = 0; frame < 240; frame++) {
          qa.advance(100); await new Promise(requestAnimationFrame);
          const state = qa.snapshot(), trace = state.presentation.traces[0];
          if (trace) {
            qa.captureClock(trace.born + state.presentation.shotTraceMs * 0.45);
            await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
            return { trace, event: qa.snapshot().shots.find(s => s.id === trace.id) };
          }
        }
        throw new Error('No actual fired-shot trace observed');
      });
      assert(shot.event, 'trace is backed by a real shot');
      assert.equal(shot.event.fromHexId, shot.trace.fromHexId);
      assert.equal(shot.event.targetHexId, shot.trace.targetHexId);
      const facings = await page.evaluate(() => window.__operationC.snapshot().presentation.facings);
      assert(facings.every(f => f.facingX === 1 || f.facingX === -1), 'horizontal-only unit facing');
      await page.screenshot({ path: path.join(outDir, 'desktop-bullet-traces.png') });
      await page.evaluate(() => window.__operationC.captureClock(null));
      console.log('PASS desktop: actual-shot traces and horizontal-only unit facing');
    }
    await page.screenshot({ path: path.join(outDir, `${profile.name}-battle.png`) });
    await press('restart');
    state = await page.evaluate(() => window.__operationC.snapshot());
    assert.equal(state.resources.committed, 0);
    console.log(`PASS ${profile.name}: canvas placement, production, order, 45s simulation, exclusive occupancy, restart; objects=${state.objects}, textures=${state.textures}`);
    await context.close();
  }
} finally { await browser.close(); }
assert.deepEqual(errors, [], 'browser console/page errors');
console.log('Operation C browser flow passed; no console errors.');
