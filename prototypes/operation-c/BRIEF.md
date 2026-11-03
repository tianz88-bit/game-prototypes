# Operation C permanent design reference

Last reconciled: 2026-11-03, Asia/Singapore. This is the canonical design reference for main, logic and art discussions. Check it before re-asking an answered question. Update the relevant section when a decision changes; keep proposals distinct from confirmed rules. BUILD_STATUS.md records implementation and verification, not design authority. Git history preserves superseded decisions.

## Design versus implementation

The Phaser 3 / strict TypeScript prototype supports two-human private-room 1v1 and a local human-versus-bot sandbox. It includes base-card loadouts, T1/T2/T3 research, construction/selling, permanent conversions, eleven producers/sixteen unit forms plus two utility cards, squads/reinforcements, delayed discounted destruction release and a classic RTS interface. It also includes Bunker/Silo, HQ defence, death-triggered replacement cooldowns, friendly-building defend/expand anchors, friendly-territory movement and the approved roster balance pass. Six-player FFA, full geography and race catalogs remain later work. BUILD_STATUS.md records actual verification/publication status; unspecified tuning remains provisional.

## Match and player control

- Mobile-first, deterministic real-time hex war. Full-game direction: six-player FFA, fully visible Eurasia-shaped map, last surviving HQ wins.
- HQ destruction eliminates its owner, removes their units and neutralizes their territory.
- Players choose their building-card loadout before the match. During play they place buildings and issue faction-wide orders. Own HQ resets Expand/defend to home; any FRIENDLY BUILDING can be selected as the defend/expand anchor through its contextual command. Moving units cannot be command anchors (confirmed 2026-11-03). Enemy HQ selects Attack. Units act autonomously.
- Three races are planned, with expensive advanced, low-tech swarm and balanced identities discussed. Race-specific catalogs and detailed tier access still need design.

## Territory and committed resources

- Each productive owned hex supplies 1 capacity. Display committed resources / total capacity; debt can exceed capacity, such as 100 / 50.
- New buildings need enough global free capacity and their full cost in connected OPEN OWNED UNBURNT hexes, including the building tile. Reserve the nearest connected eligible cells.
- Supporting cells cannot host/fund another building or carry its resource connection. Neutral, enemy, burnt and already committed cells break a NEW building's support connection.
- Losing supporting territory removes its local assignment permanently, including after recapture, but does not release the building's committed cost. Existing buildings continue functioning in debt. New construction requires sufficient capacity again.
- Selling OR enemy destruction releases only the cells still assigned to that building. Selling releases immediately; enemy destruction keeps the remaining assignments committed for 10 seconds before release, with a countdown on each hex. Capturing an assignment during this countdown permanently strands that part of the commitment; recapture does not restore it. Previously captured support assignments are discounted from the release; their unreleased commitment remains as match debt after the building is gone. Example: cost 8, lose 3 assigned support cells, then sell or lose the building: release 5 and retain 3 debt. Recapturing a formerly assigned cell does not restore the lost assignment or clear this debt.
- Enemy destruction permanently burns the building hex. Burnt cells give no resources, building space or support connectivity, but remain traversable. Its living unit survives without replacements. Selling instead returns the building tile to open owned territory and retires its forces, as specified below.
- No shared building-placement cooldown. Earlier Barracks-8 and Barracks-4 experiments are superseded by the current Barracks-6 cost.

## Occupancy, movement and spawning

- One registered unit per hex, with no air/ground stacking. Buildings block every unit type. Units queue and seek distinct positions around targets; visual movement may pass without creating shared logical occupancy.
- A squad is a unit under the existing one-hex occupancy rule; its members do not each reserve a separate hex. Exact member visual arrangement remains presentation work.
- Spawn into an unoccupied reachable cell, searching outward without a distance cap. Committed cells are eligible. A full blockade prevents spawn; do not jump occupied barriers. Visually emerge from the producer and travel to the registered tile.
- Range 1 means adjacent, range 2+ ranged. Engagement resolves from registered hexes.
- Infantry squads prioritize capture over fighting, including under unanswered fire. Other ground units prioritize valid enemies within their own sight. Capturing vehicles capture ONLY in Expand mode and while no valid enemy is within their own sight; distant intruders no longer block all expansion. Ground Expand mode prioritizes reachable neutral land outward in rings from the selected friendly BUILDING (HQ by default) before hostile land. Defence-only units return toward that anchor when idle. The real HQ's capture pressure remains unchanged.
- Aircraft in Expand mode engage valid enemies within their own sight, otherwise defend/return to their anchor. Attack mode advances toward the selected enemy HQ seeking valid local targets. Fighters never attack ground units or buildings.
- Prototype choice: movement reserves both origin and destination until arrival, preventing swaps. This is a documented implementation choice, not a separate full-game design mandate.
- Balance playtest approved 2026-11-03: all units move 25% faster when departing a friendly owned hex (step duration is base movement time divided by 1.25). Sample ownership when the step begins and retain that duration through arrival, including if ownership changes mid-step. Neutral and enemy territory use unchanged base speed. This applies equally to both players, including aircraft and attackers travelling across their own captured land. Base unit speeds, production cooldowns and cosmetic squad reinforcement travel are unchanged for this first comparison.
- Other recovery mechanics discussed (HQ Mobilize, out-of-combat HQ repair and economic changes) are proposals only, not part of this approved movement playtest. Recaptured former support cells are open and locally usable; no assignment is automatically restored. No economic-rule changes were approved for this pass.

