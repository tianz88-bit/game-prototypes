## Current milestone

LIVE VERIFIED181126r0103/protocol29. PR566 merge2c0ee7a97268be7d687d43a01884610a4556fa2f; itch44292583012, Worker44292583031 and Pages44292583010 all succeeded. Owned pre-mission evolution loadouts released.

## What was implemented

BC/MC each require a permanent1500 bank-credit unlock and a separate equip tap in Hangar → EVOLVE. One evolution slot; buying another keeps current equipment, tapping equipped removes it. The ship-page slot opens EVOLVE. No free default/grandfather grant; legacy numeric preference ignored. Match shop shows both upgrade counters/mineral goal/cost, READY/EVOLVED or NO EVO. In-run requirements remain BC2T/Guns4 or MC4MSL/2MINE plus300 balance/120 cost; combat balance unchanged.

## Key technical decisions

Existing atomic bank/catalogue/cleanLook reused; no migration/dependency/art upload. NetClient freezes requested look at construction; initial auth before binary controls/within3s captures equipment, server bank ownership resolves it. Only server-cleaned roster determines client readiness and only matching player BUY5 passes authority. Resume/Warzone lives retain equipment; NPC sim path unchanged. Protocol29 retains layout and refreshes old free-selection clients.

Type/build/shared sim/config/bank pass. Real SQLite/Room regression covers exact billing/insufficient funds/idempotence, forged/unowned/unequipped/late/silent-late/alternate choices, selected purchase/repeat and resume. Six local PC/touch/portrait plus2 public layouts pass purchase→unlock→explicit equip, one-slot/unequip, old preference ignored, compact progress/minerals/ready/blocked6 and bounds. Public real Worker strips forged MC selection,51 healthy snapshots, NO EVO, version103; no page errors/capture. Proof ../steroids-alpha-lab/evolution/loadout-release-proof.json; raw outputs/steroids-alpha/missile-cruiser-lab/loadout-*.

## Open questions

Owner can refine1500-credit pricing after play. No immediate Claude work; deferred handoff saved.

## Known issues

Browser purchases are intercepted fixtures; no live account credits spent. Positive bank/authority cases use actual SQLite/Room tests, public authority check verifies rejection. Existing random bot-spacing/Pages counter housekeeping remains deferred; this release passed first attempt. No physical Safari review.

## Next proposed step

Refresh for29. Buy then equip an evolution before launch; earn the shown requirements, then explicitly evolve in UPGRADES. Claude backlog saved; temporary preview and headless closed, no resident publisher, no screenshots/recording.
