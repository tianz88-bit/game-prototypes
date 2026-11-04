## Current milestone

Operation C 1v1 r0021: owner-visible nuclear missile launch and flight. Deployed to https://operation-c-online.tianz-88.workers.dev/ (Worker version 87f8eb0c-822a-435e-8435-b0bccd38ae92).

## What was implemented

A vector missile lifts from its silo with launch smoke and a fading exhaust trail, follows a high arc and descends into its selected target on the existing authoritative flight timer. The public mushroom cloud is unchanged. The launching silo's floating command button hides during flight so it cannot cover the launch; its bottom context menu remains usable. Existing owner-only flight DTOs also restore the correct animation progress after reconnect.

## Key technical decisions

Presentation only; no simulation, protocol, damage, travel time, production or map changes. Renderer explicitly filters by local owner even offline. Defenders still receive no launch/target/flight data until impact. Arc lift is tuned in tune.json and exposed in the nuclear Tweakpane folder. No assets, dependencies or services added.

Verification: 125 simulation +31 online tests pass, including defender redaction and reconnect payload filtering. Full repository typecheck/build and standalone release build pass. Real construction/research/silo-production/launch/8-second-flight/impact flows pass in isolated Brave on desktop, portrait, landscape and small landscape, without console errors. Launch and flight screenshots inspected. Browser test now brings the HQ into overview before selecting it. Evidence: outputs/operation-c-nuke-final.

## Open questions

None.

## Known issues

Existing large bundle warning remains. Physical-device checks are not part of this pass.

## Next proposed step

Reload the live game and test a silo launch. 
