## Current milestone

Protruding crystal rich-asteroid art is LIVE in171126r0088. PR531 merged586c12958c580f4ef8b5cedbaa9c41bd6c6f836b. Itch44012011364 and Pages44012011412 succeeded. Existing Worker protocol24 healthy. Game: https://daily-daily-games.itch.io/steroids-alpha . Continued owner's direct-publication preference for this readability refinement.

## What was implemented

Chunky painted gold crystal outcrops on all15 rich asteroid variants, retaining existing gold veins,3 colour families and sibling split shapes. Parents have2 groups; medium/small fragments1 clear cluster, proportionally largest on small fragments. Crystal tips extend beyond rock silhouettes with attached dark roots, broad gold planes and pale facets. Ordinary rocks and prior Warzone updates retained.

## Key technical decisions

Sprites use padded canvases with bodyOffset metadata; all original body opacity remains covered. Added silhouette ranges about4–26% (small15–26%). RockBodyFrame records the original plain-rock body. decoratedRockFrame registers the enlarged texture against that SAME body, so physical centre, world scale and inscribed collision coverage remain unchanged. Existing pooled mesh/Canvas transforms, damage stages and lighting render the crystals. Hash-query asset URLs prevent cached old images being read with the new registration. No sim/tune/HP/reward/spawn/wire changes.

R2 steroids-alpha_rich-asteroids-v2_assets.zip:4,956,322bytes, SHA4df28e3e4f3bbac1db3ac57f5213df74e3f2bfd42f332cd45e18fb63f66f20ab. Exact public ZIP/all15 sources verified; binaries outside Git. Manifest/prompt in art/rich-asteroids-v1 identifies active v2. Source pieces, composed sheet and evidence under outputs/steroids-alpha/rich-crystal-art/.

Typecheck/build/rig and9 registration-transform cases pass;15 preserved-body/protrusion checks and180 local plus180 public Brave DPR2 desktop/mobile cases cover15 variants ×3 damage states ×2 light levels ×2 device layouts. Public original-body anchors/coverage equal normal rocks, new decorative extents can grow, with zero page/console errors. Real beta-room sockets close before local-only fixture edits; no test stats sent. Public client confirms version88, prepared body-registration fields, prior Warzone skin and Worker protocol24. Evidence: {asset-check,r2-verification,runtime-check,live-game,public-runtime-check}.json in the output folder. No screenshots/recordings.

## Open questions

None for this shipped readability refinement.

## Known issues

Physical-phone/Safari appearance not checked; headless Brave mobile emulation only. Existing unrelated build warnings remain.

## Next proposed step

Collect live feedback before further art/tuning. Claude receives PR/run/asset/public-body-check proof in Agent Comms threade31061e9-e8e1-4105-858a-2f847541014a. Temporary Vite4187 stopped after release; no resident publisher/capture service.
