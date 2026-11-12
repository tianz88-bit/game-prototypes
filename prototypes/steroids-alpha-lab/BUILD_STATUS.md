## Current milestone
Repair private live publishing after the background companion stopped.

## What was implemented
Restarted the companion outside the chat command lifetime; supplied a local restart shortcut. Updated the private checkout to the current game contract. Retained ten observed baseline records so equivalent migrated settings do not falsely block older drafts. Existing drafts remain intact.

## Key technical decisions
Publishing remains loopback-only and uses the existing authenticated main-branch workflow. A version mismatch may proceed only when an independently observed historical baseline normalizes to exactly the current live data; unknown baselines and real changes still require review. No authentication or compare-and-swap checks were removed.

## Open questions
Publishing after a PC reboot requires starting the companion again; hosted administration remains separate scope.

## Known issues
The public page cannot start a stopped local process. The supplied Windows shortcut starts it hidden. This change does not alter gameplay tuning or complete the production FFD port.

## Next proposed step
Use Publish from the permanent lab; keep the private companion checkout current when the game's configuration contract changes.
