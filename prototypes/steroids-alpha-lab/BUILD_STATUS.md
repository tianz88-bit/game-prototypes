## Current milestone

Public permanent lab matches LIVE181126r0107/protocol31 balance. Pages44357659573 succeeded; production PR574.

## What was implemented

Shared actual hull capacity separates lab health bars/repair from money. Evolution sandbox keeps free prepare/evolve; production still requires owned/equipped1500-credit unlocks and in-run prerequisites. Evolution cost/floor50; Shop5/10/15/20 per track. Hidden internal balanceVersion; whole-mineral tier inputs.

## Key technical decisions

Canonical hullCapacity/mineralBalance interpret legacy wire hullMax=baseHP+wallet. Historical config parses into epoch2 without losing calibration. No production sockets/account writes in isolated sandboxes. Public lab DOM check confirms5/10/15/20 inputs with step1 and no exposed epoch control; no writes/errors/capture. Evolution gate/type/build/rig pass. Proof progression-balance-proof.json includes3 local/2 public game transactions and real Worker55 snapshots.

## Open questions

No blocking questions. Owner benchmark target recorded in production BRIEF.md.

## Known issues

Evolution sandbox is a design preview and does not unlock/equip live accounts. Power benchmark excludes capital roles, ordnance tactics, accuracy and regeneration. No screenshots/recording.

## Next proposed step

Playtest progression pace and fresh-versus-max combat; keep capital role balance separate.
