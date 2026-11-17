## Current milestone

Landing menu and planet map hierarchy implemented and approved for go-live. Deployment/public verification pending. Existing live client171126r0097, Worker protocol25.

## What was implemented

Selected real ship/palette is the main menu hero with primary pulsing Warp/Choose a planet, secondary Learn to fly and Hangar. Banked credits stay visible. Settings, Account/recovery and Share/QR open as isolated utility panels; all remain accessible on short/mobile/tall layouts. Pilot editing moves into Account on very short screens. Recovery retains the existing API and saves a newly edited name before switching modes.

Five spinning terrain globes show simple name, danger/player count, resources/rewards and optional Info. Warzone uses accurate Auto-join when open wording; closed rounds allow clan selection without entry. Confirmed opening is required for auto-join, and closing/changing destination cancels it. Longer rules do not crowd the chart.

## Key technical decisions

Pure landingLayout geometry; existing shipPreview rig and UI palette/panels, no new assets/dependencies. Utility/map taps stay isolated through existing intents. No account/save/network schema, server/protocol, gameplay or live tuning changes. Existing ship rig/FFD and orbital flow retained.

Type/build/rig/sim/config checks pass.8 CI geometry sizes enforce action bounds/separation/targets.9 local Brave DPR2 desktop/compact/mobile/tall/portrait/320x240 cases pass for all utilities/recovery,5 destination Info routes, closed Warzone/side selection/confirmed auto-join, Hangar/Learn and stable rebuild children/callbacks.1 final compact case adds cancellation label verification. Zero page errors; no captures/public-room fixture writes. Evidence outputs/steroids-alpha/landing-map-hierarchy/.

## Open questions

None for release.

## Known issues

Physical-phone/Safari visuals not inspected; headless Brave interaction/geometry checks used per owner no-capture instruction. Existing unrelated build warnings remain.

## Next proposed step

Publish and verify public game, record final version/runs, then collect owner feedback. CLAUDE_BACKLOG.md contains deferred seams; no immediate Claude execution/review requested. Stop temporary Vite4187 after release.
