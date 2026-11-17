## Current milestone

Mineral-rich asteroids (17 November, claude): rare golden rocks by the hot zone pay 3x minerals, 2x health; protocol 24.

Approved Battlecruiser and grounded-building updates are live. Itch version: 161126r0084. PR524 merged at eb17e0b12ebd6e6b5f66e7eb16332d1df5f06d26. Client43908175540, Worker43908175298 and Pages43908175290 all succeeded. Public Worker health reports protocol23. Game: https://daily-daily-games.itch.io/steroids-alpha . Lab: https://tianz88-bit.github.io/game-prototypes/prototypes/steroids-alpha-lab/?review=battlecruiser .

## What was implemented

Nexus and tower layers connect with muted cylindrical supports and use independent clan material ramps. Foundations share the planet-fixed terrain coordinates. Contact shadows stay exactly at their roots; directional footprint shadows extend away from the sun through the same ground projection. Tower head/barrel lift is60/62. Planet spin still drives sunlight; travel still scrolls the ground. Idle rotation no longer slides terrain under buildings.

Battlecruiser-v3 has a transparent forked centre channel, two flush main guns on each side, no forward round glass details and stronger directional layer offsets. Bridge/four turret platforms remain:22 modules and10 source textures. Fixed Z,3% shading, vibration, recoil and control-only per-part FFD/fallback remain. Main cannon origins are forward81.07,right±38.7/±55.8. Other stats, shields, equipment and building footprints are unchanged by this pass.

## Key technical decisions

BuildingRigPose.projectGround projects cast-shadow vertices from the shared foundation. Column textures are cached per clan; column/cast objects participate in existing hide/destroy lifecycle. A bounded convex hull avoids overlapping shadow fills. Building colours are independent of pilot palettes. PlanetFrame.camera uses travel only; sun longitude uses travel plus planet rotation.

Exact R2 ZIP and all10 part hashes verified publicly before merge: bc03dc5acab672424b5dffa23918500e3cba72c288e66b03b3085a0fd37af80a. No PNG/ZIP in Git. Existing rig CI entry point runs the new building/mount regression; workflow files and access scopes were not changed. Main PR521/522/523 Sparrow6shots/s/90%capacity, siege/bot/pod changes and playable Warzone/protocol23 were preserved. Sparrow hangar ammo caption now derives from tuning.

Typecheck/build, sim/live-config/rig and building suites pass. New regression covers18 sun/root/material/mount cases. Public headless desktop/mobile flight fixtures check all7 building roots, column endpoints and contact shadows across four spins (8 cases). Public lab checks all five requested models/rotation/firing/return (10 cases). Public itch verifies version84, the22-module v3 profile and all four cannon recoil sides. No console/page errors, screenshots or recordings. Evidence: outputs/steroids-alpha/grounded-capital-review/{r2-verification.json,live-game.json,public-flight-grounding.json,public-lab-result.json}. Render fixtures disconnect before staging state; altered fixture stats never reach a server.

## Open questions

None for this approved release. Claude's further Warzone damage/shield/Nexus-health/globe art request is a follow-up, not part of this release.

## Known issues

Mobile evidence is browser emulation, not a physical phone/Safari test. Data/source-alpha checks do not replace the owner's visual approval; the owner approved the interactive preview. Existing unrelated bundle warnings remain.

## Next proposed step

Playtest the public build and collect owner feedback before more tuning. Claude receives final PR/run/public-proof details in Agent Comms threade31061e9-e8e1-4105-858a-2f847541014a. Temporary local preview is stopped after release; no private publisher or capture/recording service runs.
