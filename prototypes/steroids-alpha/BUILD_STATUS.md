## Current milestone

Owner approved the Warp map and leaderboard for live publication on 16 November 2026. Release candidate on codex/steroids-warp-stellar-map, based on main9097c74. New pulsing WARP menu button, spinning-globe destination popup, and level/kills/minerals leaderboard implemented. Public build remains161126r0073 from the previous approved release. Review gallery: outputs/steroids-alpha/warp-map-preview/index.html. The reviewed candidate fb8c7c9 passed its checks; publishing and public verification are now authorized and in progress.

## What was implemented

- Main menu WARP opens a stellar chart containing all four planets, using four bounded instances of the existing terrain/globe renderer and shared R2 terrain art. First tap selects/highlights and shows player count, territory relationship and resources; second tap on that same selected globe enters through the existing orbital arrival.
- Real populations refresh from the existing /planets endpoint. Unreachable counts show Players unavailable. Clan homes are friendly to their members and hostile to other clans; Lawless A is hostile, Satellite B neutral (PvP still possible). Mineral/salvage and member-fuel notes reflect current rules. Close, outside tap or Escape returns to menu; underlying name/share/menu controls are isolated while open. Selection survives resize.
- One pure rankPilots helper sorts level descending, kills descending, mineral balance descending, then stable id. Desktop board, mobile drawer and compact rank all use it. Display says MINERALS; existing authoritative power wire field remains the hull/shop mineral balance. No economy, protocol-version or server behavior changes.
- Fixed inherited menu rebuild leakage: DisplayList.removeAll(true) did not destroy old text canvases. Layout now destroys old objects and shared art stays loaded. Ten repeated map open/close cycles stay at53 objects/133 textures with4 globe shaders, or0 shaders in Canvas.

## Key technical decisions

No dependencies, generated images, new R2 objects or extra permissions. The popup reuses PlanetGround through bounded positioning/disposal methods. Canvas compatibility keeps rotating projected surface marks and a shaded disc. Shared planet metadata and real counts supply intel; no fabricated resource quantities or player counts. Existing ship art, rig/FFD, mobile controls and orbital flow remain.

Typecheck/build/rig/sim/live-config pass. New meaningful ranking cases cover level vs kills, kills vs minerals, stable ties, old missing-level rosters and source immutability. Brave DPR2 PC1280x720, mobile844x390, small667x375 and upright390x844: all four selections, real second-tap warp, modal input isolation, hidden/restored name field and rotation pass. Desktop/mobile board ordering and compact rank agree. WebGL and Canvas repeat-open resource counts stay stable; resize preserves selection; stale Escape and simulated count503 fail gracefully. About60 FPS / p9516.8ms for the open four-globe map on this PC. No unexpected page/console errors; intentional503 injection is excluded from the error count. Evidence: outputs/steroids-alpha/warp-map-preview/{result,leaderboard,lifecycle}.json and actual-renderer screenshots/GIF.

## Open questions

None blocking the requested behavior. Latest owner request is recorded in BRIEF.md.

## Known issues

Physical phone/Safari performance is unmeasured. Canvas uses simpler globe shading than WebGL. This is a menu destination chart; a free-flight space hub is separate. Existing unrelated build warnings remain.

## Next proposed step

Publish the approved pass, monitor itch and Worker workflows, verify the fresh public build and two-tap planet entry, then send Claude the release proof and menu/ranking contracts. Main remains unchanged at9097c74; no rebase or implementation changes required.
