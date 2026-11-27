// Single-player tower run: pick a starter, pay an entry bet per floor,
// fight, take the payout, pick a level-up tile, repeat until broke or KO.
import { tune } from '../tune';
import {
  OFFER_TILES,
  PALETTES,
  PARTS,
  PARTS_BY_SLOT,
  SLOTS,
  STARTERS,
  tileRarity,
  type MonsterSpec,
  type PartId,
  type Rarity,
  type TileId,
} from './content';
import { createCombat, makeFighter, yieldFight, type Combat } from './combat';
import { pickIndex, type Rng } from './rng';

export type Screen = 'select' | 'prefight' | 'fight' | 'result' | 'loot' | 'levelup' | 'gameover';

export interface Run {
  screen: Screen;
  rng: Rng;
  monster: MonsterSpec | null;
  gold: number;
  floor: number;
  level: number;
  streak: number;
  bestStreak: number;
  enemy: MonsterSpec | null;
  combat: Combat | null;
  /** Outcome of the last fight, shown on the result screen. */
  last: { won: boolean; yielded: boolean; payout: number } | null;
  offers: TileId[];
  /** Part dropped by the last defeated enemy, offered as a swap. */
  drop: PartId | null;
  /** The 4th starter option: random common parts, re-rolled on demand. */
  randomStarter: MonsterSpec;
  gameOverReason: string;
}

export function newRun(rng: Rng): Run {
  return {
    randomStarter: randomStarter(rng),
    screen: 'select', rng, monster: null, gold: tune.run.startGold, floor: 1, level: 1,
    streak: 0, bestStreak: 0, enemy: null, combat: null, last: null, offers: [], drop: null, gameOverReason: '',
  };
}

export function entryBet(run: Run): number {
  return tune.run.betBase + (run.floor - 1) * tune.run.betPerFloor;
}

/** Rarities that may appear on this floor. Rarer ones never roll before their floor. */
export function allowedRarities(floor: number): Rarity[] {
  const r = tune.rarity;
  return floor >= r.epicFromFloor ? ['common', 'rare', 'epic'] : floor >= r.rareFromFloor ? ['common', 'rare'] : ['common'];
}

/** Weighted pick that respects the floor's rarity gate. */
function pickByRarity<T>(rng: Rng, items: T[], rarityOf: (t: T) => Rarity, floor: number): T {
  const allowed = allowedRarities(floor);
  const weight = (r: Rarity) => (r === 'epic' ? tune.rarity.epicWeight : r === 'rare' ? tune.rarity.rareWeight : 1);
  const pool = items.filter((t) => allowed.includes(rarityOf(t)));
  const total = pool.reduce((s, t) => s + weight(rarityOf(t)), 0);
  let roll = rng() * total;
  for (const t of pool) {
    roll -= weight(rarityOf(t));
    if (roll <= 0) return t;
  }
  return pool[pool.length - 1];
}

const NAME_A = ['Tusk', 'Maw', 'Crest', 'Fang', 'Scar', 'Gloom', 'Ember', 'Rift'];
const NAME_B = ['hulk', 'wisp', 'reaver', 'back', 'claw', 'drake'];

export function randomMonster(rng: Rng, floor: number, name?: string): MonsterSpec {
  const build = {} as MonsterSpec['build'];
  for (const slot of SLOTS) build[slot] = pickByRarity(rng, PARTS_BY_SLOT[slot], (id) => PARTS[id].rarity, floor);
  return {
    name: name ?? `${NAME_A[pickIndex(rng, NAME_A.length)]}${NAME_B[pickIndex(rng, NAME_B.length)]}`,
    soul: 'wild', build, extra: [], palette: PALETTES[pickIndex(rng, PALETTES.length)],
  };
}

/** The random-roll starter: random common parts with the Adaptive soul. */
function randomStarter(rng: Rng): MonsterSpec {
  return { ...randomMonster(rng, 1, 'Random roll'), soul: 'adaptive' };
}

export function rerollRandomStarter(run: Run) {
  run.randomStarter = randomStarter(run.rng);
}

/** The 4 starter options: 3 premade plus the random roll. */
export function starterOptions(run: Run): MonsterSpec[] {
  return [...STARTERS, run.randomStarter];
}

