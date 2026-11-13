// The bank account (BRIEF.md "Bank and unlocks"), from the client's side: create one on first visit,
// read the balance and unlocks, buy unlocks, and move an account here with its recovery code. The
// secret lives in the save blob; the server stores only hashes. Every call fails soft: no bank means
// play goes on unbanked.
import { serverOrigin } from '../base';
import { loadSave, writeSave } from '../save';

const httpOrigin = (): string => serverOrigin().replace(/^ws/, 'http');

export interface AccountState {
  balance: number;
  unlocks: string[];
}

/** Make sure this browser has an account. Returns its balance and unlocks, or null if the bank is unreachable. */
export async function ensureAccount(): Promise<AccountState | null> {
  try {
    const saved = loadSave().account;
    if (saved?.secret) {
      const r = await fetch(`${httpOrigin()}/account`, { headers: { Authorization: `Bearer ${saved.secret}` }, cache: 'no-store' });
      if (r.ok) {
        const a = (await r.json()) as Partial<AccountState>;
        return { balance: Number(a.balance) || 0, unlocks: Array.isArray(a.unlocks) ? a.unlocks : [] };
      }
      if (r.status !== 401) return null;
      // 401: the account moved to another device (recovered there). Start a fresh one here.
    }
    const r = await fetch(`${httpOrigin()}/account`, { method: 'POST', cache: 'no-store' });
    if (!r.ok) return null;
    const a = (await r.json()) as { secret: string; recovery: string; balance: number };
    writeSave({ account: { secret: a.secret, recovery: a.recovery }, look: {} });
    return { balance: a.balance, unlocks: [] };
  } catch {
    return null;
  }
}

/** Buy an unlock. The server sets the price and checks the balance. */
export async function buyUnlock(id: string): Promise<AccountState | { error: string }> {
  try {
    const secret = loadSave().account?.secret;
    if (!secret) return { error: 'No account yet' };
    const r = await fetch(`${httpOrigin()}/account/buy`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ unlock: id }), cache: 'no-store' });
    const a = (await r.json()) as { ok?: boolean; balance?: number; unlocks?: string[]; error?: string };
    if (a.ok) return { balance: Number(a.balance) || 0, unlocks: a.unlocks ?? [] };
    return { error: a.error === 'not enough credits' ? 'Not enough credits' : a.error === 'owned' ? 'Already owned' : 'Bank unavailable, try again' };
  } catch {
    return { error: 'Bank unavailable, try again' };
  }
}

/** Move an account to this browser with its recovery code. */
export async function recoverAccount(code: string): Promise<AccountState | { error: string }> {
  try {
    const r = await fetch(`${httpOrigin()}/account/recover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), cache: 'no-store' });
    if (r.status === 404) return { error: 'Code not found' };
    if (!r.ok) return { error: 'Bank unavailable, try again' };
    const a = (await r.json()) as { secret: string; recovery: string; balance: number };
    // Equipped looks belong to the old device's purchases until checked; start plain.
    writeSave({ account: { secret: a.secret, recovery: a.recovery }, look: {} });
    return (await ensureAccount()) ?? { balance: a.balance, unlocks: [] };
  } catch {
    return { error: 'Bank unavailable, try again' };
  }
}
