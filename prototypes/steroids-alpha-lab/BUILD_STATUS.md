## Current milestone

Owner approved Warzone art/final-hit effects for publication; release in progress.

## What was implemented

Ship / building selector adds Warzone siege-art preview through the production review scene. Mixed intact/damaged/critical/wreck towers, shield coverage and Nexus health can be cycled independently. Clan colours and moving ground/lighting inspect the same rooted building rigs. Standalone Nexus/tower tabs allow larger damage review and have FINAL HIT / REPAIR buttons. Warzone offers DETONATE TOWERS / DETONATE NEXUS / REPAIR ALL. Final-hit blasts throw painted neutral debris; both destroyed buildings become neutral rubble only.

## Key technical decisions

Reuse the existing isolated iframe and same-origin allowlist. Calibration loop sleeps during review; return preserves the browser draft and unmounts the frame. No gameplay socket, grant, account write or publishing action. Seven source assets uploaded and publicly hash-verified in R2.

## Open questions

Owner approved; no open design question for this release.

## Known issues

Public deployment verification in progress. Desktop/mobile DPR2 Brave state/lifecycle and4 destruction cases pass, including one-shot triggering, grounded neutral wrecks, expiration, repair and bounded sprite-pool reuse; no screenshots, recordings or physical-phone visual test. Hosted publishing was not exercised.

## Next proposed step

Verify the public Warzone lab after deployment and synchronize release proof with Claude.