function prepareFloor(run: Run) {
  run.enemy = randomMonster(run.rng, run.floor);
  run.enemy.name += ` F${run.floor}`;
  run.combat = null;
  if (run.gold < entryBet(run)) {
    run.screen = 'gameover';
    run.gameOverReason = 'Not enough gold for the next entry bet.';
  } else run.screen = 'prefight';
}

export function chooseStarter(run: Run, index: number) {
  const s = starterOptions(run)[index];
  if (!s) return;
  run.monster = { ...s, name: index === STARTERS.length ? 'Mongrel' : s.name, build: { ...s.build }, extra: [] };
  prepareFloor(run);
}

export function enterFight(run: Run) {
  if (run.screen !== 'prefight' || !run.monster || !run.enemy) return;
  run.gold -= entryBet(run);
  const r = tune.run;
  const f = run.floor - 1;
  const player = makeFighter('player', run.monster);
  const enemy = makeFighter('enemy', run.enemy, { hp: 1 + f * r.enemyHpPerFloor, atk: 1 + f * r.enemyAtkPerFloor });
  run.combat = createCombat(player, enemy, run.rng);
  run.screen = 'fight';
}

export function playerYield(run: Run) {
  if (run.screen === 'fight' && run.combat && !run.combat.winner) yieldFight(run.combat, 'player');
}

/** Called once the fight has a winner and its ending has played out. */
export function finishFight(run: Run) {
  const c = run.combat;
  if (!c || !c.winner || run.screen !== 'fight') return;
  const won = c.winner === 'player';
  const yielded = !won && c.fighters.player.hp > 0;
  const payout = won ? Math.round(entryBet(run) * tune.run.payoutMult) : 0;
  run.gold += payout;
  run.last = { won, yielded, payout };
  if (won) {
    run.streak++;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
  } else run.streak = 0;
  run.screen = 'result';
}

export function continueAfterResult(run: Run) {
  if (run.screen !== 'result' || !run.last) return;
  if (run.last.won) {
    run.level++;
    run.offers = rollOffers(run);
    run.drop = rollDrop(run);
    run.screen = run.drop ? 'loot' : 'levelup';
  } else if (!run.last.yielded) {
    run.screen = 'gameover';
    run.gameOverReason = `${run.monster?.name} took the final hit and is lost.`;
  } else prepareFloor(run); // yielded: retry the same floor if gold allows
}

/** One of the defeated enemy's parts that differs from the player's part in that slot. */
function rollDrop(run: Run): PartId | null {
  if (!run.enemy || !run.monster) return null;
  const options = SLOTS.map((s) => run.enemy!.build[s]).filter((id) => run.monster!.build[PARTS[id].slot] !== id);
  return options.length ? options[pickIndex(run.rng, options.length)] : null;
}

/** Take the dropped part (replacing the one in its slot) or keep the current one. */
export function chooseLoot(run: Run, take: boolean) {
  if (run.screen !== 'loot' || !run.monster) return;
  if (take && run.drop) {
    const slot = PARTS[run.drop].slot;
    run.monster = { ...run.monster, build: { ...run.monster.build, [slot]: run.drop } };
  }
  run.drop = null;
  run.screen = 'levelup';
}

function rollOffers(run: Run): TileId[] {
  const out: TileId[] = [];
  // Offers use the next floor's gate, so rarer tiles show up as the tower climbs.
  for (let tries = 0; tries < 60 && out.length < tune.run.offerCount; tries++) {
    const t = pickByRarity(run.rng, OFFER_TILES, tileRarity, run.floor + 1);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export function chooseOffer(run: Run, index: number) {
  if (run.screen !== 'levelup' || !run.monster) return;
  const t = run.offers[index];
  if (!t) return;
  run.monster.extra.push(t);
  run.floor++;
  prepareFloor(run);
}

export function restartRun(run: Run): Run {
  const fresh = newRun(run.rng);
  fresh.bestStreak = run.bestStreak;
  return fresh;
}

export function partNames(spec: MonsterSpec): string[] {
  return SLOTS.map((s) => PARTS[spec.build[s]].name);
}
