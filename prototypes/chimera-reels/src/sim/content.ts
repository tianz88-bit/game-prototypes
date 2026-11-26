// Tile and part identities. All numbers (power, stats, shields) live in
// tune.json; this file only says what things are, their rarity, and which
// tiles each part puts on the reels.

export type Rarity = 'common' | 'rare' | 'epic';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic'];
export type DamageType = 'slash' | 'crush' | 'pierce' | 'exotherm';

export type MoveId = 'claw' | 'bite' | 'slam' | 'breath' | 'rend' | 'gore' | 'inferno' | 'quake';
export type MutatorId = 'power' | 'quick' | 'shield';
export type ZoneId = 'head' | 'limbs' | 'legs' | 'aux' | 'body';
export type TargetId = `t_${ZoneId}`;
export type TileId = MoveId | MutatorId | TargetId | 'blank';
export type ReelIndex = 0 | 1 | 2;
export const REEL_NAMES = ['Move', 'Target', 'Mutator'];

export interface MoveDef { label: string; dmg: DamageType; rarity: Rarity }
export const MOVES: Record<MoveId, MoveDef> = {
  claw: { label: 'Claw', dmg: 'slash', rarity: 'common' },
  bite: { label: 'Bite', dmg: 'pierce', rarity: 'common' },
  slam: { label: 'Slam', dmg: 'crush', rarity: 'common' },
  breath: { label: 'Breath', dmg: 'exotherm', rarity: 'common' },
  rend: { label: 'Rend', dmg: 'slash', rarity: 'rare' },
  gore: { label: 'Gore', dmg: 'pierce', rarity: 'epic' },
  inferno: { label: 'Inferno', dmg: 'exotherm', rarity: 'epic' },
  quake: { label: 'Quake', dmg: 'crush', rarity: 'epic' },
};

export const MUTATORS: Record<MutatorId, { label: string; rarity: Rarity }> = {
  power: { label: 'Power+', rarity: 'common' },
  quick: { label: 'Quick', rarity: 'common' },
  shield: { label: 'Shield', rarity: 'common' },
};

export const ZONES: ZoneId[] = ['head', 'limbs', 'legs', 'aux', 'body'];
export const ZONE_LABEL: Record<ZoneId, string> = { head: 'Head', limbs: 'Limbs', legs: 'Legs', aux: 'Aux', body: 'Body' };

export const isMove = (id: TileId): id is MoveId => id in MOVES;
export const isMutator = (id: TileId): id is MutatorId => id in MUTATORS;
export const isTarget = (id: TileId): id is TargetId => id.startsWith('t_');
export const zoneOf = (id: TargetId): ZoneId => id.slice(2) as ZoneId;
export const targetTile = (z: ZoneId): TargetId => `t_${z}`;
export const reelOf = (id: TileId): ReelIndex => (isMove(id) ? 0 : isTarget(id) ? 1 : 2);

export function tileLabel(id: TileId): string {
  if (id === 'blank') return '';
  if (isMove(id)) return MOVES[id].label;
  if (isTarget(id)) return ZONE_LABEL[zoneOf(id)];
  return MUTATORS[id].label;
}

export function tileRarity(id: TileId): Rarity {
  if (isMove(id)) return MOVES[id].rarity;
  if (isMutator(id)) return MUTATORS[id].rarity;
  return 'common';
}

// ------------------------------------------------------------------ parts

export type Slot = 'body' | 'head' | 'limbs' | 'legs' | 'skin' | 'aux';
export const SLOTS: Slot[] = ['body', 'head', 'limbs', 'legs', 'skin', 'aux'];
export type ArmourId = 'hide' | 'shell' | 'fur' | 'scale' | 'plate';
/** The target zone a slot is hit through. Skin is armour, not a hitzone. */
export const SLOT_ZONE: Record<Slot, ZoneId | null> = { body: 'body', head: 'head', limbs: 'limbs', legs: 'legs', skin: null, aux: 'aux' };

export type PartId =
  | 'brute' | 'stalker' | 'titan' | 'wyrmcore'
  | 'tusk' | 'maw' | 'crest' | 'horned' | 'gorehorn'
  | 'claws' | 'fists' | 'wings' | 'blades' | 'dragonwings'
  | 'striders' | 'stumps' | 'raptor' | 'colossus'
  | 'hide' | 'shell' | 'fur' | 'scales' | 'plating'
  | 'spines' | 'tailclub' | 'pouch' | 'spiketail' | 'heart';

/** `look` picks the placeholder mesh builder; `size` scales it for rarer variants. */
export interface PartDef {
  slot: Slot;
  name: string;
  rarity: Rarity;
  moves: MoveId[];
  mutators: MutatorId[];
  startPocket?: TileId[];
  flight?: boolean;
  armour?: ArmourId;
  look: string;
  size?: number;
}

