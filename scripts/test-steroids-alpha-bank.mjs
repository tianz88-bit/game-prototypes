// Bank test for Steroids-Alpha (server/src/bank.ts + server/migrations): accounts, recovery codes and
// idempotent extraction credits, run against the real migration SQL on an in-memory SQLite database
// shaped like Cloudflare D1. Also the room's side: the auth message and banking on extraction.
// Run: node scripts/test-steroids-alpha-bank.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'prototypes/steroids-alpha/server');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'steroids-bank-'));
const entry = `export * from ${JSON.stringify(path.join(server, 'src/bank.ts'))};
export { Room } from ${JSON.stringify(path.join(server, 'src/room.ts'))};
export * from ${JSON.stringify(path.join(root, 'prototypes/steroids-alpha/sim/protocol.ts'))};
export * from ${JSON.stringify(path.join(root, 'prototypes/steroids-alpha/sim/unlocks.ts'))};`;
await build({ stdin: { contents: entry, resolveDir: server, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: path.join(tmp, 'bank.mjs'), logLevel: 'silent' });
const B = await import(pathToFileURL(path.join(tmp, 'bank.mjs')).href);
rmSync(tmp, { recursive: true, force: true });

/** A D1-shaped wrapper over node:sqlite, with every migration applied in order. */
function d1() {
  const db = new DatabaseSync(':memory:');
  const dir = path.join(server, 'migrations');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(path.join(dir, f), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...v) => stmt(sql, v),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => db.prepare(sql).run(...args),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  // D1 runs a batch as one transaction.
  return {
    raw: db,
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const st of list) out.push(await st.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

// Codes and secrets.
{
  const code = B.newRecoveryCode();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/, 'recovery code shape');
  assert.equal(B.normalizeCode(code.toLowerCase().replace(/-/g, ' ')), code, 'any case, spaces instead of dashes');
  assert.equal(B.normalizeCode('oooo-iiii-llll'), '0000-1111-1111', 'look-alikes map to digits');
  assert.equal(B.normalizeCode('ABCD-EFGH-JKM'), null, 'too short');
  assert.equal(B.normalizeCode('ABCD-EFGH-JKMU'), null, 'U is not in the alphabet');
  assert.equal(B.normalizeCode(42), null, 'not a string');
  const s = B.newSecret();
  assert(B.validSecret(s) && s.length === 43, 'secret: 32 bytes base64url');
  assert.notEqual(B.newSecret(), s, 'secrets differ');
}

// Accounts: only hashes stored; balance from the ledger; credits idempotent per run; recovery moves the account.
{
  const db = d1();
  const a = await B.createAccount(db);
  assert.equal(a.balance, 0, 'new account starts at 0');
  const row = db.raw.prepare('SELECT * FROM accounts').get();
  assert(row.secret_hash !== a.secret && row.secret_hash.length === 64, 'secret stored only as a hash');
  assert(row.recovery_hash !== a.recovery && row.recovery_hash.length === 64, 'recovery code stored only as a hash');
  assert.equal(await B.accountFor(db, a.secret), row.id, 'secret finds its account');
  assert.equal(await B.accountFor(db, B.newSecret()), null, 'unknown secret finds nothing');
  assert.equal(await B.accountFor(db, "x' OR 1=1 --"), null, 'malformed secret rejected before any query');

  assert.equal(await B.creditExtraction(db, a.secret, 84.9, 'run-1'), 84, 'credit whole salvage');
  assert.equal(await B.creditExtraction(db, a.secret, 84.9, 'run-1'), 84, 'same run again: no second payout');
  assert.equal(await B.creditExtraction(db, a.secret, 16, 'run-2'), 100, 'another run adds up');
  assert.equal(await B.creditExtraction(db, a.secret, 0, 'run-3'), 100, 'nothing carried: nothing credited');
  assert.equal(await B.creditExtraction(db, a.secret, 1e9, 'run-4'), 100 + B.MAX_CREDIT, 'one extraction is capped');
  assert.equal(await B.creditExtraction(db, B.newSecret(), 50, 'run-5'), null, 'unknown account: no credit');
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM ledger').get().n, 3, 'one ledger row per paying run');

  const moved = await B.recoverAccount(db, a.recovery.toLowerCase());
  assert(moved && moved.balance === 100 + B.MAX_CREDIT && moved.recovery === a.recovery, 'recovery code restores the account and balance');
  assert.equal(await B.accountFor(db, a.secret), null, 'the old secret stops working');
  assert.equal(await B.accountFor(db, moved.secret), row.id, 'the new secret works');
  assert.equal(await B.recoverAccount(db, B.newRecoveryCode()), null, 'unknown code: nothing');
  assert.equal(await B.recoverAccount(db, 'nonsense'), null, 'malformed code: nothing');
  const b = await B.createAccount(db);
  await B.creditExtraction(db, b.secret, 7, 'run-b');
  assert.equal(await B.balanceOf(db, await B.accountFor(db, b.secret)), 7, 'accounts are separate');
}

// Room: the one auth message names the account; extraction credits the room's own salvage count for
// this run, reports it, then closes the connection.
{
  const tune = JSON.parse(readFileSync(path.join(root, 'prototypes/steroids-alpha/tune.json'), 'utf8'));
  class Sock extends EventTarget { sent = []; closed = 0; send(v) { this.sent.push(v); } close(c) { this.closed = c; } }
  const frames = (s) => s.sent.filter((m) => typeof m === 'string').map((m) => JSON.parse(m));
  const extract = async (room, sock, salvage) => {
    const [p] = [...room.players.values()];
    p.started = true;
    Object.assign(p.ship, { lockdown: 0, warping: true, warpDist: tune.warp.distance - 1, salvage });
    for (let i = 0; i < 3 && !frames(sock).some((m) => m.type === 'extracted'); i++) room.step();
    for (let i = 0; i < 20 && !sock.closed; i++) await new Promise((r) => setTimeout(r, 5));
    return { p, banked: frames(sock).find((m) => m.type === 'banked') };
  };
  const db = d1();
  const acct = await B.createAccount(db);
  const calls = [];
  const bank = async (secret, amount, runId) => { calls.push({ secret, amount, runId }); return B.creditExtraction(db, secret, amount, runId); };

  const room = new B.Room(1, () => {}, bank);
  room.setBots(false);
  const sock = new Sock();
  room.join(sock, 'Banker');
  room.stop();
  const [player] = [...room.players.values()];
  room.onMessage(player, JSON.stringify({ type: 'auth', secret: acct.secret }));
  assert.equal(player.secret, acct.secret, 'auth message stores the secret');
  assert.equal(sock.closed, 0, 'auth message accepted');
  const { p, banked } = await extract(room, sock, 57.8);
  assert.deepEqual(calls.map((c) => c.amount), [57], 'the room banks its own whole salvage count');
  assert.equal(calls[0].runId, p.runId, 'keyed by this run');
  assert.deepEqual(banked, { type: 'banked', amount: 57, balance: 57 }, 'pilot hears the new balance');
  assert.equal(sock.closed, B.CLOSE.EXTRACTED, 'closed as extracted after banking');

  // Without an account: nothing banked, told why. A second auth or any other text closes the socket.
  const room2 = new B.Room(1, () => {}, bank);
  room2.setBots(false);
  const s2 = new Sock();
  room2.join(s2, 'NoAcct');
  room2.stop();
  const r2 = await extract(room2, s2, 30);
  assert.deepEqual(r2.banked, { type: 'banked', amount: 0, balance: null, error: 'no account' }, 'no account: not banked');
  const room3 = new B.Room(1, () => {}, bank);
  const s3 = new Sock();
  room3.join(s3, 'Spam');
  room3.stop();
  const [p3] = [...room3.players.values()];
  room3.onMessage(p3, JSON.stringify({ type: 'auth', secret: acct.secret }));
  room3.onMessage(p3, JSON.stringify({ type: 'auth', secret: acct.secret }));
  assert.equal(s3.closed, B.CLOSE.BAD_PROTOCOL, 'only one auth message');
  const room4 = new B.Room(1, () => {}, async () => { throw new Error('D1 down'); });
  room4.setBots(false);
  const s4 = new Sock();
  room4.join(s4, 'Down');
  room4.stop();
  room4.onMessage([...room4.players.values()][0], JSON.stringify({ type: 'auth', secret: acct.secret }));
  const r4 = await extract(room4, s4, 30);
  assert.equal(r4.banked.error, 'bank unavailable', 'bank failure reported, run still ends');
  assert.equal(s4.closed, B.CLOSE.EXTRACTED);
}

// Unlocks: buying charges the server's price once, needs the credits, cannot buy twice; looks are worn
// only when owned. Tints are no longer sold: matching palettes come with them, gold/ice give a free claim.
{
  const tune = JSON.parse(readFileSync(path.join(root, 'prototypes/steroids-alpha/tune.json'), 'utf8'));
  // The same quote the Worker route uses (server/src/index.ts).
  const quoteFor = (id) => (owned) => {
    const u = B.unlockById(id);
    if (!u) return null;
    if (B.effectiveOwned(owned).has(u.id)) return 'owned';
    const legacy = u.slot === 'palette' ? B.unclaimedLegacy(owned) : null;
    if (legacy) return { price: 0, grant: B.claimMarker(legacy) };
    const price = B.unlockPrice(u, tune);
    return price === null ? null : { price };
  };
  const db = d1();
  const a = await B.createAccount(db);
  await B.creditExtraction(db, a.secret, 2500, 'r1');
  const pal = tune.unlockPrices.palette;
  assert.deepEqual(await B.buyUnlock(db, a.secret, 'palette.1', quoteFor('palette.1')), { ok: true, balance: 2500 - pal, unlocks: ['palette.1'] }, 'palette bought at the server price');
  assert.deepEqual(await B.buyUnlock(db, a.secret, 'palette.1', quoteFor('palette.1')), { ok: false, error: 'owned', balance: 2500 - pal }, 'cannot buy twice');
  assert.equal((await B.buyUnlock(db, a.secret, 'ship.interceptor', quoteFor('ship.interceptor'))).balance, 2500 - pal - tune.unlockPrices.ship, 'interceptor bought');
  assert.equal((await B.buyUnlock(db, a.secret, 'tint.gold', quoteFor('tint.gold'))).error, 'not for sale', 'tints no longer sold');
  assert.equal((await B.buyUnlock(db, a.secret, 'palette.0', quoteFor('palette.0'))).error, 'owned', 'default palette is free and owned');
  assert.equal((await B.buyUnlock(db, a.secret, 'ship.scrappy', quoteFor('ship.scrappy'))).error, 'owned', 'starter ship is owned');
  const poor = await B.createAccount(db);
  assert.equal((await B.buyUnlock(db, poor.secret, 'palette.2', quoteFor('palette.2'))).error, 'not enough credits', 'needs the credits');
  assert.equal((await B.buyUnlock(db, B.newSecret(), 'palette.2', quoteFor('palette.2'))).error, 'unknown account');
  assert.equal((await B.buyUnlock(db, a.secret, 'free.everything', quoteFor('free.everything'))).error, 'not for sale');
  // Every item for sale is priced; nothing sold is a stat.
  for (const u of B.UNLOCKS) if (!u.free && !u.legacy) assert(B.unlockPrice(u, tune) > 0, `${u.id} priced`);
  assert(B.UNLOCKS.every((u) => ['ship', 'palette', 'tint', 'flame', 'shield', 'killfx', 'badge', 'tag', 'qol'].includes(u.slot)), 'cosmetic, ship-choice and QoL slots only');

  // Legacy tints: crimson owners own the crimson palette; a gold owner claims any one palette free, once.
  const t = await B.createAccount(db);
  const tid = await B.accountFor(db, t.secret);
  for (const id of ['tint.crimson', 'tint.gold']) db.raw.prepare('INSERT INTO unlocks (account_id, unlock_id, created_at) VALUES (?, ?, 0)').run(tid, id);
  assert.equal((await B.buyUnlock(db, t.secret, 'palette.2', quoteFor('palette.2'))).error, 'owned', 'crimson tint gives the crimson palette');
  const claim = await B.buyUnlock(db, t.secret, 'palette.3', quoteFor('palette.3'));
  assert(claim.ok && claim.balance === 0 && claim.unlocks.includes('claimed.tint.gold'), 'gold tint: one palette free');
  assert.equal((await B.buyUnlock(db, t.secret, 'palette.1', quoteFor('palette.1'))).error, 'not enough credits', 'the claim is used up');
  assert.deepEqual(B.cleanLook({ palette: 'palette.2', tint: 'tint.crimson' }, ['tint.crimson']), { palette: 'palette.2' }, 'tints are not worn; their palette is');

  // cleanLook keeps owned, slot-matching items only.
  assert.deepEqual(B.cleanLook({ ship: 'ship.interceptor', palette: 'palette.1', flame: 'flame.red', badge: 'palette.1', qol: 'runlog' }, ['palette.1', 'runlog']), { palette: 'palette.1' }, 'unowned interceptor and flame dropped');
  assert.deepEqual(B.cleanLook({ ship: 'ship.scrappy', palette: 'palette.0' }, []), { ship: 'ship.scrappy', palette: 'palette.0' }, 'free items always allowed');
  assert.deepEqual(B.cleanLook('nonsense', ['palette.1']), {});

  // The room shows a pilot's look once the bank confirms ownership, and an owned Interceptor
  // replaces the starter right after drop-in.
  class Sock extends EventTarget { sent = []; closed = 0; send(v) { this.sent.push(v); } close(c) { this.closed = c; } }
  const owned = async (secret) => { const id = await B.accountFor(db, secret); return id ? B.ownedUnlocks(db, id) : null; };
  const room = new B.Room(1, () => {}, undefined, owned);
  room.setBots(false);
  const sock = new Sock();
  room.join(sock, 'Shiny');
  room.stop();
  const [p] = [...room.players.values()];
  room.onMessage(p, JSON.stringify({ type: 'auth', secret: a.secret, look: { ship: 'ship.interceptor', palette: 'palette.1', flame: 'flame.red' } }));
  for (let i = 0; i < 20 && !p.look.palette; i++) await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(p.look, { ship: 'ship.interceptor', palette: 'palette.1' }, 'owned ship and palette worn, unowned flame dropped');
  assert.equal(p.ship.chassis, 1, 'interceptor flies');
  const roster = sock.sent.filter((m) => typeof m === 'string').map((m) => JSON.parse(m)).filter((m) => m.type === 'roster').pop();
  assert.deepEqual(roster.players.find((x) => x.id === p.id).look, { ship: 'ship.interceptor', palette: 'palette.1' }, 'everyone hears the look');
  // Without the unlock: still the starter.
  const room2 = new B.Room(1, () => {}, undefined, owned);
  room2.setBots(false);
  room2.join(new Sock(), 'Poor');
  room2.stop();
  const [p2] = [...room2.players.values()];
  room2.onMessage(p2, JSON.stringify({ type: 'auth', secret: poor.secret, look: { ship: 'ship.interceptor' } }));
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(p2.ship.chassis, 0, 'no interceptor without the unlock');
}

console.log('Steroids-Alpha bank: codes, hashed accounts, idempotent capped credits, recovery, room auth, banking on extraction, unlock purchases, palettes from tints, ship choice and owned looks all pass.');
