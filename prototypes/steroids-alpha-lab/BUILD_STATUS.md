## Current milestone

Production loadouts LIVE181126r0103/protocol29 via PR566; Pages44292583010, itch44292583012 and Worker44292583031 succeeded. Existing design lab remains public and isolated.

## What was implemented

Production Hangar requires1500 bank credits per permanent evolution unlock, then explicit pre-mission equipment; match shop shows both requirement counters/resources. This standalone lab keeps free prepare/evolve controls for design comparisons and never unlocks/equips an account. MC base0/min90 and bought CIWS behavior retained.

## Key technical decisions

Lab account isolation unchanged. Shared catalogue/config adds evolution slot/price; backend verifies initial loadout and ownership, protocol29 same layout. Six local+2 public UI cases and SQLite/Room bank tests pass; public real authority rejects forged MC selection over51 healthy snapshots. No capture. Portable production proof evolution/loadout-release-proof.json.

## Open questions

Owner may tune progression after play; no immediate Claude request.

## Known issues

No live credits spent by QA; positive bank/equip checks use SQLite/Room and browser intercepted fixtures. Design lab intentionally bypasses account progression only in its isolated model.

## Next proposed step

Use Hangar → EVOLVE for real unlocks/loadouts and this lab for art/combat comparison. Deferred handoff saved, preview/headless closed.
