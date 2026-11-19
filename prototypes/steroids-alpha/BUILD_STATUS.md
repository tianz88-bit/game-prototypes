## Current milestone

Progression pace study completed19 November2026; live107/31 unchanged.210 seeded headless simulation runs saved in ../steroids-alpha-lab/PROGRESSION_PACE.md and progression-pace-proof.json.

LIVE VERIFIED181126r0107/protocol31. PR574 merge d43bdd7e8dba3d315055fea50640932fcd9fa6bf; itch44357659530, Worker44357659566 and Pages44357659573 succeeded. Flat fighter progression and cheaper mineral shop released.

## What was implemented

Measurement only: safe max20 upgrades median2:32–2:46; owned cruiser~1:15–1:19. Zero-credit account → first evolution~16:49–17:57 with4 successful extractions; permanent unlock remains1500. Cost−79.8% matches safe elapsed−81.9%, not a linear combat-power reduction. Runtime/tuning unchanged.

Owner-selected about+75% fighter power target measures+76.8% strongest max Falcon versus fresh Sparrow on60-second main+ideal automatic-drone DPS × hull/shield. All5 upgrade tracks5/10/15/20 minerals,250 for20 upgrades (was1240). Both owned/equipped evolutions50 cost/floor,115 earliest mineral route including existing BC Turrets2/Guns4 or MC Missiles4/Mines2.1500-credit permanent unlocks unchanged.

Wallet and combat health are independent; mining/spending cannot heal or damage. Actual hull50, fighter max shield65 (Bat45.5), tier gun damage+12%, heat capacity+10%; drones0.8 damage, ordnance retains capacity/utility without tier damage stacking. Repair, bounded wallet-only loot, health bars, roster/extraction and tutorial follow the new economy. Art/rig/controls/calibration and capital role factors retained.

## Key technical decisions

Protocol31 forces paired refresh without wire-layout changes. Legacy hullMax stores base HP+wallet; use mineralBalance/hullCapacity. Existing carried-load size/speed penalty retained. Room preserves wallets across config base-hull edits. Epoch2 upgrades historical published balances once, preserving unrelated settings/later epoch2 edits. Historical stored ConfigRecord/hash remains unchanged; effective socket/client/lab data are migrated. No D1 migration, resident publisher, credentials, assets or dependencies.

Type/build/full sim/progression/capital/grip, real SQLite bank, live-config/OIDC/admin/publisher, rig/FFD/building/layout and evolution-lab pass.3 local+2 public headless Brave PC/touch/portrait cases buy all20 through actual local Room/NetClient and test empty/repeat taps,49/50 evolution, health invariance and bounds. Actual public Worker55 snapshots/ack92 confirms HP50, wallet0, roster0, rejected empty buy and socket epoch2. Public lab prices/whole-mineral fields pass with no writes; public label reads181126r0107. No screenshots/recording. Durable proof ../steroids-alpha-lab/progression-balance-proof.json.

## Open questions

Owner's benchmark choice is recorded in BRIEF.md. No blocking questions. Measure actual time-to-upgrade, missile/mine tactics and capital siege matchups through playtesting. Claude handoff remains deferred in CLAUDE_BACKLOG.md.

## Known issues

Power index excludes accuracy, shield recovery, tactical ordnance and capital roles; it is not a win-rate guarantee. Browser account ownership is a fixture; real billing/positive authority are covered separately by Room/SQLite tests. Headless pace now measured under documented scripts; human beginner completion time remains unmeasured. Existing Vite large-bundle warning remains.

## Next proposed step

Review the measured safe pace, permanent-unlock grind and interrupted progression with the owner. Human playtest survival and combat; discuss an earlier first-cruiser unlock if desired. No further tuning approved by this measurement request.
