## Current milestone

Owner approved the grounded-building and capital-v3 release on17November. R2 upload and public ZIP/10part hash verification are complete. Integrating mainebb8a2b (PR521/522/523) and running final checks before coordinated client/Worker release. Previous public prototype counter83; final version will be verified after deployment.

Main PR523 playable Warzone and protocol23 are also preserved.


## What was implemented

Nexus/tower layers have muted cylinder supports. Independent Crimson/Azure architecture materials replace the ship palette remapper. Contact shadow remains exactly at the foundation; a directional cast extrudes the footprint away from the sun through the same ground projection. Tower head/barrels are lifted60/62 for visible support. Terrain camera is planet-fixed travel; spin still changes sunlight, so fixed objects stay attached to the same texels while travel continues scrolling the ground. No independent sun cycle.

Battlecruiser-v3 has a transparent forked centre channel, two flush forward gun sprites per side, no forward round glass/lens modules, and stronger calibrated facing offsets. Bridge and four turret platforms remain.22 modules/10 source textures. Fixed Z,3% shading, vibration, recoil and control-only per-part FFD/fallback retained. Main sim origins move to forward81.07/right±38.7/±55.8; other game stats/equipment/shield/footprints are unchanged.

## Key technical decisions

BuildingRigPose.projectGround projects shadow footprint vertices from a common root. Procedural column textures are shared by clan, and all view-owned columns/cast graphics hide/destroy with the existing lifecycle. Bounded convex hulls avoid multiple overlapping shadow fills. Material ramps preserve alpha/neutral linework. Planet rotation changes sun-relative longitude without injecting a second surface scroll.

Built-in imagegen edits only chassis/armour cells from the approved parts sheet; other retained PNGs are byte-identical copies. Workspace sources/prompt/ZIP are documented in art/battlecruiser-v3/README.md. New ZIP SHA isbc03dc5acab672424b5dffa23918500e3cba72c288e66b03b3085a0fd37af80a. Owner-approved R2 object is uploaded and publicly re-fetched with matching ZIP/10part hashes. Evidence: outputs/steroids-alpha/grounded-capital-review/r2-verification.json.

Typecheck/build/sim/live-config/rig suites pass. New regression covers18 projected sun/root cases, clan materials, flush paired mounts and stronger cardinal depth. Eight headless desktop/mobile flight fixtures cover all7 buildings across four spins: column endpoints and contact shadows stay at the correct roots. Ten lab interaction cases pass with no console/page errors; bow-channel alpha is transparent. Source-alpha occlusion checks confirm each new connector exposes steel. Evidence outputs/steroids-alpha/grounded-capital-review/{flight-grounding.json,result.json}. Fixtures disconnect before staging render state; no altered stats are sent to the server. No screenshots or recordings were taken.

## Open questions

No unresolved art approval. Owner approved release. Browser-only upload succeeded using the expanded Files choice; native picker input was not needed. No new permission/credential, screenshot or recording.

## Known issues

New art public readback is verified; coordinated deployment and public runtime checks are pending. Mobile evidence is emulation; source-alpha/runtime checks are not owner visual approval. Existing unrelated bundle warnings remain.

## Next proposed step

Complete post-integration checks, publish client+Worker, verify public building anchors and capital guns, then send Claude final run/version links. Preserve main Sparrow6shots/s/90%capacity, siege110/750/1100, bot spill collection and larger repair pods. No resident publisher/capture runs.
