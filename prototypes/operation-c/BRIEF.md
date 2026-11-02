# Operation C permanent design reference

Last reconciled: 2026-11-03, Asia/Singapore. This is the canonical design reference for main, logic and art discussions. Check it before re-asking an answered question. Update the relevant section when a decision changes; keep proposals distinct from confirmed rules. BUILD_STATUS.md records implementation and verification, not design authority. Git history preserves superseded decisions.

## Design versus implementation

The current Phaser 3 / strict TypeScript local preview is a two-HQ human-versus-bot progression sandbox. It implements base-card loadouts, T1/T2/T3 research, timed construction/selling, permanent producer conversions, eleven base producers/sixteen unit forms, infantry squads/reinforcements, delayed discounted destruction release with stranded debt, and a classic RTS bottom deck/context panel. Full multiplayer, six-player map and three race catalogs remain later work. BUILD_STATUS.md records verification and limitations; all unspecified tuning choices below are provisional for playtesting.

## Match and player control

- Mobile-first, deterministic real-time hex war. Full-game direction: six-player FFA, fully visible Eurasia-shaped map, last surviving HQ wins.
- HQ destruction eliminates its owner, removes their units and neutralizes their territory.
- Players choose their building-card loadout before the match. During play they place buildings and issue faction-wide orders by selecting their own HQ (Expand/defend) or an enemy HQ (Attack). Units act autonomously.
- Three races are planned, with expensive advanced, low-tech swarm and balanced identities discussed. Race-specific catalogs and detailed tier access still need design.

## Territory and committed resources

- Each productive owned hex supplies 1 capacity. Display committed resources / total capacity; debt can exceed capacity, such as 100 / 50.
- New buildings need enough global free capacity and their full cost in connected OPEN OWNED UNBURNT hexes, including the building tile. Reserve the nearest connected eligible cells.
- Supporting cells cannot host/fund another building or carry its resource connection. Neutral, enemy, burnt and already committed cells break a NEW building's support connection.
- Losing supporting territory removes its local assignment permanently, including after recapture, but does not release the building's committed cost. Existing buildings continue functioning in debt. New construction requires sufficient capacity again.
- Selling OR enemy destruction releases only the cells still assigned to that building. Selling releases immediately; enemy destruction keeps the remaining assignments committed for 10 seconds before release, with a countdown on each hex. Capturing an assignment during this countdown permanently strands that part of the commitment; recapture does not restore it. Previously captured support assignments are discounted from the release; their unreleased commitment remains as match debt after the building is gone. Example: cost 8, lose 3 assigned support cells, then sell or lose the building: release 5 and retain 3 debt. Recapturing a formerly assigned cell does not restore the lost assignment or clear this debt.
- Enemy destruction permanently burns the building hex. Burnt cells give no resources, building space or support connectivity, but remain traversable. Its living unit survives without replacements. Selling instead returns the building tile to open owned territory and retires its forces, as specified below.
- No shared building-placement cooldown. Earlier Barracks-8 experiment is superseded by the current Barracks-4 cost.

## Occupancy, movement and spawning

- One registered unit per hex, with no air/ground stacking. Buildings block every unit type. Units queue and seek distinct positions around targets; visual movement may pass without creating shared logical occupancy.
- A squad is a unit under the existing one-hex occupancy rule; its members do not each reserve a separate hex. Exact member visual arrangement remains presentation work.
- Spawn into an unoccupied reachable cell, searching outward without a distance cap. Committed cells are eligible. A full blockade prevents spawn; do not jump occupied barriers. Visually emerge from the producer and travel to the registered tile.
- Range 1 means adjacent, range 2+ ranged. Engagement resolves from registered hexes.
- Infantry squads prioritize capture over fighting, including under unanswered fire. Other ground units prioritize combat and defend against intruders on friendly territory. They capture ONLY in Expand mode and only while no enemy unit occupies friendly territory. Ground Expand mode prioritizes reachable neutral land outward in rings from its HQ before hostile land. The current interpretation was stated during discussion and remains subject to playtest feedback.
- Aircraft in Expand mode prioritize nearest valid intruders on owned territory, otherwise defend/return home. Attack mode advances toward the selected enemy HQ seeking valid targets. Fighters never attack ground units or buildings.
- Prototype choice: movement reserves both origin and destination until arrival, preventing swaps. This is a documented implementation choice, not a separate full-game design mandate.

