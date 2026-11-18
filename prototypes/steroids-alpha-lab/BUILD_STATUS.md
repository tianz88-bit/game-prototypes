## Current milestone

PUBLIC lab matches LIVE181126r0102/protocol28 artillery correction via PR564. Pages44251753017 deploy succeeded; post-deploy counter persistence raced main. Client/Worker succeeded.

## What was implemented

Missile Cruiser preview/evolution has zero base turrets, retains bought ones, minimum90/cruise170/top225; four empty platforms visible. Battlecruiser base2/min140 retained. Graphical build choice/requirements,8 rear-launched missiles and bought CIWS bursts remain.

## Key technical decisions

Lab no longer hardcodes2 turrets for MC. Shared production uses tune base0. Unit/type/build/sim/config/lab pass; public lab gives0 turrets/min90/ammo8 and actual public Hangar heads0/BC2.49 healthy network snapshots carry corrected values. Proof evolution/artillery-release-proof.json, no errors/capture.

## Open questions

Owner can playtest slower artillery positioning; no further release permission needed.

## Known issues

Unrelated randomized bot-spacing test retried successfully; Pages post-deploy counter push race deferred. Lab remains isolated from game accounts/network authority.

## Next proposed step

Use the public lab or refresh/play live. Claude backlog saved; no resident publisher, temporary tests closed.
