## Current milestone

Owner approved live port of speed-dependent grip on18 November2026. Production protocol26 release pending; duel lab comparisons retained.

## What was implemented

Duel candidate disables the new shared grip to avoid double movement before its existing lab grip/shot bridge. Live Baseline now follows production shared grip. Reset aligns travel state. Permanent lab stats include the new bounded Grip group; shield/evolution fields appear in their existing groups.

## Key technical decisions

Production integrates grip inside shared stepShip before muzzle emission, with snapshot/replay travel state. Lab-only broad turn band, auto-cruise and stronger collision experiments stay independent. New shared-grip regression confirms parity with the approved lab travel formula. Lab grip/duel tests pass; main game BUILD_STATUS holds full release tests. No live config publish from the lab.

## Open questions

Other lab handling changes still require owner approval.

## Known issues

Headless checks do not prove human combat feel. No physical Safari review/capture.

## Next proposed step

Verify coordinated public client/Worker release and permanent lab controls. Keep deferred Claude backlog; no immediate execution.
