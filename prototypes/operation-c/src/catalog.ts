import type { CardKind } from './model';

/** One vocabulary for loadout portraits, deck sockets and battlefield commands. */
export const NAMES: Record<CardKind, string> = {
  worker: 'Worker',
  infantry: 'Barracks', missile: 'Armoury', tank: 'Motor Pool', siege: 'Siege Foundry',
  artillery: 'Artillery Battery', mlrs: 'Rocket Battery', helicopter: 'Helipad',
  gunship: 'Attack Helipad', fighter: 'Airbase', bomber: 'Bomber Command',
  scout: 'Recon Post', gunner: 'Support Barracks', flak: 'Air Defence Post',
  walker: 'Assault Foundry', destroyer: 'Anti-tank Depot', carrier: 'Carrier Command',
  bunker: 'Bunker', silo: 'Nuclear Silo',
};
export const UNIT_NAMES: Record<CardKind, string> = {
  worker: 'Engineer',
  infantry: 'Infantry Squad', missile: 'Missile Squad', tank: 'Battle Tank', siege: 'Siege Tank',
  artillery: 'Field Artillery', mlrs: 'MLRS', helicopter: 'Helicopter', gunship: 'Gunship',
  fighter: 'Fighter', bomber: 'Bomber', scout: 'Scout Buggy', gunner: 'Machine-gun Squad',
  flak: 'Flak Rover', walker: 'Assault Walker', destroyer: 'Tank Destroyer', carrier: 'Assault Carrier',
  bunker: 'Static Defence Gun', silo: 'Nuclear Payload',
};
export const NOTES: Record<CardKind, string> = {
  worker: 'Neutral capture only; unarmed, dies to any hit.',
  infantry: 'Enemy capture scales with members; fragile under splash.', missile: 'Enemy capture scales with members; slow to reinforce.',
  tank: 'Durable frontline; cannot capture or fight air.', artillery: 'Two-hit squad splash; frail up close. Cannot capture.',
  helicopter: 'Mobile ground hunter; vulnerable to fighters.', fighter: 'Air superiority; cannot attack ground.',
  bomber: 'Heavy ground strikes; needs an escort against fighters.', mlrs: 'Cannot capture; blind inside range 3, weak to air.',
  scout: 'Fast worker hunter; cannot capture. Weak in fights.', gunner: 'Anti-swarm; enemy capture scales with members.',
  flak: 'Air defence; cannot capture or fight ground.', walker: 'Close assault; cannot capture. Slow and easy to outrange.',
  destroyer: 'Cannot capture; weak to swarms inside minimum range.',
  gunship: 'Splash ground support; cannot fight aircraft.', siege: 'Cannot capture; slow fire, weak up close and to air.',
  carrier: 'Heavy aerial bombardment; expensive, slow production, helpless against fighters.',
  bunker: 'Static ground and air defence; holds a position without producing troops.',
  silo: 'One stored nuclear payload; friendly fire in the blast. Launches remain hidden until impact.',
};
