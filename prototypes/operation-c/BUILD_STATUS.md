## Current milestone

Roster balance playtest, 2026-11-03. Published preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version 031126r0012; Worker deployment d07de534-0ed8-4141-b1cb-014da3eced10. PR #414 remains the review branch; GitHub Pages and unrelated deployments are unchanged. Reload and start a NEW room to use the new tuning.

## What was implemented

Infantry replacement cooldown 6.5s to 8s. Recon damage 5 to 3 and replacement cooldown 5s to 7s, retaining speed/capture role. Battle Tank health 130 to 180, retaining the 1.3s firing interval. Bunker health 180 to 280 and damage 5 to 8 per second, retaining cost 8 and range 1-2. Field Artillery now uses radius-one enemy-only splash: 19 damage to every member on the centre hex and 35% (6.65) to eligible adjacent enemies. Existing frailty, retreat, minimum range and firing/production timings remain.

Advanced commitments: Helicopter/Fighter/Bomber/Tank Destroyer 10; Walker/Gunship/MLRS 12; Siege Tank 16; Carrier 18; Silo 24. Surcharges remain total minus base: Missile +2, Siege +8, MLRS +4, Gunship +2, Bomber +0. Research still commits 20 temporary tiles for 30s T2/60s T3. Advanced construction and production timers, HQ gun, nuclear damage, friendly movement bonus and all resource lifecycle rules remain unchanged. Catalog notes and canonical BRIEF.md reflect current tuning. Debug controls now include building health and existing splash parameters.

## Key technical decisions

Existing squad splash and upgrade allocation logic already supports the approved changes; gameplay changes are in tune.json. No protocol or dependencies changed. New rooms use current tuning; existing v3 rooms preserve their checkpoint tuning. Artillery's direct hit can wipe a fresh squad; adjacent regular infantry survive with 1.35 HP/member and Missile Infantry with 0.35. Nuclear damage remains 200 centre/80 outer, so the new full-health Bunker survives one centre hit at 80 HP.

Verification: 80 core + 19 online tests pass. Targeted tests cover actual cheaper support budgets, all upgrade surcharges, unchanged research/movement and advanced timers, 180 HP tank durability with anti-armour counterplay, Recon's per-member chip damage, Artillery splash/falloff/domain/minimum-range/cadence and Bunker destruction under sustained fire. Full repository TypeScript, client/server scoped TypeScript, full repository build and standalone build pass; existing unrelated hub warnings remain. Four Brave layouts (desktop, portrait, landscape, small landscape) pass the full gameplay flow without console/page errors. Desktop/phone screenshots inspected. Two independent local Worker clients completed a match at 85.5s with identical final worlds. Published two-client smoke checks pass placement/production, building anchors, reconnect and enemy-command restrictions without browser errors. Evidence outside Git: outputs/operation-c-balance-regression, outputs/operation-c-balance-online and outputs/operation-c-balance-hosted.

## Open questions

Playtest whether Artillery now suppresses infantry too sharply, whether Tank durability creates enough frontline time, and whether cheaper advanced commitments are accessible without displacing T1. These are provisional balance settings. Earlier HQ Mobilize/repair and economic proposals remain unapproved; no implementation in this pass. Minimum T1 ground-card capture requirement remains unresolved and unchanged.

## Known issues

Tests verify behavior rather than competitive balance. Exclusive occupancy can still cause congestion; physical-phone/cellular and high-concurrency performance remain unverified. Faster friendly movement benefits attackers on their own captured land too. Existing rooms retain old balance tuning.

## Next proposed step

Play a fresh two-human room with Infantry/Recon against Tank/Artillery/Bunker, then compare access to T2/T3 production. Review results before further numerical changes.
