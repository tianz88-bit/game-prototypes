# Deferred Claude sync backlog

Owner direction,17 November2026: Codex completes and deploys the approved work. Claude will sync later; this file records the handoff without requesting an immediate session or review.

## Missile Cruiser bow gun candidate

Owner moved the cruiser-specific deck cannon onto the centreline over the white nose armor and dropped the bay. The previously uploaded deck-cannon-v2 art pack supplies the sprite with no bay part. The gun recoils at side 0 and uses the standard primary Fire input with Sparrow cadence, heat and drift. Missiles retain a separate hold-to-repeat control and their existing refill. Evolution lab uses the production rig. Protocol 34 adds the separate missile spacing timer and requires a paired release.

## Combined release — LIVE r0109 / protocol 33

Owner approved Bat primary damage parity and the combined pickup, tutorial, missile and economy candidate. Bat uses Falcon's shot damage and cadence. Bat's 52.5 shield, turning, acceleration and speeds retain their previous tune. Legacy hosted balance records adopt damage parity during upgrade to the current epoch. Test both stock and max gun tiers for equal sustained primary output.

PR588 merge 97f6ca80c3312db0531e87846f63b43941c429f2. Itch 44475904101, Worker 44475903983 and Pages 44475904099 succeeded. The new denominations, tutorial, missile and pickup sections below are shipped by this release. Public headless Brave verified itch build 191126r0109 and Crimson connection (45 snapshots, ack 78), with effective settings, pickup textures and updated tutorial shown. Public lab shows 1/2/3/4. See ../steroids-alpha-lab/combined-release-proof.json. Deferred sync only.

## Simplified mineral denomination

Owner requests memorable numbers. Every track costs 1, 2, 3, 4, with 50 minerals for the full shop. Either owned/equipped cruiser costs 10 during the run, including 13 in prerequisite upgrade spend for a 23-mineral route. Mining scales to .18 of original ore. The HUD shows tenths and dropped hull minerals are proportional to the new prices. The epoch 4 migration also covers older epoch 2 and 3 records. Bat's shields are 70% of Falcon's, with 70% faster turn, 20% stronger acceleration, 10% lower top speed and 15% lower shot damage. No Bat stat changes in this pass.

## Economy and starting shields candidate

Owner requests less mineral income, proportional prices, and more shield than hull. Mining mineral yield factor .70 is independent of salvage and fuel. Tier prices 4/8/13/17 total 210 across twenty upgrades. Either equipped evolution costs 40 in-run, with a 94-mineral minimum route and the existing 500-credit permanent unlock. Combat spills still transfer minerals from the wallet. Progression epoch 3 migrates earlier price tables.

Fighters have 50 hull, with 75 shield for Sparrow/Falcon and 52.5 for Bat. Current regen cap applies. Ten matched seeds per route found median first upgrade 6.25→7.5s, max 139→155s and evolutions ~70→79s in quiet scripted mining. Perfect hit max Falcon vs fresh Sparrow: 9→11 bullets, 1.07→1.33s from first hit. These fixtures measure controlled scenarios.

## Missile control and artillery handling candidate

Fighter missile HUD now accepts desktop clicks. Late and queue-overflow input preserves a single missile and mine press. Cruiser rear delay .45→.18s, turn 1.9→4.2rad/s and reload 6→12s per missile. Unlocked rear launch curves forward. Locked fixed-target fixture 491→137px rear excursion and 1.27→.57s before moving forward. Base fighter stats and progression are pending balance discussion.

## Tutorial lesson gates

Tutorial progress observes local simulation ticks. Brake and accelerate through separate gates. The marked rock yields its ore at the impact site only when shot, and the shop opens only after that pickup is collected. The ram lesson has a launch marker and requires both gates and an actual ram in a single dash. A missed attempt lays out a new course. Warp still completes through the existing extraction path. Contextual prompts outside the tutorial remain separate.

## Separate resources — tested candidate, not live

