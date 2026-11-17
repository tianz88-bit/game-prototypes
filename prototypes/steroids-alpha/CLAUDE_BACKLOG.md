# Deferred Claude sync backlog

Owner direction,17 November2026: Codex completes and deploys the approved work. Claude will sync later; this file records the handoff without requesting an immediate session or review.

## Awaiting owner playtest: speed-dependent grip

Owner approved this next LAB candidate after the drift research. PUBLIC LAB PREVIEW VERIFIED. PR554 mergecc1fc0b7e3f97a2dfa5c442ae4af93bd049980a3; Pages44074248828 succeeded. Six local plus6 public headless Brave DPR2 layouts pass, including tall/portrait, held Thrust/Brake recovery, profiles, all4 ships, firing/dash and reset disposal. Direct No Drift link works. Zero page errors/game sockets/writes/captures; temporary preview/headless stopped. Live combat remains171126r0098/protocol25. No immediate Claude execution/review or live port is requested.

- Speed Grip (default), No Drift (the prior easier candidate) and Live Baseline cycle through the existing profile button. URLs support grip=1/0 and handling=baseline. All four ships and both Tailed/Circling starts remain. New held THRUST exposes high speed on mobile; W/S work on PC, Brake restores grip, release returns cruise in both candidates. Enlarged hold/fire/dash hitboxes clear each other, including tall layouts; controls avoid the pilot.
- duel.tune.json grip defaults: slowTau.015, cruiseTau.035, fastTau.22, dashTau.30, brakeTau.025, maxSlip24°. Tau grows from power-adjusted cruise to current top speed; genuine deceleration restores fast grip. Dash keeps committed travel until slowing. Both pilots share this physics. No random input or angular/nose lag and no magnitude speed penalty. Falcon cruise slip~3.84° and fast24°; after.2s braking~2.16°. Bat6.53°→24°→3.53°; Battlecruiser2.11°→17.45°→.39°; Sparrow matches Falcon.
- stepGrip replaces only forward displacement after the shared ship step, preserving knockback and World.prev for swept collisions. Nose heading remains exactly identical to No Drift under matched inputs. The guarded lab bridge recomputes ONLY the just-spawned main bullet/event using corrected mount and actual target travel velocity; damage/life/count unchanged. Turret aiming already uses corrected target positions. Ram response uses travel heading for normal velocity. Old callers default grip off.
- This is lab-only separate travel state, not a publishable config knob. BEFORE live release, implement inside shared server/client movement before weapons/collisions and serialize/reconcile travel state; delete the private bullet/events bridge rather than copying it into authority. Owner approval is still required.
- Standalone scripts: test-steroids-speed-grip.mjs (four-chassis direction/speed parity, bounds, brake recovery, guns/lead, ram/knockback/wrap, hold geometry); existing test-steroids-duel-lab remains valid; compare-steroids-speed-grip.mjs reproduces48 scripted Falcon comparisons with optional GRIP_RESULTS_FILE. Type/build/rig/sim/config pass. No weapon damage changes.
- Scripted outcomes are mixed: fast-tail Brake cuts survived6/6 both profiles. Circle-fast-cut cases survived3/6 without drift vs5/6 with Grip, but potential enemy alignment increased and other metrics conflict. Small deterministic samples/continuous aim are not human win-rate, ease or fun proof. Need owner feel review. Raw artifacts outputs/steroids-alpha/speed-grip-lab/.

Gate: public lab is ready; owner playtests before approving further tuning or a live port. No itch/Worker/config release until explicit approval and proper shared-physics port.

## Drift research findings — discussion only

Owner asked whether precision causes perfect tailing/circling and requested headless tests. No drift implementation or live/lab change was requested/approved. Existing easier candidate stays intact. See steroids-alpha-lab/drift-findings.json for portable aggregate evidence; full reproducible in-memory build/scenario artifacts are outputs/steroids-alpha/drift-experiment/.