## Capture and HQ pressure

- Anti-rush pass approved 2026-11-03: squad capture strength is multiplied by living members / configured squad size. A full five-member squad captures at 100%, three at 60%, one at 20%. Incoming cosmetic reinforcements contribute only after merging. Remaining HP within a living member does not reduce capture strength. Neutral full-squad capture now takes 4s and enemy-owned capture 6s. HQ capture pressure is not member-scaled.

- Approved capture-role split (2026-11-03): Infantry, Missile and Machine-gun squads capture at 100% strength and prioritize capture. Recon captures at 20%; Battle Tanks and Assault Walkers capture at 25%. These vehicles retain combat priority and capture only in Expand mode with no valid enemy within their own sight. Field Artillery, MLRS, Tank Destroyers and Siege Tanks cannot capture, joining Flak and all aircraft as non-capturing specialists. The individual-sight decision supersedes the former map-wide intruder restriction.
- Non-neutral cells take 50% longer than neutral capture duration (1.5x), superseding the older 2x rule. Neutral capture is provisionally 4s at 100% strength, 20s at Recon's 20%, and 16s at vehicles' 25%, before simulation-step rounding and HQ pressure. Unit capture rates do not change HQ capture pressure.
- Capture pauses only while the capturing unit itself attacks. Taking damage without retaliating does not pause it; paused progress is retained.
- When the responsible capturer dies, incomplete progress slowly reverses toward the unchanged original controller. A replacement capturer can resume progress. Merely attacking or leaving while alive does not trigger casualty rollback.
- HQ starts with the two surrounding rings (18 cells) captured and applies pressure like invisible infantry, subject to hostile occupation exceptions. Exact full-game exceptions remain open.

## Individual sight and engagement — 2026-11-03

- Command correction approved 2026-11-03: Defend/Expand pursues valid visible enemy UNITS, but never chases structures outside its legal firing band. Buildings may be fired upon when already inside weapon/minimum range; an out-of-range building must not interrupt vehicle capture. Attack-HQ orders still advance on the selected faction and pursue structures. This supersedes the initial sight implementation that treated every visible structure as an engagement destination.

- Each mobile unit uses ONLY its own sight. No allied spotting, fog of war or hidden-map system. The battlefield remains fully visible to the player; sight governs autonomous acquisition and engagement.
- Base Infantry and Machine-gun squads have sight 1. Combat units default to sight 3. Ranged specialists use their weapon range plus 1 rather than plus 2 for this playtest: Missile Infantry 3; Field Artillery, Flak, Tank Destroyer and Siege Tank 4; MLRS 6. Tanks, Recon, Walkers and all aircraft have sight 3. Ranged Infantry is an exception to sight 1 so it retains its range-2 weapon role.
- Weapon/minimum ranges remain unchanged and firing requires the unit's own sight as well as its weapon's firing band. Combat-first units stop capture and approach a firing position when a valid enemy is within sight, regardless of tile controller. Enemies outside sight and enemies that the unit cannot target do not globally stop its capture or attract it to defend.
- Infantry retains capture-first behavior, completing its current capture before retaliating. An explicit enemy-HQ order remains a strategic destination even before the HQ is within sight; units engage valid local enemies en route and then resume the order. Idle defenders return to the selected friendly-building anchor. Static HQ/Bunker weapon behavior is unchanged.

## Production and infantry reinforcements

