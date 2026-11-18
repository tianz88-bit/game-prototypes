// The shop (owner design): upgrades bought with minerals, paid from the hull maximum (power). Each
// item has 4 tiers; tier i needs at least <item>Floors[i] power and costs <item>Costs[i] minerals. Upgrades last until
// the ship is destroyed. Pure rules shared by server (which decides) and client (which shows offers).
import type { Tune } from './tune';
import type { ShipState } from './ship';
import { maxShield } from './ship';
import { BATTLECRUISER, MISSILE_CRUISER, isCapital, upgradeTotal } from './chassis';

/** Shop items by their wire number. */
export const SHOP_ITEMS = ['turret', 'shield', 'damage', 'missile', 'mine'] as const;
export type ShopItem = (typeof SHOP_ITEMS)[number];
export const SHOP_TIERS = 4;

const TIER_FIELD = { turret: 'turrets', shield: 'shieldTier', damage: 'damageTier', missile: 'missileTier', mine: 'mineTier' } as const;

export function shopTier(s: ShipState, item: ShopItem): number {
  return s[TIER_FIELD[item]];
}

/** The next tier of item on offer: its tier, the power it needs and its price; null when maxed. */
export function shopOffer(s: ShipState, item: ShopItem, tune: Tune): { tier: number; floor: number; cost: number } | null {
  const tier = shopTier(s, item);
  if (tier >= SHOP_TIERS) return null;
  return { tier, floor: tune.shop[`${item}Floors`][tier], cost: tune.shop[`${item}Costs`][tier] };
}

/** Whether the ship could buy item now. */
export function canBuy(s: ShipState, item: ShopItem, tune: Tune): boolean {
  const o = shopOffer(s, item, tune);
  return !!o && s.hp > 0 && s.hullMax >= o.floor && s.hullMax - o.cost >= 1;
}

/**
 * Buy the next tier of item if allowed. tier must be the one on offer, so a repeated or stale tap
 * cannot buy twice. Pays from the hull. Returns true if bought.
 */
export function buy(s: ShipState, item: ShopItem, tier: number, tune: Tune): boolean {
  const o = shopOffer(s, item, tune);
  if (!o || o.tier !== tier || !canBuy(s, item, tune)) return false;
  // The price comes off the hull maximum (power). Current hull only drops if it is above the new
  // maximum: a damaged ship keeps the hull it has (owner design).
  s.hullMax -= o.cost;
  s.hp = Math.min(s.hp, s.hullMax);
  s[TIER_FIELD[item]]++;
  // Each missile or mine tier comes with one more charge, ready to use.
  if (item === 'missile') s.missileCharges++;
  if (item === 'mine') s.mineCharges++;
  return true;
}

/**
 * Evolving into the Battlecruiser (owner design): offered during a run once a fighter has bought
 * battlecruiser.minUpgrades upgrades and carries at least battlecruiser.powerFloor power; it costs
 * battlecruiser.cost minerals from the hull maximum, like the shop. Sent as BUY item EVOLVE_ITEM.
 */
export const EVOLVE_ITEM = 5;

export function canEvolve(s: ShipState, tune: Tune, build=0): boolean {
  if(build!==0&&build!==1)return false;
  const b = build===1?tune.missileCruiser:tune.battlecruiser;
  return s.hp > 0 && !isCapital(s.chassis) && upgradeTotal(s) >= b.minUpgrades && (build===1?s.missileTier>=tune.missileCruiser.minMissiles&&s.mineTier>=tune.missileCruiser.minMines:s.turrets >= b.minTurrets && s.damageTier >= b.minGuns) && s.hullMax >= b.powerFloor && s.hullMax - b.cost >= 1;
}

/**
 * Evolve if allowed. Repeats are harmless: once evolved, canEvolve is false. Keeps every upgrade,
 * charge and the salvage carried; the hull keeps its points (capped by the new maximum after the
 * price) and the shield keeps its share of the larger maximum; gun heat resets.
 */
export function evolve(s: ShipState, tune: Tune, build=0): boolean {
  if (!canEvolve(s, tune,build)) return false;
  const shieldShare = s.shield / Math.max(1, maxShield(s, tune));
  s.hullMax -= (build===1?tune.missileCruiser:tune.battlecruiser).cost;
  s.hp = Math.min(s.hp, s.hullMax);
  s.chassis = build===1?MISSILE_CRUISER:BATTLECRUISER;
  if(build===1)s.missileCharges=tune.missileCruiser.capacity;
  s.shield = shieldShare * maxShield(s, tune);
  s.heat = 0;
  s.overheated = false;
  s.fireCd = 0;
  return true;
}

export function evolutionProgress(s:ShipState,tune:Tune,build:0|1){const b=build===1?tune.missileCruiser:tune.battlecruiser;
 const requirements=build===1?[{label:'MSL',have:s.missileTier,need:tune.missileCruiser.minMissiles},{label:'MINE',have:s.mineTier,need:tune.missileCruiser.minMines}]:[{label:'TUR',have:s.turrets,need:b.minTurrets},{label:'GUN',have:s.damageTier,need:b.minGuns}];
 return{ready:canEvolve(s,tune,build),requirements,missing:requirements.filter(r=>r.have<r.need),upgradeText:requirements.map(r=>r.label+Math.min(r.have,r.need)+'/'+r.need).join(' '),resourceText:canEvolve(s,tune,build)?'READY · '+b.cost+' MIN':(upgradeTotal(s)<b.minUpgrades&&requirements.every(r=>r.have>=r.need)?'LV '+upgradeTotal(s)+'/'+b.minUpgrades+' · ':'')+Math.min(Math.floor(s.hullMax),b.powerFloor)+'/'+b.powerFloor+'MIN ·'+b.cost,price:b.cost,floor:b.powerFloor};}
