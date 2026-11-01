# Operation C permanent design reference

Last reconciled: 2026-11-02, Asia/Singapore. This is the canonical design reference for main, logic and art discussions. Check it before re-asking an answered question. Update the relevant section when a decision changes; keep proposals distinct from confirmed rules. BUILD_STATUS.md records implementation and verification, not design authority. Git history preserves superseded decisions.

## Design versus implementation

The current Phaser 3 / strict TypeScript preview is a two-HQ human-versus-bot sandbox with five producers. It implements the core territory/economy, exclusive occupancy, capture rollback and ground/air roles. Loadout selection, technology progression, infantry members/reinforcements, Missile Infantry, Bombers, MLRS, building upgrades/selling/construction time and the persistent selection/right-panel interface are design work; they are not implemented in the preview. Multiplayer follows this design milestone.

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
- Destroyed production buildings release their full committed cost and permanently burn their own hex. Burnt cells give no resources, building space or support connectivity, but remain traversable. The building's living unit survives without replacements.
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

- Non-squad producer: immediate first unit; production cooldown starts on every spawn. Replacement requires both the previous unit to be dead and cooldown to be complete. This prevents repeated defensive spawning.
- Both regular and Missile Infantry are squads of 5. Each living member contributes 20 percent of full squad attack power. Casualties reduce damage. Owner requests weaker health; exact member/squad health and damage allocation remain open.
- Reinforcement rule already discussed and retained: missing squad members can be reinforced after the producer's production cooldown. Reinforcements travel faster and can continue a squad even if it was wiped before they arrive. Do not re-ask whether squads can reinforce or require complete death before replacement.
- The earlier swarm/squad reinforcement rule now informs both infantry types, following the owner's reminder to retain the prior decision. Exact dispatch quantities, member targeting and travel/reservation details still need specification.
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
- T2 to T3 research cost/time remains unspecified. The UI control does not by itself establish a destructible HQ-upgrade mechanic.

## Building upgrades and timed conversions

All building upgrades are PERMANENT and ONE-WAY, including Airfield to Bomber Airfield. No downgrade or switch back. Additional upgrade resources remain committed for the upgraded building's lifetime. Costs vary by upgrade; do not generalize the Barracks surcharge to all producers.

- Barracks to Barracks+/Armoury: permanently add 2 resource cells, for total commitment 6. Requires an upgrade timer. New production is Missile Infantry instead of regular infantry. Missile Infantry remains a T1 role.
- Airfield to Airfield+/Bomber Airfield: explore a FREE permanent upgrade with a conversion timer, not a +2 surcharge. No extra resource commitment; the existing Airfield commitment of 12 remains. Fighter is T2, Bomber T3. Cannot switch back to Fighters.
- Latest timing supersedes the earlier delete-at-completion proposal: when the player starts upgrading/converting the building, its previous unit or squad retreats briefly and fades from the map. The lost field presence is an additional upgrade penalty. Do not retain the old unit until upgrade completion.
- Earlier new-unit-on-completion intent remains: upgraded production becomes available when the timer finishes, subject to legal spawn occupancy. Exact cooldown interaction needs specification.

Recommended simulation/presentation interpretation, not separately confirmed: retire the old unit from combat/capture/occupancy immediately on accepted conversion; play retreat/fade as a cosmetic visual. Pause production/reinforcements during conversion and spawn the new type on completion. This avoids a retreating visual continuing to affect gameplay.

Remaining decisions: timer lengths, support connectivity for Barracks' added 2, cancellation/interruption during an unfinished upgrade, in-flight reinforcements, production/cooldown timing and upgrade prerequisites. Base-only loadouts and building-selected upgrade options are confirmed; upgraded variants are not loadout cards. Airfield's zero-surcharge conversion is under exploration, not a universal upgrade-cost rule; permanent one-way behavior is confirmed. No gameplay implementation until the relevant rules are settled.

## Design review pending decisions

Reviewed 2026-11-02. Permanence is settled and must not be re-asked. These are remaining implementation decisions, not changes to confirmed rules:

1. Base-only loadout eligibility is SETTLED: upgrades are building-selected options, not loadout cards. Show base cards with their tier/stats; decide how to preview upgrade stats without making upgrades selectable.
2. Technology gates and timing: define T2-to-T3 resource/time cost, building upgrade durations, and enforce Bomber's T3 prerequisite independently of its zero resource surcharge.
3. Additional support: define whether Barracks' added 2 cells must connect to the building or its existing support footprint. Research explicitly has no connectivity requirement; do not silently apply that exception to building upgrades.
4. Upgrade interruption: define cancellation of an unfinished upgrade, refund of any added commitment, destruction during conversion, and the handling of the retired unit's capture progress. Completed upgrades cannot be reversed.
5. Reinforcement integration: define dispatch count per cooldown, merge/arrival behavior while the target squad occupies its hex, blocked routes, detached/in-flight members when a producer upgrades or is destroyed, and cooldown interaction with conversion. Reinforcement itself is already confirmed.
6. Combat details: member health/damage allocation and splash footprint, falloff, friendly fire, maximum MLRS range and provisional new-unit stats. Clarify whether fewer surviving infantry also reduce capture strength.

## Selling and building construction

Owner requests selling buildings and introduces construction time for EVERY building as the tradeoff. This supersedes instant placement/completion. Building construction time and unit-production cooldown are separate values and systems; the slower Missile Infantry production request still stands.

Selling is accepted as a new design direction, but its exact rules remain unresolved: treatment of the produced unit/squad and in-flight reinforcements; whether the sold tile becomes open or burnt; sale duration/interruptibility; whether HQs are excluded; sale of an unfinished/upgrading building; and release of the building's total committed cost. Resource costs represent capacity commitments rather than spent currency, so define release of commitment rather than an unrelated cash refund.

Construction still needs start/completion rules: when commitment is reserved; when the building begins blocking a hex; vulnerability/health while building; first spawn and production cooldown timing; interruption/cancellation/destruction outcomes; and numerical build times. Do not silently implement defaults.

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

## Delivery and verification

- Phaser 3, strict TypeScript, Vite, canvas UI and tune.json values/debug pane; no new dependencies without discussion. Existing Godot planning work remains preserved.
- Keep changes game-specific. Reuse Firestorm's pure-rules/commands/authoritative-presentation architecture lessons, without connecting to or changing its live server.
- Entry prototypes/operation-c/ and hub shortcut remain. Game-specific validation workflow; existing hub Pages publishing. Do not retarget Current WIP itch or unrelated deployments.
- Verify meaningful deterministic behavior, scoped/full TypeScript/build, Brave desktop/touch flows and inspected screenshots. Report physical-phone/performance limits honestly. Keep small automatic version stamp.
- Save implementation/results in BUILD_STATUS.md. Do not merge/publish pending PR #410 without explicit owner approval following the existing approval-review rejection.
