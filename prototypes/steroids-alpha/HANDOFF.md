# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-14 codex codex/steroids-ships-v2-handoff
DID: Deliver current overhead interceptor/capital rigs and three new R2 art packs for integration; no runtime wiring, merges or deployments.
FILES: tools/ship-rig/human-nomad-ships-v2/* BUILD_STATUS.md
SEAM: proposed per-chassis profiles/calibration, four-cannon recoil, palette RGBA remap and footprint/muzzle proposals only; production contracts unchanged.
CROSS: none; no tune, protocol, account, scene-flow or CI changes.
FOR claude: Restore via kit/restore-assets.mjs; all three public ZIP SHA256s verified. Twelve/sixteen-module tests, typecheck, approved396-pose rig and build pass. Radius/mount proposals require owner review. Credit unlock/evolution/stat/tint migration decisions remain in your lane; orbital zoom/salvage polish remains pending Codex work.
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

## 2026-11-13 codex codex/steroids-bot-readability
DID: Authoritative diamond bot tags and quiet bot text/board styling; full graphics brief delivered and session status reconciled.
FILES: src/scenes/flight.ts sim/protocol.ts server/src/room.ts scripts/test-steroids-live-config.mjs BUILD_STATUS.md GFX_BRIEF.md
SEAM: optional roster.bot boolean from server-owned bot map; absent flag stays unmarked. Binary protocol remains 14; client + Worker deploy together. Gameplay/calibration unchanged.
CROSS: protocol.ts/room.ts additive read-only bot metadata; live-config room test confirms a human named BOT Impostor remains bot:false.
FOR claude: Typecheck/build/rig/sim/live-config pass; live two-client + four-bot flags verified, desktop/DPR2 bot/human-name-spoof fixtures inspected; zero errors, baseline pacing. Optional new physical power-tier modules remain an owner art decision.

## 2026-11-13 codex codex/steroids-vfx
DID: Stylized explosion rays/smoke, clearer directional shield hits (8-hit render cap), square dash charge, boosted engine cores/streaks and beveled turrets; threats draw after explosions.
FILES: src/render/{worldArt,shipView}.ts src/scenes/flight.ts
SEAM: none; gameplay, hitboxes, inputs and calibration unchanged.
CROSS: none (render/shared drawing)
FOR claude: Typecheck/build/rig/sim pass; desktop/DPR2 phone charge, boost, shield, turret and explosion fixtures inspected. 2 clients + bots baseline pacing, zero errors. Particle emission, rig poses and combat timings unchanged.

## 2026-11-13 codex codex/steroids-ui
DID: Shared canvas panels/palette for shop, board, bars, weapons/touch, menu/name/QR and death; tier pips, action glyphs and compact phone board.
FILES: client.tune.json src/render/ui.ts src/scenes/{flight,menu}.ts sim/liveConfig.ts scripts/test-steroids-live-config.mjs
SEAM: STEER face + intents.schemeButton move together to bottom-left; render.ui* palette defaults added, older configs upgraded without overwriting tuning. Other zones/gameplay/calibration unchanged.
CROSS: sim/liveConfig.ts bounds only six UI RGB paths to integer 0..0xffffff and corners to 0..16; scripts/test-steroids-live-config.mjs boundary/migration coverage; menu styling only.
FOR claude: Typecheck/build/rig/sim/live-config pass; desktop + DPR2 phone HUD/menu/death inspected; real STEER taps toggle both ways. 2 clients + bots baseline pacing, zero errors. QR quiet zone retained.

## 2026-11-13 codex codex/steroids-markers
DID: Gold segmented bounty rings and star badges, backed/clamped tracker labels, matching board accent and a persistent framed MISSILE LOCK warning.
FILES: src/scenes/flight.ts
SEAM: none; gameplay, hitboxes, inputs and calibration unchanged.
CROSS: none (render/shared drawing)
FOR claude: Typecheck/build/rig/sim pass. Brave desktop + DPR2 phone owner/near/edge bounty fixtures inspected; 2 clients + 4 bots baseline pacing, zero console/page errors; bounty rules and lock selection untouched.