## Capture and HQ pressure

- Most ground units capture; infantry is most effective. Non-neutral cells take 50% longer than neutral capture duration (1.5x), superseding the older 2x rule. Aircraft do not capture.
- Capture pauses only while the capturing unit itself attacks. Taking damage without retaliating does not pause it; paused progress is retained.
- When the responsible capturer dies, incomplete progress slowly reverses toward the unchanged original controller. A replacement capturer can resume progress. Merely attacking or leaving while alive does not trigger casualty rollback.
- HQ starts with the two surrounding rings (18 cells) captured and applies pressure like invisible infantry, subject to hostile occupation exceptions. Exact full-game exceptions remain open.

## Production and infantry reinforcements

- Non-squad producer: first unit on completed construction when a legal spawn cell is available; production cooldown starts on every spawn. Replacement requires both the previous unit to be dead and cooldown to be complete. This prevents repeated defensive spawning.
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
| T1 | Barracks / Infantry Squad | 4 | Base; fast capture, G to G/A, five fragile members |
| T1 | Armoury / Missile Squad | 6 | Barracks upgrade; anti-ground, slower movement and reinforcement |
| T1 | Motor Pool / Battle Tank | 8 | Base; reliable ground armour, cannot hit air |
| T1 | Artillery Battery / Field Artillery | 8 | Base; frail, range 2-3, retreats after damage |
| T1 | Recon Post / Scout Buggy | 4 | Base; fast cheap exploration, weak in sustained combat |
| T1 | Support Barracks / Machine-gun Squad | 5 | Base; five rapid-firing anti-swarm members, short range |
| T1 | Air Defence Post / Flak Rover | 6 | Base; G to A only, cannot capture, helpless against ground attackers |
| T2 | Helipad / Helicopter | 12 | Base; mobile air-to-ground support, cannot fight air |
| T2 | Attack Helipad / Gunship | 16 | Helipad upgrade; ground splash, vulnerable to fighters |
| T2 | Airbase / Fighter | 12 | Base; air-to-air only, cannot damage ground or buildings |
| T2 | Assault Foundry / Assault Walker | 14 | Base; G to G/A close assault, slow and easy to outrange |
| T2 | Anti-tank Depot / Tank Destroyer | 12 | Base; heavy range 2-3 shots, fragile against close swarms |
| T3 | Bomber Command / Bomber | 12 | Airbase conversion; heavy ground hit, helpless against fighters |
| T3 | Rocket Battery / MLRS | 16 | Artillery upgrade ONLY; splash range 3-5, weak at close range and to air |
| T3 | Siege Foundry / Siege Tank | 20 | Motor Pool upgrade; heavy slow shots, minimum range 2, cannot hit air |
| T3 | Carrier Command / Assault Carrier | 24 | Base; heavy ground splash, 30s production, cannot fight aircraft |

Names are shared by the loadout, deck and contextual panel. Costs for the eight new units and new conversion durations are provisional playtest settings; existing approved base costs remain intact. Bombers and MLRS now use 24-second production cooldowns under the new slow T3 philosophy; Siege Tanks use 26 seconds. No new armour-resistance or invulnerability system.
## Loadout page

- Up to 8 UNIQUE BASE building cards across T1-T3; at least one T1 ground producer. Upgrades are options belonging to their base card, never separate selectable cards or extra slots.
- Three scrollable catalog sections by BASE tier, with a pinned top tray of eight selected-card sockets. Clicking a populated socket removes that base card. A Buildings / Units toggle changes the mini portraits in the tray and match deck.
- Every catalog card has separate BUILDING and UNIT sections and matching procedural pictures. Show building name, cost, health, construction and production time; unit name, health, speed, range, damage and targeting type, plus a short role/weakness note.
- An up-arrow button flips eligible cards to their upgrade preview with a scripted flip animation; the reverse arrow restores the base face. Previewing changes neither loadout membership nor base-tier grouping. The selected socket continues to represent the base card.
- Deck/socket mini cards use the same unit/building art factories as battlefield entities. In-match cards are concise: name, resource cost, construction time.
## Utility buildings and nuclear silo — design discussion

