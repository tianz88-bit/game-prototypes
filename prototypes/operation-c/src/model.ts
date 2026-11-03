export type CardKind = 'infantry' | 'tank' | 'artillery' | 'helicopter' | 'fighter' | 'missile' | 'bomber' | 'mlrs' |
  'scout' | 'gunner' | 'flak' | 'walker' | 'destroyer' | 'gunship' | 'siege' | 'carrier' | 'bunker' | 'silo';
export type UnitDomain = 'ground' | 'air';
export type DamageClass = 'light' | 'armoured' | 'structure';
/** Presentation-only record of a shot actually fired, independent of entity IDs. */
export interface Shot {
  id: number; unitId: string; owner: number; kind: CardKind;
  fromHexId: string; targetHexId: string; targetDomain: UnitDomain; timeMs: number;
  sourceKind?: 'unit' | 'hq' | 'bunker';
}
export interface Hex {
  id: string; q: number; r: number; owner: number | null; burnt: boolean;
  lockedBy: string | null; capture: number; capturePlayer: number | null;
  captureUnitId?: string; captureReversing?: boolean;
  commitment?: 'building' | 'upgrade' | 'research' | 'release'; releaseAtMs?: number;
}
export interface Building {
  id: string; hexId: string; owner: number; kind: 'hq' | CardKind;
  hp: number; maxHp: number; readyAtMs: number; unitId: string | null;
  completeAtMs?: number; upgradeKind?: CardKind; upgradeStartedAtMs?: number; upgradeCompleteAtMs?: number;
  committedCost?: number; upgradeCost?: number;
  cooldownActive?: boolean; productionStartedAtMs?: number; defenseNextAtMs?: number; nukeReadyAtMs?: number;
}
export interface Unit {
  id: string; hexId: string; owner: number; kind: CardKind; hp: number; maxHp: number;
  fromHexId?: string; movedAtMs?: number; movingUntilMs?: number;
  attacking: boolean; attackTargetHexId?: string; buildingId: string | null; nextAttackAtMs: number;
  retreatFromHexId?: string; retreatUntilMs?: number;
  members?: number[];
}
export interface Research {
  fromTier: 1 | 2; toTier: 2 | 3; startedAtMs: number; completeAtMs: number; supportIds: string[];
}
export interface Player {
  id: number; name: string; alive: boolean; targetId: number; techTier: 1 | 2 | 3; research: Research | null;
  defendTargetId?: string | null;
}
export interface Reinforcement {
  id: string; unitId: string; buildingId: string; owner: number; count: number;
  fromHexId: string; startedAtMs: number; arriveAtMs: number;
}
export interface Retirement {
  id: number; unitId: string; kind: CardKind; owner: number; hexId: string; members?: number[]; timeMs: number;
}
export interface PendingRelease { id: string; owner: number; releaseAtMs: number; supportIds: string[] }
export interface NukeFlight {
  id: string; owner: number; buildingId: string; fromHexId: string; targetHexId: string; launchedAtMs: number; impactAtMs: number;
}
export interface NuclearImpact { id: number; owner: number; hexId: string; timeMs: number; radius: number }
export interface CardTune {
  cost: number; buildingHp: number; unitHp: number; damage: number; range: number;
  attackMs: number; moveMs: number; productionMs: number; captureRate: number;
  domain: UnitDomain; targets: UnitDomain[]; minRange: number; retreatMs?: number;
  tier: 1 | 2 | 3; buildMs: number; upgradeTo?: CardKind; upgradeMs?: number;
  squadSize?: number; splashRadius?: number; splashDamageFraction?: number;
  capturePriority?: boolean;
  utility?: 'bunker' | 'silo';
  damageClass: DamageClass; damageBonus?: Partial<Record<DamageClass, number>>;
}
export interface Tune {
  stepMs: number; map: { radius: number; hqQ: number; hqR: number };
  /** Absent in older v3 rooms: retain their original base-speed rules. */
  movement?: { friendlySpeedMultiplier: number };
  resources: { capacityCap: number; destroyReleaseMs: number }; hq: { hp: number; captureRings: number; defenseRange: number; defenseDamage: number; defenseAttackMs: number };
  nuclear: { flightMs: number; radius: number; centreDamage: number; outerDamage: number };
  capture: { neutralMs: number; ownedMultiplier: number; hqRate: number; rollbackRate: number };
  presentation: { captureFlipMs: number; captureLift: number; shotTraceMs: number; retreatMs: number; maxShotEvents: number; commandPulseMs: number; upgradeBobMs: number; upgradeBobLift: number; mushroomMs: number };
  bot: { buildEveryMs: number; attackAtMs: number; cardCycle: CardKind[] };
  research: { cost: number; tier2Ms: number; tier3Ms: number };
  reinforcements: { msPerHex: number; minTravelMs: number };
  cards: Record<CardKind, CardTune>;
}
export interface Placement { ok: boolean; reason?: string; hexes: string[] }
