# HANDOFF (newest first, max 15; format in COLLAB.md)

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

## 2026-11-13 codex codex/steroids-ordnance
DID: Missile hull/fins, blue-white ignition and bounded curved smoke history; spiked armed/unarmed mines, trigger dashes and HP; distinct blast debris and segmented lock crosshairs.
FILES: src/render/worldArt.ts src/scenes/flight.ts
SEAM: none; gameplay, hitboxes, inputs and calibration unchanged.
CROSS: none (render/shared drawing)
FOR claude: Typecheck/build/rig/sim pass. Brave desktop + DPR2 phone ordnance fixtures inspected; 2 clients + bots, baseline frame pacing and no console/page errors; no projectile rules or lock-selection changes.

## 2026-11-13 codex codex/steroids-pickups
DID: Faceted amber mineral crystals with value scaling, bob and sparkle; medical capsules and floating heal crosses; collection shards.
FILES: src/render/worldArt.ts src/scenes/flight.ts
SEAM: none; gameplay, hitboxes, inputs and calibration unchanged.
CROSS: none (render/shared drawing)
FOR claude: Typecheck/build/rig/sim pass. Brave desktop + DPR2 phone fixtures inspected; 2 clients + 4 bots 32.06 FPS, p95 31.6ms, zero console/page errors.

## 2026-11-13 codex codex/steroids-asteroids
DID: sunlit asteroid facets, inset pits, damage cracks, hard outline and split/impact debris.
FILES: src/render/worldArt.ts src/scenes/flight.ts
SEAM: none; existing rockShape/collision geometry, fx events and gameplay unchanged.
CROSS: none (shared flight drawing only)
FOR claude: typecheck/build/rig/sim pass; Brave desktop + DPR2 phone fixtures inspected; two clients + bots 32.04 FPS, p95 31.6ms, zero console errors. Remaining graphics work continues.

## 2026-11-13 codex PR #448
DID: stationary craters/dust, sand banks, cool night/warm twilight and sunlit atmosphere, shader only; silence missing favicon request.
FILES: src/render/planetGround.ts index.html BUILD_STATUS.md
SEAM: none; projection, sun, calibration, inputs and gameplay values unchanged.
CROSS: none
FOR claude: typecheck/build/396-pose rig/sim pass; Brave desktop + 844x390 DPR2, two clients + 4 bots, no console errors. Frame parity: main 32.04 vs pass 32.06 FPS, both p95 31.6ms. Legacy keyboard-turn check fails on both main and pass; investigate harness separately. GFX_BRIEF items 2-8 remain queued.

## 2026-11-12 claude bounty-lock
DID: bounty marker on the strongest real player (2+ players, bots never) + gold edge tracker for others; in-flight missile lock crosshair for firer and target, MISSILE LOCK warning. GFX_BRIEF.md for codex.
FILES: server/src/room.ts sim/protocol.ts src/net/client.ts src/scenes/flight.ts scripts/test-steroids-alpha-sim.mjs GFX_BRIEF.md
SEAM: protocol 14: OrdnanceView.target. JSON 'bounty' {id,x,y} -> net.bounty. flight.ts drawBounty, drawCrosshair, drawStar.
CROSS: none
FOR codex: read GFX_BRIEF.md (owner's graphics request, priority list). Bounty/lock visuals are placeholders.
