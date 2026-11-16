## Current milestone

LOCAL MOTION REVIEW on codex/steroids-hyperspace-arrival, based on main d56a3b8. Owner corrected the warp sequence after live0074: hyperspace first, then heading-driven globe approach, plus observer fade/brake/residuals and protection through completion. Public game remains161126r0074; this pass is not pushed or deployed. Motion gallery: outputs/steroids-alpha/hyperspace-preview/index.html.

## What was implemented

- Pilot stays level and centred at full normal speed. Distributed blue-white/orange hyperspace streaks run along the ship bearing; the background fades before the planet zooms from20% to play scale. A bounded forward camera/surface travel produces rapid terrain roll in that bearing and returns exactly to the authoritative camera. No vertical drop or shockwave. Full-speed control deformation/exhaust remain per part.
- Departure reverses globe zoom, surface travel and hyperspace fade after extraction; retained ship is removed at completion, then existing MENU-only results. Normal death/respawn remains separate.
- New arrivals seen by another client are hidden during initial travel, then fade in for the last0.7s with fast forward approach, a short overshoot and hard brake. Residual square particles last650ms. Only positive server arrival state starts this effect; established ships/reconnects do not fake a new entrance.
- Authoritative arrival remaining time initializes to3.2s. World advances it once per tick, including before input startup; prediction advances its copy once per input. All damage, contact/ram displacement and combat actions are gated. Bearing stays fixed at full normal speed until release. Client animation follows remaining authority state and cannot extend immunity. Departure is2.4s and remains visual after server extraction.
- Transit hides UI, then restores original opacities at completion. Foreground ship/exhaust render above hyperspace. Resize/rebuild preserves authority progress and now destroys old ship/FFD/UI resources instead of orphaning them via DisplayList.removeAll(true).

## Key technical decisions

Protocol21 appends f32 arrival at offset99:103-byte ship records. ShipState arrival is optional only for older local fixtures, encoded as0 when omitted. Remote countdown is interpolated. Client and Worker must release together after review. New bounded warp timings upgrade into older hosted settings automatically; minimum arrival2s never undercuts legacy contact grace. No new assets, dependencies or permissions; shared R2 art, fixed-Z ship rig, Canvas and sprite fallback retained. Existing Warp map and level/kills/minerals ranking preserved.

Typecheck/build/rig/sim/live-config/bank suites pass. New tests cover protected health/shield/recharge, blocked attacks/dash/warp, full-speed fixed bearing, one-step prediction parity, automatic vulnerability, copied/wire countdown, reverse camera/fade and old-ship behavior; hosted timing upgrades/bounds pass. Existing combat/room fixtures explicitly start after arrival. Rig396 poses/14400 FFD points remain unchanged.

Brave DPR2 desktop1280x720 and mobile844x390 real server arrivals reach flight from positive authority time; actual renderer entry/exit captures preserve centred ship and exact final scale. A real two-client observer sees hidden arrival then fade-in.21 deterministic observer frames verify overshoot, settlement, residual cleanup and no effect for an old visitor. WebGL and Canvas held-fire arrival, resize continuity, UI restoration, repeated resize texture stability and return-to-menu cleanup pass. No unexpected page/console errors. Evidence: outputs/steroids-alpha/hyperspace-preview/result.json, observer.json, compatibility.json and5 GIFs. Captured animation timelines use isolated client fixtures after network close; real network checks are recorded separately.

## Open questions

Owner motion review: timing and intensity of the approach, reverse departure and observer brake. No missing implementation decision blocks review.

## Known issues

Phone emulation is not physical phone/Safari evidence. Canvas retains the existing simpler terrain fallback. Authoritative extraction/bank logic is covered by simulation/bank suites; departure capture stages the extracted presentation locally. Existing unrelated bundle warnings remain.

## Next proposed step

Owner reviews the5 motion clips. After approval, merge latest main and publish matching protocol21 client/Worker, then verify public two-client arrival/protection and Warp map entry. Claude receives the new authority/render contracts in Agent Comms thread68c1ca78. Current live0074 is unchanged.
