# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-18 codex capital release candidate — art verified
DID: owner approved live release; thinner painted CIWS tracers, selectable Hangar evolutions, production Missile Cruiser, common capital bursts and heavy tower doublets prepared. R2 upload completed and hashes verified; paired release queued.
FILES: shared chassis/shop/ship/ordnance/world/config/protocol; room, Hangar/flight/HUD/art profiles, R2 staging, lab comparison and release regression.
SEAM: protocol27 keeps107-byte ships, accepts chassis4 and ordnance kind2; BUY item5 tier0=Battlecruiser/1=Missile Cruiser. Server validates criteria/cost. Client+Worker must release together.
CROSS: explicit owner release authorized shared gameplay/input/save/test changes. Sim/config/rig/bank/type/build and verified production art packing pass;7 Hangar and two-client Worker checks, WebGL/Canvas render checks, no capture.
FOR claude: deferred backlog only. New R2 ZIP and8 parts verified after Brave upload; task tab closed, no native input/capture. Release authorized. Local artifacts outputs/steroids-alpha/missile-cruiser-lab/.

## 2026-11-18 codex evolution & siege LOCAL PREVIEW
DID: isolated ?evolution=1 Hangar/build selection, new18-part Missile Cruiser, eight rear-launch missiles/hold-repeat, common7-shot CIWS and heavy tower doublets. Owner gate LAB FIRST.
FILES: steroids-alpha-lab/evolution*, entry/index; prepare-steroids-lab; standalone evolution test and deferred backlog.
SEAM: none in production. Sandbox clones shared motion; live chassis/save/authority/burst/missile port requires approval and implementation, not copying the local model.
CROSS: new isolated test/asset staging. Type/build/model/rig +7 headless Brave DPR2 PC/touch/Canvas layouts pass, no captures/sockets/writes. R2 upload URL still404; no push/merge/deploy.
FOR claude: deferred backlog only. R2 ZIP prepared; owner manual upload tab retained. README records mechanics, tuning, asset hashes and live-port boundaries.

## 2026-11-18 codex live speed grip and ship balance
DID: LIVE171126r0100/protocol26 via PR5591eccd9e0; itch44129275449 + Worker44129275517 + Pages44129275338 success. Responsive grip, stat Hangar,2T/Guns4 and25/s regen cap.
FILES: shared sim/protocol/tune/config, client replay/lead, Hangar/shop UI, lab isolation/stat fields, regressions and both release gates.
SEAM: Protocol26,107-byte ships with travelHeading103; shared movement precedes gun mounts, no lab bridge. Client+Worker must deploy together. Other lab handling stays gated.
CROSS: sim/server/net/menu/test/CI changed within owner's explicit live request. Unit/config/rig/bank and no-capture PC/mobile/two-client proof recorded in BUILD_STATUS.
FOR claude: deferred backlog only.7 public Hangar/5 evolution layouts, live beta drift/brake72 snapshots and lab three modes pass, no page errors/capture. Evidence outputs/steroids-alpha/live-speed-grip/.

## 2026-11-17 codex desktop/mobile UI correction
DID: LIVE171126r0099 via PR557 ec5ef477; itch44119747544 success. Bounded desktop title; clickable PC Upgrades[B]/Scoreboard[Tab], aligned Warp/header.
FILES: render/landingLayout,hudLayout; scenes/menu,flight; landing layout regression and deferred docs.
SEAM: optional touch argument/desktop credit anchors; flight header shares PC nav/Warp geometry; existing drawer/input intents unchanged.
CROSS: menu/input behaviour minimally touched to repair missing PC controls; no simulation/tune/Worker/config or live Speed Grip port.
FOR claude: backlog ready, no immediate action.12 local menus/8 HUD/7 final menu and7 public menus/8 HUD pass without page errors/capture. Pages post-deploy Operation C counter push race logged.

## 2026-11-17 codex speed-dependent grip PUBLIC LAB
DID: Speed Grip / No Drift / Live Baseline, held Thrust/Brake and bounded speed-dependent travel drift public via PR554 cc1fc0b7; Pages44074248828 success.
FILES: lab-only grip/model/layout/input/UI/preset and standalone tests/comparison scripts; deferred docs. Live combat171126r0098/Worker25 unchanged; no client/server deploy.
SEAM: separate travel state, corrected new main-shot origin/lead and actual ram velocity; production port requires shared authority/prediction/state integration after approval, not the lab private-field bridge.
CROSS: type/build/rig/sim/config/duel/grip pass;48 scripted cases mixed,6 local+6 public Brave DPR2 layouts pass for all profiles/ships/controls/direct links/disposal. No page errors/sockets/writes/captures; processes stopped.
FOR claude: owner now playtests public ?duel=tail&grip=1 or ?duel=circle&grip=1; backlog ready, no immediate execution/review. Evidence outputs/steroids-alpha/speed-grip-lab/.