Owner chose separate mineral/cargo physical objects. Gold crystals buy upgrades; new purple salvage cases bank on warp; new cyan fuel canisters unload at own home Nexus. Existing green repair retained. R2 resource-pickups-v1 manifest verifies uploaded original ZIP and sources; runtime192px. HUD uses the same body frames.

Protocol33 adds fuel/mined pickup metadata and optional JSON move array; no binary layout/D1 changes. Actual server chooses nearest eligible collector within old radius+64px, attracts420px/s, coalesces movement at snapshot cadence. Preserve spill locks, full/partial capacity, bot mined-cargo exclusion and home ownership. Pool200→400 for split objects, strict even for death salvage. pickupVersion1 migrates once and retains future edits. Tutorial mineral-only/Warzone no mined cargo. Prices/generated nominal totals unchanged; collection pace may differ from historical bundled rewards.

All required gates plus3 actual Room/NetClient headless layouts atDPR2 pass;400-object pool/texture plateau, no capture/live spending. Evidence ../steroids-alpha-lab/resource-pickups-proof.json, original prompts/art/readability outside checkout outputs/steroids-alpha/resource-pickups-v01. No immediate Claude session requested; paired release pending.

## Bot survival /500-credit evolutions — LIVE191126r0108/protocol32

Owner19 November: keep minerals; reduce both permanent evos1500→500 rather than free first choice; test survival changes before release. Owner then approved release: PR577076417e1ea73c84960404a57e9941ba172c58c16. Client44443795181/Worker44443795129/Pages44443795169 succeeded; live191126r0108/protocol32.

Diagnosis: guns dominate; one-hunter cap works. Removing dash/ordnance alone insufficient. Continuous nose pursuit creates body-checks; centre-area player spawns avoided rocks but not ships. Candidate aim7→14deg/perception.25→.45/reaction.9→1.3; ordinary attack pass exits at360px for1.2s (siege committed approach retained); occupied open-player spawns reuse32-point ship/rock spread. No extra arrival immunity, HP/damage/movement/ram/shop/art changes.

Equal10-minute sessions,10 seeds per policy, continuing after max: mining deaths27.5→4, evasive10.5→1, combat18→2.5. Combat pilot frozen to live AI/settings on both sides and memory reset each life; initial adaptive-pilot comparisons excluded. No lifetime inference from deceased samples. Reached all20 at least once0/10→9/10,0/10→8/10,0/10→9/10 respectively. Human playtest still needed.

500-credit account route40 cases:2 successful extractions, first cruiser median8:23–8:34 versus~17–18min. ActualSQLite499/500/exact/duplicate/ownership/equipment gates pass; browser UI account responses mocked, no live spending. Full type/build/sim/config/bank/rig and2 local headless PC/portrait UI cases pass. Protocol32 paired refresh required; behaviourVersion1 upgrades only old bot observation fields, future edits preserved; effective unlock catalogue500 is deployment-owned. No D1 migration/resident publisher/assets. Public PC/portrait500 quote/buy/equip tests pass (mocked accounts); real home55 snapshots/ack100 verifies effective500 quote/bot epoch1 and every mineral price, alpha80 snapshots/ack155 has4 bots/HP50, public lab bot fields/mineral steps pass. No page errors/capture/live spending. Historical stored ConfigRecord remains unchanged; effective parseRecord migration verified. See ../steroids-alpha-lab/BOT_SURVIVAL_REVIEW.md and bot-survival-proof.json. Deferred only; no immediate Claude session needed.

## Progression pace measured —19 November2026; no tuning changes

210 seeded production-simulation runs,10 per condition. Quiet median max20 upgrades2:32 focused/2:46 delayed; owned BC1:15/1:18, MC1:17/1:19. Matched before max14:01/BC6:31/MC6:43. Shop spend−79.8%, safe-max elapsed−81.9%. First account banks1500 via4 successful extractions, then evolves at16:49–17:57 median depending controller/build; human account/tutorial/menu time excluded.

