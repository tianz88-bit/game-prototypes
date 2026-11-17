# Deferred Claude sync backlog

Owner direction,17 November2026: Codex completes and deploys the approved work. Claude will sync later; this file records the handoff without requesting an immediate session or review.

## Ready for later sync: landing menu and planet map

Status: release approved; local validation complete, deployment/public proof pending. No immediate Claude execution/review requested.

- Menu uses the existing selected ship/palette rig as the hero, primary pulsing Warp/Choose a planet, secondary Learn to fly and Hangar. Banked credits are separate from run minerals. Settings/Account/Share remain reachable on mobile and compact screens; QR/recovery are no longer permanent clutter.
- landingLayout supplies pure screen geometry. Settings clan/PC controls/hints, Account pilot name/recovery, Share QR/copy retain existing intent/save/account APIs. Account labels use modal depth; pilot name is saved before recovery mode. Focused input survives rebuild; short screens move name editing into Account.
- StellarMap still renders all5 actual terrain globes and reads live counts/status. Info isolates longer rules; visible intel separates name, risk/player count and resources/rewards. Neutral destinations explicitly mention PvP; visitors cannot mine, Warzone rewards remain temporary.
- MapAction adds chooseSide for a closed Warzone (choose a clan and stay); existing joinAs enters only when open. Auto-join when open replaces misleading Notify me. It requires a confirmed opening, a clan and selected Warzone. Map close/another destination cancels state and displayed label. Unknown status never auto-joins. Escape dismisses Info first, then map. No server/wire/gameplay tuning change.
- Type/build/rig/sim/config and8 pure geometry sizes pass.9 local Brave DPR2 desktop/phone landscape/portrait/tall/320x240 cases cover reachable actions, Settings, recovery, Share, all5 intel/Info routes, Warzone waiting/opening/side selection, Hangar/Learn and stable children/preview callbacks. Final compact case adds cancellation-label regression. Zero page errors; no captures or public-room fixture writes. Evidence outputs/steroids-alpha/landing-map-hierarchy/.

Later sync: consult these seams before editing MenuScene/stellar map. No duplicate implementation needed; collect owner feedback.

## Ready for later sync: HUD space, ram force and objective arrows

Status: LIVE171126r0097. PR544 merge864906e6edcd45d06d270c19f417d41f91847aa6; narrow objective-text follow-up PR545 ea2d987536f0db3b1790038d1277c9cfc2fbabe0. Final itch44041634549/Pages44041634523 succeeded; existing Worker protocol25 healthy. No immediate Claude execution/review is requested.

- PC and mobile share hudLayout header/control/objective/hint/notice geometry. PC B/click toggles the collapsed shop,1–6 still quick-buy, Tab expands rankings, H peeks key help. Existing mobilePanel state is reused on PC. MIN/Lv are persistent; bankable salvage and home fuel stay distinct; hull numbers live in the shop.
- Mobile counts moved inside their ordnance buttons. Fire/Dash sizes/hit factors are retained; compact/tall layout and row budgets keep secondary panels out of combat hitboxes. PC top3 plus pinned own row; mobile Stats stays in a drawer.
- Warzone role/objectives are separate from priority warnings. Incoming missile > critical hull > overheat > friendly-shield fire block; hints yield. Client manual-fire prediction now matches the existing server shield restriction. No gameplay rule, wire or tuning change.
- Ram chevron replaced by curved pressure/fire ribbons and swept fragments; larger impact crash, no extra emitter/timer. GuideView.targets passes UI anchors; TutorialGuide.objectiveArrows exposes active world/UI arrows. All four tutorial stages remain unchanged.
- Evidence: seven local+seven public UI layouts plus three local+three public arrow/ram/extraction routes, and two local+two final-public narrow-panel cases in outputs/steroids-alpha/hud-space-ram-objectives/. Type/build/rig/sim/config and new CI geometry/VFX checks pass. Zero page errors; no captures/public-room fixture writes. Temporary preview stopped. BUILD_STATUS/HANDOFF retain details.

Later sync: consult these seams before changing Flight/header/control positions. No duplicate implementation is needed; review or tuning should follow owner feedback only.
## Ready for later sync: four-step tutorial and contextual tips

Status: LIVE171126r0095 by Codex. PR542 merge7b90e92a7a53546888c8df96f94fe307290e7446. Itch44032662726, Pages44032662575 and Worker44032662716 succeeded; health protocol25. Existing Warzone changes retained. No duplicate implementation is needed.

- New stages: Fly0 (two rings), Fight1 (one rock -> marked minerals -> one upgrade), Dash/Ram2 (one stationary weakened target), Escape3 (actual warp extraction).
- Fight's marked mineral bundle funds one tier-one purchase without grinding. Shop opens after collection; guns/manual ordnance and automatic turret fire are disabled in RAM. Warp is hidden/gated until Escape, which waits for the dash to finish. Practice still grants no bank credit.
- Changed seams: TutorialGuide.policy includes warp; Room.setTutorialRules accepts optional warp and ignores all tutorial policy in online rooms. TutorialBotKind adds target, held stationary only in manual rooms. No wire version, live combat/movement/economy tuning changed.
- ContextTips/TipState teach overheat, shield/hull recovery, missiles, mines and available evolution as brief one-time hints. Save.tipsSeen preserves IDs in the existing save blob. No input blockers, tutorial modals, repeat drills or extra timers.
- Verification: type/build/rig/sim/live-config checks pass;3 local+3 public full-route cases and18 local+18 public contextual-tip cases pass on Brave DPR2 desktop/mobile landscape/portrait. Real ram/extraction, gates, saved hints and resize continuity verified. Zero page errors, no captures/public-room fixture writes. Evidence: BUILD_STATUS.md and outputs/steroids-alpha/four-step-tutorial/. Temporary preview stopped.

Later review, when Claude is available: read the changed seams and regression tests before further tutorial/server edits. The old14-step indices5/8/3 are obsolete; use the stage policy and Fight phase. Keep the owner's four-step flow unless they request a change.

## Feedback to collect

The roughly one-minute duration is a design target, not a measured human playtest. Observe the owner's first run for missed rings, collecting the marked bundle, finding the first upgrade, and aiming the single ram. Change difficulty or copy only if that feedback warrants it. No current work is blocked on Claude.