## 2026-11-17 codex speed-dependent grip PREVIEW
DID: lab-only speed-dependent bounded side-slip, rapid grip when slowing, unchanged nose aiming. Three-way comparison, mobile/PC held THRUST/BRAKE and compact non-overlapping targets.
FILES: lab speed-grip/model/controls/layout/preset/index, standalone unit/comparison scripts, deferred docs. Production runtime/tune untouched.
SEAM: optional travel state, corrected forward displacement/main-shot mount/lead and ram travel velocity. Existing World damage/grace retained; production port requires authority/prediction/travel-state work after approval.
CROSS: type/build/rig/sim/config and speed-grip/duel tests pass;48 scripted scenarios show mixed outcomes, no human-fun claim. Six built-preview Brave layouts pass, no page errors/game sockets/writes/captures; public proof follows.
FOR claude: backlog only; owner must try public lab before any live release. Evidence outputs/steroids-alpha/speed-grip-lab/.

## 2026-11-17 codex drift headless RESEARCH
DID: tested travel-direction lag0/.10/.22/.45s and capped15° light grip. Mixed results: some overshoot openings, evader path changes also weakened. No handling changes applied.
FILES: portable lab/drift-findings.json, deferred backlog and status. Raw memory-only experiment artifacts outputs/steroids-alpha/drift-experiment/.
SEAM: none; production/lab code/tune and live config untouched. Motion lag only, nose aiming preserved; same profile for both pilots.
CROSS:320 scripted duel runs, all4 chassis slip checks, zero-variant canonical parity and exact delayed replay;10 Brave DPR2 runtime cases, zero page errors/sockets/writes/captures, processes stopped.
FOR claude: research only, no implementation/live approval. Do not assume drift solves tailing/circling; current easier candidate stays. Backlog records metrics and limitations.

## 2026-11-17 codex easier duel controls PUBLIC
DID: fixed stale Start-pointer aim; auto-cruise, mobile steering/Brake, broad turn band and delayed sparring live in LAB only. PR551 b7ed4f4d; Pages44064727969 success.
FILES: lab controls/input/model/preset/renderer, standalone test and deferred docs. Production combat remains171126r0098/Worker25, no new client/server deploy.
SEAM: per-step clone gyro restored in finally, input adapter owns Brake events; synthetic continuous-aim counter windows are not human-fun/win guarantees.
CROSS: type/build/rig/sim/config/physics pass;3 local+3 public targeted inputs and6 local+6 public general layouts,12 timing-window sequences. No page errors/game sockets/writes/captures; preview/headless stopped.
FOR claude: owner retry gate remains. Backlog updated, no immediate execution/review or live port. Public ?duel=tail / ?duel=circle; evidence outputs/steroids-alpha/combat-duel-lab/easier-* and public-easier-*.

## 2026-11-17 codex easier duel controls PREVIEW
DID: owner found both manoeuvres too difficult. Candidate now auto-cruises on release, mobile drag only steers, Brake holds useful speed, broad cruise turn band; fixed stale Start-pointer aim. Sparring has delayed observations/bursts.
FILES: lab-only controls/input/model/renderer/preset, standalone regression and deferred docs. Live combat/tuning unchanged.
SEAM: temporary cloned gyro override restored per shared movement step; pure throttle helper and separate Brake input adapter. Damage and prior impact response retained; opening pointer neutral until moved.
CROSS: type/build and physics/control tests pass;3 built-preview Brave control cases +6 general layouts pass.12 continuous-aim synthetic counters yield firing windows across timing variation, not human-fun/win proof. Public proof pending.
FOR claude: backlog only. Owner playtest gate remains; no immediate action or live port. Evidence outputs/steroids-alpha/combat-duel-lab/easier-*.

## 2026-11-17 codex combat duel lab PUBLIC PREVIEW
DID: Tailed/Circling handling lab published via PR549 06e75665; Pages44057784026 success. Live combat stays171126r0098/Worker25; no new Steroids itch/Worker run.
FILES: lab-only model/renderer/tuning/entry plus standalone physics test; durable docs/backlog.
SEAM: existing World damage/weapons/grace, post-step candidate contact response and read-only projectile adapter. No live config writes or production code/tune changes.
CROSS: type/build/rig/sim/config/physics pass;6 local+6 public DPR2 PC/mobile layouts, all4 public ships/held Fire/Dash/roles/presets/reset disposal. Zero page errors/game sockets/writes/captures; Vite/headless stopped.
FOR claude: OWNER PLAYTEST GATE remains. Deferred backlog has future authority/prediction port requirements; no immediate execution/review. URLs ?duel=tail and ?duel=circle; evidence outputs/steroids-alpha/combat-duel-lab/.