- Updated 2026-11-03 to reduce snowballing: first unit still appears after completed construction and a legal spawn cell. Production does NOT pre-charge while the unit is alive. Its full replacement cooldown begins only when the supported unit dies. For squads it begins at the first missing member; subsequent losses join the pending batch without restarting the timer. Dispatch accounts for incoming reinforcements; wiped squads still lose incoming members permanently. This supersedes the previous cooldown-on-spawn rule.
- Regular, Missile and Machine-gun Infantry are squads of 5. Each member is an individual combat unit with its own attack power; balance the complete squad as a group. Derive squad damage from the living members rather than applying an arbitrary fixed 20-percent squad modifier. Identical members naturally contribute equal shares, but per-member combat stats are the design source of truth. Losing a member removes that member's attacks. All squad members FOCUS ONE SHARED TARGET; members do not independently choose different targets. Single-target incoming attacks damage ONE member at a time; excess damage does NOT spill into another member. Splash can damage multiple members. Owner requests weaker health; exact member health, member hit selection, splash allocation and attack timing remain open.
- Missing squad members can be reinforced after the producer's production cooldown; reinforcements travel faster. Reinforcements are tied to a LIVING target squad: if that squad is destroyed, ALL incoming reinforcements vanish. They never recreate a wiped squad or become an independent replacement squad. The previous reference incorrectly said they could continue a wiped squad; that statement is superseded and must not be used.
- The earlier swarm/squad reinforcement rule now informs both infantry types, following the owner's reminder to retain the prior decision. On each eligible production cooldown, dispatch only enough missing members to restore the squad to 5, counting living members AND members already travelling. Example: 2 living/0 travelling dispatches 3; 2 living/1 travelling dispatches 2. Never over-dispatch beyond the five-member total.
- New reinforcement members arrive at full individual HP; surviving members retain their existing HP and are not healed.
- Reinforcement travel is mostly visual until merge: incoming members occupy no hex, cause no blocking, and cannot attack, capture, be targeted or take damage. They visually approach the moving target squad and add their members on arrival, without a separate battlefield occupancy/merge exception. Selling/upgrading retires incoming reinforcements under the established rules. Member damage allocation, numeric travel speed and timing remain to be specified.
- Missile Infantry has slower movement and a longer UNIT PRODUCTION cooldown. This remains distinct from the newly requested building construction time below; the earlier instant-construction rule is superseded.

## Tier philosophy and current roster

- T1 is fast and cheap, providing exploration, attack and defence with multiple swarm/squad choices. It stays relevant throughout the match.
- T2 adds capabilities and tactical dimensions, rather than replacing T1 efficiency.
- T3 is expensive and slow to produce, intended to break stalemates. Every T3 unit has an exploitable weakness; massed T1 can defeat it with suitable positioning and targeting.
- Exactly eight new unit forms were added in this milestone: Scout Buggy, Machine-gun Squad, Flak Rover, Assault Walker, Tank Destroyer, Gunship, Siege Tank and Assault Carrier. Their numerical balance is provisional.

| Tier | Military building / unit | Total commitment | Access / role and weakness |
| --- | --- | --- | --- |
| T1 | Barracks / Infantry Squad | 6 | Base; fast capture, G to G/A, five fragile members |
| T1 | Armoury / Missile Squad | 8 | Barracks upgrade; anti-ground, slower movement and reinforcement |
| T1 | Motor Pool / Battle Tank | 8 | Base; reliable ground armour, cannot hit air |
| T1 | Artillery Battery / Field Artillery | 8 | Base; frail, range 2-3, retreats after damage |
| T1 | Recon Post / Scout Buggy | 6 | Base; fast cheap exploration, weak in sustained combat |
| T1 | Support Barracks / Machine-gun Squad | 7 | Base; five rapid-firing anti-swarm members, short range |
| T1 | Air Defence Post / Flak Rover | 6 | Base; G to A only, cannot capture, helpless against ground attackers |
| T2 | Helipad / Helicopter | 10 | Base; mobile air-to-ground support, cannot fight air |
| T2 | Attack Helipad / Gunship | 12 | Helipad upgrade; ground splash, vulnerable to fighters |
| T2 | Airbase / Fighter | 10 | Base; air-to-air only, cannot damage ground or buildings |
| T2 | Assault Foundry / Assault Walker | 12 | Base; G to G/A close assault, slow and easy to outrange |
| T2 | Anti-tank Depot / Tank Destroyer | 10 | Base; heavy range 2-3 shots, fragile against close swarms |
| T3 | Bomber Command / Bomber | 10 | Airbase conversion; heavy ground hit, helpless against fighters |
| T3 | Rocket Battery / MLRS | 12 | Artillery upgrade ONLY; splash range 3-5, weak at close range and to air |
| T3 | Siege Foundry / Siege Tank | 16 | Motor Pool upgrade; heavy slow shots, minimum range 2, cannot hit air |
| T3 | Carrier Command / Assault Carrier | 18 | Base; heavy ground splash, 30s production, cannot fight aircraft |

Names are shared by the loadout, deck and contextual panel. Costs for the eight new units and new conversion durations are provisional playtest settings; the balance pass below supersedes earlier costs. Bombers and MLRS now use 24-second production cooldowns under the new slow T3 philosophy; Siege Tanks use 26 seconds. No new armour-resistance or invulnerability system.
## Approved balance pass — 2026-11-03

