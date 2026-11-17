## Current milestone

Warzone art/health/destruction review is LIVE. PR527 merged46db3f81; Pages43997031451 succeeded. Open https://tianz88-bit.github.io/game-prototypes/prototypes/steroids-alpha-lab/?review=warzone . Itch client171126r0086 also includes the same review and production art.

## What was implemented

Selector includes Warzone siege-art review: mixed intact/damaged/critical/wreck towers, independent tower/shield/Nexus health presets, clan colours and surface/lighting travel. Neutral rubble replaces destroyed towers AND Nexus. FINAL HIT/REPAIR on standalone building tabs and DETONATE TOWERS/DETONATE NEXUS/REPAIR ALL on Warzone replay pooled flying debris/blasts.

## Key technical decisions

Reuse the isolated production-renderer iframe and same-origin subject allowlist. Calibration loop sleeps during review, one frame is reused across subjects, return unmounts the review and preserves the draft. No game-room socket, grants or publishing action from review controls. Seven-source R2 pack verified publicly; no art binaries in Git.

## Open questions

None for this approved release.

## Known issues

Public headless Brave desktop/mobile DPR2 state/lifecycle and destruction checks pass; no physical-phone/Safari or captured visual test. Owner manually approved the local art; no screenshots or recordings. Initial one-off503 did not recur on the complete rerun. Hosted publishing was not exercised.

## Next proposed step

Use the public Warzone and standalone building tabs for future visual feedback. Existing Falcon draft editor/publishing remains unchanged. Temporary localhost preview stopped after release; no resident publisher/capture service.
