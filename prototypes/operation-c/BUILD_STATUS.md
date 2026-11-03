## Current milestone

Friendly-territory movement playtest, 2026-11-03. Published preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version 031126r0011; Worker deployment ea4333b4-fa21-4e94-9b1a-8039c04d8719. PR #414 remains the review branch; GitHub Pages and unrelated deployments are unchanged.

## What was implemented

All mobile ground and air units move 25% faster when departing their own territory: base step duration divided by 1.25. Ownership is sampled at step start and arrival time remains fixed through captures and checkpoint recovery. Neutral/enemy territory retains base speed. The rule applies equally to both players, retreats and traversable owned support/burnt cells. A Movement folder exposes the multiplier in the existing debug pane.

Base card movement values, production cooldowns, cosmetic squad reinforcement travel, combat, capture and resource rules are unchanged. Production still begins on supported unit death, or the first squad member casualty. All previous damage classes, nuclear utilities, HQ defence, loadouts and commands remain available. Confirmed movement scope and deferred reset proposals are recorded in BRIEF.md.

## Key technical decisions

The existing movedAtMs/movingUntilMs timestamps carry the latched duration through client interpolation, authoritative deltas and recovery. No new protocol or dependencies. The new tune.movement block is optional for v3 checkpoint compatibility: existing rooms without it retain original speed. Reload and create a NEW room to test the 1.25 multiplier.

Verification: 75 core and 19 online tests pass, including both owners/all mobile forms across source ownership, destination independence, mid-step captures, recovery and old-tune compatibility. Full repository and server TypeScript checks pass. Full repository and standalone builds pass, with existing unrelated hub warnings. Four isolated Brave layouts (desktop, portrait, landscape and small landscape) pass the complete gameplay UI flow without console/page errors; desktop and phone screenshots inspected. Two independent local Worker clients complete a full match at 66.9 seconds with identical final worlds. Published two-seat smoke checks also pass placement/production, building anchors, reconnect and enemy-command restrictions with no browser errors. Screenshots/results are outside Git in outputs/operation-c-movement-regression, outputs/operation-c-movement-online and outputs/operation-c-movement-hosted.

## Open questions

Assess whether faster home response creates enough recovery time before changing production intervals. HQ Mobilize, HQ repair and economic changes are discussion proposals only. The recaptured former support tile itself is open and usable; this pass does not change economic bookkeeping. The earlier minimum T1 ground-card capture requirement remains unresolved and unchanged.

## Known issues

This is a balance experiment, not evidence that snowballing is solved. Faster movement also benefits attackers on their own captured territory. Exclusive occupancy still permits congestion, and simulation steps quantize arrival processing. Physical-device/cellular and large-concurrency performance remain unverified. Existing rooms retain old movement tuning; start new rooms.

## Next proposed step

Play a fresh two-human room and compare defensive response and attacker reinforcement travel. Adjust production cooldowns only after observing this movement-only change.