- Latest anti-rush revision: Barracks and Recon Post cost 6, Support Barracks 7, Armoury total 8 (Barracks upgrade +2). Flak remains 6; Motor Pool, Artillery Battery and Bunker remain 8. Two Barracks commit 12, while Barracks plus Tank/Artillery/Bunker commits 14. The actual prototype opening has 18 productive support cells around the HQ; higher costs permit at most three Barracks if all support is available, rather than the prior four. First units STILL appear at construction completion; an extra initial production timer is not approved.
- HQ now has 650 HP and a single-target ground gun dealing 8 each second at range 2. There is no tier immunity or invulnerability. Field Artillery damage is now 4 per member on its centre hex and 1.4 on adjacent hexes, requiring two direct shots against a fresh 8-HP/member basic squad. Preserve minimum range 2, 38 HP, slow movement and damage-triggered retreat; Recon and Tank close attacks must remain effective counters. Previous cheaper advanced commitments and all production/building timers remain unchanged.

- Infantry replacement cooldown increases from 6.5s to 8s. Scout Buggy damage decreases from 5 to 3 and replacement cooldown increases from 5s to 7s. Their movement, capture, health and building costs remain unchanged.
- Battle Tank health increases from 130 to 180. Keep its 1.3s firing interval; this replaces the earlier proposed firing-speed buff. Bunker health increases from 180 to 280 and damage from 5 to 8 each second, retaining cost 8 and range 1-2.
- Field Artillery gains radius-one enemy-only splash: full 4 damage to every member on the target hex and provisional 35% damage on adjacent hexes. No friendly fire. Existing range 2-3, minimum range, retreat, health, firing interval and production time remain. Two direct hits wipe a fresh basic infantry squad; each member takes 4 damage per hit. Adjacent hits apply 35% (1.4 damage/member).
- Advanced total producer commitments are the current roster table above: Helicopter/Fighter/Bomber/Tank Destroyer 10; Walker/Gunship/MLRS 12; Siege Tank 16; Carrier 18; Silo 24. Upgrade surcharges are target total minus base commitment, including free Fighter-to-Bomber conversion. Advanced construction/production timers and research's 20 temporary tiles/30s T2/60s T3 remain unchanged.
- The approved 25% friendly-territory movement bonus remains. All numerical changes are provisional playtest balance, not proof that snowballing is solved.

## Loadout page

- Up to 8 UNIQUE BASE building cards across T1-T3; at least one T1 ground producer. Upgrades are options belonging to their base card, never separate selectable cards or extra slots.
- Three scrollable catalog sections by BASE tier, with a pinned top tray of eight selected-card sockets. Clicking a populated socket removes that base card. A Buildings / Units toggle changes the mini portraits in the tray and match deck.
- Every catalog card has separate BUILDING and UNIT sections and matching procedural pictures. Show building name, cost, health, construction and production time; unit name, health, speed, range, damage and targeting type, plus a short role/weakness note.
- An up-arrow button flips eligible cards to their upgrade preview with a scripted flip animation; the reverse arrow restores the base face. Previewing changes neither loadout membership nor base-tier grouping. The selected socket continues to represent the base card.
- Deck/socket mini cards use the same unit/building art factories as battlefield entities. In-match cards are concise: name, resource cost, construction time. All card menus and selected sockets are ordered by tier first, then ascending cost, with stable catalog order for ties. In-match cards above current technology are visibly disabled, including keyboard shortcuts; pre-match cards remain selectable across tiers.
## Damage classes and weapon bonuses

Approved 2026-11-03: adopt a small SC2-inspired additive bonus system. Every battlefield target has one of LIGHT, ARMOURED or STRUCTURE. Every building/HQ is STRUCTURE independently of the class of its produced unit. Ground/air targeting remains separate and must be legal before damage is considered. There is no numerical armour reduction, tier multiplier or invulnerability.

- LIGHT units: Regular/Missile/Machine-gun Infantry, Scout Buggy, Field Artillery, Flak Rover, Helicopter and Fighter.
- ARMOURED units: Battle Tank, Assault Walker, Tank Destroyer, MLRS, Siege Tank, Gunship, Bomber and Assault Carrier.
- Provisional flat bonuses: Machine-gun Squad +0.5 per member against Light; Missile Squad +2 per member against Armoured; Tank Destroyer +24 against Armoured; Bomber +15 against Structure; Siege Tank +20 against Structure. The damage-class change itself preserves base stats; the approved balance pass above supplies subsequent damage, health, cost and production changes.
- Each hit deals base damage plus the matching class bonus. Each living squad member contributes its own hit; single-target excess damage still does not spill into the next member. Each splash recipient uses its OWN class, then the existing splash falloff applies to that recipient's total. A centre target's bonus never transfers to a differently classified neighbour.
- HQ/Bunker remain generalists at their existing damage. Nukes keep their explicit centre/outer values and bypass class bonuses. Bonuses do not let a weapon shoot an otherwise invalid air/ground target.
- Catalog cards and inspectors show target classes and explicit bonuses. Mini building cards retain concise names/cost/construction time. tune.json and the debug pane expose classes/bonuses. Exact bonus numbers remain playtest settings; T1 swarms must retain counterplay against unsupported T3.

## Utility buildings and nuclear silo

