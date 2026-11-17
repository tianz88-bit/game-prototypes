## Current milestone

Landing menu and planet map hierarchy LIVE171126r0098. PR547 mergefde1891ede1393ad994997de6a77eb2fa2927b53; itch44051762536 and Pages44051762420 succeeded. Existing Worker protocol25 healthy. Public game: https://daily-daily-games.itch.io/steroids-alpha . Owner approved release; Claude sync remains deferred.

## What was implemented

Selected real ship/palette is the main menu hero with primary pulsing Warp/Choose a planet, secondary Learn to fly and Hangar. Banked credits stay visible. Settings, Account/recovery and Share/QR open as isolated utility panels; all remain accessible on short/mobile/tall layouts. Pilot editing moves into Account on very short screens. Recovery retains the existing API and saves a newly edited name before switching modes.

Five spinning terrain globes show simple name, danger/player count, resources/rewards and optional Info. Warzone uses accurate Auto-join when open wording; closed rounds allow clan selection without entry. Confirmed opening is required for auto-join, and closing/changing destination cancels it. Longer rules do not crowd the chart.

## Key technical decisions

Pure landingLayout geometry; existing shipPreview rig and UI palette/panels, no new assets/dependencies. Utility/map taps stay isolated through existing intents. No account/save/network schema, server/protocol, gameplay or live tuning changes. Existing ship rig/FFD and orbital flow retained.

Type/build/rig/sim/config checks pass.8 CI geometry sizes enforce action bounds/separation/targets.9 local plus9 public Brave DPR2 desktop/compact/mobile/tall/portrait/320x240 cases pass for all utilities/recovery,5 destination Info routes, closed Warzone/side selection/confirmed auto-join, Hangar/Learn and stable rebuild children/callbacks.1 final local compact case adds cancellation label verification, also included in all9 public cases. Public base confirms11 real ship modules, all5 live count keys and client98. Zero page errors; no captures/public-room fixture writes. Evidence outputs/steroids-alpha/landing-map-hierarchy/.

## Open questions

None for release.

## Known issues

Physical-phone/Safari visuals not inspected; headless Brave interaction/geometry checks used per owner no-capture instruction. Existing unrelated build warnings remain.

## Next proposed step

Collect owner live feedback. CLAUDE_BACKLOG.md contains durable release/seam notes for later sync; no immediate Claude execution/review requested. Temporary Vite4187 stopped; no resident publisher/capture or leftover headless test process.
