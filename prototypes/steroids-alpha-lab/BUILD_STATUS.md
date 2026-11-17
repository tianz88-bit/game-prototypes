## Current milestone

Local Warzone art review added; pending owner visual approval. Public lab unchanged.

## What was implemented

Ship / building selector adds Warzone siege-art preview through the production review scene. Mixed intact/damaged/critical/wreck towers, shield coverage and Nexus health can be cycled independently. Clan colours and moving ground/lighting inspect the same rooted building rigs. Standalone Nexus/tower tabs allow larger damage review and have FINAL HIT / REPAIR buttons. Warzone offers DETONATE TOWERS / DETONATE NEXUS / REPAIR ALL. Final-hit blasts throw painted neutral debris; both destroyed buildings become neutral rubble only.

## Key technical decisions

Reuse the existing isolated iframe and same-origin allowlist. Calibration loop sleeps during review; return preserves the browser draft and unmounts the frame. No gameplay socket, grant, account write or publishing action. Damage assets remain local/hash-verified, with publication withheld.

## Open questions

Owner visual approval of the Warzone art.

## Known issues

Only the local port4187 preview includes this addition. Desktop/mobile DPR2 Brave state/lifecycle and4 destruction cases pass, including one-shot triggering, grounded neutral wrecks, expiration, repair and bounded sprite-pool reuse; no screenshots, recordings or physical-phone visual test. Hosted publishing was not exercised.

## Next proposed step

Review http://127.0.0.1:4187/game-prototypes/prototypes/steroids-alpha-lab/?review=warzone . Cycle tower/shield/Nexus states and inspect standalone tabs. Approve or request changes before public deployment.
