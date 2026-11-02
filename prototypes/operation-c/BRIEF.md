# Operation C permanent design reference

Last reconciled: 2026-11-02, Asia/Singapore. This is the canonical design reference for main, logic and art discussions. Check it before re-asking an answered question. Update the relevant section when a decision changes; keep proposals distinct from confirmed rules. BUILD_STATUS.md records implementation and verification, not design authority. Git history preserves superseded decisions.

## Design versus implementation

The current Phaser 3 / strict TypeScript local preview is a two-HQ human-versus-bot progression sandbox. It implements base-card loadouts, T1/T2/T3 research, timed construction/selling, permanent Armoury/Bomber conversions, six base producers/eight unit forms, infantry squads/reinforcements, discounted support release with stranded debt, and the persistent inspector/right card panel. Full multiplayer, six-player map and three race catalogs remain later work. BUILD_STATUS.md records verification and limitations; all unspecified tuning choices below are provisional for playtesting.

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
- Selling OR enemy destruction releases only the cells still assigned to that building. Previously captured support assignments are discounted from the release; their unreleased commitment remains as match debt after the building is gone. Example: cost 8, lose 3 assigned support cells, then sell or lose the building: release 5 and retain 3 debt. Recapturing a formerly assigned cell does not restore the lost assignment or clear this debt.
- Enemy destruction permanently burns the building hex. Burnt cells give no resources, building space or support connectivity, but remain traversable. Its living unit survives without replacements. Selling instead returns the building tile to open owned territory and retires its forces, as specified below.
- No shared building-placement cooldown. Earlier Barracks-8 experiment is superseded by the current Barracks-4 cost.

## Occupancy, movement and spawning

- One registered unit per hex, with no air/ground stacking. Buildings block every unit type. Units queue and seek distinct positions around targets; visual movement may pass without creating shared logical occupancy.
- A squad is a unit under the existing one-hex occupancy rule; its members do not each reserve a separate hex. Exact member visual arrangement remains presentation work.
- Spawn into an unoccupied reachable cell, searching outward without a distance cap. Committed cells are eligible. A full blockade prevents spawn; do not jump occupied barriers. Visually emerge from the producer and travel to the registered tile.
- Range 1 means adjacent, range 2+ ranged. Engagement resolves from registered hexes.
- Ground Expand mode prioritizes reachable neutral land outward in rings from its HQ before hostile land. The current interpretation was stated during discussion and remains subject to playtest feedback.
- Aircraft in Expand mode prioritize nearest valid intruders on owned territory, otherwise defend/return home. Attack mode advances toward the selected enemy HQ seeking valid targets. Fighters never attack ground units or buildings.
- Prototype choice: movement reserves both origin and destination until arrival, preventing swaps. This is a documented implementation choice, not a separate full-game design mandate.

## Capture and HQ pressure

- Most ground units capture; infantry is most effective. Owned cells take twice neutral capture duration. Aircraft do not capture.
- Capture pauses only while the capturing unit itself attacks. Taking damage without retaliating does not pause it; paused progress is retained.
- When the responsible capturer dies, incomplete progress slowly reverses toward the unchanged original controller. A replacement capturer can resume progress. Merely attacking or leaving while alive does not trigger casualty rollback.
- HQ starts with the two surrounding rings (18 cells) captured and applies pressure like invisible infantry, subject to hostile occupation exceptions. Exact full-game exceptions remain open.

## Production and infantry reinforcements

