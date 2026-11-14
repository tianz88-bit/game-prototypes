# Integration status — 14 November 2026

This kit-only branch carries the source library without the older branch's prototype BUILD_STATUS/HANDOFF rewrites. It is not a new deployment. Do not merge the obsolete documentation snapshots from codex/steroids-ships-v2-handoff over newer main entries.

Claude integrated the ship assets/profiles/identity/evolution/palettes in PR467, merged ab8f39d22bb5ffa64d7653821fb46bd8ed4358d3. Independently checked: PR state MERGED, client workflow43592595865 successful, Worker43592595936 successful. Claude separately verified restore/kit tests in message1cf72a3e and reported integration/local interaction checks in91ebedb9. Real-phone capital performance remains unverified.

The figures in footprint-proposals.json remain historical proposals; current production tune.json and server-issued live configuration are authoritative. Claude reports owner authorization for educated trial values, capital dash/warp and tint migration. No gameplay numbers were changed by this kit-only branch. The earlier ART_HANDOFF.md's undecided/local-only sections are historical and superseded by live integration; keep their projection/rig constraints and rejected-art warnings.

## Direct renderer inspection at main4844bb2

- shipProfiles.ts carries the reviewed interceptor/capital module anchors and separate calibration data. Capital outer cannons use event sides-2/+2. ShipView retains fixed order, layer shading, engine vibration and per-cannon recoilScale.
- shipArt.ts loads all three source sets, trims with alpha>12, makes palette textures lazily and builds separate ship shadows. The asset hook checks complete ZIP and part hashes.
- Control-driven FFD is still explicitly unported in ShipView. The source-kit FFD exists here and in the labs; passing base-pose parity does not prove the live renderer includes it.
- Hosted calibration schema is still a single starter calibration; shipArt.CALIBRATION aliases profile0. Interceptor/capital calibration is static JSON. The previously proposed per-chassis live calibration map is not yet implemented.

## Remaining art-lane work

From91ebedb9: evolution transform effect; capital name-tag placement; Hangar ship icons and EVOLVE card styling; escort appearance (currently existing turret-drone rendering).

From2ff99430 / GFX_BRIEF: orbital entry/exit zoom (replaces cloud transition), salvage coins, hot-zone ring/arrow and SALVAGE styling. These remain pending and are not completed by publishing the kit.

Current main also records forgiving-shield placeholders (shatter ring, red cooldown HUD and possible on-ship shield-down cue). Retain Claude's authoritative shield/cooldown logic when polishing these visuals.

Claude asked for the repaired two-client screenshot harness to be run on this GPU PC. That check is tracked in the sync ledger; its actual result is reported through the original Agent Comms thread rather than assumed from the container run.
