## Current milestone

Worker economy and Recon balance, plus memory-cache cleanup, 2026-11-04. Published version 041126r0018 at https://operation-c-online.tianz-88.workers.dev/ . Worker deployment 9330364e-06fe-4e4e-8ba8-b0ed4bf2c908. Protocol/checkpoints v6: both players must reload and create a new room. Draft PR #414 remains unmerged.

## What was implemented

Workers cannot route through enemy-owned land. Neutral gathering destinations are limited to four hexes around their friendly Gather/Defense anchor or supporting HQ. Exhausted collection waits for a reachable target or a forward anchor. Extra HQs now commit 18 connected tiles and construct for 30s. Starting three workers, four-second capture, eight-second replacement and lethal single hits remain.

Recon now costs 8 tiles, constructs for 3.5s, moves at 550ms/hex and replaces after 10s. Its 35 HP, 3 damage, 700ms attack, sight 3 and worker priority remain. Bunker and other combat values are unchanged. Gather radius lives in tune.json and the debug pane; HQ context explains forward anchors. Deleted HQ labels are destroyed and removed from the UI cache rather than retained across losses/resets.

Added route-blocking, radius-boundary, forward-anchor/Attack and authoritative reconnect regressions. Updated HQ queues, Scout tuning and command/production fixtures without skipping combat, occupancy, resource-debt or nuclear privacy coverage. Added scripts/balance-operation-c.mjs to run actual rules directly.

## Key technical decisions

Corrected a mistake in the temporary study harness: radius/routing variants had also changed worker durability. Their originally claimed low-loss defensive wins are invalid; the old report is marked corrected. The permanent harness performs no hypothetical source edits. The three-change economy patch alone did not stop Recon; corrected trials required the targeted Recon pass above.

Final actual-rule mirrored scenarios: mixed defeats fast-HQ greed at 156.2/217.4s; Bunker/Tank defense defeats Recon at 258.4/133.9s after 28/13 worker losses. Recon still beats undefended greed at 110.7s on one side; the reverse is unfinished at 300s. These demonstrate recovery in controlled policies, not human win rates.

Verification: 111 core + 26 online = 137 passing tests; scoped client/server and full repository TypeScript pass; standalone and full repository builds pass. Full progression passes in isolated Brave at desktop, portrait, landscape and small landscape sizes, including forward gathering to fund the Silo; screenshots inspected and no browser errors. Desktop/touch bot checks pass with mixed forces. A local two-human match ends at 111.6s with identical final worlds. Published two-human placement/production/reconnect and desktop/touch bot checks also pass without browser errors.

Memory: retained Node heap stays about 24.75–24.94MB over 12 simulated minutes and 24.82–25.02MB after six disposed bot matches. Browser heap warms from 7.38MB to about 9.3MB across six HQ-building/match-reset cycles; stale HQ labels are absent after reset. This shows no unbounded growth in those windows and does not measure GPU/OS memory.

Evidence outside Git: outputs/operation-c-balance-release/REPORT.txt, verified/actual-rules.json, memory.json and browser-memory.json; operation-c-balance-final-ui, operation-c-balance-final-bot, operation-c-balance-online and hosted verification folders.

## Open questions

No blocking design question. Human tests should compare defended expansion with raids and check forward-anchor usability. Costs/timers remain provisional. No new dependencies, paid services or unrelated deployments.

## Known issues

Exclusive occupancy can cause congestion. Four-hex collection deliberately stops passive map-wide expansion. Scripted policies lack adaptive forward-anchor placement, tech/nuclear play and counterpicking; starting-seat/path effects are substantial. Physical-device/cellular and high-concurrency behavior remain unverified. The standalone main chunk is about 1,612KB raw, above its existing 1,600KB warning threshold; builds succeed.

## Next proposed step

Reload, start a fresh room or VS BOT, and compare a defended expansion with a Recon-heavy raid. Select a forward friendly building and use Gather/Defense when local neutral collection is exhausted. Judge recovery and match pacing before another numeric pass.