## 2026-11-17 codex combat duel lab PREVIEW
DID: lab-only stronger mass-weighted opposing impacts, ram consumes dash, longer kick decay and cruise-best turning. Tailed/Circling starts, baseline/candidate, four ships, role swap, reset/pause and existing PC/mobile controls.
FILES: steroids-alpha-lab entry/duel/duel-model/duel.tune/index/README; standalone physics test and deferred docs. Production runtime/tune/workflows untouched.
SEAM: production World handles damage/weapons; isolated post-step candidate replaces kicks/separates contacts. Read-only projectile adapter observes private World.bullets. No socket/account/publishing.
CROSS: pure collision/radius/damage-parity/wrap tests pass,6 Brave DPR2 layouts incl touch steering/held fire/Dash and reset lifecycle; zero page errors/game sockets/writes/captures. Public preview proof follows.
FOR claude: backlog only, no immediate work. LIVE BALANCE NOT APPROVED: await owner lab playtest before porting to authority/prediction; no online latency or human-fun proof claimed.

## 2026-11-17 codex landing menu/map LIVE
DID: ship/Warp hero, accessible utilities and clearer five-planet map live171126r0098. PR547 fde1891e; itch44051762536/Pages44051762420 success, Worker25 healthy.
FILES: menu, stellarMap, landingLayout and rig-gate layout test; BRIEF/COLLAB/BUILD_STATUS/CLAUDE_BACKLOG.
SEAM: chooseSide while closed; Info dismissal; confirmed Warzone auto-join with cancellation state/label. Existing account/save/input APIs; no wire/gameplay/live tuning changes.
CROSS: type/build/rig/sim/config pass;9 local+9 public Brave DPR2 layouts plus final compact case. Utilities/recovery/all5 intel routes/side selection/auto-join/Hangar/Learn/lifecycle pass, zero page errors/captures/public-room fixture writes.
FOR claude: deferred backlog ready; no immediate execution/review needed. Vite4187 stopped, no leftover headless test process. Evidence outputs/steroids-alpha/landing-map-hierarchy/.

## 2026-11-17 codex landing menu/map RELEASE
DID: selected real ship/palette hero with primary Warp, secondary Learn to fly; utility panels preserve mobile Settings/Account/Share. Map has name/danger/players/resources and optional Info.
FILES: menu, stellarMap, pure landingLayout and existing rig-gate geometry regression; brief/collaboration/status/backlog.
SEAM: MapAction.chooseSide for closed Warzone, dismissInfo for Escape. Auto-join requires confirmed opening; closing/changing planet cancels. Existing account/input/save/network contracts retained.
CROSS: type/build/rig/sim/config pass;9 Brave DPR2 desktop/mobile/portrait/tall/short cases plus final compact cancellation case, no page errors/captures/public-room fixture writes. Recovery preserves edited name and modal field layers.
FOR claude: deferred FYI only; no immediate execution/review. Owner approved go-live. Public release proof follows in CLAUDE_BACKLOG/BUILD_STATUS.

## 2026-11-17 codex HUD/ram/objective arrows LIVE
DID: HUD reorganisation, pressure-bow ram/crash and every tutorial objective arrow live171126r0097. PR544 864906e6; narrow-label PR545 ea2d9875. itch44041634549/Pages44041634523 success; Worker25 healthy.
FILES: hudLayout/Flight/CombatHud/UI/input, combatEffects, guide/contextTips, CI regressions/docs/backlog.
SEAM: B/click shop,1–6 retained, Tab pilots, H help; mobilePanel reused on PC, shared geometry/priority slots, GuideView.targets/objectiveArrows. Client shield suppression mirrors existing server authority; no wire/live tuning changes.
CROSS: type/build/rig/sim/config pass;7 local+7 public UI and3 local+3 public full arrow/ram/extraction cases, plus2 local+2 final-public narrow cases pass; zero page errors/captures/public-room fixture writes.
FOR claude: defer sync per owner. CLAUDE_BACKLOG.md has seams and proof, no immediate execution/review needed. Preview4187 stopped; evidence hud-space-ram-objectives.

## 2026-11-17 codex HUD/ram/objective arrows RELEASE
DID: collapsed PC shop (B/click,1–6 retained), Tab rankings/own pin, H help; MIN/Lv + distinct cargo; embedded mobile counts/current Fire-Dash sizes; Warzone role and priority warnings. Ram pressure bow/fragments replace chevron; tutorial arrows cover all world/UI goals.
FILES: hudLayout/mobileFlightUi, Flight/CombatHud/UI/input, combatEffects, guide/contextTips, CI regressions/docs/backlog.
SEAM: mobilePanel reused on PC, GuideView.targets/objectiveArrows, geometry/priority slots. Client fire gate mirrors existing shield authority; no wire/gameplay tune/economy changes.
CROSS: type/build/rig/sim/config +7 Brave UI layouts and3 actual tutorial arrow/ram/extraction routes pass, zero page errors/no captures/public-room fixture writes. Hit targets and urgent/objective separation checked.
FOR claude: owner says sync later; CLAUDE_BACKLOG.md has durable seams and evidence, no immediate action needed. Public proof follows; use main after release.
