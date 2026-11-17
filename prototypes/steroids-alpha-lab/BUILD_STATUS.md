## Current milestone

Live port verified171126r0100/protocol26 via PR559, approved18 November2026. Pages44129275338 and client/Worker release succeeded; independent duel lab comparisons retained.

## What was implemented

Duel candidate disables the new shared grip to avoid double movement before its existing lab grip/shot bridge. Live Baseline now follows production shared grip. Reset aligns travel state. Permanent lab stats include the new bounded Grip group; shield/evolution fields appear in their existing groups.

## Key technical decisions

Production integrates grip inside shared stepShip before muzzle emission, with snapshot/replay travel state. Lab-only broad turn band, auto-cruise and stronger collision experiments stay independent. New shared-grip regression confirms parity with the approved lab travel formula. Lab grip/duel tests pass; main game BUILD_STATUS holds full release tests. No live config publish from the lab. Public eight Grip fields and all three profiles verified without page errors/capture; shared enable0 on candidates,1 on Live Baseline.

## Open questions

Other lab handling changes still require owner approval.

## Known issues

Headless checks do not prove human combat feel. No physical Safari review/capture.

## Next proposed step

Owner can compare further handling experiments against the new Live Baseline. Release and public controls verified; keep deferred Claude backlog, no immediate execution.