- Non-squad producer: first unit on completed construction when a legal spawn cell is available; production cooldown starts on every spawn. Replacement requires both the previous unit to be dead and cooldown to be complete. This prevents repeated defensive spawning.
- Both regular and Missile Infantry are squads of 5. Each member is an individual combat unit with its own attack power; balance the complete squad as a group. Derive squad damage from the living members rather than applying an arbitrary fixed 20-percent squad modifier. Identical members naturally contribute equal shares, but per-member combat stats are the design source of truth. Losing a member removes that member's attacks. All squad members FOCUS ONE SHARED TARGET; members do not independently choose different targets. Single-target incoming attacks damage ONE member at a time; excess damage does NOT spill into another member. Splash can damage multiple members. Owner requests weaker health; exact member health, member hit selection, splash allocation and attack timing remain open.
- Missing squad members can be reinforced after the producer's production cooldown; reinforcements travel faster. Reinforcements are tied to a LIVING target squad: if that squad is destroyed, ALL incoming reinforcements vanish. They never recreate a wiped squad or become an independent replacement squad. The previous reference incorrectly said they could continue a wiped squad; that statement is superseded and must not be used.
- The earlier swarm/squad reinforcement rule now informs both infantry types, following the owner's reminder to retain the prior decision. On each eligible production cooldown, dispatch only enough missing members to restore the squad to 5, counting living members AND members already travelling. Example: 2 living/0 travelling dispatches 3; 2 living/1 travelling dispatches 2. Never over-dispatch beyond the five-member total.
- New reinforcement members arrive at full individual HP; surviving members retain their existing HP and are not healed.
- Reinforcement travel is mostly visual until merge: incoming members occupy no hex, cause no blocking, and cannot attack, capture, be targeted or take damage. They visually approach the moving target squad and add their members on arrival, without a separate battlefield occupancy/merge exception. Selling/upgrading retires incoming reinforcements under the established rules. Member damage allocation, numeric travel speed and timing remain to be specified.
- Missile Infantry has slower movement and a longer UNIT PRODUCTION cooldown. This remains distinct from the newly requested building construction time below; the earlier instant-construction rule is superseded.

## Confirmed tier roster and costs

| Tier | Building or unit role | Cost | Targeting and behavior |
| --- | --- | --- | --- |
| T1 | Barracks / regular infantry squad | 4 | Ground to ground/air; 5 members |
| T1 | Factory / tank | 8 | Ground to ground |
| T1 | Artillery | 8 | Frail; ground to ground; range 2-3; retreats after damage |
| T1 | Missile Infantry squad | 6 total | Ground anti-ground; 5 members; slower movement/production |
| T2 | Hangar / helicopter | 12 | Air to ground; cannot capture |
| T2 | Airfield / fighter | 12 | Air to air; cannot capture |
| T3 | Bomber | Unspecified | Heavy air-to-ground damage |
| T3 | MLRS | Unspecified | Long-range ground vehicle; splash; slow fire; minimum range 3 |

Missile Infantry and Bomber producer forms may change to the upgrade proposal below. Current sandbox health, damage and timing values are provisional tuning, not confirmed final balance.

## Loadout page

- Up to 8 UNIQUE building cards, mixing T1-T3. At least one selected T1 ground-unit producer. No duplicate selections.
- Simple cards show building cost, building health, unit production time, unit health, speed, attack range, damage and type.
- Owner initially described T1-T2 catalog visibility while allowing T1-T3 selections; final T3 presentation needs clarification.
- Loadout selects BASE BUILDING CARDS ONLY. Upgrades are not separately selectable cards and consume no separate loadout slot; they appear as options when the player selects an eligible placed building. Race restrictions and upgrade prerequisites still need definition.

## Technology research

- T1 to T2: temporarily commit 20 OPEN UNCOMMITTED OWNED cells for 30 seconds. No adjacency/connectivity requirement. Creates deliberate rush vulnerability.
- Research keeps the full 20 commitment in the shared resource pool after territory loss and continues counting down. This blocks other construction/expansion when capacity is insufficient.
- Completion releases research commitment and remaining reservations. Clicking active research cancels it, releases that commitment/reservations, and loses all progress. Territory ownership is unaffected by release.
- Top-of-screen research control is both the click target to advance technology and the progress-bar location.
- Research cells show faded conical flasks with subtle vertical bobbing. All committed cells use a darker shade of the owner's colour instead of lock icons. The flask distinguishes temporary research support from building support.
- T2 to T3: current playtest setting is temporarily commit 20 OPEN UNCOMMITTED OWNED cells for 60 seconds. This supersedes the earlier 30-cell/45-second setting. Apply the same no-connectivity, continue-through-territory-loss, full retained research commitment, completion release and cancellation-with-progress-loss rules. The UI control does not by itself establish a destructible HQ-upgrade mechanic.

## Building upgrades and timed conversions

All building upgrades are PERMANENT and ONE-WAY, including Airfield to Bomber Airfield. No downgrade or switch back. Additional upgrade resources remain committed for the upgraded building's lifetime. Costs vary by upgrade; do not generalize the Barracks surcharge to all producers.

