// Tile identities. Numbers (power, buffs) live in tune.json; this file only
// says what each tile is. Scope step 3 will build strips from body parts
// instead of the fixed lists below.

export type MoveKind = 'attack' | 'defend' | 'brains';
export type MoveId = 'claw' | 'bite' | 'slam' | 'guard' | 'snatch' | 'jam';
export type MutatorId = 'power' | 'quick' | 'blank';
export type TileId = MoveId | MutatorId;

export interface MoveDef {
  kind: MoveKind;
  label: string;
}

export const MOVES: Record<MoveId, MoveDef> = {
  claw: { kind: 'attack', label: 'Claw' },
  bite: { kind: 'attack', label: 'Bite' },
  slam: { kind: 'attack', label: 'Slam' },
  guard: { kind: 'defend', label: 'Guard' },
  snatch: { kind: 'brains', label: 'Snatch' },
  jam: { kind: 'brains', label: 'Jam' },
};

export const MUTATORS: Record<MutatorId, { label: string }> = {
  power: { label: 'Power+' },
  quick: { label: 'Quick' },
  blank: { label: '-' },
};

export function isMove(id: TileId): id is MoveId {
  return id in MOVES;
}

export function tileLabel(id: TileId): string {
  return isMove(id) ? MOVES[id].label : MUTATORS[id].label;
}

export interface MonsterDef {
  name: string;
  /** Reel 1 (moves) and reel 2 (mutators). */
  strips: [MoveId[], MutatorId[]];
}

export const PLAYER_MONSTER: MonsterDef = {
  name: 'Tuskrel',
  strips: [
    ['claw', 'claw', 'bite', 'guard', 'guard', 'snatch', 'slam', 'jam', 'claw'],
    ['power', 'blank', 'quick', 'blank', 'power', 'blank', 'quick', 'blank'],
  ],
};

export const ENEMY_MONSTER: MonsterDef = {
  name: 'Mawback',
  strips: [
    ['bite', 'bite', 'slam', 'guard', 'snatch', 'slam', 'guard', 'jam'],
    ['blank', 'power', 'blank', 'quick', 'blank', 'power', 'blank'],
  ],
};
