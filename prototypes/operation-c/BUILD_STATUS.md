## Current milestone

Worker/HQ economy, 2026-11-03. Preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version 031126r0017. Worker deployment 14080547-d4dc-4c38-af34-6be86d53a163. Published two-human placement/production/reconnect and desktop/touch bot checks pass without browser errors. Protocol/checkpoints are v5: reload both clients and create a new room. PR #414 remains the draft review branch; no merge or unrelated deployment.

## What was implemented

Start with six productive adjacent cells and three Engineer workers per original HQ. Remove continuous HQ capture. Workers capture neutral land only, take 4s per cell, never fight or flee, and die to any positive damaging hit. Infantry/Missile/Machine-gun squads alone capture enemy land with living-member-scaled strength; other military cannot capture. Recon prioritizes visible workers in either mode, using its own sight.

HQ is fixed in the first deck slot, leaving seven unique selectable base cards. Additional HQs commit 12 connected owned cells, construct for 15s, then sequentially produce three workers at 8s each. Casualties restart sequential replacement without stockpiles. Orphans survive and keep gathering without replacements. Only loss of the last completed HQ eliminates a faction; unfinished HQs do not prevent elimination.

Research upgrades the selected completed HQ: 20 temporary open owned cells, 30s to T2 / 60s to T3, no connectivity requirement. Highest surviving completed HQ sets new tier access. Existing advanced producers and units keep operating after technology loss. Losing the researching HQ cancels its research. Completed selling is disabled; unfinished construction, conversions and research can still be cancelled with the existing discounted support release rules.

Selecting buildings only inspects them and exposes above-map/contextual commands: friendly Gather/Defense, hostile Attack Here. Workers keep gathering during army attacks. Destroying an attack destination returns the order to the nearest surviving friendly completed HQ. Worker vector art, worker/HQ details, level labels and compact landscape context layout are integrated. The bot uses the same economy, expands HQs, raids workers and excludes unarmed workers from emergency military pressure.

## Key technical decisions

Server-authoritative commands remain fixed-step deterministic. Protocol, simulation and room checkpoints advance to v5; older rooms require a fresh room. No new dependencies, paid services, browser credentials or account changes. Existing nuclear privacy, combat classes/bonuses, exclusive occupancy and death-triggered military replacement remain intact.

Provisional implementation defaults: worker movement 650ms/hex, sight 1; default selectable seven are Barracks, Motor Pool, Artillery Battery, Airbase, Recon Post, Bunker and Silo. Original free HQ centre is nonproductive; a paid HQ's cell remains productive so a twelve-cell expansion has no automatic extra debt. Canonical decisions are recorded in BRIEF.md.

Verification: 108 core + 25 online = 133 passing tests. Scoped client/server and full repository TypeScript pass; standalone and full repository builds pass. Unit/server coverage includes worker queues/blockades/orphans, lethal worker hits, last-HQ elimination, linked research and technology loss, grandfathered advanced replacement, no-selling/cancellation, Recon priorities, building targets/fallback, authoritative reconnects and deterministic recovery. Existing combat/production/debt/nuclear privacy regressions remain covered.

Isolated Brave checks pass on desktop, portrait, landscape and small landscape: fixed HQ/seven-card loadout, worker inspection, extra HQ construction and sequential workers, selected-HQ research through T3, upgrades/cancellation, utilities/nuclear presentation and explicit commands. Bot-enabled desktop/touch checks pass with mixed army construction and exclusive occupancy. A real two-client local match ends at 112.4s with identical final worlds; reconnect and enemy command restrictions pass, with no browser errors. The compact HQ text fix was visually rechecked. Evidence outside Git: outputs/operation-c-workers-regression, operation-c-workers-compact, operation-c-workers-bot and operation-c-workers-online, operation-c-workers-hosted-online and operation-c-workers-hosted-bot.

## Open questions

No implementation question remains from the approved twelve defaults. Costs, timings and movement are provisional playtest values. Competitive balance and whether worker raiding provides enough recovery/counterplay require human playtests. The bot does not autonomously launch nukes.

## Known issues

Exclusive occupancy can cause congestion, including around HQ worker spawns. Physical-device/cellular latency and high-concurrency/free-quota capacity remain unverified. The standalone main chunk is about 1,611KB raw, slightly over its existing 1,600KB warning threshold; builds succeed. Scripted test wins do not prove fair balance.

## Next proposed step

Reload and create a fresh private room, or choose VS BOT. Compare an early military rush with investment in an additional HQ, and test worker raids and recovery before changing numerical balance again.
