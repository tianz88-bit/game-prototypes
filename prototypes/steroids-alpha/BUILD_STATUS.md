## Current milestone

LIVE VERIFIED181126r0105/protocol29. PR570 mergee648baa279136176a86ba60da2f4eaaa536bb830; itch44321872467 and Pages44321872344 succeeded. Fixed building perspective and barrel-aligned smaller tower shots released. Existing Worker29 unchanged.

## What was implemented

Nexus/tower foundations, shafts and plates keep a fixed top-down orientation. Only tower heads/barrels aim. A centred stack overlaps at its root; screen-edge layers offset outward in proportion to height, with a0.55 radial bound and connecting cylinders. Existing terrain-anchored roots/contact/cast shadows and clan/damage/wreck/repair art retained. Lab adds Centre/Right/Bottom/Left/Top positions, separate tower aim and Nexus position sweep.

Tower bolts use45% of prior visual size and a shorter trail. Existing received SHOTS gain local origin/duration/barrel tags; matching alternating recoil/foreshortened tips launch them, then a180ms smooth blend restores the authoritative trajectory. No damage, collision, cadence, gameplay tune or wire change.

## Key technical decisions

Ground orientation remains separate from stackLean and turret aim. Optional viewport/barrel fields share perspective and firing parity between lab and production. No new assets, dependencies, emitters, migration, protocol or Worker deploy. Existing paired-client/server release is not needed for these visual tags.

Typecheck/build/sim/live-config/rig plus expanded centre/edge/corner/extreme geometry and22 layout cases pass. Three local headless Brave PC/touch/portrait cases plus2 public itch cases each pass50 transforms/muzzles, smaller bolts and wreck/repair. An isolated actual Flight/NetClient fixture checks alternating parity, exact projected barrel origin, size and authority-path convergence. Public permanent lab shows fixed Nexus and working position controls. No page errors, screenshots or recording. Proof ../steroids-alpha-lab/building-stack-proof.json; raw outputs/steroids-alpha/missile-cruiser-lab/building-stack-*.

## Open questions

None. Owner approved live release after checks; deferred Claude handoff saved without requesting immediate work.

## Known issues

Headless render/transform checks use bundled-config and isolated tutorial fixtures; no hostile live player or account spending involved. No screenshot visual inspection or physical Safari review per owner preference. Existing randomized bot-spacing/Pages housekeeping remains deferred; this release passed first attempt.

## Next proposed step

Refresh for105, then use the permanent lab Nexus/Tower turrets Position control to compare centre and edges. Aim turns only tower heads/barrels. Temporary preview and headless test processes closed; no resident publisher or capture session.
