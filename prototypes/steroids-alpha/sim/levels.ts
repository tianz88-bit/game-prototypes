// Run levels (owner, 19 November 2026): minerals collected this run are experience. Each level
// offers three perk cards; the pilot picks one. Collecting never spends the cargo, so everything
// carried still banks on warp-out. Owned evolutions always appear as a card once their
// requirements are met. Pure rules shared by the server (which decides) and the client (which shows
// the cards).
import type { Tune } from './tune';
import type { ShipState } from './ship';
import { maxShield, hullCapacity, levelsFromXp } from './ship';
import { BATTLECRUISER, MISSILE_CRUISER, isCapital, upgradeTotal } from './chassis';
import { SHOP_ITEMS, SHOP_TIERS, shopTier } from './shop';

/** Perk cards: 0-4 the upgrade tracks (SHOP_ITEMS order), EVOLVE_CARD + build an evolution. */
export const EVOLVE_CARD = 10;
export const CARDS_PER_LEVEL = 3;

/** Experience needed to go from level n-1 to level n (n from 1): early levels come quickly. */
export function levelStep(n: number, tune: Tune): number {
  return tune.shop.levelXpBase + tune.shop.levelXpGrowth * (n - 1);
}

/** Levels reached with xp experience. */
export function levelsEarned(xp: number, tune: Tune): number {
  return levelsFromXp(xp, tune);
}

/** Total experience needed to reach level n. */
export function xpForLevel(n: number, tune: Tune): number {
  let need = 0;
  for (let i = 1; i <= n; i++) need += levelStep(i, tune);
  return need;
}

/** Level-ups earned but not yet picked. */
export function pendingPicks(s: Pick<ShipState, 'xp' | 'picks'>, tune: Tune): number {
  return Math.max(0, levelsEarned(s.xp, tune) - s.picks);
}

function evolutionTune(build: number, tune: Tune) {
  return build === 1 ? tune.missileCruiser : tune.battlecruiser;
}

/** Whether evolution build's requirements are met (owning it is checked by the caller). */
export function evolutionReady(s: ShipState, build: number, tune: Tune): boolean {
  if (isCapital(s.chassis) || s.hp <= 0) return false;
  const b = evolutionTune(build, tune);
  if (upgradeTotal(s) < b.minUpgrades) return false;
  return build === 1 ? s.missileTier >= tune.missileCruiser.minMissiles && s.mineTier >= tune.missileCruiser.minMines : s.turrets >= b.minTurrets && s.damageTier >= b.minGuns;
}

/** Tracks an owned evolution still needs, so the draw can lean toward them. */
function wantedTracks(s: ShipState, owned: readonly number[], tune: Tune): Set<number> {
  const want = new Set<number>();
  if (isCapital(s.chassis)) return want;
  for (const build of owned) {
    if (build === 1) {
      if (s.missileTier < tune.missileCruiser.minMissiles) want.add(3);
      if (s.mineTier < tune.missileCruiser.minMines) want.add(4);
    } else {
      if (s.turrets < tune.battlecruiser.minTurrets) want.add(0);
      if (s.damageTier < tune.battlecruiser.minGuns) want.add(2);
    }
  }
  return want;
}

/**
 * Three cards for the next level: every owned evolution whose requirements are met (guaranteed),
 * then upgrade tracks not yet maxed, drawn without repeats. Tracks an owned evolution still needs
 * are shop.levelEvolutionWeight times as likely. Fewer cards when fewer are possible.
 */
export function drawCards(s: ShipState, owned: readonly number[], tune: Tune, rng: () => number): number[] {
  const cards: number[] = [];
  for (const build of owned) if (cards.length < CARDS_PER_LEVEL && evolutionReady(s, build, tune)) cards.push(EVOLVE_CARD + build);
  const want = wantedTracks(s, owned, tune);
  // Shield is passive per level now (owner, 21 November 2026), so it is never a card while that is on.
  const passiveShield = tune.shop.shieldPerLevel > 0;
  const pool = SHOP_ITEMS.map((name, i) => ({ i, w: shopTier(s, name) < SHOP_TIERS && !(passiveShield && name === 'shield') ? (want.has(i) ? tune.shop.levelEvolutionWeight : 1) : 0 })).filter((c) => c.w > 0);
  while (cards.length < CARDS_PER_LEVEL && pool.length) {
    let roll = rng() * pool.reduce((n, c) => n + c.w, 0), k = 0;
    while (k < pool.length - 1 && roll >= pool[k].w) roll -= pool[k++].w;
    cards.push(pool[k].i);
    pool.splice(k, 1);
  }
  return cards;
}

/** Apply a picked card. Returns false if it cannot apply (maxed track, evolution not ready). */
export function applyCard(s: ShipState, card: number, tune: Tune): boolean {
  if (card >= EVOLVE_CARD) {
    const build = card - EVOLVE_CARD;
    if (!evolutionReady(s, build, tune)) return false;
    const shieldShare = s.shield / Math.max(1, maxShield(s, tune));
    s.chassis = build === 1 ? MISSILE_CRUISER : BATTLECRUISER;
    if (build === 1) s.missileCharges = tune.missileCruiser.capacity;
    s.shield = shieldShare * maxShield(s, tune);
    s.hp = Math.min(s.hp, hullCapacity(s, tune));
    s.heat = 0;
    s.overheated = false;
    s.fireCd = 0;
    return true;
  }
  const name = SHOP_ITEMS[card];
  if (!name || shopTier(s, name) >= SHOP_TIERS) return false;
  const field = ({ turret: 'turrets', shield: 'shieldTier', damage: 'damageTier', missile: 'missileTier', mine: 'mineTier' } as const)[name];
  s[field]++;
  if (name === 'missile') s.missileCharges++;
  if (name === 'mine') s.mineCharges++;
  return true;
}

/** What a card shows: a short title and what it gives (values from tune, so they stay in step). */
export function cardText(card: number, s: ShipState, tune: Tune): { title: string; sub: string; evolve: boolean } {
  if (card >= EVOLVE_CARD) return { title: card - EVOLVE_CARD === 1 ? 'MISSILE CRUISER' : 'BATTLECRUISER', sub: 'EVOLVE NOW', evolve: true };
  const name = SHOP_ITEMS[card], next = (name ? shopTier(s, name) : 0) + 1;
  const sub: Record<string, string> = {
    turret: '+1 auto drone',
    shield: `+${tune.shop.shieldPerTier} shield`,
    damage: `+${Math.round(tune.shop.damagePerTier * 1000) / 10}% dmg`,
    missile: '+1 · faster',
    mine: '+1 · faster',
  };
  const title: Record<string, string> = { turret: 'DRONE', shield: 'SHIELD', damage: 'GUNS', missile: 'MISSILES', mine: 'MINES' };
  return { title: `${title[name] ?? '?'} ${next}/${SHOP_TIERS}`, sub: sub[name] ?? '', evolve: false };
}