Confirmed 2026-11-03. These are recorded design decisions, NOT implemented in the current roster/UI playtest. Continue systems discussion here before assigning execution.

- Add utility buildings and a nuclear silo. Base utility cards compete for the SAME eight unique loadout slots as producers; no separate utility allowance. They do not replace the requirement to bring at least one T1 ground-unit producer.
- Utility buildings introduce non-unit-producing building roles. Defence bunkers are a candidate; self-contained weapons versus garrison mechanics, other utility types and their tiers/costs remain undecided. Earlier suggested support buildings are proposals, not an approved catalog.
- The silo is expensive in committed resource territory. After building construction completes, it takes additional time to produce its first nuke. Building construction and nuke production are separate timers.
- The silo holds ONE ready nuke. It does not stockpile or start another production cycle while that nuke is ready. Launching consumes the ready nuke and starts producing the next one.
- Select the silo on the map and use its contextual menu to launch. Targeting/confirmation details still need discussion; launch is a player command rather than autonomous unit behaviour.
- Launch and impact are separated by actual elapsed flight time. The nuke in flight is INVISIBLE to defenders. Fixed versus distance-based flight duration, attacker-side presentation, warnings and interception are not yet settled. Do not assume a defender-visible projectile/path or carry forward the earlier warning proposal as confirmed.
- The blast targets SEVEN hexes: one centre hex and its six adjacent neighbours. The centre takes the most damage; exact centre/outer damage, squad-member allocation, ground/air eligibility and friendly fire remain undecided.
- Owner explicitly requests a visually satisfying MUSHROOM CLOUD at impact. Art direction proposal: scripted flash, expanding ground shockwave, rising stem and billowing mushroom cap, consistent with the procedural/vector style. Exact animation remains art work for a later execution milestone.
- Proposed, not confirmed: T3 access; ordinary building support/construction/sale/destruction rules for utilities; launched missiles surviving silo destruction; blasts not directly burning empty terrain. Existing destruction burns building tiles, but direct nuclear terrain effects have not been decided.
- Still to settle: friendly fire and damage eligibility, HQ lethality, terrain effects, post-launch silo/owner destruction behaviour, targeting confirmation, utility catalog, tier access, costs, production/flight times and damage falloff.
## Technology research

- T1 to T2: temporarily commit 20 OPEN UNCOMMITTED OWNED cells for 30 seconds. No adjacency/connectivity requirement. Creates deliberate rush vulnerability.
- Research keeps the full 20 commitment in the shared resource pool after territory loss and continues counting down. This blocks other construction/expansion when capacity is insufficient.
- Completion releases research commitment and remaining reservations. Clicking active research cancels it, releases that commitment/reservations, and loses all progress. Territory ownership is unaffected by release.
- Top-of-screen research control is both the click target to advance technology and the progress-bar location.
- Research cells show faded conical flasks with subtle vertical bobbing. All committed cells use a darker shade of the owner's colour instead of lock icons. The flask distinguishes temporary research support from building support.
- T2 to T3: current playtest setting is temporarily commit 20 OPEN UNCOMMITTED OWNED cells for 60 seconds. This supersedes the earlier 30-cell/45-second setting. Apply the same no-connectivity, continue-through-territory-loss, full retained research commitment, completion release and cancellation-with-progress-loss rules. The UI control does not by itself establish a destructible HQ-upgrade mechanic.

## Building upgrades and timed conversions

Current one-way conversion tree: Barracks → Armoury (+2 / 5s / T1); Motor Pool → Siege Foundry (+12 / 10s / T3); Artillery Battery → Rocket Battery (+8 / 8s / T3); Helipad → Attack Helipad (+4 / 6s / T2); Airbase → Bomber Command (+0 / 8s / T3). Added conversion costs/timers are provisional and use the same confirmed lifecycle below. MLRS is no longer a base card.

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