Owner explicitly requested implementation on 2026-11-03. Minimal first catalog: self-firing Defence Bunker and Nuclear Silo; additional utility roles remain open. All numerical values and unresolved interactions below are provisional playtest defaults, distinct from the confirmed one-payload/launch/flight/blast rules.

- Add utility buildings and a nuclear silo. Base utility cards compete for the SAME eight unique loadout slots as producers; no separate utility allowance. They do not replace the requirement to bring at least one T1 ground-unit producer.
- Utilities produce no map unit. Defence Bunker is a self-contained T1 ground/air gun, without garrison mechanics. Provisional: 8 tiles, 6s construction, 280 HP, range 1-2, 8 damage every second. Other support-building types remain proposals.
- The silo is expensive in committed resource territory. After building construction completes, it takes additional time to produce its first nuke. Building construction and nuke production are separate timers.
- The silo holds ONE ready nuke. It does not stockpile or start another production cycle while that nuke is ready. Launching consumes the ready nuke and starts producing the next one.
- Select the silo and choose Launch Nuke in its contextual menu, tap a target hex to preview the seven-cell footprint, then Confirm Launch. Cancel exits targeting without consuming the payload. This is a player command, never autonomous firing.
- Launch and impact are separated by actual elapsed flight time. The nuke in flight is INVISIBLE to defenders: the server must redact flight/target/timing and silo readiness from opposing snapshots as well as hiding visuals. Provisional fixed 8s flight, no warning or interception.
- The blast targets SEVEN hexes: one centre and six neighbours. The centre takes the most damage; friendly fire is CONFIRMED. Provisional 200 centre/80 outer damage to ground, air and buildings, including HQs and every affected squad member. Empty terrain is not directly burnt; normal destroyed-building burns/releases apply.
- Owner explicitly requests a visually satisfying MUSHROOM CLOUD at impact. Implement a scripted flash, expanding ground shockwave, rising stem and billowing mushroom cap in the procedural/vector style; reduced motion uses a static impact pose. The lifetime is tunable in presentation.mushroomMs.
- Provisional silo: T3, 24 committed tiles, 15s construction, 160 HP, 60s payload production. Ordinary connected support, sale/destruction and delayed discounted release rules apply. Launched missiles survive silo sale/destruction, but owner elimination removes remaining flights. Utilities use normal build/loadout rules and slots. A new-game default deck includes Bunker and Silo so the requested mechanics are discoverable.
- HQ anti-rush defence requested 2026-11-03: an automatic ground-only gun, provisionally 650 HP, range 2 and 8 damage per second. It does not target buildings or grant invulnerability; artillery and aircraft retain counterplay. Existing HQ capture aura remains at the actual HQ even when the defend/expand anchor changes.
## Technology research

- T1 to T2: temporarily commit 20 OPEN UNCOMMITTED OWNED cells for 30 seconds. No adjacency/connectivity requirement. Creates deliberate rush vulnerability.
- Research keeps the full 20 commitment in the shared resource pool after territory loss and continues counting down. This blocks other construction/expansion when capacity is insufficient.
- Completion releases research commitment and remaining reservations. Clicking active research cancels it, releases that commitment/reservations, and loses all progress. Territory ownership is unaffected by release.
- Top-of-screen research control is both the click target to advance technology and the progress-bar location.
- Research cells show faded conical flasks with subtle vertical bobbing. All committed cells use a darker shade of the owner's colour instead of lock icons. The flask distinguishes temporary research support from building support.
- T2 to T3: current playtest setting is temporarily commit 20 OPEN UNCOMMITTED OWNED cells for 60 seconds. This supersedes the earlier 30-cell/45-second setting. Apply the same no-connectivity, continue-through-territory-loss, full retained research commitment, completion release and cancellation-with-progress-loss rules. The UI control does not by itself establish a destructible HQ-upgrade mechanic.

## Building upgrades and timed conversions

Current one-way conversion tree: Barracks → Armoury (+2 / 5s / T1); Motor Pool → Siege Foundry (+8 / 10s / T3); Artillery Battery → Rocket Battery (+4 / 8s / T3); Helipad → Attack Helipad (+2 / 6s / T2); Airbase → Bomber Command (+0 / 8s / T3). Added conversion costs/timers are provisional and use the same confirmed lifecycle below. MLRS is no longer a base card.

All building upgrades are PERMANENT and ONE-WAY, including Airbase to Bomber Command. No downgrade or switch back. Additional upgrade resources remain committed for the upgraded building's lifetime. Costs vary by upgrade; do not generalize the Barracks surcharge to all producers.

- Barracks to Armoury: permanently add 2 resource cells, for total commitment 6. Requires an upgrade timer. New production is Missile Infantry instead of regular infantry. Missile Infantry remains a T1 role.
- Airbase to Bomber Command: explore a FREE permanent upgrade with a conversion timer, not a +2 surcharge. No extra resource commitment; the existing Airbase commitment of 12 remains. Fighter is T2, Bomber T3. Cannot switch back to Fighters.
- Latest timing supersedes the earlier delete-at-completion proposal: when the player starts upgrading/converting the building, its previous unit or squad retreats briefly and fades from the map. The lost field presence is an additional upgrade penalty. Do not retain the old unit until upgrade completion.
- Upgraded production becomes available when the timer finishes, subject to legal spawn occupancy; completion starts the new type's production cooldown when it spawns.