Four-bot mining stress with normal damage/death reset: all20 completes0/10 without evasion,1/10 with flight/dash by20min. Evaders reach each cruiser9/10. This mining controller cannot represent skilled combat or a measured human novice; retain censored failures and never average finishers alone. Permanent unlock/survival dominate beyond the short safe grind. Do not cut minerals again on percentage arguments; discuss unlock/onboarding goals separately.

Reusable scripts/measure-steroids-progression-pace.mjs; ../steroids-alpha-lab/PROGRESSION_PACE.md and progression-pace-proof.json include raw cases, provenance, assumptions and exact replay proof. Owner requested measurement/discussion; no runtime/deploy/config/account changes or capture.

## Flat combat progression — LIVE181126r0107/protocol31

PR574d43bdd7e8dba3d315055fea50640932fcd9fa6bf; itch44357659530/Worker44357659566/Pages44357659573 succeeded.2 public PC/portrait purchase cases, real home Worker55 snapshots/ack92 (zero wallet rejection, roster0, HP50/50), effective socket epoch2 and public lab5/10/15/20 integer inputs pass. Historical public stored ConfigRecord remains unchanged; parseRecord upgrades its effective data in Room/client/lab. No publisher/credential operation.

Owner chose about+75% strongest max fighter versus fresh Sparrow.60-second main+ideal4-drone DPS × hull/shield reaches1.76756, excluding accuracy, regen, missiles/mines and cruiser roles. All five tier tracks5/10/15/20, total250; both equipped/owned evolutions50 cost/floor,115 earliest route.1500 bank unlock prices unchanged.

Legacy ShipState.hullMax now stores tune.ship.maxHp+wallet to preserve the wire layout and existing carried-load size/speed penalty. Always use mineralBalance for money and hullCapacity for actual HP; never use raw hullMax as a health maximum. Shared World, Room, shop/evolve, HUD/tutorial, bots and lab follow this contract. Collection/spending never repairs/damages. Repair pods/pads use actual hull; damage spills at most wallet, death spill quantized once before chunking (no minted baseline hull or rounding money). Roster/extraction power keys report actual wallet. Room config application preserves wallets across base-hull edits and clamps each chassis shield correctly. Protocol31 forces paired refresh.

shop.balanceVersion2 performs a one-time upgrade of older published balances: resets shop, drone damage, missile/mine tier-damage scaling and evolution cost/floor to approved defaults while preserving unrelated art/controls. Current epoch2 owner edits survive. No remote publisher or secret needed. New progression gate runs in the sim gate; includes60s benchmark,250/115 paths, exact-cost Float32 boundary, wallet/repair/loot conservation and migration. Config/bank gates retain real authority/SQLite coverage.3 local headless PC/touch/portrait layouts buy all20 via actual local Room/NetClient, check empty/repeat/49vs50 evolution, HP and bounds; account ownership is a fixture, not a live purchase.

Deferred only. Revisit actual time-to-upgrade, ordnance tactics and cruiser siege matchups after playtesting; no universal win-rate claim. See ../steroids-alpha-lab/progression-balance-proof.json for release evidence.

## Cruise/home extraction, low-speed FX and building tilt — LIVE181126r0106/protocol30

PR5723245a9e4350f4fb170a837b575ae82f778f20bb3. Client44338617901/Worker44338617904/Pages44338621246 succeeded.3 local+2 public WebGL cases and actual Canvas fallback pass; real home server56 snapshots confirm cruise260,lockdown0,warp across10 more snapshots/ack99. Proof lab/cruise-home-proof.json. No capture/spending; temporary preview/headless stopped.

Owner18 November: no held speed control returns to each chassis/power cruise with existing accel/brake; no tuned rates changed. Shared stepShip performs this in authority/prediction. Removed marker auto-brake and marker-push acceleration; aiming is independent. Mobile gets compact hold+/− controls (44px high), with pointer release/cancel/blur/shutdown cleanup. Down/− over own pad reaches zero and docks; release accelerates and takes off. Tutorial/control wording updated.