The implemented roster and new numerical tuning are provisional for playtesting. Core lifecycle, permanent conversions, research timings, squad focus/reinforcement, bottom RTS interface and maximum eight unique base cards are settled. Race catalogs, full map, multiplayer and final balance remain future work. Do not re-ask settled rules before the next build.

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
- Tapping YOUR HQ immediately orders Expand/defend; tapping an ENEMY HQ immediately orders Attack against that HQ. The selected HQ's contextual panel also exposes that same command.
- Selecting a building or unit shows its details and available commands in the right half of the bottom panel. Own buildings expose Sell and permanent Upgrade/Cancel Upgrade as applicable. Entity selection follows its stable ID as it moves, never whatever later occupies the clicked hex.
- In-match cards/context avoid catalog-level stat overload. Retain name/cost/construction, health/progress and actionable commands; detailed combat stats remain in the pre-match catalog.
- Portrait and landscape remain playable; deck cards never shrink the board into the previous narrow right-sidebar layout. The portrait deck uses two columns on its left half, landscape/desktop four.
## Multiplayer direction

Private-room WebSocket multiplayer with a server-authoritative simulation is recommended, adapting Firestorm room/connection/reconnect architecture. First milestone recommendation is two humans completing a match, then FFA. Hosting and final multiplayer scope remain proposals, not deployed features.

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
- Eleven base cards are available, with five permanent upgrade forms, for sixteen unit types. The loadout limit is eight unique; the default deck is Barracks, Motor Pool, Artillery Battery, Helipad, Airbase, Recon Post, Air Defence Post and Carrier Command. Numerical roles/costs for new forms are provisional; see roster table and tune.json.
- Regular infantry: five members, 8 HP and 2 damage each (40 squad HP, 10 full volley damage); Missile Infantry: five members, 7 HP and 4 damage each, range 1-2, move 1000 ms/hex, production 9000 ms, attack 1200 ms. Member attack clocks are synchronized on one shared target; single hits choose the first living member. Capture strength stays constant as members die.
- Bomber: total producer commitment 12, unit HP 100, damage 45, range 1-2, move 800 ms/hex, attack 2400 ms, production 24000 ms. No splash on Bombers in this slice.
- MLRS: cost 16, unit HP 80, damage 30, range 3-5, move 1500 ms/hex, attack 3000 ms, production 24000 ms. Radius-one enemy-only splash: full damage on the target hex, half on adjacent hexes, applied to every squad member in an affected hex. No friendly damage.
- Reinforcements take 250 ms per dispatch-distance hex with a 500 ms minimum. The visual follows the current squad location; arrival is scheduled at dispatch. They vanish on squad death; producer destruction alone permits already dispatched members to reach a living orphan. Upgrading/selling retires them.
- Selling is immediate, including an upgrading building, using the combined base-plus-pending-upgrade surviving support count. Retiring a capturer triggers capture rollback. Fresh production cooldown after cancelled upgrade is the base type's full interval.
- Retired forces stop gameplay immediately; a 650 ms retreat/fade is cosmetic. Inspector keeps the selected entity ID while it moves and retains its last details marked destroyed after loss. The bottom command area has the deck on its left and contextual selection on its right.

These numbers live in tune.json; they are not final race balance or changes to the owner's confirmed lifecycle rules.

## Delivery and verification

- Phaser 3, strict TypeScript, Vite, canvas UI and tune.json values/debug pane; no new dependencies without discussion. Existing Godot planning work remains preserved.
- Keep changes game-specific. Reuse Firestorm's pure-rules/commands/authoritative-presentation architecture lessons, without connecting to or changing its live server.
- Entry prototypes/operation-c/ and hub shortcut remain. Game-specific validation workflow; existing hub Pages publishing. Do not retarget Current WIP itch or unrelated deployments.
- Verify meaningful deterministic behavior, scoped/full TypeScript/build, Brave desktop/touch flows and inspected screenshots. Report physical-phone/performance limits honestly. Keep small automatic version stamp.
- Save implementation/results in BUILD_STATUS.md. Owner explicitly approved merging PR #410 on 2026-11-02; it is now merged and published. Future external publication follows the applicable authorization rules.