Confirmed upgrade lifecycle:
- Starting reserves any additional resource support, retires the current unit/squad AND incoming reinforcements, and pauses production. Retired forces use the brief retreat/fade; they do not return if cancelled.
- Player may cancel an UNFINISHED upgrade. All upgrade progress is lost. Release only the upgrade's remaining assigned support tiles; lost assignments remain debt. The base building remains. The retired unit is not restored. Cancellation starts a FRESH FULL production cooldown for the base unit type; after it finishes, dispatch a replacement unit/squad, waiting if legal spawning is blocked. This prevents cancellation from accelerating replacement.
- Enemy destruction while upgrading burns the building tile immediately and holds the remaining support assignments from both base and upgrade for the same 10-second release countdown.
- Completion permanently changes production, spawns the new type when a legal cell is available, then starts that type's production cooldown. Completed upgrades remain irreversible.

Presentation implementation recommendation: remove retired forces from combat/capture/occupancy when accepted, then render retreat/fade cosmetically. Exact retirement timing relative to the short visual remains a presentation detail; do not permit it to restore a retired force.

Conversion times are approved for the first playtest: Armoury 5 seconds and Bomber Command 8 seconds. Base production restart after cancellation is confirmed as a fresh full base-type cooldown. Upgrade prerequisites follow the target form tier in the current roster. Base-only loadouts and building-selected upgrade options are confirmed; upgraded variants are not loadout cards. Airbase's zero-surcharge conversion is under exploration, not a universal upgrade-cost rule; permanent one-way behavior is confirmed. Implement the settled rules for the next playtest; remaining numerical balance and minor integration defaults must be documented as provisional rather than prompting for every edge case.

### Additional resource support for upgrades

- Owner confirmed that resource-consuming upgrades reserve additional support from ANY open, owned, unburnt, uncommitted tiles. No adjacency or connection to the building or its original support footprint is required. Barracks+ still needs two free global resources and two eligible support cells somewhere in owned territory.
- These upgrade-support assignments remain committed for the upgraded building's lifetime, unlike temporary research support. Capturing them permanently loses their assignment, retains their commitment as debt, and discounts release on sale/destruction under the same support rules.
- Mark upgrade-support tiles with an UP ARROW over the darkened player-colour fill. Research support keeps the conical flask. Ordinary building support uses darkened player colour. Do not reintroduce locks.
- This replaces the previously suggested connected-extra-support rule. New building placement still requires connected support.

## Remaining design review

The roster and numerical tuning are provisional for playtesting. Core lifecycle, permanent conversions, research timings, squad focus/reinforcement, bottom RTS interface and maximum eight unique base cards are settled. Two-human multiplayer is implemented; race catalogs, full map, six-player FFA and final balance remain future work. Do not re-ask settled rules before the next build.

## Selling and building construction

Owner requests selling buildings and introduces construction time for EVERY building as the tradeoff. This supersedes instant placement/completion. Building construction time and unit-production cooldown are separate values and systems; the slower Missile Infantry production request still stands.

Confirmed selling rules:
- Retire the building's unit/squad and incoming reinforcements with retreat/fade.
- Return the building tile to open owned territory; selling does not burn it. HQs cannot be sold.
- Release ONLY the resource tiles still tied to that building at sale time. Previously captured support tiles discount the release; do not refund the full original/upgraded cost on sale. Owner explicitly extended the same discounted release to enemy destruction. This supersedes both the full-release selling recommendation and the older full-cost destruction rule.
- Example: cost 8, with 3 support assignments lost, releases only the remaining 5 immediately on sale or after 10 seconds on enemy destruction. The unreleased 3 remains as match debt; do not silently clear it by deleting the building from a summed-cost ledger.

Selling is immediate in the prototype, including an upgrading building; this remains a provisional playtest choice. Selling unfinished construction is confirmed as cancellation under the lifecycle below. Resource costs represent capacity commitments rather than spent currency.

Confirmed construction lifecycle:
- Placement immediately reserves the building's full resource cost and blocks its hex.
- A building under construction can be attacked and produces no units.
- Completion spawns the first unit, then starts its normal production cooldown. If no legal spawn cell exists, spawning waits.
- Selling an unfinished building cancels construction, releases only its remaining assigned support cells and returns its tile to open owned territory.
- Enemy destruction during construction burns the tile immediately and releases only remaining assignments after the same 10-second countdown.

Owner-approved first-playtest construction durations:

