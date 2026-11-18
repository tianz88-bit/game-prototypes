## Current milestone

LIVE VERIFIED181126r0106/protocol30. PR572 merge3245a9e4350f4fb170a837b575ae82f778f20bb3; itch44338617901, Worker44338617904 and Pages44338621246 succeeded. Neutral cruise/home extraction, compact low-speed FX, outward building FFD and idle tower heads released.

## What was implemented

No speed input smoothly restores each chassis/power cruise with existing acceleration/braking; aiming is independent. Keyboard Up/Down and compact mobile hold+/− explicitly control speed. Marker drag no longer auto-brakes or accelerates. Hold Down/− over an owned pad to slow below normal minimum and dock; release accelerates/takes off. Peaceful Crimson/Azure homes have no warp cooldown; ordinary/Warzone and arrival protection restrictions remain. Tutorial/control text follows the new controls.

Low-speed plume narrower and nozzle-width ignition blocks capped, retaining rectangular particles and speed colours. Building plates have bounded outward per-part FFD while root/stack/fixed-depth layout remain. Original sprites cover Canvas/context-loss/disabled FFD; pooled meshes use source crop UVs/clan/damage tint. Home heads wander slowly when idle and yield to recent fire. No new assets or gameplay rate changes.

## Key technical decisions

Shared movement/home helper and NetClient replay/prediction stay aligned. Client explicitly checks home IDs before siege data arrives. Protocol30 retains wire layout but refreshes old movement clients; paired release completed. Input pointer release/cancel/blur/shutdown cleanup prevents stuck throttle. No migration, dependency, published config edit or resident service.

Typecheck/build/sim/live-config/rig pass. Neutral/dock/release/home/war/arrival regressions and bounded tilt/idle checks added; fixed-speed shield/ram/grip fixtures explicitly hold brake/throttle, post-dash neutral expects cruise. Three local and2 public WebGL PC/touch/portrait cases pass actual keyboard/CDP touch holds, release, neutral marker and home UI. Actual GPU faces render; mesh/object/texture reuse, centre identity and context-loss fallback pass, plus real Canvas fallback. Real home connection held cruise260 and lockdown0 at46 snapshots, then warp persisted through56 snapshots/ack99. No page errors, screenshots or recording. Proof ../steroids-alpha-lab/cruise-home-proof.json; raw outputs/steroids-alpha/missile-cruiser-lab/cruise-*.

## Open questions

None. Deferred Claude handoff saved; no immediate session requested.

## Known issues

Docking authority is covered by shared tests; headless home flight verifies cruise and warp, without manual bay navigation or visual capture. Idle head patrol is cosmetic and shot angles remain authoritative. Browser fixtures use intercepted accounts/config where noted; no bank credits spent. No physical Safari review.

## Next proposed step

Refresh both game/lab for106/30. Try neutral cruise, hold−/Down to dock and release to depart; use building Position presets to inspect outward tilt. Temporary preview and headless processes stopped; no publisher or capture left running.
