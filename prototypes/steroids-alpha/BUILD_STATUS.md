## Current milestone

Protruding crystal revision ready for direct release on codex/steroids-rich-crystals. R2 v2 art pack/all15 source hashes verified. Existing gold-vein release171126r0087 preserved; deployment pending.

## What was implemented

Added chunky painted gold crystal outcrops to all15 rich asteroid variants, retaining existing veins,3 rock families and sibling shapes. Parent rocks have2 groups; medium/small fragments1 clear cluster, proportionally largest on small fragments. Crystals extend beyond the old silhouette with dark attached roots and pale faceted tips; no glow/ring placeholder replaces them.

## Key technical decisions

Master sprites use padded canvases/bodyOffset metadata. All original body opacity remains covered; new silhouette adds4–26% (small15–26%). Runtime derives decorative texture registration from the original plain-rock body frame, preserving centre, world scale and inscribed collision coverage. New crystals share existing curved mesh/Canvas pooling, damage stages and lighting. Hash-query asset URLs prevent old v1 image cache/registration mismatches. No sim/tune/HP/reward/spawn/wire changes.

R2 steroids-alpha_rich-asteroids-v2_assets.zip:4,956,322bytes, SHA4df28e3e4f3bbac1db3ac57f5213df74e3f2bfd42f332cd45e18fb63f66f20ab; exactZIP/all15 source hashes verified publicly. Sources/outcrop sheet/composite/QA under outputs/steroids-alpha/rich-crystal-art; no binaries committed. Typecheck/build/rig and9 registration-transform cases pass;15 body-preservation/protrusion checks and180 Brave desktop/mobile damage/day-night runtime cases pass with zero page/console errors. Runtime original-body anchors/coverage equal normal rocks. Sockets close before local render fixture edits; no test stats sent. No screenshots/recordings.

## Open questions

None for this readability refinement; preceding direct-publication preference retained.

## Known issues

Physical-phone/Safari appearance not checked; headless Brave mobile emulation only. Existing unrelated build warnings remain.

## Next proposed step

Deploy revision, verify public version88/all15 decorated variants and body registration, update Claude and stop Vite4187. No resident publisher/capture service.
