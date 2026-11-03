import type { CardKind } from './model';

/** One vocabulary for loadout portraits, deck sockets and battlefield commands. */
export const NAMES: Record<CardKind, string> = {
  infantry: 'Barracks', missile: 'Armoury', tank: 'Motor Pool', siege: 'Siege Foundry',
  artillery: 'Artillery Battery', mlrs: 'Rocket Battery', helicopter: 'Helipad',
  gunship: 'Attack Helipad', fighter: 'Airbase', bomber: 'Bomber Command',
  scout: 'Recon Post', gunner: 'Support Barracks', flak: 'Air Defence Post',
  walker: 'Assault Foundry', destroyer: 'Anti-tank Depot', carrier: 'Carrier Command',
  bunker: 'Bunker', silo: 'Nuclear Silo',
};
export const UNIT_NAMES: Record<CardKind, string> = {
  infantry: 'Infantry Squad', missile: 'Missile Squad', tank: 'Battle Tank', siege: 'Siege Tank',
  artillery: 'Field Artillery', mlrs: 'MLRS', helicopter: 'Helicopter', gunship: 'Gunship',
  fighter: 'Fighter', bomber: 'Bomber', scout: 'Scout Buggy', gunner: 'Machine-gun Squad',
  flak: 'Flak Rover', walker: 'Assault Walker', destroyer: 'Tank Destroyer', carrier: 'Assault Carrier',
  bunker: 'Static Defence Gun', silo: 'Nuclear Payload',
};
export const NOTES: Record<CardKind, string> = {
  infantry: 'Capture scales with members; fragile under splash.', missile: 'Capture scales with members; slow to reinforce.',
  tank: 'Durable frontline; 25% capture. Cannot fight air.', artillery: 'Two-hit squad splash; frail up close. Cannot capture.',
  helicopter: 'Mobile ground hunter; vulnerable to fighters.', fighter: 'Air superiority; cannot attack ground.',
  bomber: 'Heavy ground strikes; needs an escort against fighters.', mlrs: 'Cannot capture; blind inside range 3, weak to air.',
  scout: 'Fast scout; 20% capture. Weak in sustained fights.', gunner: 'Anti-swarm; capture scales with surviving members.',
  flak: 'Air defence; cannot capture or fight ground.', walker: 'Close assault; 25% capture. Slow and easy to outrange.',
  destroyer: 'Cannot capture; weak to swarms inside minimum range.',
  gunship: 'Splash ground support; cannot fight aircraft.', siege: 'Cannot capture; slow fire, weak up close and to air.',
  carrier: 'Heavy aerial bombardment; expensive, slow production, helpless against fighters.',
  bunker: 'Static ground and air defence; holds a position without producing troops.',
  silo: 'One stored nuclear payload; friendly fire in the blast. Launches remain hidden until impact.',
};