Peaceful Crimson/Azure home worlds bypass warp cooldown; ordinary planets and Warzone keep restrictions, protected arrival still blocks warp. Shared freeHomeWarp drives World; NetClient explicitly checks home IDs (avoids pre-siege-frame Warzone ambiguity), clears prediction/replay lockdown similarly; UI reads same rule. Protocol30 keeps layout but forces old clients to refresh. Paired client/Worker release required.

Nozzle-width ignition blocks capped to particle-scale size, slow idle plume narrower; rectangular particles and slow/cruise palettes retained. BuildingFFD reuses nine samples/eight triangles per plate with cropped-frame UVs, shade, clan/damage skins and fixed roots/depths; only vertex positions tilt radially. Identity at centre, bounded edge projection. Canvas, disabled FFD and context-loss retain originals; meshes destroyed with views. Home idle tower aim is seeded slow continuous wandering, yielding to recent fire then slowly blending back. No extra shots or server aiming changes.

Type/build/sim/config/rig pass. New neutral/dock/release/home/war/arrival tests plus explicit-speed shield/ram/grip fixtures and cruise-after-dash assertion. Headless PC/touch/portrait verifies neutral input and independent marker, actual keyboard/touch holds and release, home warp UI, real GPU faces, bounded reusable mesh/object/texture counts, context-loss and actual Canvas fallback. No capture/live account spending. Deferred only; no immediate Claude action.

## Fixed building stacks and barrel-aligned tower shots — LIVE181126r0105

PR570 e648baa279136176a86ba60da2f4eaaa536bb830; itch44321872467 and Pages44321872344 succeeded.3 local+2 actual public headless cases passed, plus permanent lab embedded controls. Proof lab/building-stack-proof.json. Existing Worker29 unchanged.

Owner correction: buildings do not rotate. Fixed Nexus/tower foundation/shaft/plates; only turret head and barrels aim. buildingStackLean uses screen-relative radius, bounded at0.55 displacement per layer height; centre overlaps, edge offsets scale with height. Same origin feeds connecting columns and muzzle flashes; existing ground projection/cast shadow remains. Lab has five position presets, separate turret aim, optional Nexus position sweep. Existing art/clan/damage/wreck/repair retained.

NetClient adds local tower-origin/duration/barrel tags to existing SHOTS (no wire change). Each received tower shot toggles local per-index parity and forwards it to the rig; rendering begins at the matching recoil/foreshortened barrel tip and smoothly merges onto authoritative trajectory in180ms. Tower bolts use45% of the existing bulletScale and a shorter trail; primary/CIWS remain unchanged. No simulation, hitboxes, damage, cadence, assets, dependencies or Worker changes. Owner approved release after testing. Deferred only, no immediate Claude action.

Type/build/sim/config/rig pass;3 local headless PC/touch/portrait cases each check50 fixed-orientation/position/muzzle combinations, smaller bolts and wreck/repair. Isolated tutorial fixture exercises actual NetClient handle/Flight draw for parity, exact projected muzzle, size and final authority path. No live account spending, captures or screenshots.

## Main-menu evolution loadout slot — LIVE181126r0104

PR568983a497d; itch44295327666 and Pages44295327839 succeeded.8 local+2 public headless PC/touch cases passed; proof lab/evolution/menu-slot-proof.json. No capture, real account purchases or immediate Claude action.

Shows the existing owned equipped evolution (or Choose evolution) beside Learn to fly beneath Warp. Tap opens Hangar EVOLVE using an explicit scene option; ordinary Hangar entry retains its remembered tab. Selection reads selectedEvolution with current account unlocks; forged/unowned and legacy numeric choices display empty. Menu rebuild refreshes after equip/unequip. Same44px action row, no extra mobile height. No account, gameplay, protocol or assets changes. Headless Brave validation only, no capture; no immediate Claude action.

## Owned pre-mission evolution loadouts — LIVE181126r0103/protocol29

