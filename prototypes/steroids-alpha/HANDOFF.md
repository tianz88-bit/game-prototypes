# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-15 codex ground-hover-light
DID: restored the separate soft ground hover pool missing from the live renderer: +2X/+35Y at 1600x900 reference, palette-coloured, lower than the craft, sized by chassis/growth. Sun-driven hard shadow and drone rendering retained.
FILES: render/{hoverLight,shipView}.ts client.tune.json sim/liveConfig.ts scripts/test-steroids-live-config.mjs BRIEF/BUILD_STATUS.md
SEAM: render.hoverLight* live visual fields; older records inherit defaults, bounded settings; ShipPlacement and protocol unchanged.
CROSS: config validator/test only. Typecheck/build/rig+FFD/live-config pass; 24 Brave WebGL/Canvas desktop/mobile day/night cases verify offset, palette textures and unchanged shadow placement with no browser errors.
FOR claude: one cached 128px texture per glow palette; ships own only an Image, destroyed with view. Approved portal logo and 8 new painted bullet/mineral/coin sources are separate PC review assets, not part of this runtime PR; R2 delivery/integration follows art approval.

## 2026-11-15 claude feel-pass
DID: dash boosts straight ahead (aimed dash removed; bots dash only when lined up); accel/brake 440/600; bullets drawn x2 (hitbox unchanged); hit sparks x2; plume x2 at top speed (thrusterTopSpeedStretch 1 -> 3), x3 in a dash (thrusterDashStretch 5); bots linger 60 s after the last pilot is destroyed, leave at once on disconnect; death screen R/Space respawn, Esc menu, keys on buttons; R no longer eaten as Warp while dead.
FILES: sim/{ship,protocol,bots,liveConfig}.ts server/src/room.ts src/{input/intents,net/client,scenes/flight,render/thrusters,render/shipView}.ts tune.json client.tune.json ../steroids-alpha-lab/preview.ts scripts/test-steroids-alpha-{sim,bank}.mjs BRIEF.md
SEAM: ShipInput.dashAim removed; wire offset 18 stays as a reserved NaN float (protocol 19 unchanged). ThrusterInput.dashing; ThrusterVFX.update(..., trailStretch, dashStretch). clientTune.render.{thrusterDashStretch,bulletScale,hitSparkScale}; tune.bots.lingerSeconds.
CROSS: src/render/{thrusters,shipView}.ts (dash stretch), worldArt draw calls get a scaled `at` (drawHitSpark/drawBullet unchanged).
FOR codex: the dash aim arrow during the charge now just points along the heading; restyle or drop it.

## 2026-11-15 codex control-ffd
DID: per-part hardline FFD for acceleration/braking/yaw on all 3 ships; passive rotation stays on the original rig. Preserves inverted yaw, fixed Z, recoil, vibration, palette/depth shading and tilted exhaust origins; no raster baking.
FILES: render/{shipTilt,partFFD,shipView}.ts scenes/flight.ts main.ts client.tune.json sim/liveConfig.ts scripts/test-steroids-{alpha-rig,live-config}.mjs COLLAB/BRIEF/BUILD_STATUS.md
SEAM: optional ShipView/DrawnShip control cue; own intent vs explicit remote observed motion, absent cue level. render.ffd* live settings, old records upgrade; no protocol/gameplay changes.
CROSS: scene control forwarding, bounded config validation and regression tests. Typecheck/build/sim/live-config/396 poses + 14400 lab FFD points pass; Brave WebGL/Canvas 36 states, mobile marker/brake, disable/slow/failure fallback, context restoration and 2-client check pass (~58/57 FPS PC).
FOR claude: Owner approved; PR #478 merged/live, client 43689948315 and Worker 43689948353 passed. Brave verified build 151126r0052 FFD, disable fallback and level return with no errors. render.ffdEnabled=0 selects original sprites; slow frames >50ms for 2s fall back, 5s healthy recovers; distant cutoff scale .15. Meshes are cached per view and destroyed with it. FFD is visual only; authoritative hitboxes/muzzle points unchanged. Per-chassis live calibration and orbital transitions remain pending.

## 2026-11-15 codex compact-ui
DID: compact labelled shield/hull/heat/dash cluster, shield reboot and break cells, readable salvage/zone badges, actual rig ship/palette previews, EVOLVE thumbnail and capital name clearance; navy/cream panel material across menus and controls.
FILES: src/render/{ui,combatHud,shipPreview}.ts src/scenes/{flight,hangar,menu}.ts BUILD_STATUS.md
SEAM: none; wire, gameplay tuning and action/shop hit zones retained.
CROSS: scene presentation only. Typecheck/build/396-pose rig/sim/live-config pass; Brave DPR2 desktop/844x390/667x375/upright UI and controls inspected; two-client check passed at 57 FPS (PC emulation).
FOR claude: owner approved live publishing; PR #476 merged as 422d8a9, client run 43687328183 succeeded. Live HUD/planet snapshots verified in Brave with zero errors. Full harness needs a shooting-phase split baseline; its absolute splits>=1 can skip the hunt before bullets appear. Local Brave adapter uses splits>phaseStart; production harness unchanged. FFD, per-chassis hosted calibration and orbital transitions still pending.

