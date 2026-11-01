## Current milestone

Combined-arms local playtest, 2026-11-01. Existing local preview http://127.0.0.1:5188/ serves the new standalone production build. PR #410 will be updated with the complete iteration. Hosted Pages remains on the earlier build; merge/publication awaits explicit owner approval following the prior automatic approval review rejection.

## What was implemented

Barracks 4, Factory 8, Artillery 8, Hangar 12 and Airfield 12. Helicopters attack ground only; fighters attack air only; neither captures. Infantry can attack both domains; tanks and artillery attack ground only. Artillery retains frail 38 HP, has a minimum range of 2 (maximum 3), and retreats after actual damage. Five vector building/unit silhouettes, rotor animation, floating aircraft and attack-domain labels fit desktop and phone layouts.

Capturer death starts slow reversal of incomplete progress toward the unchanged original controller. A replacement capturer can resume it; a living unit attacking or merely leaving does not trigger reversal. Ground expansion fills reachable neutral land in rings from the HQ before hostile land. Aircraft in Expand mode seek nearest valid intruders on owned land, otherwise return home; Attack mode seeks valid targets toward the enemy HQ. Owner confirmed one shared occupancy slot: air, ground and buildings block each other, with shared movement reservations and queues.

Earlier capture flips, horizontal-only unit mirroring, actual-shot traces, committed locks and gold hammer two-tap confirmation remain included. No construction cooldown added.

## Key technical decisions

Deterministic fixed-step rules remain separate from rendering. Card data declares domain, valid target domains and minimum range. Buildings are ground targets. Shot records carry target domain for altitude-aware traces. Aircraft cannot add capture pressure. No separate air occupancy layer. Casualty rollback tracks the responsible capturer; progress shrinks without changing ownership. Provisional rollback is 0.25 times baseline capture speed, artillery retreat memory 2200 ms, and new aircraft stats are in tune.json/debug controls.

Verification: 31 behavior tests pass, including target matrix, non-capture, defensive pursuit/return, fighter HQ approach without ground fire, spawn/movement blockages, casualty reversal and artillery screening. Full/scoped TypeScript and hub/standalone production builds pass. Brave development checks pass desktop 1440x900, portrait 390x844 and landscapes 844x390/667x375, with all five producer costs/spawns verified and no console errors. Inspected phone helicopter/fighter silhouettes and five-card layouts. Standalone production bundle passes the same four Brave profiles, all five producer placements/costs, capture/landing and actual-shot checks, with no console errors.

## Open questions

BRIEF.md is the permanent design reference. Corrected reinforcement rule: incoming members vanish when their target squad is destroyed; they cannot recreate a wiped squad. Reinforcement travel is visual/non-interactable with no hex occupancy until members merge. Dispatch quantity counts living and already travelling members toward five. Selling/upgrading retires incoming reinforcements. The older wiped-squad continuation statement was wrong and has been removed from active rules.

Confirmed design awaiting implementation: base-only loadouts (up to 8 unique, at least one T1 ground producer), tier roster, five-member infantry squads, top research control, permanent one-way building upgrades, selling, building construction times, persistent inspector/right card panel and discounted support release with stranded debt. Research T1-to-T2 is 20 tiles/30s; T2-to-T3 is 20 tiles/60s. Upgrade support can be disconnected and uses up arrows; research uses flasks. Full rules and approved construction/conversion timings are in BRIEF.md.

Construction and upgrade health/lifecycles are confirmed, including fresh full base production cooldown on unfinished-upgrade cancellation. Owner clarified squad combat: each member has individual attack power, with the five-member group balanced as a whole; do not implement a fixed 20-percent squad modifier as the underlying stat model. All squad members focus one shared target, confirmed by owner. Remaining design: attack timing, health/damage allocation and capture scaling; new unit stats and splash; numerical reinforcement travel/cooldown details; incoming reinforcements if only the producer is destroyed; retired capturer progress; sale duration/interruptibility and selling an upgrading building; final catalog/tier presentation.

## Known issues

Two-HQ local bot sandbox; no six-player networking/final map/factions. Physical phone performance and balance remain unverified. Shared occupancy intentionally lets aircraft be blocked by ground traffic/buildings. Reduced-motion preference suppresses capture flips. Existing hub build warnings concern legacy chunk size/Punchies imports; builds pass. Publication is not authorized yet; do not merge PR #410 or unrelated migration PRs without approval.

## Next proposed step

Loadout-slot and permanent upgrade rules are settled. Construction lifecycle is confirmed. Upgrade interruption is confirmed. Resolve remaining squad/combat integration before implementing the expanded milestone; cancellation production restart is confirmed as a fresh full base-type cooldown; include discounted sale/destruction debt accounting. Existing preview remains available for combined-arms playtesting. Publication of PR #410 still requires explicit approval.
