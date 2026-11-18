# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-19 codex flat progression — release pending
DID: Owner-approved about+75% fighter target measures+76.8%; shop250 total, evolution50/earliest115; minerals no longer add/spend combat HP.
FILES: shared ship/shop/world/liveConfig/tune, Room, HUD/Flight/tutorial, lab/evolution and progression/config/bank/sim gates.
SEAM: protocol31 same layout; hullMax is legacy baseline+wallet, use mineralBalance/hullCapacity. Epoch2 upgrades legacy hosted balance once, preserving art/control settings and later epoch2 edits.
CROSS: authority/economy/UI/tests per owner; type/build/sim/config/bank/rig/evolution and3 headless purchase layouts pass. No new assets/dependencies/D1 schema/permanent-price change or capture.
FOR claude: deferred; see CLAUDE_BACKLOG/progression-balance-proof.json. Capital roles, tactics, regen and accuracy are outside the benchmark; monitor separately.

## 2026-11-18 codex cruise/home/tilt LIVE181126r0106
DID: PR5723245a9e4 live106/30; itch44338617901/Worker44338617904/Pages44338621246 succeeded. Neutral cruise, deliberate docking, peace-home warp, compact FX, building FFD and idle heads.
FILES: shared ship/home/world, Intents/NetClient/Flight/tutorial, buildingFFD/geometry/Rig/clanBaseArt and ship exhaust; authority/grip/building fixtures.
SEAM: protocol30 same wire layout forces paired refresh; shared authority/prediction agree. Optional idleScan and pooled per-part building meshes preserve roots/fixed layers and Canvas/context-loss fallback.
CROSS: owner requested movement/landing/warp; existing acceleration/braking/tuned caps unchanged. Type/build/sim/config/rig pass;3 local+2 public WebGL cases plus Canvas pass input/FFD; actual home56 snapshots verify cruise260/lock0/acknowledged warp. No capture.
FOR claude: deferred only. Explicit brake/full-throttle now used in fixed-speed shield/ram/grip fixtures; neutral post-dash expects cruise. No new assets/dependencies/migration or hosted config changes.

## 2026-11-18 codex fixed building stacks LIVE181126r0105
DID: PR570 e648baa2 live105; itch44321872467/Pages44321872344 succeeded. Fixed buildings, bounded outward stack offsets, connected columns, smaller alternating barrel-tip bolts.
FILES: buildingGeometry/Rig, clanBaseArt, rigReview, Flight draw and NetClient visual tags, building regression and brief.
SEAM: optional stackLean/viewport/barrel plus local tower bullet origin/parity; existing SHOTS retained. Visual180ms launch blend converges to server path; no simulation/wire/tune/assets changes.
CROSS: net tags and Flight rendering only. Type/build/sim/config/rig pass;3 local+2 public headless layouts pass50 transforms/muzzle checks each; isolated actual-flight parity/launch/size/convergence and public embedded lab pass. No capture.
FOR claude: deferred only; owner approved live after checks. Nexus position presets/sweep and separate turret aim in lab. No new publishers, emitters, dependencies or server deploy.

## 2026-11-18 codex main-menu evolution slot LIVE181126r0104
DID: PR568983a497d live104; itch44295327666/Pages44295327839 success. Main menu owned evolution or Choose evolution opens Hangar EVOLVE; shares secondary row with Learn to fly.
FILES: landingLayout, MenuScene, HangarScene explicit tab option, layout bounds gate and brief.
SEAM: none; existing selectedEvolution ownership check and saved look reused. No account/gameplay/protocol/config changes.
CROSS: minimal menu flow/layout test. Type/build/rig+22 layout gates pass;8 local+2 public PC/touch cases pass labels, ownership, direct tab, refresh, bounds and utility isolation. No capture.
FOR claude: deferred only; normal Hangar entry retains remembered tab, explicit evolution shortcut overrides it. No immediate action.

