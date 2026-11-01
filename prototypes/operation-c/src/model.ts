export type CardKind = 'infantry' | 'tank' | 'artillery';
/** Presentation-only record of a shot actually fired, independent of entity IDs. */
export interface Shot {
  id: number; unitId: string; owner: number; kind: CardKind;
  fromHexId: string; targetHexId: string; timeMs: number;
}
export interface Hex {
  id: string; q: number; r: number; owner: number | null; burnt: boolean;
  lockedBy: string | null; capture: number; capturePlayer: number | null;
}
export interface Building {
  id: string; hexId: string; owner: number; kind: 'hq' | CardKind;
  hp: number; maxHp: number; readyAtMs: number; unitId: string | null;
}
export interface Unit {
  id: string; hexId: string; owner: number; kind: CardKind; hp: number; maxHp: number;
  fromHexId?: string; movedAtMs?: number; movingUntilMs?: number;
  attacking: boolean; attackTargetHexId?: string; buildingId: string | null; nextAttackAtMs: number;
}
export interface Player { id: number; name: string; alive: boolean; targetId: number }
export interface CardTune {
  cost: number; buildingHp: number; unitHp: number; damage: number; range: number;
  attackMs: number; moveMs: number; productionMs: number; captureRate: number;
}
export interface Tune {
  stepMs: number; map: { radius: number; hqQ: number; hqR: number };
  resources: { capacityCap: number }; hq: { hp: number; captureRings: number };
  capture: { neutralMs: number; ownedMultiplier: number; hqRate: number };
  presentation: { captureFlipMs: number; captureLift: number; shotTraceMs: number; maxShotEvents: number };
  bot: { buildEveryMs: number; attackAtMs: number; cardCycle: CardKind[] };
  cards: Record<CardKind, CardTune>;
}
export interface Placement { ok: boolean; reason?: string; hexes: string[] }
