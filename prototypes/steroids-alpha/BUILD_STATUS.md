## Current milestone

All approved ship updates are live at https://daily-daily-games.itch.io/steroids-alpha, version 161126r0079. PR517 merged at7965bcdf710970b22191f0344ae3149ff2268162. Client run43887481908, Worker43887482153 and hosted settings publish43888409949 succeeded. Public Worker health reports protocol22.

## What was implemented

Sparrow is the free starter: centre gun,5shots/s,80% of Falcon's shots before overheating (base12 versus15), bounded3degree launch drift and Falcon base movement/defence. Scrappy is renamed Falcon, Interceptor Bat; stable ownership IDs retained. Everyone must unlock Falcon, including old accounts; no grandfathered grant. Compact hangar includes all fighters plus the in-run Battlecruiser evolution.

Bat has cobalt primary cowlings and live maxSpeed315/cruiseSpeed234/turnRate5.44. Battlecruiser has a clear bridge, richer panel details,4 forward cannons and4 rigged deck platforms with independently aiming/recoiling turret heads. Existing two built-in/up-to-four equipped turret rules remain. Fixed Z, facing offsets,3% depth shading, engine vibration, hover light/dynamic shadow and control-only per-part FFD with sprite fallback are retained.

## Key technical decisions

Protocol22 adds chassis3 and centre recoil side0 without changing the103-byte snapshot layout. Sparrow shares Falcon shipMotion; Bat uses the newer explicit motion schema. Existing tutorial, hull-first rams, dash and corner steering from PR515/516 were preserved. Hosted OIDC publishing changed only the three approved Bat motion fields; owner calibration and other values were preserved. Public configuration matches the validated payload, version97dfb031bc3f21a2e6464f5b5d14223102aa82d275f2534423b51d1e237424ce.

All three R2 ZIP hashes and27part hashes were verified by public re-fetch before release. PNG/ZIP binaries remain outside Git. Capital uses24 modules/11textures; deck turret origins right±36/rear−9/front25.2. No new dependencies.

Typecheck/build/sim/bank/live-config/rig suites pass (396poses/14400FFD points). Public isolated Brave DPR2 desktop/mobile checks verified version79, live Sparrow connection/firing,30 new profile textures, hangar IDs and server rejection of unowned saved Falcon. Tutorial starts Sparrow through its menu button. No page/console errors. Screenshots were inspected. Evidence: outputs/steroids-alpha/ship-release/{r2-verification.json,live/result.json,live/mobile-hangar.png,live/desktop-sparrow-flight.png}. Local capital WebGL/Canvas equipment/rotation/FFD fixtures remain in outputs/steroids-alpha/fleet-revision-review.

## Open questions

None for this approved release.

## Known issues

Mobile evidence is browser emulation, not a physical phone/Safari test. Capital equipment/FFD visual fixtures were local isolated presentation tests; gameplay authority was tested separately in sim/bank suites. Local frame comparison was about32FPS for both capital and Falcon in the same emulation, not a60FPS claim. Existing unrelated bundle warnings remain.

## Next proposed step

Playtest the released ships and collect owner feedback before further tuning. Claude receives the final release/rig/settings handoff in Agent Comms threade31061e9-e8e1-4105-858a-2f847541014a. Temporary QA browsers and servers are closed; no local publisher runs.
