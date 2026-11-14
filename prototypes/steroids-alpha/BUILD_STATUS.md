## Current milestone

14 November: current overhead interceptor/battlecruiser source handoff prepared on codex/steroids-ships-v2-handoff, outside the live renderer. Three new public R2 packs are downloaded and SHA256-verified. The live starter object is unchanged. This work does not merge, deploy or wire new gameplay. Main at handoff base13df8f8 includes Claude's bank, hangar unlock shop, salvage/hot zone and warp-out work; this session does not claim new live verification of those features.

## What was implemented

- Portable code-only tools/ship-rig/human-nomad-ships-v2 kit: twelve-module interceptor and sixteen-module capital profiles/calibration; accepted rig, FFD, flight motion and depth effects; per-cannon recoil multipliers/delays; RGBA palette remapping; hashed restore tool and source trim metadata.
- R2 interceptor-v2, battlecruiser-v1 and visual-review-v4 archives with packed/loose layout. Remote ZIP hashes and all17 new source PNG hashes verified after download.
- Proposed per-chassis collision circles, four capital muzzle tips and turret formations in footprint-proposals.json. These are not applied to tune.json or approved gameplay values.
- Local menu review v02 shows the current ships, four palettes and separate capital evolution preview. Desktop and mobile DPR2 Brave checks pass, no page errors.

## Key technical decisions

- Overhead orthographic plan with shallow edges; parented cardinal offsets create depth. Fixed Z,3% per-layer darkening, no rotation FFD, accepted control-driven FFD and engine vibration remain.
- Preserve all source canvases/registration; derive renderer frames from manifest alpha>12 trim rectangles. No PNG/ZIP in Git.
- Keep collision/authoritative muzzles separate from visual footprint and screen-space layer offsets. The reference render scale is.18; proposals still require review.
- Claude reported the owner-confirmed planning direction: Interceptor one-time credit unlock; free swapping afterwards; capital mineral evolution lost on death/extraction; palettes replace tints. No prices, stats, migrations or carry-over rules were implemented here.

## Open questions

Owner/Claude: Interceptor and palette prices, five legacy tint mappings onto four candidate palettes, capital minimum upgrades/power floor/cost, ship stats, carry-over and capital dash/warp rules. Update BRIEF.md when settled. Do not deploy invented values.

## Known issues

- New ships and palette textures are not yet wired to live chassis snapshots, per-chassis calibration maps or account unlocks. Production FFD adapter and evolution effect remain integration work.
- Orbital entry/exit zoom, salvage coins/hot-zone/SALVAGE restyling remain pending Codex work from Agent Comms2ff99430; not completed by this source/art handoff.
- Full multiplayer/death checks were not rerun for this code-only kit because no runtime/sim files changed. Previous harness limitations are not claimed fixed.

## Next proposed step

Claude restores the two art packs, reviews footprint/muzzle proposals and implements the agreed identity/evolution/menu logic after the owner supplies numbers. Codex follows with per-chassis renderer integration and the separately requested orbital/salvage graphics work. Reuse existing tune/liveConfig conventions; preserve the approved starter and keep the retired private publisher off.

Validation: kit720-heading/calibration/palette tests, npm run typecheck, approved396-pose rig test, npm run build, installed-Brave menu desktop/mobile DPR2, public R2 download+SHA256 and module restoration all pass. Build needed an escalated retry because esbuild's parent-directory read was denied in the filesystem sandbox; retry passed. No new dependencies or credentials.