- Barracks to Barracks+/Armoury: permanently add 2 resource cells, for total commitment 6. Requires an upgrade timer. New production is Missile Infantry instead of regular infantry. Missile Infantry remains a T1 role.
- Airfield to Airfield+/Bomber Airfield: explore a FREE permanent upgrade with a conversion timer, not a +2 surcharge. No extra resource commitment; the existing Airfield commitment of 12 remains. Fighter is T2, Bomber T3. Cannot switch back to Fighters.
- Latest timing supersedes the earlier delete-at-completion proposal: when the player starts upgrading/converting the building, its previous unit or squad retreats briefly and fades from the map. The lost field presence is an additional upgrade penalty. Do not retain the old unit until upgrade completion.
- Upgraded production becomes available when the timer finishes, subject to legal spawn occupancy; completion starts the new type's production cooldown when it spawns.

Confirmed upgrade lifecycle:
- Starting reserves any additional resource support, retires the current unit/squad AND incoming reinforcements, and pauses production. Retired forces use the brief retreat/fade; they do not return if cancelled.
- Player may cancel an UNFINISHED upgrade. All upgrade progress is lost. Release only the upgrade's remaining assigned support tiles; lost assignments remain debt. The base building remains. The retired unit is not restored. Cancellation starts a FRESH FULL production cooldown for the base unit type; after it finishes, dispatch a replacement unit/squad, waiting if legal spawning is blocked. This prevents cancellation from accelerating replacement.
- Enemy destruction while upgrading burns the building tile and releases only the remaining support assignments from both base and upgrade.
- Completion permanently changes production, spawns the new type when a legal cell is available, then starts that type's production cooldown. Completed upgrades remain irreversible.

Presentation implementation recommendation: remove retired forces from combat/capture/occupancy when accepted, then render retreat/fade cosmetically. Exact retirement timing relative to the short visual remains a presentation detail; do not permit it to restore a retired force.

Conversion times are approved for the first playtest: Armoury 5 seconds and Bomber Airfield 8 seconds. Base production restart after cancellation is confirmed as a fresh full base-type cooldown. Upgrade prerequisites remain to be fully specified. Base-only loadouts and building-selected upgrade options are confirmed; upgraded variants are not loadout cards. Airfield's zero-surcharge conversion is under exploration, not a universal upgrade-cost rule; permanent one-way behavior is confirmed. Implement the settled rules for the next playtest; remaining numerical balance and minor integration defaults must be documented as provisional rather than prompting for every edge case.

### Additional resource support for upgrades

- Owner confirmed that resource-consuming upgrades reserve additional support from ANY open, owned, unburnt, uncommitted tiles. No adjacency or connection to the building or its original support footprint is required. Barracks+ still needs two free global resources and two eligible support cells somewhere in owned territory.
- These upgrade-support assignments remain committed for the upgraded building's lifetime, unlike temporary research support. Capturing them permanently loses their assignment, retains their commitment as debt, and discounts release on sale/destruction under the same support rules.
- Mark upgrade-support tiles with an UP ARROW over the darkened player-colour fill. Research support keeps the conical flask. Ordinary building support uses darkened player colour. Do not reintroduce locks.
- This replaces the previously suggested connected-extra-support rule. New building placement still requires connected support.

## Design review pending decisions

Reviewed 2026-11-02. Permanence is settled and must not be re-asked. These are remaining implementation decisions, not changes to confirmed rules:

