## Current milestone

Hyperspace/spark release verified as161126r0075; latest public build is161126r0076 after Claude's siege-rules merge, retaining this release. Live at https://daily-daily-games.itch.io/steroids-alpha. Owner approved the revised hyperspace and final landing spark. PR512 merged39d1b471; client43853040304 and Worker43853040359 both succeeded. Public Worker health is OK/protocol21. Motion preview remains outputs/steroids-alpha/hyperspace-preview/index.html.

## What was implemented

- Pilot stays level and centred at full normal speed. Distributed blue-white/orange hyperspace streaks run along the ship bearing; the background fades before the planet zooms from20% to play scale. A bounded forward camera/surface travel produces rapid terrain roll in that bearing and returns exactly to the authoritative camera. No vertical drop or shockwave. Full-speed control deformation/exhaust remain per part.
- Departure reverses globe zoom, surface travel and hyperspace fade after extraction; retained ship is removed at completion, then existing MENU-only results. Normal death/respawn remains separate.
- New arrivals seen by another client are hidden during initial travel, then fade in for the last0.7s with fast forward approach, a short overshoot and hard brake. Residual square particles last650ms. Only positive server arrival state starts this effect; established ships/reconnects do not fake a new entrance.
- Authoritative arrival remaining time initializes to3.2s. World advances it once per tick, including before input startup; prediction advances its copy once per input. All damage, contact/ram displacement and combat actions are gated. Bearing stays fixed at full normal speed until release. Client animation follows remaining authority state and cannot extend immunity. Departure is2.4s and remains visual after server extraction.
- Transit hides UI, then restores original opacities at completion. Foreground ship/exhaust render above hyperspace. Resize/rebuild preserves authority progress and now destroys old ship/FFD/UI resources instead of orphaning them via DisplayList.removeAll(true).

- Completion now emits one world-anchored white glint dissolving into blue-white square ions for1400ms, for both own and remote arrivals. At most32 effects are retained; they expire and do not extend protection. Old visitors do not trigger it.

## Key technical decisions

Protocol21 appends f32 arrival at offset99:103-byte ship records. ShipState arrival is optional only for older local fixtures, encoded as0 when omitted. Remote countdown is interpolated. Client and Worker must release together after review. New bounded warp timings upgrade into older hosted settings automatically; minimum arrival2s never undercuts legacy contact grace. No new assets, dependencies or permissions; shared R2 art, fixed-Z ship rig, Canvas and sprite fallback retained. Existing Warp map and level/kills/minerals ranking preserved.

Typecheck/build/rig/sim/live-config/bank suites pass. New tests cover protected health/shield/recharge, blocked attacks/dash/warp, full-speed fixed bearing, one-step prediction parity, automatic vulnerability, copied/wire countdown, reverse camera/fade and old-ship behavior; hosted timing upgrades/bounds pass. Existing combat/room fixtures explicitly start after arrival. Rig396 poses/14400 FFD points remain unchanged.

Brave DPR2 desktop1280x720 and mobile844x390 real server arrivals reach flight from positive authority time; actual renderer entry/exit captures preserve centred ship and exact final scale. A real two-client observer sees hidden arrival then fade-in.21 deterministic observer frames verify overshoot, settlement, residual cleanup and no effect for an old visitor. WebGL and Canvas held-fire arrival, resize continuity, UI restoration, repeated resize texture stability and return-to-menu cleanup pass. No unexpected page/console errors. Evidence: outputs/steroids-alpha/hyperspace-preview/result.json, observer.json, compatibility.json and5 GIFs. Captured animation timelines use isolated client fixtures after network close; real network checks are recorded separately.

Public Brave verification: all four desktop/mobile map layouts load0075 and complete actual two-tap planet entry with open connections. Desktop/mobile completion sparks trigger at arrival0, remain for1400ms and expire; remote completion triggers once and old visitors do not trigger. A real two-client in-range observer confirms hidden approach then fade-in;21 isolated rendered frames confirm brake/overshoot, residual cleanup and old-visitor suppression. No unexpected page/console errors. Evidence: hyperspace-live-verification/map/result.json, landing-live-verification/result.json and inspected GIF/screenshots, hyperspace-live-verification/observer/observer.json. Observer was flown within the server1400-unit interest range using normal controls; distant ships are correctly omitted from snapshots.

Latest-build recheck after PR513: public161126r0076 passes desktop/mobile own/remote completion trigger,1400ms cleanup and old-visitor suppression, zero errors; health remains protocol21. Evidence outputs/steroids-alpha/landing-live-current/result.json and screenshots. No runtime code was changed by this documentation merge.

## Open questions

Owner reviewed and approved the motion. No open release decision.

## Known issues

Phone emulation is not physical phone/Safari evidence. Canvas retains the existing simpler terrain fallback. Authoritative extraction/bank logic is covered by simulation/bank suites; departure capture stages the extracted presentation locally. Existing unrelated bundle warnings remain.

## Next proposed step

Owner playtests live0075. Final release proof and protocol/arrival contracts are sent to Claude in thread68c1ca78. No remaining deployment work.