## 2026-11-18 codex evolution loadouts LIVE181126r0103
DID: PR566 2c0ee7a9 live; itch44292583012/Worker44292583031/Pages44292583010 success.1500-credit permanent unlock each, separate equip, compact missing-upgrade/resource status.
FILES: catalogue/tune, Room auth/buy gate, client frozen look/Hangar/shop/tips, bank regression; loadout-release-proof.json and deferred docs.
SEAM:29 same layout; owned Look.evolution captured before controls/within3s; BUY5 must match. Roster drives UI, resume retains equipment, old numeric preference ignored; lab stays isolated/free.
CROSS: type/build/sim/config/bank pass.6 local+2 public layouts pass full buy/equip/status; real Worker rejects forged selection with51 healthy snapshots. Browser purchases mocked, SQLite/Room tests cover actual billing/positive authority; no capture.
FOR claude: deferred only. No migration/assets/dependencies; no live credits spent. Temporary preview/headless stopped. Existing random bot-spacing/Pages counter housekeeping remains future work; this release all first-attempt success.

## 2026-11-18 codex owned pre-mission evolution loadouts
DID: permanent BC/MC unlocks1500 bank credits each; buy then explicitly equip one in Hangar. Match shop shows both upgrade counters/mineral progress; no equipped build means no evolve.
FILES: unlock catalogue/tune, Room auth/buy guard, NetClient frozen look, Hangar/shop/tips, bank authority regression and deferred docs.
SEAM: Look.evolution is owned/slot-cleaned at initial auth before controls/within3s; queued BUY5 must match. Reconnect retains equipment; old Save.evolution ignored. Protocol29 same wire layout.
CROSS: user requested price1500 and loadout gate; real SQLite bank/Room tests reject forged/unowned/unequipped/late/alternate/duplicate purchases;6 headless PC/touch layouts pass buy/equip/status/bounds with no capture.
FOR claude: deferred only. No new DB migration/assets/dependencies; existing bank atomicity reused. Paired client/Worker release required; lab remains a free isolated design sandbox.

## 2026-11-18 codex Missile Cruiser correction LIVE181126r0102
DID: PR564 74dd2ced live; client44251753113 attempt2 + Worker44251753080 success. MC zero free turrets, bought upgrades retained, min90/cruise170/top225. Public lab matches.
FILES: tune/protocol28, lab settings/model/preview, capital/lab regressions; artillery-release-proof.json and deferred docs.
SEAM:28 has identical layout; refresh cached27 clients. Existing legacy hosted record omits MC, so defaults90/base0 apply to new client and Worker.
CROSS: authority tests cover0/1/2/4 bought turrets, actual braking floor90, BC base2/min140 and bought CIWS bursts. Type/build/sim/lab/config pass;49 public snapshots and heads0/BC2 verified, no capture.
FOR claude: deferred only. Client retry cleared randomized bot-spacing fixture failure; Pages deploy succeeded but Operation C counter push raced main. Future deterministic fixture/counter retry housekeeping; no live block.

## 2026-11-18 codex Missile Cruiser artillery tuning
DID: zero free/required turrets and zero gun requirement fields; only bought turrets retained. Minimum90 (was140), cruise170/top225 unchanged; lab matches live.
FILES: tune/protocol28, lab evolution settings/model/preview, capital/lab regressions and deferred docs.
SEAM: protocol28 has identical wire layout; deployment compatibility refresh prevents cached27 clients retaining old bundled MC defaults under the unchanged legacy config hash.
CROSS: owner requested balance correction; authority tests cover zero/1/2/4 bought turrets, braking floor, retained BC base2/min140 and bought CIWS bursts. No asset/input/aim changes.
FOR claude: deferred backlog. Hangar → EVOLVE → Missile Cruiser; Missiles4/Mines2,300 mineral balance,120 cost. Hosted record omits MC, so bundled defaults apply; paired client/Worker release follows.

## 2026-11-18 codex capital release LIVE 181126r0101
DID: PR562 29bb41a4 live; itch44232567195, Worker44232567203, Pages44232567296 success. Thin CIWS, Hangar evolutions, Missile Cruiser and heavy towers released.
FILES: shared sim/config/protocol27, room, Hangar/flight/HUD/art, verified R2 staging, lab and capital regression; release-proof.json.
SEAM:107-byte ships/chassis4/ordnance kind2; BUY5 tier0=BC/1=MC validated server-side. Both client and Worker now27; refresh cached clients.
CROSS: owner approved live. Type/build/sim/capital/config/rig/bank pass;7 local+2 public Hangar,2 public lab,2 public renderers and75 actual public snapshots pass without capture.
FOR claude: deferred backlog only. R2 ZIP/8 parts verified via Brave Files submenu; no native input, screenshots or recording. Task tab/temporary preview/Worker/headless closed; proof in lab/evolution/release-proof.json.

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

