// Unlocks bought with banked credits (BRIEF.md "Bank and unlocks"): cosmetics and quality of life,
// never raw power (owner rule). Shared by the server (purchases, checking what a pilot may wear)
// and the client (hangar, drawing other pilots' looks). Prices live in tune.json `unlockPrices`.
import type { Tune } from './tune';

/** Where an unlock is worn. One item per slot can be equipped; 'qol' items just work once owned. */
export type UnlockSlot = 'ship' | 'palette' | 'tint' | 'flame' | 'shield' | 'killfx' | 'badge' | 'tag' | 'qol';
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
  /** Free and always owned (the starter ship, the default palette). */
  free?: boolean;
  /** No longer sold (hull tints, replaced by palettes on 14 November 2026); kept so owners keep them. */
  legacy?: boolean;
  /** Ship type for a ship unlock (sim/chassis.ts), palette index for a palette. */
  index?: number;
}

export const UNLOCKS: readonly Unlock[] = [
  { id: 'ship.scrappy', slot: 'ship', name: 'Scrappy', index: 0, free: true },
  { id: 'ship.interceptor', slot: 'ship', name: 'Interceptor', index: 1 },
  // Palettes (owner art, tools/ship-rig/human-nomad-ships-v2/palettes.json): repaint hull, trim and glass.
  { id: 'palette.0', slot: 'palette', name: 'Cobalt & orange', index: 0, colour: 0x1f5fd6, free: true },
  { id: 'palette.1', slot: 'palette', name: 'Teal & gold', index: 1, colour: 0x1f8a6e },
  { id: 'palette.2', slot: 'palette', name: 'Crimson & cream', index: 2, colour: 0xb8303f },
  { id: 'palette.3', slot: 'palette', name: 'Violet & lime', index: 3, colour: 0x6f4bc9 },
  { id: 'tint.crimson', slot: 'tint', name: 'Crimson hull', colour: 0xff9a9a, legacy: true },
  { id: 'tint.emerald', slot: 'tint', name: 'Emerald hull', colour: 0x9affb4, legacy: true },
  { id: 'tint.violet', slot: 'tint', name: 'Violet hull', colour: 0xc8a8ff, legacy: true },
  { id: 'tint.gold', slot: 'tint', name: 'Gold hull', colour: 0xffdc8a, legacy: true },
  { id: 'tint.ice', slot: 'tint', name: 'Ice hull', colour: 0xb4e8ff, legacy: true },
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

/** Price in credits, by slot (tune.json unlockPrices); null for items not sold (free or legacy). */
export function unlockPrice(u: Unlock, tune: Tune): number | null {
  if (u.free || u.legacy) return null;
  const p = tune.unlockPrices;
  return u.id === 'runlog' ? p.runlog : p[u.slot as Exclude<LookSlot, 'tint'>];
}

/**
 * Hull tints became palettes (owner, 14 November 2026). Owners of a tint with a matching palette own
 * that palette; owners of the gold or ice tint may claim any one palette free (LEGACY_CLAIMS).
 */
const TINT_TO_PALETTE: Record<string, string> = { 'tint.crimson': 'palette.2', 'tint.emerald': 'palette.1', 'tint.violet': 'palette.3' };
export const LEGACY_CLAIMS = ['tint.gold', 'tint.ice'] as const;
export const claimMarker = (tint: string): string => `claimed.${tint}`;

/** What an account effectively owns: its unlocks, the free items and palettes converted from tints. */
export function effectiveOwned(owned: Iterable<string>): Set<string> {
  const have = new Set(owned);
  for (const u of UNLOCKS) if (u.free) have.add(u.id);
  for (const [tint, palette] of Object.entries(TINT_TO_PALETTE)) if (have.has(tint)) have.add(palette);
  return have;
}

/** A gold or ice tint not yet exchanged for a palette, or null. */
export function unclaimedLegacy(owned: Iterable<string>): string | null {
  const have = new Set(owned);
  return LEGACY_CLAIMS.find((t) => have.has(t) && !have.has(claimMarker(t))) ?? null;
}

/**
 * A look as asked for, kept only where each item exists, fits its slot and is owned. Anything else
 * is dropped, so nobody can wear what they have not bought.
 */
export function cleanLook(look: unknown, owned: Iterable<string>): Look {
  const have = effectiveOwned(owned);
  const out: Look = {};
  if (!look || typeof look !== 'object') return out;
  for (const [slot, id] of Object.entries(look as Record<string, unknown>)) {
    const u = unlockById(id);
    // Tints are no longer worn: palettes replaced them.
    if (u && u.slot === slot && u.slot !== 'qol' && u.slot !== 'tint' && have.has(u.id)) out[u.slot] = u.id;
  }
  return out;
}
