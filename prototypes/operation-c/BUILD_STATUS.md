## Current milestone

Operation C 1v1 r0023: economy recovery, HQ-connected research/conversion support and Dismantle. Deployed to https://operation-c-online.tianz-88.workers.dev/ (Worker version 96f481cc-73a2-44aa-9a0a-6639c439ffc8). Protocol and checkpoints v9; both clients must reload and use a new room.

## What was implemented

Workers prefer reachable neutral hexes within four of their supporting HQ, then search farther for the nearest reachable neutral territory. They still cannot cross enemy territory, buildings, units or gaps and never follow army commands. With no reachable target they return toward their HQ, show an idle ellipsis and explain No reachable territory in the inspector. They resume when a neutral target/route opens. HQ context explains the soft radius.

New research and conversion surcharges draw only from open productive owned hexes connected by adjacent owned land to any completed friendly HQ. Owned buildings and committed cells connect supply; neutral, enemy, burnt and gap cells break it. Initial free HQ centre seeds supply without becoming productive. Running work continues after cuts, with existing support-loss accounting. Ordinary construction funding and total capacity are unchanged.

Completed buildings have a two-tap Dismantle action. The building immediately stops and burns its footprint; living supported units survive as orphans. Surviving assigned supports show the existing ten-second release countdown. Captured/lost assignments are never refunded. Extra completed HQs may be dismantled, cancelling their research and orphaning workers, but the last completed HQ is protected. Unfinished construction retains Cancel Build; selling stays disabled.

## Key technical decisions

Uses existing destruction cleanup, orphaning, debt and delayed support-release logic rather than a second refund system. HQ-connected eligibility is evaluated only when starting research/conversion, and may use any supplied HQ component. Worker preference remains tune.hq.workerGatherRadius=4; capture and movement speeds/costs are unchanged. Protocol/checkpoints v9 safely reject old rooms. No dependencies or services added.

Verification: 129 simulation +32 online tests pass, covering distant neutral capture, idle return/resumption, enemy/gap routes, supply cuts and repairs, committed/building bridges, completed versus unfinished HQ islands, continuation after cuts, dismantle ownership, last-HQ protection, orphan units, captured support discounts, ten-second countdown and checkpoint recovery. Repository TypeScript/build, server TypeScript and standalone build pass. Isolated Brave checks pass on desktop, portrait, landscape and small landscape, including real research/production/nuke progression and two-tap Dismantle with delayed release. Screenshots inspected; no console errors. A real local two-client room passes ready/build/production/authenticated reload and command checks. Desktop and touch bot checks on Ring seed938603 pass. Published portrait progression/Dismantle and a fresh published two-player Ring seed938603 room pass without browser errors; both seats reconnect and use authoritative v9 rules. Portrait research cancellation uses a short label to keep Dismantle unobstructed.

Evidence outside Git: outputs/operation-c-recovery-ui, operation-c-recovery-online, operation-c-recovery-ring-bot and operation-c-recovery-core.txt / operation-c-recovery-online.txt; published evidence in outputs/operation-c-recovery-hosted and operation-c-recovery-hosted-online, final portrait correction in outputs/operation-c-recovery-final.

## Open questions

None. Human playtests should check whether longer worker travel keeps distant expansion appropriately vulnerable.

## Known issues

Exclusive occupancy can still temporarily queue workers; isolated regions without a ground route remain unreachable. The existing standalone chunk warning remains (about1624KB raw). Physical-device and large-concurrency performance are unverified.

## Next proposed step

Reload both clients, create a fresh room and test recovery from a full first-HQ economy on the Ring map. Build another HQ for more workers and shorter replacement travel, rather than to unlock a hard gathering boundary.