| Base building | Construction time |
| --- | --- |
| Barracks | 3 seconds |
| Motor Pool | 5 seconds |
| Artillery Battery | 5 seconds |
| Helipad | 6 seconds |
| Airbase | 6 seconds |
| Recon Post | 2.5 seconds (provisional) |
| Support Barracks | 3.5 seconds (provisional) |
| Air Defence Post | 4 seconds (provisional) |
| Assault Foundry | 7 seconds (provisional) |
| Anti-tank Depot | 6 seconds (provisional) |
| Carrier Command | 10 seconds (provisional) |

Owner-approved conversion durations: Barracks to Armoury 5 seconds; Airbase to Bomber Command 8 seconds. Construction and conversion times remain separate from unit-production cooldowns. These timings are provisional for the first playtest. Confirmed construction health: a new building starts at full building HP, remains vulnerable and inactive during construction, and completing construction does not heal damage taken. Upgrading preserves current building HP and completion does not heal it. No progressive construction-health curve or upgrade healing.

## Selection and classic RTS interface

- Resources are at the TOP RIGHT; technology control/progress stays at the top. The bottom contains building cards on the left and contextual commands on the right half. No separate global expand/attack buttons.
- Selecting a card clears contextual entity selection and enters building mode. First tap on eligible open owned terrain shows a hammer and connected support preview; tapping that hex again confirms construction.
- Selecting a non-empty hex exits building mode and deselects the card. Units/buildings on it become the contextual selection; committed/burnt hexes also exit building mode rather than pretending to be valid construction.
- Default faction order is Expand/defend around own HQ. Friendly buildings offer a contextual DEFEND / EXPAND command and move the pulsing ground ring/inward arrows to that building. Destroyed/sold anchors fall back to own HQ; moving units cannot be anchors. Attack moves the ring to the selected enemy HQ. Include a clear mode label; inspection alone must not change a non-HQ command. Draw a tiny bobbing up-arrow over owned buildings whose upgrade is currently available. Respect reduced motion.
- Tapping YOUR HQ immediately orders Expand/defend; tapping an ENEMY HQ immediately orders Attack against that HQ. The selected HQ's contextual panel also exposes that same command.
- Selecting a building or unit shows its details and available commands in the right half of the bottom panel. Own buildings expose Sell and permanent Upgrade/Cancel Upgrade as applicable. Entity selection follows its stable ID as it moves, never whatever later occupies the clicked hex.
- In-match cards/context avoid catalog-level stat overload. Retain name/cost/construction, health/progress and actionable commands; detailed combat stats remain in the pre-match catalog.
- Portrait and landscape remain playable; deck cards never shrink the board into the previous narrow right-sidebar layout. The portrait deck uses two columns on its left half, landscape/desktop four.
## Multiplayer delivery request

On 2026-11-03 the owner requested a two-human online private-room 1v1 version by 2026-11-04 Singapore time. That preview was delivered, then the owner explicitly requested Bunker/Silo implementation and anti-snowball balance changes, confirmed provisional utility tuning and FRIENDLY BUILDINGS ONLY as defend/expand anchors. These are authorized execution scope, not design-only follow-ups.

## Multiplayer direction

Private-room WebSocket multiplayer uses a server-authoritative simulation, adapting Firestorm's separation of rules, commands and presentation without sharing its server. First milestone is two humans completing a match, then FFA. The isolated Operation C Worker was deployed on 2026-11-03 to the existing verified Workers Free account, with no plan upgrade. Client publication remains separate from server deployment; see BUILD_STATUS.md for current verification/publication status.

Implementation defaults: five-character private invite code/link; two authenticated tab seats; separate loadouts and Ready; three-second countdown; fixed 100 ms server steps and 200 ms record deltas. No online pause, bots, accounts, matchmaking or spectators. Tab session storage retains each seat token; invite links omit tokens. Original-tab reload reconnects; disconnected seats cannot be stolen. New matches use new rooms. Lobby expiry is 30 minutes of inactivity, ended-match retention one hour. These networking/lobby defaults are provisional for playtesting.

Confirmed disconnect behavior: match continues, units retain current orders, and the player can reconnect to the same seat.

## Presentation and controls

- Welcoming procedural/vector military miniatures, distinct owner colours plus non-colour cues, responsive portrait/landscape. Generated mockup is direction only.
- Capture visibly lifts, flips and lands; state updates immediately. Respect reduced-motion preferences.
- Units stay upright and may mirror horizontally. UI indicates actual target direction; short bullet traces occur only on real firing events.
- Two taps/clicks to build: first previews the connected footprint and distinct gold hammer cell; second confirms. Invalid placement is red with an X.
- Latest committed-cell visual rule is darkened player colour, replacing the older lock-marker design.

## Prototype choices and remaining design

Current test map is 271 cells, radius 9. HQ centre gives no capacity. Capacity is provisionally capped at 200 while further land remains capturable. Exact cap meaning, full match length/map size, HQ pressure exceptions, terrain, LOS, eliminated buildings, numerical balance, splash footprint/falloff/friendly fire and member damage allocation remain open. Do not promote these test assumptions into confirmed design.