- Tested travel-heading lag tau0/.10/.22/.45s, plus light capped15° with stronger brake/dash grip. Scalar speed, nose aim, weapons and turning band held fixed; both pilots share each profile. Zero variant matches the canonical lab ship states exactly. Corrected assist target velocity to actual travel direction in experimental bundles. Source transformations existed in memory only, never production files.
- 320 deterministic duel runs:80 base scenarios,192 timing-sensitivity runs and48 bounded runs. Reaction0 and.3s, guns off/on. Falcon combat comparisons, all4 chassis slip checks. Ten headless Brave runtime cases (five profiles at PC1280x720 and mobile568x320 DPR2) use real lab rigs/terrain; zero JS errors/game sockets/writes/captures. No resident browser/server remains.
- Falcon peak slip after a1s turn:15.45° light,36.96° medium,70.87° heavy; after release, return to within5° takes.13/.47/1.20s. Bat heavy reaches120.49°. Heavy drift therefore makes precise course changes much less direct.
- Light drift helped the instant-reacting pursuer's circle-break test: mean longest non-aligned interval.64→2.86s over six timings. With the current.3s reaction opponent, the same measure worsened5.30→3.77s. Current-opponent simple-weave nose alignment rose17.6% no-drift→92.0% heavy. These are geometric opportunities, not hit-rate or human-fun claims.
- Perfect delayed control replay still follows exactly with every tau; mirrored inputs stayed symmetric. Added drift cannot automatically produce a winner. Bounded light drift limited Bat/Falcon slip but did not consistently improve the tested gun-on outcomes.

Conclusion: do not implement blanket floatiness as the solution. A further speed-dependent grip/committed-turn hypothesis may be discussed, keeping nose aiming responsive; this is not an approved next feature. Owner playtest and explicit live approval still required. No immediate Claude action.

## Awaiting owner playtest: easier duel controls

Owner said BOTH manoeuvres/controls were almost impossible. This supersedes the previous candidate's precise cruise point and throttle coupling. PUBLIC LAB UPDATE VERIFIED. PR551 mergeb7ed4f4d071025e8a62c9937737d629fbaec49d2; Pages44064727969 succeeded.3 local+3 public targeted control cases and6 local+6 public general duel layouts pass. No page errors/game sockets/writes/captures. Live itch/Worker deploys were not triggered; combat stays171126r0098/protocol25. Live combat remains171126r0098 / protocol25; no immediate Claude execution/review.

- Fixed real handoff bug: fire/keyboard takeover could aim toward the old Start-button position because mouse input remained active. Start/Resume click stays neutral until actual pointer movement, in both presets.
- Candidate neutral throttle converges exactly to power-adjusted cruise. PC W accelerates, S brakes; mobile drag steers at cruise without feathering, with a held BRAKE button. Brake targets max(minimum,65% cruise), release recovers cruise.
- combatTurnFactor supplies constant turn radius throughout65–115% cruise, smoothly opening outside it. Same helper applies to both pilots. DuelModel.advance temporarily changes the clone's chassis turn rate to feed the existing shared step, restores in finally and leaves damage/weapons/dash steering intact. This is a preview seam, not a production config field.
- Both sparring presets now use0.3s-old observations sampled every0.15s plus0.35s on/off trigger bursts. This avoids perfect mirroring; weapon stats/damage unchanged. Opponent policy is still a local helper, not actual human PvP.
- Pure regressions cover all4 cruise bands, neutral speed convergence, useful Brake floor, gyro restoration and existing impacts/damage parity.12 synthetic continuous-aim counters (two starts, Dash delays1.5–2.5s) get1.03–1.87s firing opportunities; several still lose. This demonstrates possible openings, not manual execution, human fun or guaranteed wins.
- Built-preview and public headless Brave:3 local+3 public targeted desktop/mobile/portrait cases verify no pointer snap, auto-cruise, actual held Brake/no accidental fire, independent mobile steer/speed and preserved baseline slowdown.6 local+6 public general duel layouts cover four ships, firing/dash, roles/presets, pause/reset and disposal. No JS errors, sockets, writes or captures.

Gate: owner retries the public lab. Live combat and live-config publishing remain untouched until explicit approval and a real authority/prediction port.

## Awaiting owner playtest: combat handling and duel lab

Status: PUBLIC LAB PREVIEW READY. PR549 merge06e756654af1e9a01824d0d2dc48d1813b8a1d5c; Pages44057784026 succeeded. Six local plus6 public headless Brave DPR2 layouts pass, with all4 public ship choices and both direct routes. No page errors/game sockets/writes/captures. Temporary Vite4187 stopped and headless task processes closed. Production combat remains171126r0098 / protocol25. Owner explicitly requires trying the lab BEFORE live release. No immediate Claude execution/review requested.

