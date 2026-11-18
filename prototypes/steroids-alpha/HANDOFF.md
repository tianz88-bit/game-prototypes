# HANDOFF (newest first, max 15; format in COLLAB.md)

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
