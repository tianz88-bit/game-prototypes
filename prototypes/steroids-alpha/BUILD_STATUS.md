## Current milestone

All four owner-prioritized art backlog groups are implemented as a local review pass on codex/steroids-combat-backlog-preview from e610545. Nothing uploaded, merged or deployed. The owner requested screenshots before live. Actual-renderer review gallery: outputs/steroids-alpha/backlog-review/index.html. Existing public game is unchanged by this pass.

## What was implemented

- P1 combat: three new matching painted missile/mine/repair-pod sources; smoke, arming/search/observed-seeking cues and lock brackets; death, missile/mine/shot-down blasts, asteroid splits, shield shatter, Nova, hull sparks/border hit and dash-ram feedback; heading-only charge cue.
- P2 clan planets: distinct Crimson/Azure materials, fortified treasury, pads with alignment/docked states, turrets/flash, projected dome with impact/push cues, gate and banners.
- P3 progression: evolution assembly and shield lock, capital escorts/name clearance, warp aperture and launch; two alpha-preserving fracture stages for all painted rocks.
- P4 HUD/menus: hangar emblems, target meter, nose marker, cargo cue, connection alerts, salvage ring; alerts clear other informational labels and mobile control space.

## Key technical decisions

- No sim, gameplay tuning, protocol, authoritative positions/radii, ship rig or input-zone changes. Render observes existing state; seeking cue infers recent mine movement without new wire data.
- Original source PNGs/ZIP/prompt metadata stay in outputs/steroids-alpha/combat-backlog-v01. Hash-verified local cache feeds existing asset pipeline; source pack public R2 URL is reserved, NOT uploaded. Approval must precede upload/merge. Missing body textures retain procedural fallback.
- Per-scene sprite reuse and shared textures; code-driven VFX support WebGL and Canvas. Thirty fracture variants preserve body alpha pixel-for-pixel and existing collision coverage.
- Typecheck/build/396 rig poses +14400FFD points/sim/live-config pass. Actual-renderer desktop1280x720/mobile844x390 DPR2 plus667x375 HUD checks, WebGL/Canvas and error checks pass.
- Two real connected clients with four bots on alpha: ~56.6/56.8FPS, p95~18.1/18ms on this PC atDPR2; Crimson ~56.8/56.6FPS. Real fire/dash worked, no browser errors. Test browsers close; local preview servers stop after capture.

## Open questions

- Owner reviews the screenshot gallery before any live release. No implementation decision is waiting on the owner.

## Known issues

- Real phone/Safari/Android hardware performance remains unmeasured; browser phone emulation is not hardware evidence.
- New art pack must be uploaded only after review; a clean remote build cannot fetch the reserved object yet.
- Separate orbital zoom transition and per-chassis hosted calibration remain outside this prioritized art pass.

## Next proposed step

Owner reviews combat first, then clan/progression/HUD screenshots. After explicit approval, upload the source pack, verify clean-fetch hashes, create appropriately scoped PRs and publish/check the live game.
