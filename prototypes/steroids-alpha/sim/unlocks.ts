// Unlocks bought with banked credits (BRIEF.md "Bank and unlocks"): cosmetics and quality of life,
// never raw power (owner rule). Shared by the server (purchases, checking what a pilot may wear)
// and the client (hangar, drawing other pilots' looks). Prices live in tune.json `unlockPrices`.
import type { Tune } from './tune';

/** Where an unlock is worn. One item per slot can be equipped; 'qol' items just work once owned. */
export type UnlockSlot = 'tint' | 'flame' | 'shield' | 'killfx' | 'badge' | 'tag' | 'qol';
export type LookSlot = Exclude<UnlockSlot, 'qol'>;
/** What a pilot has equipped: unlock id per slot. */
export type Look = Partial<Record<LookSlot, string>>;

export interface Unlock {
  id: string;
  slot: UnlockSlot;
  name: string;
  /** Hull tint (multiplies the art), tag colour, or the shield's main colour. */
  colour?: number;
  /** Thruster flame colours, hottest last (replaces the default blue and white). */
  palette?: number[];
  /** Leaderboard and name tag badge. */
  glyph?: string;
}

export const UNLOCKS: readonly Unlock[] = [
  { id: 'tint.crimson', slot: 'tint', name: 'Crimson hull', colour: 0xff9a9a },
  { id: 'tint.emerald', slot: 'tint', name: 'Emerald hull', colour: 0x9affb4 },
  { id: 'tint.violet', slot: 'tint', name: 'Violet hull', colour: 0xc8a8ff },
  { id: 'tint.gold', slot: 'tint', name: 'Gold hull', colour: 0xffdc8a },
  { id: 'tint.ice', slot: 'tint', name: 'Ice hull', colour: 0xb4e8ff },
  { id: 'flame.green', slot: 'flame', name: 'Green flame', palette: [0xffe27a, 0x2fbf5a, 0x7dff9a, 0xeaffef] },
  { id: 'flame.violet', slot: 'flame', name: 'Violet flame', palette: [0xff9ad6, 0x7a4dff, 0xb48cff, 0xf3e8ff] },
  { id: 'flame.white', slot: 'flame', name: 'White flame', palette: [0xfff2c4, 0xb8c4d6, 0xe8eef7, 0xffffff] },
  { id: 'flame.red', slot: 'flame', name: 'Red flame', palette: [0xffe27a, 0xd8321e, 0xff7a3a, 0xffd9b0] },
  { id: 'shield.green', slot: 'shield', name: 'Green shield', colour: 0x3ad97a },
  { id: 'shield.gold', slot: 'shield', name: 'Gold shield', colour: 0xffc23a },
  { id: 'shield.pink', slot: 'shield', name: 'Pink shield', colour: 0xff5ac8 },
  { id: 'killfx.nova', slot: 'killfx', name: 'Nova kill effect', colour: 0xb48cff },
  { id: 'badge.crown', slot: 'badge', name: 'Crown badge', glyph: '♛' },
  { id: 'badge.spark', slot: 'badge', name: 'Spark badge', glyph: '✦' },
  { id: 'badge.skull', slot: 'badge', name: 'Skull badge', glyph: '☠' },
  { id: 'tag.gold', slot: 'tag', name: 'Gold name', colour: 0xffd23a },
  { id: 'tag.mint', slot: 'tag', name: 'Mint name', colour: 0x7dffc4 },
  { id: 'tag.rose', slot: 'tag', name: 'Rose name', colour: 0xff8ab4 },
  { id: 'runlog', slot: 'qol', name: 'Run history' },
];

export const unlockById = (id: unknown): Unlock | undefined => UNLOCKS.find((u) => u.id === id);

/** Price in credits, by slot (tune.json unlockPrices). */
export function unlockPrice(u: Unlock, tune: Tune): number {
  const p = tune.unlockPrices;
  return u.id === 'runlog' ? p.runlog : p[u.slot as LookSlot];
}

/**
 * A look as asked for, kept only where each item exists, fits its slot and is owned. Anything else
 * is dropped, so nobody can wear what they have not bought.
 */
export function cleanLook(look: unknown, owned: Iterable<string>): Look {
  const have = new Set(owned);
  const out: Look = {};
  if (!look || typeof look !== 'object') return out;
  for (const [slot, id] of Object.entries(look as Record<string, unknown>)) {
    const u = unlockById(id);
    if (u && u.slot === slot && u.slot !== 'qol' && have.has(u.id)) out[u.slot] = u.id;
  }
  return out;
}
