# HANDOFF (newest first, max 15; format in COLLAB.md)

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

## 2026-11-12 claude missiles-mines
DID: shop items missile + mine (4 tiers, +1 charge each). Charges auto-refill one at a time, held. Missile locks ships only (30 deg / 900 px), homes, 35 dmg. Mine arms 0.7 s, creeps to enemies in 260 px, blast 110 px. Both shootable (36 hp); turrets: missiles > ships > mines > rocks. Bots use both. No republish needed (groups default from tune.json).
FILES: sim/{ordnance,world,ship,shop,protocol,liveConfig,bots}.ts server/src/room.ts src/{net/client,input/intents,scenes/flight,main,liveConfig}.ts tune.json scripts/test-steroids-alpha-sim.mjs scripts/screenshot-steroids-alpha.mjs
SEAM: protocol 13. Input bits missile/mine. ShipState + missileTier, mineTier, *Charges, *Cd, *Shots. MSG.ORDNANCE frame (OrdnanceView). JSON 'blasts' -> fx kind 'blast' {r, ordnance, shot}. intents.missileButton/mineButton. New tune groups missile, mine; shop.missile*/mine*.
CROSS: ../steroids-alpha-lab (draft.ts groups, preview input flags)
FOR codex: placeholders to style in flight.ts: drawWorld ordnance block (missile body+flame, spiky mine, arm blink, trigger ring, hp bar), lock brackets, drawWeapons buttons, 'blast' fx rings.

## 2026-11-12 claude bots
DID: AI bots on Planet A only, only while real players are present (4, respawn 5 s). Planet B stays PvP. Bots fight (lead + wobble, burst fire, dash), flee when hurt, farm, buy upgrades; on leaderboard as "BOT <name>".
FILES: sim/bots.ts sim/planets.ts sim/liveConfig.ts server/src/{room,index}.ts src/liveConfig.ts tune.json scripts/test-steroids-alpha-sim.mjs
SEAM: none on the wire (bots are ordinary ships in snapshots/roster). PLANETS[].bots flag. New tune group bots.
CROSS: ../steroids-alpha-lab/draft.ts (Bots group)
FOR codex: bots use the same rig; a distinct tint or marker for bot ships could help readability.

## 2026-11-12 claude dash-1.8x
DID: dash boost at 1.8x top speed (dashSpeedFactor 1.8); published live.
FILES: tune.json
SEAM: none
CROSS: none
FOR codex: nothing.

## 2026-11-12 claude dash-3x
DID: dash boost at 3x top speed (dashSpeedFactor 3), 0.8 s; published live.
FILES: tune.json
SEAM: none
CROSS: none
FOR codex: nothing.

## 2026-11-12 claude dash-lock
DID: steering locked for the whole dash (charge + boost); boost 0.8 s at the ship's top speed (dashSpeedFactor 1), per owner.
FILES: sim/ship.ts tune.json scripts/test-steroids-alpha-sim.mjs
SEAM: none
CROSS: none
FOR codex: nothing.
