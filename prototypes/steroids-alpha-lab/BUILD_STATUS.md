## Current milestone

Resource pickup candidate tested on codex/steroids-resource-pickups; not released. Public game remains 191126r0108/protocol32. Original sprite ZIP uploaded and downloaded/hash-verified in existing game-assets R2 bucket.

## What was implemented

Separate gold mineral crystals and purple salvage cases (ordinary planets) or cyan fuel canisters (own home); green repair pod retained. Matching pooled HUD icons and short-range server attraction, independent wallet/cargo collection. Tutorial mineral-only and Warzone no mined cargo.

## Key technical decisions

Protocol33 requires paired client/Worker release. Movement coalesces at snapshots and interpolates over wrapped seams. Magnet adds64px at420px/s; ownership, nearest eligible target, spill locks and capacity remain authoritative. Partial cargo retains remainder. Pool400 accommodates separate drops; cap remains bounded. One-time pickupVersion migration preserves subsequent tuning. No D1 migration/new dependency/resident publisher. Mineral/evolution prices and generated nominal reward totals unchanged.

Typecheck, packed production build, full sim including new pickup gate, config/admin, SQLite bank and rig/building/22 layouts pass. Actual Room+NetClient headless Brave PC1280x720/mobile568x320/390x844 atDPR2 independently collect ore/salvage/home fuel, update HUD, interpolate wrap seam and reject stale resurrection; no page errors.400-image stress retains231/226/226 textures, median16.7ms and p95~17.6–17.8ms on this PC. No captures or live account writes.

## Open questions

Candidate is ready for owner review/release. No further upload or identity permission needed.

## Known issues

Separate physical cargo makes actual earnings depend on what is collected; prior progression timings assumed bundled rewards and should not be reused as new measurements. Headless fixtures cannot predict real mobile GPU performance or concurrent room CPU. Existing bundle-size warning remains.

## Next proposed step

Review resource silhouettes and collection feel, then publish client/Worker/lab together. Deferred Claude handoff in CLAUDE_BACKLOG.md; lab/resource-pickups-proof.json records evidence.