- Permanent lab links ?duel=tail and ?duel=circle. Independent entry loads live settings once (labelled bundled fallback), then creates a local production World. No NetClient/Room/account/publisher dependency, sockets, POSTs, purchases or progression writes. Return reloads the editor and preserves its stored draft.
- Candidate values in lab-only duel.tune.json: minimum-speed turn multiplier.45 (baseline.7), kick decay3/s (baseline5), minimum separating normal speed900 for rams /400 for bumps, restitution.65, bounded radius-squared masses and kicks. High-speed turn factor and damage values unchanged. Ram consumes dash and caps attacker to cruise; tangential velocity retained, earliest swept normal handles crossed/wrapped contacts. Position correction keeps overlap out during existing contact grace. Damage/events remain in production World; impacts do not add a second damage call.
- Tailed starts equal ships240 apart, facing the same way; swap toggles chasing/evading. Circling starts equal ships opposite on their cruise circle; swap changes sides. Opening autopilot holds the set-up until a steer/throttle/fire/dash input; initial Start click cannot accidentally steer. Opponent is an explicit sparring policy: pursue, weave when evading, or hold the loop then pursue after separation. Fire starts after2s and needs an aim cone. It is not a second human or proof that human PvP is fun. Four chassis, baseline/candidate, pause/reset available. Guns/dash only; no shop/mines/missiles/warp.
- Reuses real ShipView per-part FFD/rig/exhaust/recoil, painted bullets/impact VFX, terrain/projection, ship arcs and the existing input layer/compact touch Fire-Dash geometry. Read-only adapter to private World.bullets avoids duplicating projectile state; revisit this seam if World internals change.
- Standalone test: node scripts/test-steroids-duel-lab.mjs. Verifies all4 cruise radii, reproducible A/B state, opposing/glancing kicks, real rear-ram reversal and consumed dash, impact damage parity/no immediate repeat, wrapping/swept/tangent/coincident cases, unchanged production TUNE. Six local plus6 public Brave DPR2 desktop/mobile/portrait/tall cases cover controls, held fire/Dash, role/preset changes, pause and ten-reset disposal. No page errors/game sockets/writes/captures. Evidence outputs/steroids-alpha/combat-duel-lab/.

Gate: OWNER PLAYTEST FIRST. Publishing a normal calibration draft cannot activate this preview. After approval, port the contact response into shared authority/prediction with parity/network tests and deliberate client+Worker release; do not change damage or add weapons without direction.

## Ready for later sync: landing menu and planet map

Status: LIVE171126r0098. PR547 mergefde1891ede1393ad994997de6a77eb2fa2927b53; itch44051762536 and Pages44051762420 succeeded. Existing Worker protocol25 healthy. No immediate Claude execution/review requested.

- Menu uses the existing selected ship/palette rig as the hero, primary pulsing Warp/Choose a planet, secondary Learn to fly and Hangar. Banked credits are separate from run minerals. Settings/Account/Share remain reachable on mobile and compact screens; QR/recovery are no longer permanent clutter.
- landingLayout supplies pure screen geometry. Settings clan/PC controls/hints, Account pilot name/recovery, Share QR/copy retain existing intent/save/account APIs. Account labels use modal depth; pilot name is saved before recovery mode. Focused input survives rebuild; short screens move name editing into Account.
- StellarMap still renders all5 actual terrain globes and reads live counts/status. Info isolates longer rules; visible intel separates name, risk/player count and resources/rewards. Neutral destinations explicitly mention PvP; visitors cannot mine, Warzone rewards remain temporary.
- MapAction adds chooseSide for a closed Warzone (choose a clan and stay); existing joinAs enters only when open. Auto-join when open replaces misleading Notify me. It requires a confirmed opening, a clan and selected Warzone. Map close/another destination cancels state and displayed label. Unknown status never auto-joins. Escape dismisses Info first, then map. No server/wire/gameplay tuning change.
- Type/build/rig/sim/config and8 pure geometry sizes pass.9 local Brave DPR2 desktop/phone landscape/portrait/tall/320x240 cases cover reachable actions, Settings, recovery, Share, all5 intel/Info routes, Warzone waiting/opening/side selection, Hangar/Learn and stable children/preview callbacks. Final local compact case adds cancellation-label regression; all9 public cases also pass that regression. Zero page errors; no captures or public-room fixture writes. Public base confirms11 real ship modules and all5 live count keys. Temporary Vite4187 stopped; no resident publisher or headless test process left. Evidence outputs/steroids-alpha/landing-map-hierarchy/.

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