PR5662c0ee7a97268be7d687d43a01884610a4556fa2f. Client44292583012/Worker44292583031/Pages44292583010 success.6 local+2 public UI cases pass, actual public Worker rejects forged/unowned MC auth and shows NO EVO over51 healthy snapshots. Source proof lab/evolution/loadout-release-proof.json. No capture/live credit spending; SQLite/Room covers positive bank/authority cases and browser fixture purchases cover presentation. Temporary processes stopped. No immediate Claude action.

Owner chose1500 banked credits each for permanent BC/MC unlocks. New evolution slot reuses catalogue/bank atomic purchase/cleanLook. Buying does NOT auto-equip; a subsequent tap equips one owned build, tapping equipped removes it. Ship page evolution-slot shortcut opens EVOLVE. Requirements/prices during match stay BC2T/G4 or MC4MSL/2MINE, floor300/cost120; no free default/grandfather grant. Legacy numeric Save.evolution is ignored.

NetClient snapshots its requested look at construction. Server accepts initial auth equipment before any binary frame and within3s of joining; async ownership resolution may complete later, but the request is fixed. Only owned, slot-matching choice reaches Player.look/roster. Queued player BUY5 must match that exact build; NPCs retain their simulation-only path. Resume/Warzone respawn preserve loadout. Unknown/bank failure stays unequipped; no game-state grants or new database tables. Protocol29 refreshes old free-selection clients, no binary layout change.

Compact shop shows both counters (e.g.MSL3/4 MINE1/2) and mineral goal/cost on two lines; READY enables button/6, EVOLVED remains visible, NO EVO prompts Hangar. Readiness/tips derive from server roster, never editable local preference. Headless fixture confirms changing saved look mid-mission still requests equipped build. Six PC/touch/portrait layouts pass two1500 purchases, explicit equip, one-slot swap/unequip, old preference ignored, progress/ready/blocked input and bounds. No captures or actual live credit spending; browser purchases are intercepted fixtures, authority/bank checks use real SQLite/Room.

Type/build/sim/config/bank pass. Bank regression covers insufficient funds, exact deductions, idempotence, unowned/unequipped/alternate/late/silent-late auth rejection, selected evolution purchase and resume. Temporary preview4187 stopped after QA; evidence outputs/steroids-alpha/missile-cruiser-lab/loadout-*. Existing randomized bot-spacing and Pages counter housekeeping remains deferred.

## Missile Cruiser artillery correction — LIVE181126r0102/protocol28

PR564 merge74dd2ced9c85c359983d4ffc421b68bfffd83b28. Client44251753113 attempt2 and Worker44251753080 succeeded. Public server supplied min90/base0/cruise170/top225 over49 healthy snapshots; actual Hangar preview has0 MC heads/2 BC heads. Public lab evolves with0 turrets/min90/ammo8. No page errors/capture; headless closed. Portable proof lab/evolution/artillery-release-proof.json. Pages44251753017 deployed successfully, then failed unrelated Operation C counter persistence on push race. Client first attempt failed existing unseeded bot-spacing assertion (848px vs900), retry passed; defer deterministic fixture/CI counter housekeeping to next Claude session.

Owner clarified zero required turrets means zero free turrets. MC baseTurrets/minTurrets/minGuns now0; bought turret upgrades retained exactly. Minimum speed140→90, cruise170/top225/turn unchanged. Lab model and turning preview match, with empty mounting platforms before purchases. Existing shipPreview already hides heads above base ownership. Bought CIWS keeps its7-shot bursts.

Shared authority regression checks0/1/2/4 bought turrets after evolution and actual braking floor90; Battlecruiser remains2 base/min140. Burst fixtures now explicitly buy MC turrets. Type/sim/lab/config pass. Protocol28 keeps the same layout, forcing refresh of cached27 clients because the older hosted config record lacks MC and keeps its legacy hash. No hosted record or asset upload needed. Paired client/Worker release completed; defer Claude action.

## Capital evolution production port — LIVE 181126r0101/protocol27

