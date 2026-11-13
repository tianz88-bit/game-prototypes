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
// only when owned.
{
  const tune = JSON.parse(readFileSync(path.join(root, 'prototypes/steroids-alpha/tune.json'), 'utf8'));
  const db = d1();
  const a = await B.createAccount(db);
  await B.creditExtraction(db, a.secret, 700, 'r1');
  const tint = B.unlockById('tint.gold');
  const price = B.unlockPrice(tint, tune);
  assert.equal(price, tune.unlockPrices.tint, 'price from tune.json');
  assert.deepEqual(await B.buyUnlock(db, a.secret, 'tint.gold', price), { ok: true, balance: 700 - price, unlocks: ['tint.gold'] }, 'bought');
  assert.deepEqual(await B.buyUnlock(db, a.secret, 'tint.gold', price), { ok: false, error: 'owned', balance: 700 - price }, 'cannot buy twice');
  const run = B.unlockById('runlog');
  const left = 700 - price;
  const r = await B.buyUnlock(db, a.secret, 'runlog', B.unlockPrice(run, tune));
  assert.equal(r.ok, left >= tune.unlockPrices.runlog, 'second item if affordable');
  const poor = await B.createAccount(db);
  assert.deepEqual(await B.buyUnlock(db, poor.secret, 'tint.gold', price), { ok: false, error: 'not enough credits', balance: 0 }, 'needs the credits');
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM unlocks WHERE account_id = (SELECT id FROM accounts WHERE secret_hash = ?)").get(await B.sha256(poor.secret)).n, 0, 'nothing granted without payment');
  assert.deepEqual(await B.buyUnlock(db, B.newSecret(), 'tint.gold', price), { ok: false, error: 'unknown account' });
  assert.equal((await B.buyUnlock(db, a.secret, 'free.everything', null)).error, 'not for sale');
  // Every unlock has a price and a slot; no slot is a stat.
  for (const u of B.UNLOCKS) assert(B.unlockPrice(u, tune) > 0, `${u.id} priced`);
  assert(B.UNLOCKS.every((u) => ['tint', 'flame', 'shield', 'killfx', 'badge', 'tag', 'qol'].includes(u.slot)), 'cosmetic and QoL slots only');
  // cleanLook keeps owned, slot-matching items only.
  assert.deepEqual(B.cleanLook({ tint: 'tint.gold', flame: 'flame.red', badge: 'tint.gold', qol: 'runlog' }, ['tint.gold', 'runlog']), { tint: 'tint.gold' }, 'only owned items in their own slot');
  assert.deepEqual(B.cleanLook('nonsense', ['tint.gold']), {});

  // The room shows a pilot's look once the bank confirms ownership.
  class Sock extends EventTarget { sent = []; closed = 0; send(v) { this.sent.push(v); } close(c) { this.closed = c; } }
  const owned = async (secret) => { const id = await B.accountFor(db, secret); return id ? B.ownedUnlocks(db, id) : null; };
  const room = new B.Room(1, () => {}, undefined, owned);
  room.setBots(false);
  const sock = new Sock();
  room.join(sock, 'Shiny');
  room.stop();
  const [p] = [...room.players.values()];
  room.onMessage(p, JSON.stringify({ type: 'auth', secret: a.secret, look: { tint: 'tint.gold', flame: 'flame.red' } }));
  for (let i = 0; i < 20 && !p.look.tint; i++) await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(p.look, { tint: 'tint.gold' }, 'owned tint worn, unowned flame dropped');
  const roster = sock.sent.filter((m) => typeof m === 'string').map((m) => JSON.parse(m)).filter((m) => m.type === 'roster').pop();
  assert.deepEqual(roster.players.find((x) => x.id === p.id).look, { tint: 'tint.gold' }, 'everyone hears the look');
}

console.log('Steroids-Alpha bank: codes, hashed accounts, idempotent capped credits, recovery, room auth, banking on extraction, unlock purchases and owned looks all pass.');
