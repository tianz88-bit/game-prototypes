## Current milestone

Bat/capital revision is ready for local art review on codex/steroids-sparrow-falcon-bat, on top of the tested Sparrow/Falcon/Bat work. Nothing pushed, merged or deployed. Live remains161126r0076. Evidence: outputs/steroids-alpha/fleet-revision-review/fleet-overview.png, capital-rotation.png, bat-palettes.png, desktop/mobile-hangar.png, result.json and flight-result.json.

## What was implemented

Bat main cowling casing is cobalt blue with ivory caps; other seven source textures and its calibration are unchanged. Hull palette choices recolour it as primary material. Requested handling first pass: speedFactor0.9, turnFactor1.7 (base315 top speed versus Falcon350;70% faster turning than Falcon). Acceleration, shield, damage and weapons remain unchanged.

Battlecruiser parts gain readable hardlines, service hatches, vents, rivets and edge marks on the existing silhouettes. Separate framed bridge housing/glass, four long forward cannons, four parented octagonal deck platforms, and four independently aimed painted turret-head instances. Default two turrets are shown; upgrades can populate four slots. Heads use authoritative count/aim/fired times, recoil and square muzzle glints; no independent drone bob or ground effects. Shield emitters move inward to clear the deck. Fixed Z, facing-offset interpolation,3% depth shading, engine vibration, control-only per-part FFD, hard shadow and whole-ship hover light remain.

Prior review retained: Sparrow is free starter with centre gun,5shots/s,12-shot cold burst versus Falcon15, bounded3degree launch drift and same base mobility/defence/damage. Falcon and Bat preserve old stable ownership IDs. Everyone must unlock Falcon, including old accounts; no grandfathered grant or migration.

## Key technical decisions

Capital turret origins now sit on deck: right±36, rear forward−9/front25.2. Main gun mounts, two built-in/up-to-four turret counts, damage, targeting and upgrade/evolve rules are unchanged. Optional DrawnShip/ShipView.setTurrets observes existing state; procedural escort fallback remains when painted head assets are unavailable. Capital profile has24 modules/11 textures; twice the fighter texture budget, capped512px per part, keeps larger panels readable. No new dependencies or wire-layout changes; existing review protocol22 still requires coordinated client/Worker deployment.

New Bat-v3 ZIP SHA58b070354160f08fd756f29cae660db51bab6ce4be94583715515a71c47bcf6d and capital-v2 SHA740376005397599597e08edcf667fa0ade23e8a8bf0330afdf990f43b8e70867 are only in local review/cache. Sparrow pack remains local too. New R2 objects have not been uploaded; verify uploaded bytes before merging. Source PNGs/ZIPs are outside Git. Prompt/source notes in art/bat-v3/README.md and art/battlecruiser-v2/README.md. Future release must publish the two requested Bat values into hosted settings without replacing other owner tuning.

Typecheck/build/sim/bank/live-config/rig suites pass. Added handling and deck-position tests; original four-cannon/evolution regressions pass. Brave DPR2 desktop/mobile captures use actual ShipView.24 parts,4 platforms,0/2/4 visible heads, independent heading, centre/main recoil, neutral rotation and24 control-driven FFD meshes checked. Actual FlightScene render fixtures pass in WebGL and Canvas, correctly replacing the capital escort drawing and changing equipped count;5 rebuilds reuse150textures. No page/console errors. Frame comparison was~32FPS in both capital and Falcon in the same local emulation; not a60FPS or physical-phone claim. Temporary services and isolated browsers closed.

## Open questions

Art and initial Bat handling values await review. No unresolved Falcon ownership decision. User requested these edits, not a live release.

## Known issues

All new art packs are local pending review/upload. Mobile browser emulation is not physical phone/Safari evidence. Capital FlightScene/equipment comparisons stage isolated presentation fixtures after closing networking; no fixture stats are sent to the server. Headless sim/bank suites cover gameplay authority separately. Existing bundle warnings remain.

## Next proposed step

Owner reviews updated Bat, bridge/cannons/platforms and handling. After approval: upload and re-fetch all three review packs, publish requested Bat live tuning, coordinate client+Worker release and verify public selection, handling, cannon fire and mounted turrets. Claude handoff stays in threade31061e9-e8e1-4105-858a-2f847541014a.
