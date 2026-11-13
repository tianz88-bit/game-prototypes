// The bank (BRIEF.md "Bank and unlocks"): anonymous accounts, recovery codes, and the ledger that
// extraction credits. A balance is the sum of its ledger rows; every row has a unique id (the run
// id for an extraction), so a retried or repeated credit can never pay twice.
//
// Secrets and recovery codes are random and only their SHA-256 hashes are stored. The browser keeps
// the secret; the server never logs or returns it except once, when it is created.

/** The slice of Cloudflare D1 used here (declared locally; the repo has no workers-types). */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
  all(): Promise<unknown>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

/** Recovery code alphabet: Crockford base32 (no I, L, O, U). 12 characters = 60 bits. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** No single extraction can bank more than this (a sanity cap; power and salvage are bounded far lower). */
export const MAX_CREDIT = 100_000;

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A new account secret: 32 random bytes, base64url. */
export function newSecret(): string {
  let s = '';
  for (const b of randomBytes(32)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A new recovery code, shown as XXXX-XXXX-XXXX. */
export function newRecoveryCode(): string {
  const chars = [...randomBytes(12)].map((b) => CODE_ALPHABET[b & 31]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}

/**
 * A typed recovery code in canonical form (XXXX-XXXX-XXXX), or null if it cannot be one. Forgiving:
 * any case, spaces or dashes, and the look-alikes O->0, I/L->1.
 */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 40) return null;
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== 12 || [...s].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** A plausible secret (shape only): base64url, 40-64 characters. */
export function validSecret(secret: unknown): secret is string {
  return typeof secret === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(secret);
}

/** Create an anonymous account. Returns the secret and recovery code, which are never shown again. */
export async function createAccount(db: D1Like): Promise<{ secret: string; recovery: string; balance: number }> {
  const secret = newSecret();
  const recovery = newRecoveryCode();
  await db
    .prepare('INSERT INTO accounts (id, secret_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), await sha256(secret), await sha256(recovery), Date.now())
    .run();
  return { secret, recovery, balance: 0 };
}

/** The account a secret belongs to, or null. */
export async function accountFor(db: D1Like, secret: unknown): Promise<string | null> {
  if (!validSecret(secret)) return null;
  const row = await db.prepare('SELECT id FROM accounts WHERE secret_hash = ?').bind(await sha256(secret)).first<{ id: string }>();
  return row?.id ?? null;
}

export async function balanceOf(db: D1Like, account: string): Promise<number> {
  const row = await db.prepare('SELECT COALESCE(SUM(amount), 0) AS balance FROM ledger WHERE account_id = ?').bind(account).first<{ balance: number }>();
  return Number(row?.balance ?? 0);
}

/**
 * Move an account to this device: a valid recovery code gets a fresh secret (the old device's secret
 * stops working). Returns null for an unknown code.
 */
export async function recoverAccount(db: D1Like, code: unknown): Promise<{ secret: string; recovery: string; balance: number } | null> {
  const recovery = normalizeCode(code);
  if (!recovery) return null;
  const row = await db.prepare('SELECT id FROM accounts WHERE recovery_hash = ?').bind(await sha256(recovery)).first<{ id: string }>();
  if (!row) return null;
  const secret = newSecret();
  await db.prepare('UPDATE accounts SET secret_hash = ? WHERE id = ?').bind(await sha256(secret), row.id).run();
  return { secret, recovery, balance: await balanceOf(db, row.id) };
}

/**
 * Bank an extraction: amount credits (whole, capped) to the account owning secret, once per runId.
 * Returns the new balance, or null if the secret is unknown. Called by the planet room only; the
 * amount is the room's own count of salvage carried out, never a number from a client.
 */
export async function creditExtraction(db: D1Like, secret: unknown, amount: number, runId: string): Promise<number | null> {
  const account = await accountFor(db, secret);
  if (!account) return null;
  const credit = Math.max(0, Math.min(MAX_CREDIT, Math.floor(amount)));
  if (credit > 0) {
    await db
      .prepare("INSERT OR IGNORE INTO ledger (id, account_id, kind, amount, created_at) VALUES (?, ?, 'extract', ?, ?)")
      .bind(`extract:${runId}`, account, credit, Date.now())
      .run();
  }
  return balanceOf(db, account);
}

/** Unlock ids an account owns. */
export async function ownedUnlocks(db: D1Like, account: string): Promise<string[]> {
  const res = (await db.prepare('SELECT unlock_id FROM unlocks WHERE account_id = ? ORDER BY created_at').bind(account).all()) as { results?: { unlock_id: string }[] };
  return (res.results ?? []).map((r) => r.unlock_id);
}

export type BuyResult = { ok: true; balance: number; unlocks: string[] } | { ok: false; error: 'unknown account' | 'not for sale' | 'owned' | 'not enough credits'; balance?: number };

/**
 * Buy an unlock: one atomic batch. The purchase row is written only if the balance covers the
 * price and the item is not owned yet (its id is unique per account and item, so a repeated tap
 * cannot charge twice); the unlock row follows only if that purchase row exists. The price comes
 * from the server's catalogue, never from the client.
 */
export async function buyUnlock(db: D1Like, secret: unknown, unlockId: unknown, price: number | null): Promise<BuyResult> {
  const account = await accountFor(db, secret);
  if (!account) return { ok: false, error: 'unknown account' };
  if (typeof unlockId !== 'string' || price === null || !(price > 0)) return { ok: false, error: 'not for sale' };
  const key = `purchase:${account}:${unlockId}`;
  const now = Date.now();
  if ((await ownedUnlocks(db, account)).includes(unlockId)) return { ok: false, error: 'owned', balance: await balanceOf(db, account) };
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO ledger (id, account_id, kind, amount, created_at) SELECT ?, ?, 'purchase', ?, ? " +
          'WHERE (SELECT COALESCE(SUM(amount), 0) FROM ledger WHERE account_id = ?) >= ? ' +
          'AND NOT EXISTS (SELECT 1 FROM unlocks WHERE account_id = ? AND unlock_id = ?)',
      )
      .bind(key, account, -Math.floor(price), now, account, Math.floor(price), account, unlockId),
    db.prepare('INSERT OR IGNORE INTO unlocks (account_id, unlock_id, created_at) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM ledger WHERE id = ?)').bind(account, unlockId, now, key),
  ]);
  const [balance, unlocks] = await Promise.all([balanceOf(db, account), ownedUnlocks(db, account)]);
  return unlocks.includes(unlockId) ? { ok: true, balance, unlocks } : { ok: false, error: 'not enough credits', balance };
}
