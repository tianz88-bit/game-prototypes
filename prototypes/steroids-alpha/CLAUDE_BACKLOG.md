# Deferred Claude sync backlog

Owner direction,17 November2026: Codex completes and deploys the approved work. Claude will sync later; this file records the handoff without requesting an immediate session or review.

## Ready for later sync: four-step tutorial and contextual tips

Status: implemented by Codex; release proof is recorded in BUILD_STATUS.md and HANDOFF.md. No duplicate implementation is needed.

- New stages: Fly0 (two rings), Fight1 (one rock -> marked minerals -> one upgrade), Dash/Ram2 (one stationary weakened target), Escape3 (actual warp extraction).
- Fight's marked mineral bundle funds one tier-one purchase without grinding. Shop opens after collection; guns/manual ordnance and automatic turret fire are disabled in RAM. Warp is hidden/gated until Escape, which waits for the dash to finish. Practice still grants no bank credit.
- Changed seams: TutorialGuide.policy includes warp; Room.setTutorialRules accepts optional warp and ignores all tutorial policy in online rooms. TutorialBotKind adds target, held stationary only in manual rooms. No wire version, live combat/movement/economy tuning changed.
- ContextTips/TipState teach overheat, shield/hull recovery, missiles, mines and available evolution as brief one-time hints. Save.tipsSeen preserves IDs in the existing save blob. No input blockers, tutorial modals, repeat drills or extra timers.
- Verification and PR/deployment references: BUILD_STATUS.md; local/public fixtures and reports in outputs/steroids-alpha/four-step-tutorial/.

Later review, when Claude is available: read the changed seams and regression tests before further tutorial/server edits. The old14-step indices5/8/3 are obsolete; use the stage policy and Fight phase. Keep the owner's four-step flow unless they request a change.

## Feedback to collect

The roughly one-minute duration is a design target, not a measured human playtest. Observe the owner's first run for missed rings, collecting the marked bundle, finding the first upgrade, and aiming the single ram. Change difficulty or copy only if that feedback warrants it. No current work is blocked on Claude.
