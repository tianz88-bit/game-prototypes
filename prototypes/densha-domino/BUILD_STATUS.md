## Current milestone
Approved sushi art and motion pass implemented and locally verified; release 3 publication in progress on the permanent sushi branch.

## What was implemented
- Regenerated ivory/mint restaurant pillar blockers on existing concrete cells; removed background ghost columns. Added flush ivory/plum caps at obstacle-ended recessed channels, keeping exits/crossings open.
- Cached warm-plum train silhouettes, plates +15%, food +20%, retaining expressive two-eyed cabs, stripe and socket-registered light bands.
- Independent 480 ms food spring, plate-anchored and delayed 100 ms per carriage. End-of-move body reset no longer cuts the food envelope. Bodies stay grounded.
- Staged Quad star arrival/controlled overshoot/settle, ascending landing chimes, third-star hold then bounded confetti. Grey slots remain still; buttons and panels have shorter controlled motion. Existing travelSpeed=0.67 retained.

## Key technical decisions
- Rules, level data, head direction, saves and tunnel art/occlusion geometry unchanged. All 100 exact pars, chain/finale contracts, fixed-head/manual-reverse/blocked and generator checks pass.
- Typecheck and production build pass. Actual Brave gameplay verifies 120 expressive eye frames, 16 registered socket frames, manual reverse, restored head signal and level 5's three-tap/six-train chain. Captures inspected under Gamedev/outputs/densha-approved-pass.
- Four-direction exit audit passes all 17 real cases across one- through five-car trains: every carriage fully under cover and offscreen before disposal, no early culling, no root jumps, zero measured cover leakage.
- Food sampling measures 0.838 minimum and 1.124 maximum scale, with independent carriage timing and no console errors.
- Local GPU benchmark: 59.95 fps blank/idle/chain, p95 frame CPU 2.9 ms idle and 2.5 ms chain. Dense board uses five batched draws; chain about four. No per-car shader/postFX.
- Art stays outside Git and ships in a checksummed versioned build artifact. Pages pin is the only required main-branch change; original Claude source stays isolated.

## Open questions
None required for this approved pass.

## Known issues
Physical-phone GPU performance remains unmeasured. Existing unrelated Vite dynamic-import and bundle-size warnings remain. Referenced classic puzzle-game easing internals were not verified; this game's timing is authored independently.

## Next proposed step
Publish release 3 to the existing prototypes sushi URL, verify anonymous live gameplay and separate Claude URL, and record deployment provenance.
