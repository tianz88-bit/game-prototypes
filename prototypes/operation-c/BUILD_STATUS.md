## Current milestone

Operation C roster and classic RTS interface milestone, 2026-11-02. Local production playtest: http://127.0.0.1:5188/ . Branch codex/operation-c-roster-rts-ui is based on current main 134b88d. Public Pages still serves the prior progression milestone 021126r0008; the new change is in draft PR #414 (https://github.com/tianz88-bit/game-prototypes/pull/414) for playtest review and has not been published. Do not manually increment the deployment counter.

## What was implemented

A three-tier scrollable loadout catalog with separate building/unit statistics and procedural pictures, animated arrow-button upgrade previews, pinned eight-card sockets, building/unit portrait toggle, eight unique BASE-card validation and a mandatory T1 ground producer. Eleven base cards offer a meaningful eight-slot choice; upgrades remain attached to base cards. Names and roles share catalog.ts with the battlefield deck and contextual commands.

Eight new forms: Scout Buggy, Machine-gun Squad, Flak Rover, Assault Walker, Tank Destroyer, Gunship, Siege Tank and Assault Carrier. Military building names replace generic producers. Sixteen forms now use distinct procedural unit/producer art. Five permanent upgrade paths include Artillery Battery to Rocket Battery/MLRS; MLRS is no longer a selectable base card. New numerical balance is provisional; T3 production takes 24-30 seconds and each form has an exploitable weakness. Existing free Bomber conversion is preserved.

Classic RTS bottom deck on the left, contextual panel on the right half, resources top-right and technology control/progress above the battlefield. Cards enter building mode and clear entity context. First eligible terrain tap shows the hammer; second confirms. Selecting an occupied/committed/burnt hex exits building mode. Entity inspection follows stable IDs. Tapping own HQ issues Expand/defend, enemy HQ issues Attack at that HQ; the contextual HQ command repeats that action. Sell and permanent Upgrade/Cancel Upgrade remain contextual.

Infantry/missile/gunner squads capture before retaliating. Other capturing ground units capture only in Expand mode while friendly territory has no hostile units, otherwise prioritize defending against valid intruders. Flak guards home/air and does not capture. Non-neutral capture duration is 1.5x neutral. Enemy destruction burns the building immediately but holds surviving support committed for ten seconds, with per-hex clock arcs and seconds labels. Captured support during the countdown becomes stranded debt; recapture does not restore it. Selling still releases surviving assignments immediately. Existing research, construction, upgrade, squad and reinforcement lifecycle rules are retained.

## Key technical decisions

Pure fixed-step simulation and validated commands remain separate from Phaser. Pending-release records retain surviving reservations and their release deadline independently of removed buildings. No full-cost refund after support loss. Shared portrait factories serve the catalog, sockets, deck and battlefield. Cached Text setters avoid redundant rasterization/texture uploads for unchanged colour, wrapping, alignment and spacing; headings no longer switch normal/bold each frame. Scroll masks keep catalog content below the pinned header/footer; touch drag, wheel and keyboard navigation use the existing intent layer. No new dependencies, generated bitmap assets, external art downloads, backend services or deployment changes.

Verification: 56 deterministic behavior tests pass, including delayed release/capture debt, capture-first infantry under fire/attack orders, non-infantry defender priorities, all new domain restrictions and five upgrade paths. Counter tests demonstrate T1 infantry defeating an unescorted Siege Tank inside minimum range and Fighter defeating an unsupported Carrier. Full/scoped TypeScript and hub/standalone production builds pass. Brave production canvas progression passes desktop 1440x900, portrait 390x844, landscape 844x390 and small landscape 667x375 with no console/page errors. It covers sockets/toggle/tier scroll/flip previews, eight-card/T1 validation, construction, squads, stable selection, upgrade/cancel, research T2/T3, Bomber/sale, Artillery-to-MLRS, HQ orders and occupied-hex build cancellation. Screenshots were inspected and compact landscape thumbnail/text overlaps fixed. A normal-clock Brave phone recording confirms construction to a five-member squad; subsequent actual bot combat produces the ten-second support-release countdown without fixture mutation.

Artifacts are outside Git under outputs/operation-c-rts-final (four-profile screenshots) and outputs/operation-c-rts-normal (normal-clock video, squad and real-destruction screenshots).

## Open questions

Playtest new roster balance before adding more rules. New unit/conversion numbers and T3 cooldowns are provisional settings implementing the requested tier philosophy; tune.json and the debug pane expose them. Canonical rules, names, upgrade costs/timers and weaknesses are recorded in BRIEF.md. Three races, geography and multiplayer remain future milestones.

## Known issues

Local two-HQ human-versus-bot sandbox only. Physical phone performance and long-session behaviour remain unverified. Exclusive air/ground hex occupancy intentionally permits congestion. Desktop/phone emulator checks are not physical-device tests. Reduced-motion preference suppresses flips. Existing legacy hub warnings concern chunk sizes and Punchies imports; builds succeed. The local preview displays the current deployment counter because counters increment only when publishing.

## Next proposed step

Review the local roster/UI milestone and merge draft PR #414 when approved, then verify the published Pages build. Keep Current WIP itch and unrelated prototype deployments untouched.
