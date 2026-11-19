# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-19 codex simplified mineral prices
DID: All upgrade tracks use 1/2/3/4 minerals, either evolution costs 10, HUD shows fractional minerals, and hull spills scale to the smaller wallet.
FILES: Tune, World, live config, HUD, evolution lab and focused regressions.
SEAM: Economy epoch4 moves older shop prices, asteroid income and hull spill into the smaller denomination. Credits and cargo mining are separate.
CROSS: Test both cruiser paths and rebuild the client/lab. Bat stats left for balance discussion.
FOR claude: Deferred. Candidate branch includes pickup, missile, tutorial and shield changes.

## 2026-11-19 codex economy and starting shield candidate
DID: Asteroid minerals −30%; tier prices 4/8/13/17 and in-run evolution 40. Sparrow/Falcon have 75 shield, Bat 52.5, all fighters 50 hull.
FILES: Tune, shared World/ship/config, evolution lab and balance/pickup/sim regressions.
SEAM: Economy epoch3 migrates epoch2 buy prices and evolution entry; fighter shield bonus uses shared maxShield and current regen cap. Mining factor scales minerals independently of resource cargo.
CROSS: Type/build, sim/config/bank/evolution and 10 matched seeds per goal. Median first purchase 6.25→7.5s, full shop 139→155s, owned cruisers ~70→79s.
FOR claude: Deferred. Perfect-hit max Falcon vs fresh Sparrow 1.07→1.33s. Candidate only; included in paired release branch.

## 2026-11-19 codex missile fixes
DID: Fighters launch from desktop/touch HUD or keyboard even when a late input is discarded. Artillery turns sooner after launch and returns forward with no lock. Cruiser reload is 12s per missile.
FILES: Room, ship/world/live config, intents/Flight, evolution lab and capital regression.
SEAM: Shared chassis-dependent refill for prediction/authority/HUD. New config factor upgrades earlier artillery records once. Wire layout is unchanged.
CROSS: Build/typecheck, full simulation, live config, evolution lab and real browser controls pass.
FOR claude: Deferred. Progression and fighter base stats are discussion only. Candidate includes the prior tutorial and pickup work.

## 2026-11-19 codex tutorial revision
DID: Four short lessons now require braking and accelerating through gates, shooting the marked rock, taking its ore, buying an upgrade, ramming after both gates in one dash, and completing warp out.
FILES: TutorialGuide, Room, World practice rock, Flight guidance, and tutorial simulation regression.
SEAM: Local Room exposes a per-tick tutorial observer with real World events. Tutorial progress no longer depends on render frames.
CROSS: Tutorial-only world and room changes plus regression coverage. No additional wire fields.
FOR claude: Deferred. Tutorial is on the resource pickups candidate branch. See CLAUDE_BACKLOG.md.

## 2026-11-19 codex resource pickup candidate
DID: Separate mineral/cargo drops, painted purple salvage and cyan fuel, matching icons and bounded authoritative magnet. Tested candidate, not live; unchanged mineral prices/generated totals.
FILES: sim/pickups/world/liveConfig/protocol33, room/client, combat render/HUD/Flight, resource manifest/prep, lab draft/proof and pickup gate.
SEAM: fuel PickupKind, mined metadata and optional pickups.move payload; snapshot-coalesced authority, wrapped interpolation. Paired client/Worker release required; no D1 migration.
CROSS: minimal sim/net/server/tune/tests for explicit separate-drop choice. Type/build/sim/config/bank/rig pass;3 DPR2 headless layouts,400 pooled sprites, stable textures. No capture/live writes.
FOR claude: deferred; read CLAUDE_BACKLOG pickup section. Preserve ownership/capacity/spill locks and prices. Prior bundled-cargo pace results are historical.

## 2026-11-19 codex bot survival LIVE191126r0108
DID: PR577076417e1 live108/32; itch44443795181/Worker44443795129/Pages44443795169 succeeded. Bot aim/passes/spawns and500-credit evos; mineral prices unchanged.
FILES: bots/world/tune/liveConfig/protocol32, lab draft/version hiding, instrumented pace harness, bank/sim/config/new survival gates; lab BOT_SURVIVAL_REVIEW/proof.
SEAM:32 same layout paired release complete; bot epoch1 migrates observations once, catalogue quote is deployment-owned500. No new wire fields, damage/HP/movement/ram/shop/art changes.
CROSS: released after owner review. Equal600s×10 seeds/policy: deaths27.5→4 mining,10.5→1 evasive,18→2.5 frozen combat. First500-credit cruiser8:23–8:34. Type/build/sim/config/bank/rig and2 headless UI cases pass; no capture.
FOR claude: deferred.2 public price/equip cases, real home55 snapshots/ack100, alpha80/155 with4 bots and public lab values pass. Proof lab/bot-survival-proof.json; no capture/live spending.

## 2026-11-19 codex progression pace study
DID:210 seeded headless runs: quiet max2:32–2:46, owned BC/MC~1:15–1:19; zero-credit first cruiser~16:49–17:57. Before max14:01; no live changes.
FILES: scripts/measure-steroids-progression-pace.mjs; lab/PROGRESSION_PACE.md and progression-pace-proof.json; status/backlog.
SEAM: none; real World/ship/shop/ordnance/loot/warp reused without tuning changes. Bank route models validated extraction credits, not live account operations.
CROSS: research harness only;10 seeds/condition, historical snapshot and exact seed1 replays. Four-bot stress: max0/10 mining or1/10 fleeing by20min; censored failures retained. No capture.
FOR claude: deferred. Cost−79.8% and safe max time−81.9% align; power index reduction is separate (wallet HP removed). First permanent unlock and survival are bottlenecks; discuss before retuning.

## 2026-11-19 codex flat progression LIVE181126r0107
DID: PR574d43bdd7e LIVE107/31; itch44357659530/Worker44357659566/Pages44357659573 succeeded. Fighter benchmark+76.8%; shop250/evolution50; wallet independent of HP.
FILES: shared ship/shop/world/liveConfig/tune, Room, HUD/Flight/tutorial, lab/evolution and progression/config/bank/sim gates.
SEAM: protocol31 same layout; hullMax is legacy baseline+wallet, use mineralBalance/hullCapacity. Epoch2 upgrades legacy hosted balance once, preserving art/control settings and later epoch2 edits.
CROSS: authority/economy/UI/tests per owner; type/build/sim/config/bank/rig/evolution and3 headless purchase layouts pass. No new assets/dependencies/D1 schema/permanent-price change or capture.
FOR claude: deferred; proof ../steroids-alpha-lab/progression-balance-proof.json.2 public UI cases/real Worker55 snapshots and public lab pass; no capture. Capital/tactics/regen/accuracy need separate playtesting.

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