Loadout/tech/squads/upgrades are the current design milestone. Six-human networking, full Eurasia geography, full race catalogs, water mechanics, accounts and paid infrastructure are not part of the existing playable slice. No Steam/console commitment.

## Provisional defaults used for the progression playtest

To keep the next build moving without further rule-by-rule questions, these are implementation defaults for review through play:
- Thirteen base cards: eleven producers, two utilities; five producer upgrades give sixteen unit types. The eight-slot default deck is Barracks, Motor Pool, Artillery Battery, Helipad, Airbase, Recon Post, Defence Bunker and Nuclear Silo. All other base cards remain selectable. Numerical roles/costs are provisional; see tune.json.
- Regular infantry: five members, 8 HP and 2 damage each (40 squad HP, 10 full volley damage); Missile Infantry: five members, 7 HP and 4 damage each, range 1-2, move 1000 ms/hex, production 9000 ms, attack 1200 ms. Member attack clocks are synchronized on one shared target; single hits choose the first living member. Capture strength scales with surviving member count; remaining HP of each living member does not alter its contribution.
- Bomber: total producer commitment 10, unit HP 100, damage 45, range 1-2, move 800 ms/hex, attack 2400 ms, production 24000 ms. No splash on Bombers in this slice.
- MLRS: cost 12, unit HP 80, damage 30, range 3-5, move 1500 ms/hex, attack 3000 ms, production 24000 ms. Radius-one enemy-only splash: full damage on the target hex, half on adjacent hexes, applied to every squad member in an affected hex. No friendly damage.
- Reinforcements take 250 ms per dispatch-distance hex with a 500 ms minimum. The visual follows the current squad location; arrival is scheduled at dispatch. They vanish on squad death; producer destruction alone permits already dispatched members to reach a living orphan. Upgrading/selling retires them.
- Selling is immediate, including an upgrading building, using the combined base-plus-pending-upgrade surviving support count. Retiring a capturer triggers capture rollback. Fresh production cooldown after cancelled upgrade is the base type's full interval.
- Retired forces stop gameplay immediately; a 650 ms retreat/fade is cosmetic. Inspector keeps the selected entity ID while it moves and retains its last details marked destroyed after loss. The bottom command area has the deck on its left and contextual selection on its right.

These numbers live in tune.json; they are not final race balance or changes to the owner's confirmed lifecycle rules.

## Offline bot playtest opponent — 2026-11-03

- Owner requests a stronger bot to judge the current snowball balance. Replace the fixed build cycle/permanent timed attack with deterministic economy/army/threat decisions: preserve capture presence, mix frontline and support, respond using cards in its legal loadout, defend/rebuild under pressure, and attack once it has a useful force.
- The bot uses the same resource capacity, placement, construction, production, capture, technology and combat rules as the player. No bonus income, free units, faster timers or stronger stats. The fully visible player map permits strategic observation of enemy composition; individual unit sight remains unchanged.
- Avoid unsafe research and conversions that strand defense or remove the only capturing force. Place producers with useful support space and protection. Stronger behavior is a playtest aid, not proof of competitive balance. Two-human online rooms remain bot-free.
- Current bot decisions: first build on the first simulation step, then a 5s decision cadence; require a healthy mixed force before attack, return to defense after losses or home pressure, and hold a 15s regrouping window to reduce order flipping. Start research with its normal 20-tile commitment plus an 8-tile reserve. Deliberately save toward that budget only with a sufficient army and active capturing units; pressure/casualties/blocked capture resume defense and construction. Upgrade only with spare support and another capturing force available.
- Use available legal counters rather than demanding cards outside the bot's loadout. Keep threatened producers safer and place useful defensive Bunkers. Do not build Silo commitments the bot cannot use; autonomous nuclear targeting is deferred. Bot decision thresholds are provisional, editable in the existing debug pane; combat and economic tuning are unchanged in this bot-only pass.

## Delivery and verification

- Phaser 3, strict TypeScript, Vite, canvas UI and tune.json values/debug pane; no new dependencies without discussion. Existing Godot planning work remains preserved.
- Keep changes game-specific. Reuse Firestorm's pure-rules/commands/authoritative-presentation architecture lessons, without connecting to or changing its live server.
- Entry prototypes/operation-c/ and hub shortcut remain. Game-specific validation workflow; existing hub Pages publishing. Do not retarget Current WIP itch or unrelated deployments.
- Verify meaningful deterministic behavior, scoped/full TypeScript/build, Brave desktop/touch flows and inspected screenshots. Report physical-phone/performance limits honestly. Keep small automatic version stamp.
- Save implementation/results in BUILD_STATUS.md. Owner explicitly approved merging PR #410 on 2026-11-02; it is now merged and published. Future external publication follows the applicable authorization rules.
