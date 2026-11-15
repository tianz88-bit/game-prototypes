## Current milestone

Clan fuel (15 November, claude): clan home planets drop no salvage; members mine Fuel there (same 400 hold, lost on death) and dock to unload it into the treasury, which will fund building upkeep later. Exhaust plume length now follows each ship's own top speed. Protocol 20.

Owner approved all four art backlog groups for live after the screenshot review. Source pack uploaded to R2 and fetched back with matching hash; PR500 merged398b045; itch run43733278666 uploaded successfully. Public Brave build151126r0067 verified all12textures, painted ordnance/repair sprites, mobile/upright drawer/fire/dash, both clan skins and open planet connections with zero browser errors. Worker health is protocol19 and healthy. The release integrates main3a38092, preserving PR498 smaller shadows/round glow/docked landing and PR499 gun convergence/idle exhaust/engines-off. Review evidence: outputs/steroids-alpha/backlog-review/index.html.

## What was implemented

- P1 combat: three new matching painted missile/mine/repair-pod sources; smoke, arming/search/observed-seeking cues and lock brackets; death, missile/mine/shot-down blasts, asteroid splits, shield shatter, Nova, hull sparks/border hit and dash-ram feedback; heading-only charge cue.
- P2 clan planets: distinct Crimson/Azure materials, fortified treasury, pads with alignment/docked states, turrets/flash, projected dome with impact/push cues, gate and banners.
- P3 progression: evolution assembly and shield lock, capital escorts/name clearance, warp aperture and launch; two alpha-preserving fracture stages for all painted rocks.
- P4 HUD/menus: hangar emblems, target meter, nose marker, cargo cue, connection alerts, salvage ring; alerts clear other informational labels and mobile control space.

## Key technical decisions

- No sim, gameplay tuning, protocol, authoritative positions/radii, ship rig or input-zone changes. Render observes existing state; seeking cue infers recent mine movement without new wire data.
- Original source PNGs/ZIP/prompt metadata stay in outputs/steroids-alpha/combat-backlog-v01. Public R2 ZIP fetched back and SHA-256 verified; source files and registration retain their hashes through the asset pipeline. Owner explicitly approved upload/merge/publication. Missing body textures retain procedural fallback.
- Per-scene sprite reuse and shared textures; code-driven VFX support WebGL and Canvas. Thirty fracture variants preserve body alpha pixel-for-pixel and existing collision coverage.
- Typecheck/build/396 rig poses +14400FFD points/sim/live-config pass. Actual-renderer desktop1280x720/mobile844x390 DPR2 plus667x375 HUD checks, WebGL/Canvas and error checks pass.
- Two real connected clients with four bots on alpha: ~56.6/56.8FPS, p95~18.1/18ms on this PC atDPR2; Crimson ~56.8/56.6FPS. Real fire/dash worked, no browser errors. Test browsers close; local preview servers stop after capture.

## Open questions

- Screenshot review and publication approval received. No implementation question is blocking release.

## Known issues

- Real phone/Safari/Android hardware performance remains unmeasured; browser phone emulation is not hardware evidence.
- Separate orbital zoom transition and per-chassis hosted calibration remain outside this prioritized art pass.

## Next proposed step

Owner playtests the approved art on real phones. Publication is complete and verified; Claude receives the PR/run/build evidence in thread07e15987. Orbital zoom and per-chassis hosted calibration remain separate tasks.