LIVE proof: PR562 29bb41a4db28900f1c00a4e028b8fb1aff1b6172; itch44232567195/Worker44232567203/Pages44232567296 all success. Public2 Hangar+2 lab+WebGL/Canvas rendering pass, real healthy planet connections and75 snapshots. Step-count grip check24°→.53° passes. Portable proof steroids-alpha-lab/evolution/release-proof.json; no captures; upload tab and temporary processes stopped. No immediate Claude action.

Owner approved release18 November2026 after the lab review, requesting narrower CIWS shots. Painted small turret bolts now compress the short axis to20% of the original sprite aspect (with a.7px visibility floor); actual production render checks compare against main shots. Main-gun width remains unchanged. Lab CIWS and primary bolts have distinct draw flags.

Production port adds chassis4 Missile Cruiser, an EVOLVE tab with two graphical requirement cards/ship stats/persistent build choice, and selected build in flight's shop. BUY5 tier0/1 selects BC/MC; authority validates alive fighter, upgrade totals/specific tiers, floor/cost and rejects repeats/invalid builds. MC requires Missiles4/Mines2, floor300/cost120; keeps other upgrades, fills eight missile charges, no main guns, one missile per press/held FIRE repeat. Shared stepShip owns ammo/cooldown so prediction/replay agree. Rear launch .45s before bounded homing, +50% range/damage,1.5x collider/render size. Server chooses ship or hostile Warzone structure locks; HUD shares structure selection; no client target IDs.

Both capital forms have server-owned seven-shot CIWS bursts at two ticks per shot,1.15s pause then reacquire, priority missiles→ships→mines→asteroids. Target is retained during a burst, dropped on loss. Fighters retain existing drone cadence. Four painted platforms, active heads max(2,bought). Heavy towers warn, fire two110-damage1500-speed shots six ticks apart, pause/reload; existing clan/docking/war protections retained. New bounded missileCruiser/ciws/heavyTower tune groups upgrade old config and are exposed in calibration stats.

Protocol27 keeps107-byte ship layout, permits chassis4 and ordnance kind2 for heavy missiles even after owner death; client+Worker must deploy together. Art is a new shared ShipProfile using the approved18 modules/cardinal offsets at equivalent game registration, native hover/shadow/palettes/per-part FFD/fallback. New package plus common BC turret parts have verified hashes; production pack passed from a locally verified ZIP cache. No image binaries committed.

Type/build/shared sim+capital regression/config/rig/bank pass. Seven production Hangar layouts cover both evolution selection/persistence/cards, alongside existing ship equips and bounded rebuilds. Two independent Brave clients through actual local Worker protocol27 pass, including120ms RTT, travel snapshots and remote interpolation. Production WebGL/Canvas fixtures verify actual18-part MC profile, no gun modules, hover/shadow and narrower CIWS; no captures. Tests/proofs in outputs/steroids-alpha/missile-cruiser-lab/. New regression imported by existing sim runner, no workflow edits.

R2 upload completed18 November through Brave file chooser (Files submenu). ZIP and8 parts verified by prepare-steroids-lab; production staging also verifies shared BC turret equipment. Task duplicate closed; no native input/capture/recording. Paired client/Worker and Pages release authorized; public checks follow. No immediate Claude session requested.

## Evolution & siege — LOCAL LAB PREVIEW, pending art upload

Owner approved lab preview first, not live deployment; missiles are one per press, hold to repeat. New isolated `steroids-alpha-lab/?evolution=1` provides graphical build criteria, persistent preview selection and test preparation. Battlecruiser requires Turrets2/Guns4; Missile Cruiser requires Missiles4/Mines2. Both use floor300/cost120 in this comparison. Other upgrades remain. Eight missile capacity, no main guns, .45s rear launch followed by bounded arc, 1.5x range/damage, larger projectile; mines retained. Both capital forms use seven-shot CIWS then pause/reacquire, prioritizing hostile missiles. Towers use two fast110-damage shots plus telegraph/reload; fighter shield-break grace retained conceptually.

