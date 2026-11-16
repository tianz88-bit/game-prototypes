## Current milestone

Production ship/building rig review is live in the permanent lab and itch game161126r0080. PR519 merged82868368bd6dfe5994db00a802005227cb7466bc; client43892666337 and Pages43892666498 succeeded. Permanent route: https://tianz88-bit.github.io/game-prototypes/prototypes/steroids-alpha-lab/?review=sparrow . Live game: https://daily-daily-games.itch.io/steroids-alpha .

## What was implemented

Ship / building selector offers Sparrow, Bat, Battlecruiser, Nexus, tower turrets and Falcon using production ShipView/BuildingRigs/CombatSprites. Rotation, cardinal headings, firing, palettes/clans, control-only tilt, capital deck turret count and simulation gun-origin guides support mount review. Hangar has a Rig Review entry. Nexus is the player-facing name for the former Treasury. Capital cannon lower casing now uses cobalt enamel and follows selected palettes; the forward steel barrel and alpha are retained.

The previous approved fleet release remains: free Sparrow starter, paid Falcon for everyone without a grant, blue Bat with live max315/cruise234/turn5.44, detailed capital with bridge/four forward cannons/four deck platforms. This pass changes no gameplay values, ownership, protocol, building footprints or live settings.

## Key technical decisions

Review scene is isolated from multiplayer and accounts, reads live settings once and uses shared stepShip/muzzleShot for gun origins/recoil events. It cannot grant/purchase/publish. Lab keeps Falcon draft calibration separate, hides its editor and sleeps its loop during review, reuses one frame across subjects and unmounts it on return. Same-origin parent messages accept only validated subject choices or exit. Internal treasury wire/storage names remain compatible. No new assets/dependencies or Worker deployment were needed; protocol22 remains.

Typecheck/build and396-pose/14400-point rig suite pass. Ten public BraveDPR2 desktop/mobile cases verify all five requested subjects, rotation/firing/toggle controls, no gameplay sockets, unchanged draft and clean return; no console/page errors. Local deep-link/Back, neutral rotation without FFD, four equipped capital heads and Canvas fallback pass. Source-pixel material check changes7264 casing pixels, preserves forward barrel/alpha and supports four palette variants. Public itch verifies161126r0080 and all four main cannon recoil sides[-2,-1,1,2]. Evidence outputs/steroids-alpha/rig-review/{local-result.json,public-lab-result.json,live-game.json}.

## Open questions

Owner visual review of the live rigs, gun positions and material correction. No screen captures were taken: the owner explicitly stopped screen grabbing, superseding the repository screenshot gate for this task.

## Known issues

DOM/runtime/source-pixel checks do not establish visual approval. Mobile evidence is emulation, not physical phone/Safari testing. Only Falcon retains an editable calibration in this lab; other choices are isolated production reviews. Existing unrelated bundle warnings remain.

## Next proposed step

Owner inspects the live selector and reports any rig/mount adjustments. Use current main. No local publisher, capture/recording, temporary server or QA browser remains running. Claude handoff is in original ship threade31061e9-e8e1-4105-858a-2f847541014a.
