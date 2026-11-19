## Current milestone

LIVE VERIFIED191126r0108/protocol32. PR577 merge076417e1ea73c84960404a57e9941ba172c58c16; itch44443795181, Worker44443795129 and Pages44443795169 succeeded. Owner approved the tested bot survival changes and500-credit evolution unlocks.

## What was implemented

Bot aim wobble7→14deg, perception.25→.45s, mean reaction.9→1.3s. Ordinary encounters make an attack pass then commit to a1.2s exit below360px; siege retains close-approach behavior (shared observation tuning also applies there). Occupied open-player entries/retries reuse ship/rock-clear spread placement; empty-room/home/Warzone positioning and arrival immunity unchanged.

Both permanent evolution unlocks now500 bank credits, still bought/equipped explicitly. Mineral prices5/10/15/20 (250 all20), in-run evolution50/earliest115 path and prerequisites unchanged. Ship health/damage/fire/movement/grip/ram rules, art/rig and+76.8% fighter benchmark retained.

## Key technical decisions

Protocol32 keeps layout but forces paired client/Worker refresh for catalogue quotes. Bot behaviourVersion1 migrates old observations once, preserves later edits/mineral/calibration data. Evolution quote500 is deployment-owned and normalized in effective config. Historical stored record remains; effective socket/client/lab data verified. No D1 migration, asset/dependency or resident publisher changes.

Typecheck/build/full sim/progression/grip/capital/tutorial, live-config/OIDC/admin/publisher, SQLite499 insufficient/exact500/duplicate/ownership, rig/FFD/building/22 layouts and new survival regression pass. Equal600s×10 seeds per policy: deaths27.5→4 mining,10.5→1 evasive,18→2.5 with frozen combat pilot.40 safe500-credit account routes reach first cruiser8:23–8:34 median after2 extractions.

Public headless Brave PC/portrait verify both500 quotes, purchases/equipment using mocked accounts; real home55 snapshots/ack100 confirms effective bot epoch/price/all mineral tracks and rejected empty buy. Actual Planet A80 snapshots/ack155 with4 bots,HP50 and arrival0 stays connected. Public lab shows aim14/perception.45/reaction1.3 and whole-mineral5/10/15/20 fields; hidden epochs, no writes/errors. Public stamp191126r0108. Proof bot-survival-proof.json and BOT_SURVIVAL_REVIEW.md. No screenshots/recording/live spending; test browsers finite.

## Open questions

No blocking questions. Owner chose500 rather than a free starter evolution and approved release. Claude backlog updated for deferred sync.

## Known issues

Scripted pilots do not measure human beginner/PvP difficulty; human playtesting should confirm adequate challenge. Death lifetime samples exclude survivors, so no population survival median is inferred. Safe account route excludes tutorial/sign-in/human menu/network time and assumes successful unlock/equipment after earnings. Public account transactions are fixtures; real billing/authorization has separate SQLite/Room coverage. Existing large-bundle warning remains.

## Next proposed step

Human playtest bot attack passes, escape opportunities and first-cruiser access; retain current mineral prices while observing the live results.
