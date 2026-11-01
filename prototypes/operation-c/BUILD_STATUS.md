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

Upgrade resource support is confirmed disconnected: any open, owned, unburnt, uncommitted owned tiles can supply an upgrade surcharge, with sufficient global capacity. Mark those permanent support assignments with an up arrow over darkened owner colour; research keeps flasks. New buildings still need connected support. This prevents enclosed producers from being unable to upgrade. Recorded in BRIEF.md; not implemented.

Owner approved provisional build times: Barracks 3s, Factory/Artillery 5s, Hangar/Airfield 6s, MLRS 8s. Upgrades: Armoury 5s, Bomber Airfield 8s. Separate from unit production. Recorded in BRIEF.md; not yet implemented. Construction-health behavior is confirmed: full building HP at placement, vulnerable/inactive during construction; completion does not heal. Upgrading preserves current HP and does not heal on completion.

Latest T2-to-T3 playtest setting: 20 open uncommitted owned tiles for 60 seconds, superseding 30 tiles/45 seconds. T1-to-T2 remains 20 tiles/30 seconds. Same research/debt/release/cancellation rules apply.

Upgrade lifecycle is now confirmed: reserve added support, retire current forces/incoming reinforcements and pause production on start; unfinished cancellation loses progress/releases only remaining upgrade supports and leaves the base building without restoring its retired unit; destruction burns and releases remaining base+upgrade supports; completion permanently changes production, spawns when legal and starts the new production cooldown. Base-production restart after cancellation and numerical timings remain open.

Latest owner decisions: loadouts select only base building cards; upgrades are options on selected placed buildings. New selling direction introduces construction time for every building, superseding instant completion and remaining separate from unit-production cooldown. Add persistent entity details when selecting hex occupants (unit movement does not switch the inspector), Warcraft/StarCraft-style building commands, and move all building cards to the right panel. These remain design work, not implemented. Selling retires the unit/squad and incoming reinforcements, restores its tile to open owned territory and excludes HQs. Owner changed BOTH selling and enemy destruction to release only support tiles still assigned to the building; captured assignments discount the release and their commitment remains as match debt. This supersedes the previous full-cost destruction release. Current sandbox code still uses full destruction release; the new rule is design-only until implemented. Owner confirmed construction lifecycle: reserve full cost/block tile on placement; vulnerable with no production during construction; first spawn on completion followed by production cooldown, waiting for a legal cell if blocked; selling unfinished construction releases remaining supports/open tile; destruction releases remaining supports/burnt tile. Construction/upgrade durations, health and upgrade interruption are confirmed; remaining integration questions are listed in BRIEF.md; BRIEF.md records them.

BRIEF.md is now the consolidated permanent design reference, reconciled 2026-11-02. It restores the previously discussed cooldown-based squad reinforcement rule (faster travelling reinforcements can continue a wiped squad) instead of asking the owner to choose again. Slower Missile Infantry build means unit production cooldown, not construction time.

Current design discussion: Barracks to Barracks+/Armoury for Missile Infantry and Airfield to Airfield+ for Bombers, replacing the old unit with a new one on conversion. Owner confirmed upgrade surcharges stay committed for the building lifetime and vary by upgrade: Barracks+ adds 2 (total 6); Airfield+ is being explored as a zero-surcharge timed permanent upgrade retaining base cost 12. Latest unit-removal timing is conversion START with brief retreat/fade, superseding removal at completion. All upgrades are confirmed permanent and one-way, including Fighter-to-Bomber. Timer/connectivity, slots, unfinished-upgrade interruption and reinforcement handling remain open. BRIEF.md contains the consolidated design review checklist. Loadout/research/squads/T3 and upgrades remain unimplemented. See BRIEF.md for confirmed tiers, costs, 8-unique loadout, research debt/cancellation and remaining decisions.

## Known issues

Two-HQ local bot sandbox; no six-player networking/final map/factions. Physical phone performance and balance remain unverified. Shared occupancy intentionally lets aircraft be blocked by ground traffic/buildings. Reduced-motion preference suppresses capture flips. Existing hub build warnings concern legacy chunk size/Punchies imports; builds pass. Publication is not authorized yet; do not merge PR #410 or unrelated migration PRs without approval.

## Next proposed step

Loadout-slot and permanent upgrade rules are settled. Construction lifecycle is confirmed. Upgrade interruption is confirmed. Resolve remaining squad/combat integration and cancellation production restart before implementing the expanded milestone; include discounted sale/destruction debt accounting. Existing preview remains available for combined-arms playtesting. Publication of PR #410 still requires explicit approval.