New18-module painted rig uses new elongated keel/sponsons/8-door bay/bridge/engines, shared faction turret hardware, fixed order/cardinal offsets/3% shading, engine vibration and per-part control FFD/Canvas fallback. Four platforms; active turret heads use max(2,bought), not additive ownership. Correction to the previous live note: minimum2 bought upgrades do not imply4 equipped heads under the current shared turretCount function.

Model has no network/save/hosted-publish connection and is NOT a production chassis implementation. Before live: authoritative build selection/purchase validation, chassis persistence/protocol, shared missile capacity/rear launch/building lock, burst turrets/towers, replay/prediction and remote rendering tests. `evolution/README.md` and JSON contain candidate values/boundary; ART_PROMPT.md records built-in image_gen provenance.

Type/build/standalone model/rig checks and seven no-capture Brave DPR2 PC/touch/portrait/Canvas layouts pass; selection/evolution,8 missiles/no primary, gun cruiser, mine input, control FFD, persistent selection, bounds and bounded resets pass. No page errors/sockets/remote writes. Evidence: outputs/steroids-alpha/missile-cruiser-lab/. Public delivery pending owner manual R2 ZIP upload; URL404, CLI not authenticated. Do not merge mandatory preparation until upload verifies. No immediate Claude work, itch/Worker/config release or production changes.

## Live speed grip, Hangar stats and ship balance — LIVE171126r0100 / protocol26

PR559 merge1eccd9e0e6626cc717504a87868314dfbb6518a5. itch44129275449, Worker44129275517 and Pages44129275338 succeeded. Public7 Hangar layouts +5 evolution-gate layouts pass; live beta connection receives72 travel snapshots and slips24° fast→.57° braking. Hosted settings upgrade resolves enabled grip/cap25/turrets2/guns4. Public lab fields/three profiles pass; no page errors or captures, temporary processes stopped.

Owner explicitly approved live Speed Grip, superseding the previous grip-only live gate. Other experimental lab turn-band, auto-cruise and pushback remain unported. Protocol26 carries travelHeading at103 (107-byte ships); one shared movement step owns grip before shot emission, including replay/snapshot/interpolation and actual target velocity. No private bullet bridge in production. Lab candidates disable shared grip to retain their independent comparisons; Live Baseline now uses live grip.

Battlecruiser now requires2 bought turret upgrades and Guns4, plus existing total/power/cost; upgrades retained and base2 turrets make4 equipped after minimum evolve. Ship shields use min(35% capacity,25 points/sec), existing delay/hit reset retained. Hangar five bar rows show tune-derived base speed, turn, shield, main DPS and actual cold-to-overheat shots. No ownership/schema changes. New grip regression is in client and Worker release gates.

Evidence: outputs/steroids-alpha/live-speed-grip/. Shared simulation, grip/lab/config/rig/bank/type/build checks and seven headless Hangar layouts pass. Two independent Brave clients including120ms RTT verify binary travel, fast slip/brake recovery, firing, remote interpolation and bounded reconciliation. No captures or immediate Claude work. Public proof above; release complete.

## Desktop/mobile UI correction — live171126r0099

PR557 mergeec5ef477; itch44119747544 success. Public seven title/resize and eight HUD layouts pass with zero page errors/no capture; backend healthy protocol25 and five planets. Worker was not redeployed. Companion Pages44119747530 completed build/deploy but failed unrelated Operation C counter persistence after a concurrent main push; future CI housekeeping only, no Steroids block.

Owner clarified PC upgrade menu/scoreboard were missing. Root cause: touch-only early return suppressed clickable drawer navigation on PC, while the shop was collapsed. Both devices now get buttons through the existing intents/uiZones; PC keeps B/Tab/1–6 shortcuts, compact pinned-self ranking and collapsed shop. Header Warp and nav share geometry. Large PC title layouts are bounded and centred with a larger logo/ship/action panel; touch/short/narrow retain compact arrangement. No new dependencies, account schema, gameplay tuning or protocol change. Speed Grip remains lab-only awaiting approval. Headless no-capture interaction and responsive geometry evidence: outputs/steroids-alpha/desktop-layout/. No immediate Claude action.

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