1. Base-only loadout eligibility is SETTLED: upgrades are building-selected options, not loadout cards. Show base cards with their tier/stats; decide how to preview upgrade stats without making upgrades selectable.
2. Research timing is SETTLED: T1-to-T2 20 cells/30 seconds; T2-to-T3 20 cells/60 seconds. First-playtest building upgrade durations are settled: Armoury 5 seconds, Bomber Airfield 8 seconds. Enforce Bomber's T3 prerequisite independently of its zero resource surcharge.
3. Upgrade support is SETTLED: additional resources may come from ANY open, owned, unburnt, uncommitted cells, without connectivity to the building or its original footprint. This prevents established producers being blocked from upgrades by surrounding development. New buildings still require connected support.
4. Upgrade interruption is SETTLED by the confirmed upgrade lifecycle below: unfinished cancellation allowed, retired forces not restored, discounted upgrade-support release, and combined discounted release/burn on destruction. Base-production restart is settled as a fresh full cooldown after cancellation. Retired capturer progress behavior remains to be defined. Completed upgrades cannot be reversed.
5. Reinforcement integration: quantity, visual-only travel/arrival and vanishing on target-squad destruction are settled. Do not create independently occupying reinforcement units or replacement squads from incoming members after a wipe. Still define incoming members when only their producer is destroyed, numeric travel speed and remaining cooldown/dispatch timing. Base-production restart after upgrade cancellation is a fresh full base-type cooldown; starting an upgrade retires incoming reinforcements and pauses production.
6. Combat details: each squad member has individual attack power and the whole squad is balanced together. Shared focus targeting is confirmed. Member health/hit selection, attack timing, splash footprint/member allocation/falloff/friendly fire, maximum MLRS range and new-unit stats remain open. Clarify whether fewer surviving infantry also reduce capture strength. Single-target damage to one member without spillover and splash affecting multiple members are confirmed. New reinforcement members arrive at full individual HP; surviving members retain their current HP and are not healed. Owner confirmed this rule.

## Selling and building construction

Owner requests selling buildings and introduces construction time for EVERY building as the tradeoff. This supersedes instant placement/completion. Building construction time and unit-production cooldown are separate values and systems; the slower Missile Infantry production request still stands.

Confirmed selling rules:
- Retire the building's unit/squad and incoming reinforcements with retreat/fade.
- Return the building tile to open owned territory; selling does not burn it. HQs cannot be sold.
- Release ONLY the resource tiles still tied to that building at sale time. Previously captured support tiles discount the release; do not refund the full original/upgraded cost on sale. Owner explicitly extended the same discounted release to enemy destruction. This supersedes both the full-release selling recommendation and the older full-cost destruction rule.
- Example: cost 8, with 3 support assignments lost, releases only the remaining 5 on sale OR enemy destruction. The unreleased 3 remains as match debt; do not silently clear it by deleting the building from a summed-cost ledger.

Sale duration/interruptibility and sale of an upgrading building remain unresolved. Selling unfinished construction is confirmed as cancellation under the lifecycle below. Resource costs represent capacity commitments rather than spent currency.

Confirmed construction lifecycle:
- Placement immediately reserves the building's full resource cost and blocks its hex.
- A building under construction can be attacked and produces no units.
- Completion spawns the first unit, then starts its normal production cooldown. If no legal spawn cell exists, spawning waits.
- Selling an unfinished building cancels construction, releases only its remaining assigned support cells and returns its tile to open owned territory.
- Enemy destruction during construction releases only remaining assignments and permanently burns the tile.

Owner-approved first-playtest construction durations:

| Base building | Construction time |
| --- | --- |
| Barracks | 3 seconds |
| Factory | 5 seconds |
| Artillery | 5 seconds |
| Hangar | 6 seconds |
| Airfield | 6 seconds |
| MLRS | 8 seconds |

Owner-approved conversion durations: Barracks to Armoury 5 seconds; Airfield to Bomber Airfield 8 seconds. Construction and conversion times remain separate from unit-production cooldowns. These timings are provisional for the first playtest. Confirmed construction health: a new building starts at full building HP, remains vulnerable and inactive during construction, and completing construction does not heal damage taken. Upgrading preserves current building HP and completion does not heal it. No progressive construction-health curve or upgrade healing.

## Persistent selection and right-side interface

- Player can select a hex containing a building or unit to inspect its details.
- The inspector remains on the selected entity when that unit moves away. Do not replace its details with whatever occupies the originally clicked hex; use stable entity selection rather than per-frame tile hover.
- Owner references Warcraft/StarCraft-style selection and command UI. Selecting a building exposes its upgrade options and the planned sell action.
- Move ALL building-card menus to the RIGHT PANEL, replacing the current bottom card menu.
- Exact inspector position/layout, selection after death, and narrow-phone right-panel behavior remain presentation decisions. Preserve mobile-first usability; do not treat a desktop-only layout as sufficient.

## Multiplayer direction

Private-room WebSocket multiplayer with a server-authoritative simulation is recommended, adapting Firestorm room/connection/reconnect architecture. First milestone recommendation is two humans completing a match, then FFA. Hosting and final multiplayer scope remain proposals, not deployed features.

