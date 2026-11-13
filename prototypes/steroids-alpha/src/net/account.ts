// The bank account (BRIEF.md "Bank and unlocks"), from the client's side: create one on first visit,
// read the balance, and move an account here with its recovery code. The secret lives in the save
// blob; the server stores only hashes. Every call fails soft: no bank means play goes on unbanked.
import { serverOrigin } from '../base';
import { loadSave, writeSave } from '../save';

const httpOrigin = (): string => serverOrigin().replace(/^ws/, 'http');

/** Make sure this browser has an account. Returns its balance, or null if the bank is unreachable. */
export async function ensureAccount(): Promise<number | null> {
  try {
    const saved = loadSave().account;
    if (saved?.secret) {
      const r = await fetch(`${httpOrigin()}/account`, { headers: { Authorization: `Bearer ${saved.secret}` }, cache: 'no-store' });
      if (r.ok) return ((await r.json()) as { balance: number }).balance;
      if (r.status !== 401) return null;
      // 401: the account moved to another device (recovered there). Start a fresh one here.
    }
    const r = await fetch(`${httpOrigin()}/account`, { method: 'POST', cache: 'no-store' });
    if (!r.ok) return null;
    const a = (await r.json()) as { secret: string; recovery: string; balance: number };
    writeSave({ account: { secret: a.secret, recovery: a.recovery } });
    return a.balance;
  } catch {
    return null;
  }
}

/** Move an account to this browser with its recovery code. Returns the balance, or an error message. */
export async function recoverAccount(code: string): Promise<{ balance: number } | { error: string }> {
  try {
    const r = await fetch(`${httpOrigin()}/account/recover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), cache: 'no-store' });
    if (r.status === 404) return { error: 'Code not found' };
    if (!r.ok) return { error: 'Bank unavailable, try again' };
    const a = (await r.json()) as { secret: string; recovery: string; balance: number };
    writeSave({ account: { secret: a.secret, recovery: a.recovery } });
    return { balance: a.balance };
  } catch {
    return { error: 'Bank unavailable, try again' };
  }
}
