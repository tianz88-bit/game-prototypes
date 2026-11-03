## Current milestone

Individual sight and local engagement, 2026-11-03. Published preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version 031126r0014; Worker deployment 86de1ea1-3b39-4f42-9583-a871abb75367. Protocol, room and simulation checkpoints are v4. Both players must reload and create a NEW room; older rooms fail clearly with a version-change message. PR #414 remains the review branch; GitHub Pages and unrelated deployments are unchanged.

## What was implemented

Each mobile unit uses only its own sight. Basic Infantry/Machine-gun squads sight 1; Tank/Recon/Walker and all aircraft sight 3. Ranged exceptions use weapon range +1: Missile Infantry 3, Artillery/Flak/Tank Destroyer/Siege Tank 4, MLRS 6. Weapon bands are unchanged. Ranged Infantry retains capture priority despite its longer sight. Sight values appear in catalog cards and unit inspectors and are editable for mobile units in the debug pane.

Combat-first units interrupt capture and move into firing range when a valid enemy is within their own sight, regardless of territory ownership. Distant intruders or invalid-domain enemies no longer globally block expansion or attract defense. Units drop local pursuit once the target is outside sight; infantry finishes its capture before retaliating. Explicit enemy-HQ orders remain strategic destinations even unseen, with local engagement en route and resumption afterward. Idle defenders return to their selected building anchor. No allied spotting or fog of war; both players still see the full battlefield. HQ/Bunker static gun behavior, prior balance values, capture strengths, friendly movement and production rules remain unchanged.

## Key technical decisions

A single own-sight target query supplies local engagement, capture gating and firing acquisition. Firing also requires weapon/minimum range and legal domains. Strategic navigation is separate from autonomous local acquisition. Existing occupancy, retreat, class bonuses, squads and nuclear privacy remain. All numerical sight values live in tune.json. No new dependencies or assets.

Protocol/checkpoint v4 avoids mixing old map-wide defense rules with the new sight model. Server recovery rejects old v1/v2/v3 room or simulation layers terminally, stops incompatible alarms, and preserves saved storage. Welcome and health responses identify v4; checkpoints carry authoritative sight tuning.

Verification: 92 core +20 online =112 tests pass. Tests cover sight boundaries against units/buildings across territory, valid targets beyond weapon range, distant/invalid-domain enemies not blocking capture, no allied spotting, losing-sight capture resumption, infantry priority/Missile range-two firing, MLRS sight-six/weapon-range-three-to-five and minimum-range movement, unseen HQ navigation/local diversion/resumption, deterministic recovery, invalid sight and older room rejection. Online tests confirm both seats retain full battlefield visibility while authoritative engagement uses own sight. Scoped client/server and full repository TypeScript pass; full repository and standalone builds pass with existing unrelated hub warnings. Four isolated Brave layouts pass the complete gameplay flow without console/page errors; desktop catalog and portrait unit-inspector screenshots inspected. Two real local-Worker clients completed a full match at 92.1s with identical final worlds. Published v4 two-client smoke checks also pass placement/production, building anchors, reconnect and enemy-command restrictions with no browser errors. Evidence outside Git: outputs/operation-c-sight-regression, outputs/operation-c-sight-online and outputs/operation-c-sight-hosted.

## Open questions

The +1 sight margin is the selected provisional option from the owner's +1 or +2 proposal. Assess pursuit distances and capture interruptions before widening it. Existing minimum T1 ground-card capture requirement remains unapproved and unchanged. Earlier HQ Mobilize/repair and economic proposals remain unimplemented.

## Known issues

Tests establish behavior, not competitive balance. Exclusive occupancy can cause congestion. Sight has no terrain occlusion or fog-of-war presentation. Physical-device/cellular and high-concurrency performance remain unverified. Older rooms cannot resume this changed ruleset.

## Next proposed step

Play a fresh two-human room and compare Infantry capture focus, Recon/Tank local response and ranged-unit positioning; adjust sight margins only after observing these behaviors.
