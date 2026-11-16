## Current milestone

Sparrow/Falcon/Bat review implemented locally on codex/steroids-sparrow-falcon-bat from main6840cf8. Not merged or deployed. Live remains161126r0076. Review outputs: outputs/steroids-alpha/sparrow-review/fighter-comparison.png, sparrow-rotation.png, desktop/mobile hangar and flight screenshots.

## What was implemented

Sparrow is the free starter: new8-source/11-module top-down Human Nomad rig, one central recoiling gun, existing engine vibration, fixed layer order,3% depth shading, hover light/dynamic shadow and control-only per-part FFD with original sprite fallback. Scrappy display name becomes Falcon; Interceptor becomes Bat. Old IDs/chassis0/1 preserved; new Sparrow is3. Hangar now fits four cards and identifies centre gun/ammo versus twin-gun sidegrade. Invalid/locked saved choices display and fly Sparrow.

Sparrow shares Falcon base mobility/defence/damage, fires5shots/s versus Falcon7.5 combined /3.75 per barrel, and holds80% cold-to-overheat shots including cooling, rounded to whole shots at each gun tier. Base12 versus15; higher tiers17/21,22/28,32/40,48/60. Shared deterministic +/-3degree launch drift after assist weakens distant shots. Normal recovery states/animations remain. Exact-cap heat is snapped within1e-10 to prevent floating-point bonus rounds.

## Key technical decisions

Protocol22 supports chassis3 and centre recoil side0 using the same103-byte snapshot and signed shot-side field; publish client and Worker together after review. Added bounded sparrow tuning group; old hosted settings upgrade to bundled Sparrow defaults without replacing existing owner values. Server checks account ownership before initial ship selection. New Sparrow source ZIP is only local in the review folder and content-hash cache; do not merge its R2 manifest until the exact ZIP has been uploaded/re-fetched and verified. No PNG/ZIP committed. Existing siege work preserved.

Typecheck/build, sim, bank, live-config and original rig/FFD suites pass. Added burst/cadence/stats/centre muzzle/drift/wire tests, invalid Sparrow config tests, locked Falcon rejection, real purchase/duplicate protection and owned selection. Existing twin-gun fixtures explicitly use Falcon. Brave DPR2 desktop1280x720/mobile844x390 local Worker spawns/connects/fires with Sparrow; actual native phone touch fire passes. Custom review captures use actual ShipView with11 parts, centre kick/stretch and11 control-driven meshes; ordinary rotation stays level. Canvas fallback renders all11 sprites with0meshes. No page/console errors in successful checks. result.json and canvas-result.json record evidence. Temporary test servers stopped at session end.

## Open questions

Owner confirmed 80% means shots before overheating and everyone must unlock Falcon, including existing players. BRIEF.md records both decisions. No grandfathered grant or account migration is needed. Art remains in review.

## Known issues

This is local review, not live. New R2 object not uploaded; cache contains reviewed ZIP335ecb6d8cc835151fff480f251f54014785eff6ec52b82b68d6a2104494b913. CLI Brave phone emulation is not physical phone/Safari evidence. Existing build bundle warnings remain. Browser firing proof uses normal input; large art/FFD comparison scenes are isolated presentation fixtures, not authority/economy tests.

## Next proposed step

Owner reviews Sparrow design. After art approval, upload/re-fetch the new art ZIP, publish client+Worker together and verify public spawn/selection/firing. Falcon requires the existing ship-slot unlock purchase for all players; no grant migration. Claude receives exact contract and review gate in Agent Comms threade31061e9-e8e1-4105-858a-2f847541014a.