export const PARTS: Record<PartId, PartDef> = {
  brute: { slot: 'body', name: 'Brute body', rarity: 'common', moves: ['slam'], mutators: ['shield'], look: 'brute' },
  stalker: { slot: 'body', name: 'Stalker body', rarity: 'common', moves: ['claw'], mutators: ['quick'], look: 'stalker' },
  titan: { slot: 'body', name: 'Titan body', rarity: 'rare', moves: ['slam', 'slam'], mutators: ['shield', 'shield'], look: 'brute', size: 1.12 },
  wyrmcore: { slot: 'body', name: 'Wyrm core', rarity: 'epic', moves: ['inferno'], mutators: ['shield', 'power', 'quick'], look: 'stalker', size: 1.2 },

  tusk: { slot: 'head', name: 'Tusk head', rarity: 'common', moves: ['bite', 'bite'], mutators: ['power'], look: 'tusk' },
  maw: { slot: 'head', name: 'Maw head', rarity: 'common', moves: ['bite', 'breath'], mutators: [], look: 'maw' },
  crest: { slot: 'head', name: 'Crest head', rarity: 'common', moves: ['breath', 'breath'], mutators: ['quick'], look: 'crest' },
  horned: { slot: 'head', name: 'Horned head', rarity: 'rare', moves: ['bite', 'bite', 'rend'], mutators: ['power'], look: 'tusk', size: 1.15 },
  gorehorn: { slot: 'head', name: 'Gorehorn', rarity: 'epic', moves: ['gore', 'gore', 'bite'], mutators: ['power', 'power'], look: 'tusk', size: 1.3 },

  claws: { slot: 'limbs', name: 'Claws', rarity: 'common', moves: ['claw', 'claw', 'claw'], mutators: ['power'], look: 'claws' },
  fists: { slot: 'limbs', name: 'Fists', rarity: 'common', moves: ['slam', 'slam'], mutators: ['shield'], look: 'fists' },
  wings: { slot: 'limbs', name: 'Wings', rarity: 'common', moves: ['claw'], mutators: ['quick', 'quick'], flight: true, look: 'wings' },
  blades: { slot: 'limbs', name: 'Blade arms', rarity: 'rare', moves: ['rend', 'rend', 'claw'], mutators: ['power'], look: 'claws', size: 1.25 },
  dragonwings: { slot: 'limbs', name: 'Dragon wings', rarity: 'epic', moves: ['inferno', 'claw'], mutators: ['quick', 'shield'], flight: true, look: 'wings', size: 1.3 },

  striders: { slot: 'legs', name: 'Strider legs', rarity: 'common', moves: ['claw'], mutators: ['quick'], look: 'striders' },
  stumps: { slot: 'legs', name: 'Stump legs', rarity: 'common', moves: ['slam'], mutators: ['shield'], look: 'stumps' },
  raptor: { slot: 'legs', name: 'Raptor legs', rarity: 'rare', moves: ['rend', 'claw'], mutators: ['quick'], look: 'striders', size: 1.15 },
  colossus: { slot: 'legs', name: 'Colossus legs', rarity: 'epic', moves: ['quake', 'quake'], mutators: ['shield', 'shield'], look: 'stumps', size: 1.3 },

  hide: { slot: 'skin', name: 'Hide', rarity: 'common', moves: [], mutators: ['power'], armour: 'hide', look: 'hide' },
  shell: { slot: 'skin', name: 'Shell', rarity: 'common', moves: [], mutators: ['shield', 'shield'], armour: 'shell', look: 'shell' },
  fur: { slot: 'skin', name: 'Fur', rarity: 'common', moves: [], mutators: ['quick'], armour: 'fur', look: 'fur' },
  scales: { slot: 'skin', name: 'Scales', rarity: 'rare', moves: [], mutators: ['shield', 'power'], armour: 'scale', look: 'shell', size: 0.8 },
  plating: { slot: 'skin', name: 'Bone plating', rarity: 'epic', moves: [], mutators: ['shield', 'shield', 'shield'], armour: 'plate', look: 'shell', size: 1.15 },

  spines: { slot: 'aux', name: 'Spines', rarity: 'common', moves: ['claw'], mutators: ['power'], look: 'spines' },
  tailclub: { slot: 'aux', name: 'Tail club', rarity: 'common', moves: ['slam'], mutators: [], look: 'tailclub' },
  pouch: { slot: 'aux', name: 'Pouch', rarity: 'common', moves: ['bite'], mutators: [], startPocket: ['power'], look: 'pouch' },
  spiketail: { slot: 'aux', name: 'Spike tail', rarity: 'rare', moves: ['slam', 'rend'], mutators: ['power'], look: 'tailclub', size: 1.2 },
  heart: { slot: 'aux', name: 'Ember heart', rarity: 'epic', moves: ['inferno'], mutators: ['shield'], startPocket: ['shield', 'power'], look: 'pouch', size: 1.3 },
};

export const PARTS_BY_SLOT = {} as Record<Slot, PartId[]>;
for (const s of SLOTS) PARTS_BY_SLOT[s] = (Object.keys(PARTS) as PartId[]).filter((id) => PARTS[id].slot === s);

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
    extra: [], palette: { body: '#3fae8c', part: '#ffd66b' },
  },
  {
    name: 'Skyreave',
    build: { body: 'stalker', head: 'crest', limbs: 'wings', legs: 'striders', skin: 'fur', aux: 'pouch' },
    extra: [], palette: { body: '#6a72e8', part: '#ff8fb8' },
  },
  {
    name: 'Bulwark',
    build: { body: 'brute', head: 'maw', limbs: 'fists', legs: 'stumps', skin: 'shell', aux: 'tailclub' },
    extra: [], palette: { body: '#d07a3a', part: '#7fe0ff' },
  },
];

export const PALETTES = [
  { body: '#b8483c', part: '#ffb36b' },
  { body: '#8a4fc2', part: '#9cf2c8' },
  { body: '#3c7fb8', part: '#ffd66b' },
  { body: '#5b8a3c', part: '#ff7a7a' },
  { body: '#c0567a', part: '#ffe08a' },
];

/** Tiles a level-up can offer (moves and mutators), filtered by rarity at roll time. */
export const OFFER_TILES: TileId[] = [...(Object.keys(MOVES) as MoveId[]), ...(Object.keys(MUTATORS) as MutatorId[])];