## 2026-11-14 claude screenshot-harness-fixes
DID: scripts/screenshot-steroids-alpha.mjs repaired (owner OK; your 4294473b/ad953346 notes): keyboard turn summed per frame in the page (screenshots between samples took ~1 s, aliasing even per-sample sums; real turn 24.5 rad); runs on Planet B (bots' hits knocked ships about); drop-in tracked by the third ship's id; STEER step replaced by "no STEER button, marker only"; desktop split check only when within interest range; prediction window retried until neither ship carries knockback.
FILES: scripts/screenshot-steroids-alpha.mjs
SEAM: none
CROSS: none
FOR codex: in this container the full run passed once; other runs fail the prediction check at ~6 FPS / 1-2 s RTT (software WebGL). Please run it on your GPU machine when convenient and report.

## 2026-11-14 claude never-block-portrait
DID: removed the "turn your phone" blocker (owner: never block the player). Tall upright phones (h > 1.4 w) draw the landscape game turned a quarter (top along the screen's left); taps, stick and the name field follow. Near-square screens play as is. Planet tap on touch requests fullscreen + landscape lock where allowed.
FILES: src/base.ts src/main.ts src/input/{intents,immersive}.ts src/scenes/{menu,flight}.ts (rotate.ts deleted) scripts/screenshot-steroids-alpha.mjs BRIEF.md
SEAM: logicalSize() is landscape when sideways; pointer coords go through base.toLogical; #app is the rotated container (name field lives inside it). Test hook sideways() replaces portraitBlocked().
CROSS: none
FOR codex: read sizes from logicalSize(), never window.innerWidth/Height; DOM elements over the canvas go inside #app.

## 2026-11-14 claude forgiving-shield
DID: shield breaking hit absorbed + 0.5 s hull grace (once per recharge cycle, re-armed above 50%); regen delay 3 s, 35%/s; HUD shield bar glows/fills flashing red during the cooldown when down; shatter ring on break.
FILES: sim/{ship,world,protocol}.ts src/net/client.ts src/scenes/flight.ts tune.json scripts/test-steroids-alpha-sim.mjs BRIEF.md
SEAM: protocol 19 ShipState.shieldCd (server-set). hits[].broke -> fx 'shieldBreak'. ship tune keys shieldBreakGraceSeconds, shieldGraceRechargeFraction.
CROSS: none
FOR codex: shatter effect and red cooldown bar are placeholders (flight.ts drawTouch, 'shieldBreak' fx); a shield-down warning on the ship would help.

## 2026-11-14 claude bot-behaviour
DID: bots play worse instead of weaker stats: sight 600, reaction ~0.9 s, aim at last-read position (4 reads/s), attention 6 s then distracted 4 s, one bot per pilot. Duel (pilot not firing back): 2.6 s -> straight 3.6 / gentle 13 / weave 27 s.
FILES: sim/bots.ts server/src/room.ts tune.json scripts/test-steroids-alpha-sim.mjs BRIEF.md
SEAM: botThink(..., others: BotBrain[]); BotBrain gains target/reactAt/engagedSince/distractedUntil/seen; new bots tune keys.
CROSS: none
FOR codex: nothing.

## 2026-11-14 claude no-steer-toggle
DID: phones always steer with the direction marker; the STEER toggle button and its zone are gone (saved craft setting ignored on touch).
FILES: src/input/intents.ts src/scenes/flight.ts BRIEF.md
SEAM: intents.schemeButton stays null on touch; toggleScheme no-op on touch.
CROSS: none
FOR codex: the bottom-left space the STEER button used is free.

## 2026-11-14 claude painted-rocks
DID: your 15 painted asteroids (visual-review-v4) replace the 64px pixel rocks: families inherit on split (server), siblings alternate variants, linear-filtered, same projected 4x4 mesh. Each rock anchored at its deepest body point and scaled so its inscribed circle >= hitbox (1.26-1.69x width). Damage darkens (no crack art).
FILES: src/render/rockPainted.ts src/scenes/{boot,flight}.ts src/main.ts sim/{asteroids,world,protocol}.ts art/asteroids-v1/asteroid-assets.json art/prepare-assets.mjs scripts/test-steroids-alpha-sim.mjs
SEAM: protocol 18 Asteroid.family (0 ochre, 1 lavender, 2 teal; new rocks id % 3). rockPixels.ts kept as fallback.
CROSS: src/render (rocks); rockPixels.ts untouched.
FOR codex: crack/damage stages and hit chips for the painted rocks would help; silhouettes with less deep notches would draw closer to the hitbox.

## 2026-11-14 claude hangar-tabs
DID: Hangar by category (owner): tabs SHIPS, PALETTES, FLAMES, SHIELDS, KILL FX, BADGES, NAMES, EXTRAS; larger cards; Battlecruiser info card in SHIPS. Open tab remembered while the game is open.
FILES: src/scenes/hangar.ts src/main.ts
SEAM: none (test hook hangar().tabs)
CROSS: none
FOR codex: tab and card styling are placeholders.

## 2026-11-14 claude ships-v2
DID: Interceptor (credit unlock, Hangar) and Battlecruiser (in-run EVOLVE: 6 upgrades, 300 power, 120c) live on the kit art; four palettes replace tints (legacy tints map/claim). Rig is profile-driven; per-ship textures, shadows, palette remap textures; 4-cannon recoil; escorts.
FILES: sim/{chassis,ship,shop,world,turrets,protocol,liveConfig,unlocks}.ts server/src/{room,index,bank}.ts src/render/{shipRig,shipArt,shipView,shipProfiles,palette}.ts src/scenes/{flight,hangar}.ts src/input/intents.ts art/{interceptor-v2,battlecruiser-v1,ships-v2}/* art/prepare-assets.mjs tune.json scripts/test-steroids-alpha-{sim,bank}.mjs
SEAM: protocol 17 ShipState.chassis. shipRig functions take an optional modules list (starter default, parity unchanged). ShipView(scene, mine, chassis, palette); partKey(asset, shipId, palette); shadowKey(shipId); profileFor(chassis). Look slots ship/palette. BUY item 5 = evolve; key 6.
CROSS: src/render/{shipRig,shipArt,shipView}.ts (codex lane): generalised for three ships; starter maths untouched (396-pose parity passes). Only manifests, calibrations and palettes.json copied from your kit; the kit itself stays on codex/steroids-ships-v2-handoff.
FOR codex: evolve transform effect, Battlecruiser name-tag placement, Hangar ship icons and EVOLVE card styling are placeholders.

## 2026-11-13 claude unlock-shop
DID: Hangar scene (menu -> HANGAR): buy/equip 20 unlocks from sim/unlocks.ts (tints, flames, shields, Nova kill fx, badges, name colours, run history). POST /account/buy (server price, atomic balance check); GET /account returns unlocks. Looks sent in the auth message, worn only when owned, broadcast in the roster. Run history recorded in the save.
FILES: sim/unlocks.ts server/src/{bank,index,room}.ts src/scenes/{hangar,menu,flight}.ts src/net/{account,client}.ts src/save.ts src/main.ts src/render/{shipView,thrusters}.ts sim/protocol.ts tune.json scripts/test-steroids-alpha-bank.mjs
SEAM: RosterEntry.look; ShipView.setLook(tint, palette, shield); ThrusterVFX.palette; DrawnShip.setLook; fx 'explosion' carries killer.
CROSS: src/render/shipView.ts (tint multiply, shield colours from look), src/render/thrusters.ts (palette)
FOR codex: hangar cards, swatches, Nova rings and badges are placeholders; restyle freely. Keep tint as a multiply over the art and shield colours readable.

## 2026-11-13 claude bank
DID: D1 bank: anonymous accounts (hashed secret + recovery code), POST/GET /account, POST /account/recover; extraction banks salvage once per run (ledger sum = balance); menu credits panel + RESTORE; result shows Banked +N / Credits. Deploy workflow applies D1 migrations before deploy.
FILES: server/{src/bank.ts,src/index.ts,src/room.ts,wrangler.jsonc,migrations/0001_bank.sql} src/{net/account,net/client,save,main}.ts src/scenes/{menu,flight}.ts scripts/test-steroids-alpha-bank.mjs .github/workflows/deploy-steroids-alpha-worker.yml
SEAM: client sends one text frame {type:'auth',secret} on open; JSON 'banked' {amount,balance,error?} -> net.banked; save.account; Room(..., bank?).
CROSS: none
FOR codex: menu account panel (menu.ts drawAccount) and the result lines are placeholders; restyle freely, keep the recovery code legible.

## 2026-11-13 claude salvage-hotzone
DID: salvage (mined minerals add it; HUD SALVAGE), gold drop on death (carried + 50% power above start; no power gold in spawn protection; repeat kills by name halve; bots never earn, drop 50%), moving x2 hot zone (ring + tracker, half of new rock spawns inside), salvage on EXTRACTED. Orbital zoom spec in GFX_BRIEF.md (owner chose it over clouds). Death check moved to Planet B (bots).
FILES: sim/{ship,world,protocol,liveConfig}.ts server/src/room.ts src/{net/client,scenes/flight,liveConfig}.ts tune.json BRIEF.md GFX_BRIEF.md scripts/{test-steroids-alpha-sim,check-steroids-alpha-death}.mjs
SEAM: protocol 16. ShipState.salvage; Pickup kind 'salvage'; World.botIds, payoutFactor, hotZone; JSON 'hotzone' -> net.hotZone; fx 'gold'; tune groups salvage, hotZone.
CROSS: ../steroids-alpha-lab/draft.ts (Salvage, Hot zone groups)
FOR codex: build the orbital zoom transition (GFX_BRIEF.md, bottom). Restyle gold coins, hot zone ring/arrow, SALVAGE counter.
