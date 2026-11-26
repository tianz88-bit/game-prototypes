// Tile and part identities. All numbers (power, stats, buffs) live in
// tune.json; this file only says what things are and which tiles each part
// puts on the reels.

export type MoveKind = 'attack' | 'defend' | 'brains';
export type DamageType = 'slash' | 'crush' | 'pierce' | 'exotherm';
export type MoveId = 'claw' | 'bite' | 'slam' | 'breath' | 'guard' | 'snatch' | 'jam';
export type MutatorId = 'power' | 'quick' | 'high' | 'low' | 'blank';
export type TileId = MoveId | MutatorId;
export type Direction = 'front' | 'high' | 'low';

export interface MoveDef {
  kind: MoveKind;
  label: string;
  short: string;
  dmg?: DamageType;
}

export const MOVES: Record<MoveId, MoveDef> = {
  claw: { kind: 'attack', label: 'Claw', short: 'Clw', dmg: 'slash' },
  bite: { kind: 'attack', label: 'Bite', short: 'Bit', dmg: 'pierce' },
  slam: { kind: 'attack', label: 'Slam', short: 'Slm', dmg: 'crush' },
  breath: { kind: 'attack', label: 'Breath', short: 'Brt', dmg: 'exotherm' },
  guard: { kind: 'defend', label: 'Guard', short: 'Grd' },
  snatch: { kind: 'brains', label: 'Snatch', short: 'Snt' },
  jam: { kind: 'brains', label: 'Jam', short: 'Jam' },
};

export const MUTATORS: Record<MutatorId, { label: string; short: string }> = {
  power: { label: 'Power+', short: 'Pw+' },
  quick: { label: 'Quick', short: 'Qck' },
  high: { label: 'High', short: 'Hi' },
  low: { label: 'Low', short: 'Lo' },
  blank: { label: '-', short: '-' },
};

export function isMove(id: TileId): id is MoveId {
  return id in MOVES;
}

export function tileLabel(id: TileId): string {
  return isMove(id) ? MOVES[id].label : MUTATORS[id].label;
}

export function tileShort(id: TileId): string {
  return isMove(id) ? MOVES[id].short : MUTATORS[id].short;
}

export function directionOf(id: TileId): Direction {
  return id === 'high' || id === 'low' ? id : 'front';
}

// ------------------------------------------------------------------ parts

export type Slot = 'body' | 'head' | 'limbs' | 'legs' | 'skin' | 'aux';
export const SLOTS: Slot[] = ['body', 'head', 'limbs', 'legs', 'skin', 'aux'];
export type ArmourId = 'hide' | 'shell' | 'fur';
/** Which attack direction a part faces. Skin is armour, not a hitzone. */
export type Zone = Direction | 'back' | 'none';

export type PartId =
  | 'brute' | 'stalker'
  | 'tusk' | 'maw' | 'crest'
  | 'claws' | 'fists' | 'wings'
  | 'striders' | 'stumps'
  | 'hide' | 'shell' | 'fur'
  | 'spines' | 'tailclub' | 'pouch';

export interface PartDef {
  slot: Slot;
  name: string;
  zone: Zone;
  moves: MoveId[];
  mutators: MutatorId[];
  /** Tiles already in the pocket when a fight starts. */
  startPocket?: TileId[];
  flight?: boolean;
  armour?: ArmourId;
}

