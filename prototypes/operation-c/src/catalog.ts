import type { CardKind } from './model';

/** One vocabulary for loadout portraits, deck sockets and battlefield commands. */
export const NAMES: Record<CardKind, string> = {
  infantry: 'Barracks', missile: 'Armoury', tank: 'Motor Pool', siege: 'Siege Foundry',
  artillery: 'Artillery Battery', mlrs: 'Rocket Battery', helicopter: 'Helipad',
  gunship: 'Attack Helipad', fighter: 'Airbase', bomber: 'Bomber Command',
  scout: 'Recon Post', gunner: 'Support Barracks', flak: 'Air Defence Post',
  walker: 'Assault Foundry', destroyer: 'Anti-tank Depot', carrier: 'Carrier Command',
};
export const UNIT_NAMES: Record<CardKind, string> = {
  infantry: 'Infantry Squad', missile: 'Missile Squad', tank: 'Battle Tank', siege: 'Siege Tank',
  artillery: 'Field Artillery', mlrs: 'MLRS', helicopter: 'Helicopter', gunship: 'Gunship',
  fighter: 'Fighter', bomber: 'Bomber', scout: 'Scout Buggy', gunner: 'Machine-gun Squad',
  flak: 'Flak Rover', walker: 'Assault Walker', destroyer: 'Tank Destroyer', carrier: 'Assault Carrier',
};
export const NOTES: Record<CardKind, string> = {
  infantry: 'Fast capture squad; fragile under splash.', missile: 'Heavy squad volley; slow to reinforce.',
  tank: 'Reliable ground armour; cannot fight aircraft.', artillery: 'Long reach; cannot fire adjacent. Retreats under fire.',
  helicopter: 'Mobile ground hunter; vulnerable to fighters.', fighter: 'Air superiority; cannot attack ground.',
  bomber: 'Heavy ground strikes; needs an escort against fighters.', mlrs: 'Breaks packed defences; blind inside range 3, weak to air.',
  scout: 'Cheap, fast exploration; loses sustained fights.', gunner: 'Anti-swarm squad; short reach and fragile members.',
  flak: 'Cheap air defence; cannot fire at ground attackers.', walker: 'Versatile close assault; slow and easy to outrange.',
  destroyer: 'Long-range anti-armour; weak to swarms inside its minimum range.',
  gunship: 'Splash ground support; cannot fight aircraft.', siege: 'Heavy siege punch; slow fire, vulnerable up close and to air.',
  carrier: 'Heavy aerial bombardment; expensive, slow production, helpless against fighters.',
};
