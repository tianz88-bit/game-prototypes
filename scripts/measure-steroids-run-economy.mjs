// Headless run-economy probe for Steroids-Alpha (owner redesign, 19 November 2026): minerals are the
// one run currency, spent on upgrades in-run and banked on warp-out. Not a human-playtime prediction.
// Run from repo root: node scripts/measure-steroids-run-economy.mjs [seeds=6] [seconds=480] [key.path=value ...]
//   PROFILE=quiet (default, no bots) or PROFILE=bots (4 production bots, deaths reset the run)
//   e.g. node scripts/measure-steroids-run-economy.mjs 6 480 shop.yieldPerUpgrade=0.08
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: "export * from './prototypes/steroids-alpha/sim/ship';export * from './prototypes/steroids-alpha/sim/shop';export * from './prototypes/steroids-alpha/sim/wrap';export * from './prototypes/steroids-alpha/sim/asteroids';export * from './prototypes/steroids-alpha/sim/bots';export {upgradeTotal} from './prototypes/steroids-alpha/sim/chassis';export {World} from './prototypes/steroids-alpha/sim/world';export {TUNE} from './prototypes/steroids-alpha/sim/tune';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const S = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const args = process.argv.slice(2), nums = args.filter((a) => !a.includes('='));
const seeds = Number(nums[0] ?? 6), limit = Number(nums[1] ?? 480), profile = process.env.PROFILE || 'quiet';
const t = structuredClone(S.TUNE);
for (const a of args.filter((x) => x.includes('='))) {
  const [path, v] = a.split('='), keys = path.split('.');
  let o = t; for (const k of keys.slice(0, -1)) o = o[k];
  if (!(keys.at(-1) in o)) throw new Error('unknown tune key ' + path);
  o[keys.at(-1)] = v.includes(',') ? v.split(',').map(Number) : Number(v);
}
const hz = t.net.tickHz, marks = [30, 60, 90, 120, 180, 240, 300, 360, 420, 480].filter((m) => m <= limit);
function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let z = a; z = Math.imul(z ^ z >>> 15, z | 1); z ^= z + Math.imul(z ^ z >>> 7, z | 61); return ((z ^ z >>> 14) >>> 0) / 4294967296; }; }
const idle = () => ({ seq: 0, turn: 0, aim: NaN, thrust: 0, dash: false, fire: false, missile: false, mine: false, warp: false });
// The scripted miner from measure-steroids-progression-pace.mjs (coached profile).
function pilot(s, w, mem) {
  const rel = (x, y) => { const dx = S.wrapDelta(x, s.x, t.world.width), dy = S.wrapDelta(y, s.y, t.world.height); return { dx, dy, d: Math.hypot(dx, dy) }; };
  const i = idle(); let pick = null, rock = null;
  for (const p of w.pickups.values()) { if (p.kind !== 'mineral' && !(p.kind === 'heal' && s.hp < 45)) continue; const r = rel(p.x, p.y); if (r.d < 800 && (!pick || r.d < pick.d)) pick = { ...r, p }; }
  for (const a of w.asteroids.values()) { const pos = S.asteroidPos(a, w.tick, t), r = rel(pos.x, pos.y); if (r.d < 1000 && (!rock || r.d < rock.d)) rock = { ...r, a }; }
  if (pick) { i.aim = Math.atan2(pick.dy, pick.dx); i.thrust = pick.d < 350 ? -1 : 0; }
  else if (rock) { const tr = rock.d / t.weapon.bulletSpeed, dx = rock.dx + rock.a.vx * tr, dy = rock.dy + rock.a.vy * tr; i.aim = Math.atan2(dy, dx); i.thrust = rock.d < 350 ? -1 : 0; i.fire = Math.abs(S.angleDelta(i.aim, s.heading)) < 0.22; if (rock.d < t.asteroid.radius[rock.a.size] + S.shipRadius(s.hullMax, t, s.chassis) + 65) { i.aim += Math.PI * 0.65; i.thrust = 1; i.fire = false; } }
  else { i.aim = mem.wander; if (w.tick % 150 === 0) mem.wander += 0.8; }
  return i;
}
// Buys the cheapest next tier first (damage first on ties): the early spikes come quickly.
// BUY=n stops after n upgrades (BUY=0: a hoarder who banks everything).
const buyLimit = process.env.BUY === undefined ? 20 : Number(process.env.BUY);
function purchase(w, s) {
  if (S.upgradeTotal(s) >= buyLimit) return false;
  let best = null;
  for (const item of [2, 1, 0, 3, 4]) { const o = S.shopOffer(s, S.SHOP_ITEMS[item], t); if (o && (!best || o.cost < best.o.cost)) best = { item, o }; }
  return best && S.canBuy(s, S.SHOP_ITEMS[best.item], t) ? w.buy(1, best.item, best.o.tier) : false;
}
const cases = [];
for (let seed = 1; seed <= seeds; seed++) {
  const r = rng(seed), w = new S.World(structuredClone(t), r); w.moveHotZone();
  let s = w.addShip(1); const mem = { wander: s.heading }, brains = new Map();
  if (profile === 'bots') for (let id = 2; id <= 5; id++) { w.addShip(id, true); w.botIds.add(id); brains.set(id, { ...S.newBrain(r), bornAt: w.tick }); }
  w.drain();
  const row = { seed, at: {}, fullAt: null, deaths: 0, mined: 0, lostOnDeath: [], speedAt: {} };
  let input = idle(), life = 0, prevWallet = 0;
  for (let k = 0; k < limit * hz; k++) {
    const sec = k / hz;
    if (!w.ships.has(1) && k >= life) { s = w.addShip(1); prevWallet = 0; }
    if (w.ships.has(1)) {
      if (k % 5 === 0) input = pilot(s, w, mem);
      w.stepShip(1, input);
      if (k % 15 === 0) purchase(w, s);
    }
    const all = [...brains.values()];
    for (const [id, b] of brains) { const bs = w.ships.get(id); if (!bs) continue; const { input: bi, buy } = S.botThink(id, bs, w, b, t, r, all); if (buy) w.buy(id, buy.item, buy.tier); w.stepShip(id, bi); }
    w.step(); const ev = w.drain();
    for (const d of ev.deaths) {
      if (d.id === 1) { row.deaths++; row.lostOnDeath.push(Math.round(prevWallet)); w.removeShip(1); life = k + 5 * hz; }
      else { w.removeShip(d.id); brains.delete(d.id); const nid = 100 + k; w.addShip(nid, true); w.botIds.add(nid); brains.set(nid, { ...S.newBrain(r), bornAt: w.tick }); }
    }
    for (const x of ev.extracted ?? []) { const id = typeof x === 'number' ? x : x.id; if (id !== 1 && w.ships.has(id)) { w.removeShip(id); brains.delete(id); } }
    if (w.ships.has(1)) {
      const wallet = S.mineralBalance(s, t), spent = shopSpent(s);
      if (wallet > prevWallet) row.mined += wallet - prevWallet; prevWallet = wallet;
      if (row.fullAt === null && S.upgradeTotal(s) === 20) row.fullAt = Math.round(sec);
      const m = marks.find((x) => Math.abs(x - (k + 1) / hz) < 1e-9);
      if (m) { row.at[m] = { up: S.upgradeTotal(s), wallet: Math.round(wallet), spent, top: Math.round(S.topSpeed(s.hullMax, t, s.chassis)) }; }
    }
  }
  cases.push(row);
}
function shopSpent(s) { let n = 0; for (const item of S.SHOP_ITEMS) { const tier = S.shopTier(s, item); for (let i = 0; i < tier; i++) n += t.shop[item + 'Costs'][i]; } return n; }
const med = (xs) => { const v = xs.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : '-'; };
const cost = (i) => t.shop.damageCosts.join('/');
console.log(`Run economy probe: ${profile}, buys up to ${buyLimit}, ${seeds} seeds, ${limit}s. Tier costs ${cost()}, yield +${t.shop.yieldPerUpgrade * 100}%/upgrade, mining x${t.asteroid.miningMineralFactor}, warp lock ${t.warp.lockdownSeconds}s, bank rate ${t.salvage.bankRate} (home ${t.salvage.homeBankRate}).`);
console.log('time  upgrades  carried(bankable)  spent  top speed');
for (const m of marks) {
  const rows = cases.map((c) => c.at[m]).filter(Boolean);
  if (!rows.length) continue;
  console.log(`${String(m).padStart(4)}s  ${String(med(rows.map((x) => x.up))).padStart(8)}  ${String(med(rows.map((x) => x.wallet))).padStart(17)}  ${String(med(rows.map((x) => x.spent))).padStart(5)}  ${med(rows.map((x) => x.top))}`);
}
const full = cases.map((c) => c.fullAt);
console.log(`Full build (20 upgrades): median ${med(full)}s, reached ${full.filter((x) => x !== null).length}/${seeds}. Deaths per run: ${cases.map((c) => c.deaths).join(',')}; carried when killed: ${cases.flatMap((c) => c.lostOnDeath).join(',') || '-'}.`);