export const PARTS: Record<PartId, PartDef> = {
  brute: { slot: 'body', name: 'Brute body', zone: 'none', moves: ['guard'], mutators: ['blank', 'blank'] },
  stalker: { slot: 'body', name: 'Stalker body', zone: 'none', moves: ['snatch'], mutators: ['quick', 'blank'] },
  tusk: { slot: 'head', name: 'Tusk head', zone: 'high', moves: ['bite', 'bite'], mutators: ['power'] },
  maw: { slot: 'head', name: 'Maw head', zone: 'high', moves: ['bite', 'breath'], mutators: ['blank'] },
  crest: { slot: 'head', name: 'Crest head', zone: 'high', moves: ['jam', 'breath'], mutators: ['high'] },
  claws: { slot: 'limbs', name: 'Claws', zone: 'front', moves: ['claw', 'claw', 'claw'], mutators: ['power'] },
  fists: { slot: 'limbs', name: 'Fists', zone: 'front', moves: ['slam', 'slam', 'guard'], mutators: ['low'] },
  wings: { slot: 'limbs', name: 'Wings', zone: 'high', moves: ['claw'], mutators: ['high', 'quick'], flight: true },
  striders: { slot: 'legs', name: 'Strider legs', zone: 'low', moves: ['claw'], mutators: ['quick', 'blank'] },
  stumps: { slot: 'legs', name: 'Stump legs', zone: 'low', moves: ['guard', 'slam'], mutators: ['low', 'blank'] },
  hide: { slot: 'skin', name: 'Hide', zone: 'none', moves: [], mutators: ['blank'], armour: 'hide' },
  shell: { slot: 'skin', name: 'Shell', zone: 'none', moves: ['guard'], mutators: ['blank'], armour: 'shell' },
  fur: { slot: 'skin', name: 'Fur', zone: 'none', moves: [], mutators: ['quick'], armour: 'fur' },
  spines: { slot: 'aux', name: 'Spines', zone: 'back', moves: ['jam'], mutators: ['power'] },
  tailclub: { slot: 'aux', name: 'Tail club', zone: 'back', moves: ['slam'], mutators: ['low'] },
  pouch: { slot: 'aux', name: 'Pouch', zone: 'back', moves: ['snatch'], mutators: ['blank'], startPocket: ['power'] },
};

export const PARTS_BY_SLOT: Record<Slot, PartId[]> = {
  body: ['brute', 'stalker'],
  head: ['tusk', 'maw', 'crest'],
  limbs: ['claws', 'fists', 'wings'],
  legs: ['striders', 'stumps'],
  skin: ['hide', 'shell', 'fur'],
  aux: ['spines', 'tailclub', 'pouch'],
};

export type Build = Record<Slot, PartId>;

export interface MonsterSpec {
  name: string;
  build: Build;
  /** Tiles added by level-up choices, on top of what the parts give. */
  extra: TileId[];
  palette: { body: string; part: string };
}

export const STARTERS: MonsterSpec[] = [
  {
    name: 'Tuskrel',
    build: { body: 'brute', head: 'tusk', limbs: 'claws', legs: 'striders', skin: 'hide', aux: 'spines' },
    extra: [],
    palette: { body: '#3fae8c', part: '#ffd66b' },
  },
  {
    name: 'Skyreave',
    build: { body: 'stalker', head: 'crest', limbs: 'wings', legs: 'striders', skin: 'fur', aux: 'pouch' },
    extra: [],
    palette: { body: '#6a72e8', part: '#ff8fb8' },
  },
  {
    name: 'Bulwark',
    build: { body: 'brute', head: 'maw', limbs: 'fists', legs: 'stumps', skin: 'shell', aux: 'tailclub' },
    extra: [],
    palette: { body: '#d07a3a', part: '#7fe0ff' },
  },
];

/** Level-up offer pool, by rarity tier (higher tiers unlock with level). */
export const TILE_POOL: TileId[][] = [
  ['claw', 'guard', 'power', 'quick', 'slam'],
  ['bite', 'breath', 'snatch', 'jam', 'high', 'low'],
  ['power', 'bite', 'breath', 'quick'],
];

export const ENEMY_PALETTES = [
  { body: '#b8483c', part: '#ffb36b' },
  { body: '#8a4fc2', part: '#9cf2c8' },
  { body: '#3c7fb8', part: '#ffd66b' },
  { body: '#5b8a3c', part: '#ff7a7a' },
];
