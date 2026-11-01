# Operation C — first playable

Owner authorized implementation and a shortcut on the prototypes page on 2026-10-31. This playable is a small, local human-versus-bot systems sandbox, not the finished six-player game. Phaser 3 + strict TypeScript is used following the lightweight-browser recommendation and the owner's instruction to start the proposed core loop. The earlier Godot planning worktree remains preserved.

## Confirmed design

- Mobile-first real-time deterministic hex war game. Full game: six-player FFA, fully visible Eurasia-shaped map, last surviving HQ wins. HQ destruction eliminates its owner, removes their units and neutralizes their territory.
- Player chooses building-card loadout before play; in match they place buildings and target their own HQ (expansion/defense) or an enemy HQ (faction-wide attack). Units act autonomously.
- Three races and three card tiers are planned; expensive advanced, low-tech swarm and balanced identities were discussed. Detailed cards, tier access and composition are not specified.
- Each productive owned hex supplies one capacity. Resources display committed building cost / total capacity. Territory loss does not reduce commitment; buildings keep operating under resource deficit, but construction cannot exceed global capacity.
- New buildings also need their full cost in adjacent connected OPEN OWNED UNBURNT hexes, including their own tile. Reserve the closest connected eligible hexes. Locked supporting hexes cannot host or fund another building, or carry another building's resource connection. Neutral, enemy, burnt and locked hexes break a new placement's connection.
- Capturing a locked hex permanently removes its assignment, but never releases global commitment. Building destruction releases its FULL cost and permanently burns its own tile. Burnt hexes provide no capacity/construction/connections but allow ground movement.
- Each building maintains one unit: immediate first spawn, cooldown starts on EVERY spawn, replacement only when both cooldown complete and prior unit dead. Building loss leaves its living unit alive with no further replacements.
- One unit occupies one hex; NO shared occupancy. Buildings block movement by all unit types. Units queue and seek positions around attack targets. Range 1 means adjacent; range 2+ is rare ranged fire. Engagement resolves from hexes.
- Spawn registers on an unoccupied reachable hex, searching rings outward without a distance cap. Committed tiles eligible. Cannot jump a blockade; if no reachable free hex exists, production waits. Visually emerge from producer.
- Ground units capture, infantry most effective. Owned territory takes twice neutral capture time. Capture pauses ONLY while the unit itself is ATTACKING; taking damage without retaliating does not pause it. Paused progress is retained.
- Living HQ starts with two surrounding rings (18 hexes) and applies capture pressure there like invisible infantry, subject to enemy occupation exceptions.
- Swarm exception for later: a unit is a troop squad, missing troops can be reinforced after production cooldown, reinforcements move faster and can continue a wiped squad. Detailed member targeting/production remains open.

## First-playable scope

Small fully visible hex map, two HQs, human versus deterministic bot, five building cards demonstrating infantry/tank/artillery/helicopter/fighter roles, resource placement previews, cooldown production, autonomous expansion/attack, exclusive occupancy, queues/surrounding, capture, burnt tiles, HQ elimination, restart, touch/mouse input and scripted visual movement/combat. No production server or credentials required.

Friendly vector-authored military miniatures in an angled top-down view. Teal/coral ownership plus patterns/labels; muted committed tiles with lock markers and cracked burnt tiles. Static terrain can be cached; dynamic feedback is scripted geometry. The generated mockup is direction only, not a fidelity requirement. Portrait and landscape must remain usable.

## Owner playtest feedback — 2026-11-01

- Captured tiles must visibly lift, flip and land when ownership changes. This is cosmetic; capture and resource state update immediately. Respect reduced-motion preferences.
- All unit bodies stay upright in this 2D presentation. A separate UI ring chevron indicates the actual attack target direction; movement or firing must not rotate the entire miniature.
- Follow-up: make the lift/full-turn/landing unmistakable in Brave; bodies may mirror horizontally for X-facing, with UI direction cues unmirrored. Short bullet lines must correspond to actual weapon fire.
- Committed hexes use muted inset shading and a small lock. Preserve ownership colour and distinguish them from open and burnt tiles.
- Preserve two-tap/click construction. The selected confirmation tile has a distinct gold rim and hammer; supporting hexes remain subdued. Invalid placement uses red and an X.
- Barracks cost increases from 4 to 8 resources for this playtest. All other gameplay tuning stays unchanged.
- A proposed shared placement cooldown is explicitly deferred. Do not add a new construction/expansion timer yet; first assess the cost increase on its own. Existing per-building unit-production cooldown remains unchanged.

All new numeric balance/movement/capture/bot values are provisional and belong in tune.json. Existing Firestorm values must not be changed. Reuse its architecture lessons (pure rules separate from presentation, explicit commands, deterministic time) rather than pretending its node/march rules implement this new occupancy game.

## Combined-arms playtest feedback — 2026-11-01

This iteration supersedes earlier sample-card costs and all-ground-only assumptions.

- Barracks costs 4, Factory 8, Artillery 8, Hangar 12. Airfield costs 12. No shared construction cooldown.
- When a capturing unit dies, its incomplete capture reverses slowly toward the original controller. Ownership remains with that controller until capture completes; rollback is a progress change, not an ownership flip. Exact rollback speed is provisional tuning.
- Artillery remains frail, fires only at ground targets at range 2 through 3, and retreats when attacked. It cannot shoot adjacent enemies and benefits from a screening unit.
- Tanks attack ground only. Infantry attacks ground and air.
- Hangar produces one helicopter: air-to-ground only, cannot capture. Airfield produces one fighter: air-to-air only, cannot capture or attack buildings. Existing one-living-unit and production-cooldown rules apply to both.
- Aircraft in Expand mode prioritize nearest valid intruders in owned territory; without one they defend home. In Attack mode they travel toward the selected enemy HQ and seek targets their weapons can attack.
- Ground expansion prioritizes reachable neutral land by distance/ring from its own HQ before advancing into enemy territory, rather than extending a distant capture trail. Deterministic pathing and exclusive occupancy remain required.
- Owner confirmed Airfield 12 and one shared occupancy slot for ground units, aircraft and buildings. Aircraft cannot share registered hexes, bypass a full occupied blockade, or overlap movement reservations. Test this constraint before revisiting it.

## Delivery and acceptance

- Entry at prototypes/operation-c/ with hub shortcut labelled local prototype / bot sandbox.
- Isolated Operation C Vite build and path-filtered validation workflow; existing hub Pages publishing supplies the requested shortcut. Do not retarget the Current WIP itch slot or deploy Firestorm's itch/Worker targets.
- Deterministic behavior tests for economy, capture, production and occupancy; scoped and repository typecheck/build; Brave desktop and touch smoke captures inspected and console clean. Report any pre-existing repo failures separately.
- Show small build stamp. Debug tuning via ?debug=1. No generated art/build binaries/secrets committed. BUILD_STATUS.md records actual results and limitations.

## Out of scope and open design

No six-human networking, private R2 pack, full Eurasia geography, complete three-race/tier/loadout system, swarm reinforcements, water mechanics, accounts or paid services in this slice. No Steam/console promises.

The meaning of the owner's '200 resource cap' (capacity vs committed cost), full match duration/map size, exact HQ recapture exceptions, simultaneous movement conflict tie-breaks, terrain effects and eliminated buildings need later decisions. Use small documented deterministic provisional rules to exercise this slice; do not represent them as owner-confirmed full-game decisions.
