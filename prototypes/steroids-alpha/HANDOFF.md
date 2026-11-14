# HANDOFF (newest first, max 15; format in COLLAB.md)

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

## 2026-11-13 claude warp-out
DID: 3-min lockdown, Warp (R / top-centre button; phones: under the shop row), warp mode (1.15x top speed, 20% steering, no firing incl. turrets), damage resets distance, rocks plowed through, 3000 px extracts -> EXTRACTED screen (Drop in / Menu). Server guessed steps no longer repeat missile/mine/warp presses.
FILES: sim/{ship,world,protocol,liveConfig}.ts server/src/room.ts src/{net/client,input/intents,scenes/flight,main,liveConfig}.ts tune.json scripts/test-steroids-alpha-sim.mjs BRIEF.md
SEAM: protocol 15. ShipState + lockdown, warping, warpDist; ShipInput.warp; CLOSE.EXTRACTED; JSON 'extracted' (to pilot) and 'warpouts' -> fx kind 'warpout'; net.extracted; intents.warpButton; tune group warp.
CROSS: ../steroids-alpha-lab (preview input, Warp group)
FOR codex: placeholders: warp button (drawWarp), warping ring (drawWorld), 'warpout' fx rings, EXTRACTED panel (deathScreen extracted=true). A warp trail/charge look would help.

## 2026-11-13 codex codex/steroids-pixel-rocks
DID: Replace vector asteroids with chunky pixel-painted sprites: nine variants, three damage stages, planet projection and bright hit flashes.
FILES: src/render/rockPixels.ts src/render/worldArt.ts src/scenes/flight.ts COLLAB.md BUILD_STATUS.md
SEAM: none; gameplay, hitboxes, inputs and calibration unchanged.
CROSS: none (render/shared drawing)
FOR claude: Typecheck/build/rig/sim pass. Two-client desktop/phone DPR2 ~56 FPS, zero errors; painted masks cover the collision disc in all27 sprites. Source is code-authored, fixed 27 nearest-filtered textures (432KiB); no raster files in Git. Owner requires GitHub tianz88-bit, not zitian-FF/Venomnom; itch stays daily-daily-games.

## 2026-11-13 codex codex/steroids-mobile-shop-level
DID: Compact upgrades into a shallow mobile row, default mobile to its own marker preference, and show ship upgrade counts as small Lv. labels.
FILES: src/scenes/flight.ts src/input/intents.ts src/save.ts sim/protocol.ts server/src/room.ts scripts/test-steroids-live-config.mjs BUILD_STATUS.md
SEAM: additive optional roster.level = sum of current shop tiers, server authoritative; binary protocol unchanged. Mobile saves use mobileSteer (default marker) independently of desktop steer. Deploy client + Worker together.
CROSS: protocol/room metadata + refresh key, intents/save preference, live-config roster regression. No gameplay stats changed.
FOR claude: Typecheck/build/rig/sim/live-config pass. Brave desktop and phone DPR2 inspected; legacy craft save starts mobile marker, explicit mobile choice persists, marker drag turns ship in freed control space. Level sums all five categories; upgrade-only roster refresh tested. Asteroids remain procedural pending owner art preference.

## 2026-11-13 codex codex/steroids-missile-wire-fixture
DID: Isolate the missile wire test from random bots and asteroid collisions so client deployment is reliable.
FILES: scripts/test-steroids-alpha-sim.mjs
SEAM: none; gameplay, hitboxes, inputs and calibration unchanged.
CROSS: scripts/test-steroids-alpha-sim.mjs fixture only; separate no-bot room with zero asteroid population.
FOR claude: Five consecutive full simulation suites pass; missile owner/target still asserted through real Room.step binary frames. No production changes.

## 2026-11-13 codex codex/steroids-hull-hit-feedback
DID: Directional hot-core impact sparks and subtle 140ms own-hull border flashes; the centre remains clear and repeated hits never stack opacity.
FILES: sim/world.ts src/net/client.ts src/scenes/flight.ts src/render/worldArt.ts scripts/test-steroids-alpha-sim.mjs BUILD_STATUS.md
SEAM: additive hits[].hull fact, NetFx hull + optional spark.angle; binary protocol unchanged. Client + Worker deploy together. Damage math, stats and calibration unchanged.
CROSS: World.damageShip reports actual hull damage (false for invulnerability); client forwards facts, sim tests cover six shield/hull cases.
FOR claude: Typecheck/build/rig/sim/live-config pass. Desktop/DPR2 pixel checks: shield/remote quiet, own hull flashes, zero interior changes, complete clearing. Six damage cases cover shields/overflow/invulnerability. ~56 FPS AMD D3D11, zero browser errors.

## 2026-11-13 codex codex/steroids-variety-drones
DID: Three asteroid outline/material families, three amber mineral forms, distinct lance/paired-tracer/drone rounds, and hovering weapon drones with detached shadows/animated stabilizers.
FILES: src/render/worldArt.ts src/scenes/flight.ts src/net/client.ts
SEAM: none; gameplay, hitboxes, inputs and calibration unchanged.
CROSS: src/net/client.ts attaches a fixed cosmetic gun-side look to transient visual bullets; no wire or prediction changes.
FOR claude: Typecheck/build/rig/sim pass; desktop/DPR2 variants inspected, two-client/bot capture ~56 FPS on AMD D3D11, zero errors. 900 outline cases enclose collision circles. Drone aim/muzzle slots and all combat tuning preserved.

## 2026-11-13 claude bot-spread
DID: bots spawn anywhere on the planet, best of 32 points by distance to the nearest ship, clear of rocks (bots.spawnRockClearance 200). Players still drop at the centre.
FILES: sim/world.ts server/src/room.ts tune.json scripts/test-steroids-alpha-sim.mjs
SEAM: World.addShip(id, spread?)
CROSS: none
FOR codex: nothing.
