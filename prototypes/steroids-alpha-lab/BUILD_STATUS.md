## Current milestone

Speed-dependent grip PUBLIC LAB preview ready. PR554 mergecc1fc0b7e3f97a2dfa5c442ae4af93bd049980a3; Pages44074248828 succeeded. Six local plus6 public headless Brave DPR2 layouts pass, including tall/portrait, held Thrust/Brake recovery, profiles, all4 ships, firing/dash and reset disposal. Direct No Drift link works. Zero page errors/game sockets/writes/captures; temporary preview/headless stopped. Owner approved lab testing only. Existing live client171126r0098 / Worker25 stays unchanged.

## What was implemented

Travel side-slip grows with speed and rapidly realigns while slowing. Nose aiming, scalar speed and weapon damage remain unchanged. Cruise is nearly planted; drift is bounded24°. Profiles cycle Speed Grip / No Drift / Live Baseline. Held THRUST and BRAKE work on PC/mobile alongside existing steering/fire/dash; layout clears enlarged targets in row and tall-column arrangements. All four ships and Tailed/Circling presets remain.

## Key technical decisions

All executable changes are lab-only. Optional per-pilot travel state corrects forward displacement after one shared ship step and before World.step. Knockback/World.prev stay intact; guarded bridge repairs only the new main bullet/event after its mount shifts and uses actual target velocity for lead. Ram impulses use travel direction. Before a live port this must move into shared authority/prediction, including travel-state serialization, instead of shipping the private-field bridge.

Type/build/rig/sim/config and existing duel/new grip tests pass. All4 ships have bounded drift and restore slip below4° within.2s braking; nose/speed parity, launch origins/lead, straight travel/knockback/wrap/ram and hold-hitbox separation checked.48 scripted comparison runs provide mixed outcomes, not human-playtest proof. Six local+6 public Brave DPR2 PC/mobile/portrait/tall layouts pass for held Thrust/Brake recovery, profiles, all4 ships, fire/dash, direct routes and reset disposal. No captures or online writes. Evidence outputs/steroids-alpha/speed-grip-lab/.

## Open questions

Owner to try the public Grip/No Drift comparison and judge whether speed commitment plus Brake cuts feel readable and useful. Live release not approved.

## Known issues

Scripted sparring/continuous aim does not prove human fun, fairness or online feel. No online prediction/travel-state protocol is implemented for this lab-only feature. Physical-phone/Safari visuals not inspected; existing unrelated build warnings remain.

## Next proposed step

Owner tries ?duel=tail&grip=1 and ?duel=circle&grip=1 in the permanent lab, comparing Speed Grip/No Drift/Live Baseline. Playtest determines further tuning or any live port. Claude backlog stays deferred. Temporary preview4187 and task headless browsers are stopped.