Confirmed disconnect behavior: match continues, units retain current orders, and the player can reconnect to the same seat.

## Presentation and controls

- Welcoming procedural/vector military miniatures, distinct owner colours plus non-colour cues, responsive portrait/landscape. Generated mockup is direction only.
- Capture visibly lifts, flips and lands; state updates immediately. Respect reduced-motion preferences.
- Units stay upright and may mirror horizontally. UI indicates actual target direction; short bullet traces occur only on real firing events.
- Two taps/clicks to build: first previews the connected footprint and distinct gold hammer cell; second confirms. Keep alternate Build Here control. Invalid placement is red with an X.
- Latest committed-cell visual rule is darkened player colour, replacing the older lock-marker design.

## Prototype choices and remaining design

Current test map is 271 cells, radius 9. HQ centre gives no capacity. Capacity is provisionally capped at 200 while further land remains capturable. Exact cap meaning, full match length/map size, HQ pressure exceptions, terrain, LOS, eliminated buildings, numerical balance, splash footprint/falloff/friendly fire and member damage allocation remain open. Do not promote these test assumptions into confirmed design.

Loadout/tech/squads/upgrades are the current design milestone. Six-human networking, full Eurasia geography, full race catalogs, water mechanics, accounts and paid infrastructure are not part of the existing playable slice. No Steam/console commitment.

## Provisional defaults used for the progression playtest

To keep the next build moving without further rule-by-rule questions, these are implementation defaults for review through play:
- Six base cards are available: Barracks, Factory, Artillery, Hangar, Airfield and MLRS Works. The loadout limit remains eight unique, ready for a larger future catalog. Upgrade stats can be previewed within their base card; variants are not selectable cards. All tiers are shown.
- Regular infantry: five members, 8 HP and 2 damage each (40 squad HP, 10 full volley damage); Missile Infantry: five members, 7 HP and 4 damage each, range 1-2, move 1000 ms/hex, production 9000 ms, attack 1200 ms. Member attack clocks are synchronized on one shared target; single hits choose the first living member. Capture strength stays constant as members die.
- Bomber: total producer commitment 12, unit HP 100, damage 45, range 1-2, move 800 ms/hex, attack 2400 ms, production 16000 ms. No splash on Bombers in this slice.
- MLRS: cost 16, unit HP 80, damage 30, range 3-5, move 1500 ms/hex, attack 3000 ms, production 16000 ms. Radius-one enemy-only splash: full damage on the target hex, half on adjacent hexes, applied to every squad member in an affected hex. No friendly damage.
- Reinforcements take 250 ms per dispatch-distance hex with a 500 ms minimum. The visual follows the current squad location; arrival is scheduled at dispatch. They vanish on squad death; producer destruction alone permits already dispatched members to reach a living orphan. Upgrading/selling retires them.
- Selling is immediate, including an upgrading building, using the combined base-plus-pending-upgrade surviving support count. Retiring a capturer triggers capture rollback. Fresh production cooldown after cancelled upgrade is the base type's full interval.
- Retired forces stop gameplay immediately; a 650 ms retreat/fade is cosmetic. Inspector keeps the selected entity ID while it moves and retains its last details marked destroyed after loss. BUILD/DETAILS tabs share the right panel on narrow screens.

These numbers live in tune.json; they are not final race balance or changes to the owner's confirmed lifecycle rules.

## Delivery and verification

- Phaser 3, strict TypeScript, Vite, canvas UI and tune.json values/debug pane; no new dependencies without discussion. Existing Godot planning work remains preserved.
- Keep changes game-specific. Reuse Firestorm's pure-rules/commands/authoritative-presentation architecture lessons, without connecting to or changing its live server.
- Entry prototypes/operation-c/ and hub shortcut remain. Game-specific validation workflow; existing hub Pages publishing. Do not retarget Current WIP itch or unrelated deployments.
- Verify meaningful deterministic behavior, scoped/full TypeScript/build, Brave desktop/touch flows and inspected screenshots. Report physical-phone/performance limits honestly. Keep small automatic version stamp.
- Save implementation/results in BUILD_STATUS.md. Owner explicitly approved merging PR #410 on 2026-11-02; it is now merged and published. Future external publication follows the applicable authorization rules.
