## Current milestone

Two-human private-room 1v1 prototype, 2026-11-03, requested for 2026-11-04 Singapore time. Shareable preview: https://operation-c-online.tianz-88.workers.dev/ . This isolated Worker serves both the standalone client and room backend on the existing verified Cloudflare Workers Free account. GitHub Pages still serves the previous milestone 021126r0008; draft PR #414 remains separate from that publication. Local preview remains http://127.0.0.1:5188/ . Do not manually increment the Pages deployment counter.

## What was implemented

Retains the three-tier catalog, eight unique base-card loadout, eleven base cards/sixteen forms, permanent conversions, squads/reinforcements, construction, research, capture priorities and ten-second support release. Adds Tier-then-cost ordering, disabled tech-locked in-match cards, bobbing upgrade arrows on eligible buildings, and a conspicuous pulsing ring/inward arrows/mode label at the commanded HQ. Reduced motion keeps these indicators static.

HOST 1V1 creates a private room, COPY INVITE shares a token-free guest link, both humans select loadouts and Ready, then a three-second countdown starts. Each browser controls its own authenticated seat, territory, cards and contextual commands. Authoritative WebSocket state, revisioned deltas, rate-limited validated commands and request deduplication prevent client-owned simulation. No online bots or pause. Original-tab reload reconnects the same seat; disconnected seats remain reserved. Matches continue during disconnects. Both-offline computation is deferred and elapsed time caught up on return. Confirmed commands/checkpoints survive object recovery. A new match uses a new room.

## Key technical decisions

Pure fixed-step simulation remains independent of Phaser. One SQLite Durable Object owns each room, with 100 ms simulation steps, 200 ms delta broadcasts, full resync on revision gaps and durable checkpoints. Server identity determines command ownership. The browser mirrors authoritative DTOs and resources, preserving hex lookup identities for placement previews. Session-storage tokens are scoped to server origin/room/host-or-guest role and never appear in invites. Fresh UUID request prefixes prevent reload collisions with saved acknowledgements. Lobby retention is 30 minutes; ended-match retention one hour.

No application dependencies or billing plans changed. Wrangler is isolated development/deployment tooling. Static assets share the isolated Operation C Worker; /health and /ws/* invoke server code. Firestorm, Current WIP itch and other deployments remain untouched. The game-specific CI now includes server typechecking, fifteen networking tests and a two-client local-Worker browser flow in addition to the existing four-profile canvas flow.

Verification: 56 deterministic gameplay tests and 15 online tests pass. Full/scoped TypeScript and hub/standalone production builds pass (existing hub chunk/Punchies warnings remain). Actual independent Brave clients completed full matches through both local Wrangler and the public Worker, with identical final time, winner, hexes, buildings and units. Browser checks cover ready/countdown, rejected third player, both owners' placement/construction/production, player-one HUD/commands, same-seat reload, enemy-command restrictions and rejection of client pause/fast-forward. Desktop, portrait and both landscape canvas regression flows pass their gameplay assertions. Physical-phone/network conditions still require a human playtest.

Evidence lives outside Git in outputs/operation-c-online-production, outputs/operation-c-online-public-server, outputs/operation-c-online-hosted and outputs/operation-c-online-regression.

## Open questions

First-cut assumption: current roster and latest UI, with utility/nuclear mechanics as a follow-up unless the owner includes them. Utility cards share eight slots; silo production/launch/flight/seven-hex blast and friendly fire are recorded in BRIEF.md but not implemented. Numerical tuning and remaining nuclear interactions need discussion.

Pending owner clarifications: exact deadline on November 4 and two-device acceptance test; whether the minimum T1 ground card must specifically be a capturing producer (current validation still allows Flak); utility/nuke scope. Existing roster numbers are provisional. Full races/geography and six-player FFA remain later milestones.

## Known issues

Prototype hosting uses shared Free account quotas, intended for small private playtests. Quota exhaustion can interrupt service. No accounts, matchmaking, spectators or portable seat recovery: closing the original tab/clearing session storage can lose a seat. Room codes are casual invitations, not confidential access control. Both-offline catch-up can briefly delay reconnect. No physical-phone performance, cellular latency or long-session concurrency claims. Shared air/ground occupancy intentionally permits congestion. Reduced-motion preference suppresses flips. Version stamp still reflects the last Pages deployment.

## Next proposed step

Play one real two-device match using the hosted preview: Host 1v1, copy invite, both Ready. Record balance, mobile performance and connection feedback; then review PR #414 for eventual hub publication. Keep utility/nuke implementation behind the pending scope discussion.
