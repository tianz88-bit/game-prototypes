## Current milestone

Coordinated pace experiment, 2026-11-04. Published build 041126r0019 at https://operation-c-online.tianz-88.workers.dev/ . Worker deployment 91984351-bf7b-4941-a0d4-6b2bb3559075. Protocol/checkpoints v7 require both players to reload and create a new room. Existing draft PR #414 stays unmerged.

## What was implemented

Neutral capture 4→6s; full-squad enemy capture 6→9s. Most building commitments are about 15–20% cheaper after whole-tile rounding: Barracks5, Tank/Artillery/Bunker7, Helipad/Airbase8, HQ16, Silo20. Recon stays8. Research commitment20→16 with unchanged30/60s timers. Permanent conversion costs derive from new total producer costs; Barracks surcharge2 and Airbase free conversion remain. All positive unit moveMs increase about15%, rounded to10ms; the 1.25 friendly speed bonus remains. Military production, HQ worker replacement, weapons, HP and construction timers are unchanged by this experiment.

Workers now gather independently around their own supporting completed HQ, or the closest surviving HQ when orphaned. Military Defend/Attack commands do not redirect workers. Capture and destination choice both enforce the four-hex HQ boundary; workers may traverse neutral/owned land but never hostile territory. Extra HQs extend economic reach. Friendly command labels say DEFEND HERE; HQ context describes HQ-bound gathering. The prior HQ-label cache cleanup remains.

## Key technical decisions

All current values are recorded in tune.json and the accepted top section of BRIEF.md. No experimental source mutation, hidden unit durability changes or dependencies. The permanent headless harness loads actual runtime rules, now recording building counts, moving units and incoming squad members alongside territory, army size and worker losses.

Actual mirrored scripted scenarios: at60s the mixed opener holds30–31 tiles and5 buildings versus r18's43–44 tiles and6 building starts, giving slower expansion but more buildings per owned tile. Mixed defeats the economic opener at183.5/180s; Bunker/Tank defense defeats Recon spam at230.7/159.8s. Recon still defeats undefended greed on one side at142.9s; the reverse is unfinished360s. Results are provisional policy comparisons, not human win rates. Existing policy limitations include no adaptive tech/anchor strategy or counterpicking.

Fixed an interaction exposed by dense layouts: while aiming a nuke, over-map army command buttons are hidden so they cannot intercept target taps. Browser checks explicitly cover this.

Scoped client/server TypeScript and full repository typecheck/build pass; standalone builds succeed. Local actual two-human play/reconnect/ownership checks pass and a full command-driven match ends at117.7s with identical final worlds. Desktop/touch bot checks pass with mixed legal forces and exclusive occupancy. 113 core +26 online =139 tests pass, including HQ-bound gathering and orphan/forward-HQ behavior. Full RTS progression passes at desktop, portrait, landscape and small landscape sizes without browser errors; screenshots inspected. Published private-room placement/production/reconnect and desktop/touch bot checks also pass without browser errors. Evidence outside Git: outputs/operation-c-deliberate/headless-final/actual-rules.json, headless-final.log, ui-verified, online, bot, hosted-online and hosted-bot.

## Open questions

No blocking implementation question. Human playtests should judge the deliberate pacing, building density, forward HQ investment and recovery from raids before another numerical change.

## Known issues

Exclusive occupancy can create queues as cheap commitments allow more producers on owned territory. Full physical-device/cellular/high-concurrency behavior remains unverified. The standalone main chunk is about1612KB raw, above the existing1600KB warning threshold; builds pass. Pure economic greed remains vulnerable in scripted scenarios; the experiment does not establish competitive balance.

## Next proposed step

Compare a defended HQ expansion against a mixed attack and Recon raid using fresh rooms. Worker expansion is automatic from HQs; DEFEND HERE moves military only.
