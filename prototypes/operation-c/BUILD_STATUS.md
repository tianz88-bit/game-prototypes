## Current milestone

Symmetric seeded 1v1 maps and gap-aware movement, 2026-11-04. Published version 041126r0020 at https://operation-c-online.tianz-88.workers.dev/ . Worker deployment cb920597-3bb5-406a-a1d0-b7484a8d4396. New match protocol/checkpoints are v8: reload both players and create a new room. Draft PR #414 remains unmerged.

## What was implemented

Added deterministic Open, Narrows, Forks and Ring presets with reusable uint32 seeds. Open/seed1 preserves the original uncut 271-cell hexagon. Other settings vary shore cuts, choke width, twin routes or the central hole. Terrain, HQ locations, six owned starting cells and initial worker positions mirror under 180-degree rotation. Each start keeps two rings of land and every preset retains a ground route.

Loadout footer opens a canvas map preview with preset/seed controls, reroll, land/gap counts and copyable replay links. Offline choices persist in the URL; ?map=ring&seed=27 reproduces a setup. New private-room hosts carry their offline choice into the room. Only the host can edit lobby maps; guests preview identical terrain. Changes reset readiness and are locked after countdown. Client/server snapshots and checkpoints preserve settings and terrain.

Gaps provide no capture, capacity, construction, research support or support connection. Ground units, workers and production spawns require land. Aircraft can cross consecutive gaps along a hex direction to valid unoccupied land, never stop on gaps, jump occupied land or leave the map. Flight duration scales with crossed distance and source-owned speed; distance-weighted planning avoids treating long flights as one cheap step. Origin/destination reservations and no shared occupancy remain. Weapon ranges and fully visible sight rules are unchanged. Gap art is recessed teal water with ripples; normal terrain art is unchanged.

## Key technical decisions

Full bounding grids retain gap cells so authoritative DTO identity, distances and rendering stay simple. Seeded generation uses no global RNG. Old config omissions normalize to Open/seed1; malformed shapes/seeds are rejected. Protocol/checkpoints v8 prevent old rooms from mixing terrain rules. Host-only map commands are separate from in-match orders. No new dependencies, services or balance-stat changes.

Verification: 125 core +31 online =156 passing tests. These cover mirrored worker starts, seeded terrain symmetry, connectivity, deterministic replay, malformed input, gap resource/support rules, blocked ground routes, occupied flight landings, full crossing duration, checkpoint recovery and host permissions/readiness locking. Scoped client/server and full repository TypeScript/build checks pass. Standalone builds succeed with the existing chunk-size warning.

Isolated Brave map checks pass on desktop, portrait, landscape and small landscape: all presets, seed +/- reproducibility, URL replay, protected starts, gap-safe workers, actual Helipad construction/research and air crossings over water with correct timers and no mid-flight firing. Existing four-profile loadout/RTS/research/nuclear progression also passes. Actual host/guest map selection shows identical previews, disables guest editing, resets readiness and reconnects correctly; a Narrows full match ends at 141.9s with identical final worlds. Final four-profile URL-reload/replay checks and desktop/touch bot checks on Narrows/seed2 also pass. Published mobile preset/seed/flight checks pass, and a published Forks/seed27 room correctly inherits its selected map, shares terrain with both seats and reconnects without browser errors. CI includes map browser checks and a generated-map online match.

Evidence outside Git: outputs/operation-c-maps-regression, operation-c-maps-existing-ui, operation-c-maps-online and operation-c-map-shapes (headless runs for four presets), operation-c-maps-final, operation-c-maps-bot, operation-c-maps-hosted and operation-c-maps-hosted-online. The CLI now accepts <output-dir> [seconds] [shape] [seed] and records map settings with actual-rule results.

## Open questions

No blocking design question. Human playtests should compare choke congestion, worker access, ranged coverage and air shortcuts between seeds. Mirrored terrain does not guarantee identical AI decisions or remove all path/turn tie-break effects.

## Known issues

Exclusive occupancy can cause queues at bridges and shores. Flights cross straight hex-direction gap runs; aircraft still need a legal land cell to stop and producers need land to spawn. Land counts differ between presets and seeds, visibly reported in preview, so experiments change available economy as well as routes. Physical-device/cellular and high-concurrency performance remain unverified. Standalone main chunk is about1620KB raw, above its existing1600KB warning threshold; builds pass.

## Next proposed step

Select MAP from the loadout, choose a preset/seed and compare the same loadouts on several shapes. Hosts choose private-room maps before Ready. Use fresh rooms for v8.
