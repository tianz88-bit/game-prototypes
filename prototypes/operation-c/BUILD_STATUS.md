## Current milestone

Owner playtest feedback iteration, 2026-11-01: visible capture flips, upright units with actual attack-direction UI, and Barracks cost 8. The live entry remains https://zitian-ff.github.io/game-prototypes/prototypes/operation-c/ with its existing hub shortcut. Publication of this iteration follows its game-specific PR validation.

## What was implemented

Capture ownership transitions now use a cosmetic lift, edge-on flip, owner-face change and squash/landing. Flipping tiles temporarily leave the cached terrain layer, render in a reusable dynamic Graphics layer, and return to the cache when finished. Capture/resources change immediately; animation does not delay simulation. Reduced-motion preferences suppress flips.

Infantry, tank and artillery bodies no longer rotate with movement or attack direction. Attacking units use an external ring wedge and directional firing trace, driven by the actual selected target hex reported by the simulation. Idle infantry no longer walk in place. Barracks resource cost increases from 4 to 8; every other gameplay tuning number is unchanged. No global placement cooldown was added, as the owner chose cost-only testing.

## Key technical decisions

Keep presentation timing independent of authoritative fixed-step rules. Real-time flip state is bounded by visible changed tiles and cleaned after completion/reset; no per-capture GameObjects or tweens are allocated. A derived attackTargetHexId supplies presentation metadata throughout weapon reload and clears when not attacking. It does not change target selection or combat/capture rules. Presentation duration/lift live in tune.json and the debug pane.

## Open questions

Assess whether the cost increase alone sufficiently slows initial expansion before discussing a separate construction timer. Other full-game design questions remain in BRIEF.md: 200-cap meaning, HQ capture exceptions, races/tiers/loadouts, swarm reinforcement details, Eurasia topology and match duration. These are outside this feedback iteration.

## Known issues

Still the two-HQ local bot sandbox, not six-player multiplayer or the final map/factions. Physical phones and long-session balance remain unverified. Existing full-game provisional rules are documented in README.md. Operating-system reduced motion intentionally suppresses the tile flip. The legacy hub publishing workflow retains its existing multi-game build; the Operation C validation workflow remains game-scoped.

## Next proposed step

Complete the game-specific PR/Pages publication, verify real capture flips and updated cost in the live game, then ask the owner to playtest opening expansion again. No new pacing timer should be added without that discussion.

Verification so far: 17 simulation behavior tests and full/scoped TypeScript checks pass; standalone and hub production builds pass. Brave checks pass desktop 1440x900, phone portrait 390x844 and landscape 844x390/667x375. Desktop and phone screenshots observe a real capture flip through landing and confirm owner state remains authoritative. Screenshots inspected; actual-attack indicator state is covered by regression tests. Production-bundle, GitHub CI and live checks follow before delivery.
