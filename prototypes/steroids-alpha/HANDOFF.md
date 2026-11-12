# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-13 codex proto/steroids-alpha/graphics-surface
DID: shader-only shallow craters, dust variation, sand banks, cool night/warm twilight and a brighter sunlit atmosphere; first graphics item, draft pending performance/DPR-2 checks.
FILES: src/render/planetGround.ts BUILD_STATUS.md
SEAM: none; projection, sun, calibration, inputs and gameplay values unchanged.
CROSS: none
FOR claude: typecheck/build/rig/sim pass; Brave desktop/phone DPR1 and two clients + bots inspected without console errors; exact DPR2/headless performance still unverified. Remaining GFX_BRIEF items stay queued.

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

## 2026-11-12 claude dash-retune
DID: dash = 0.8 s charge (steering locked) + 0.7 s boost at 4x top speed (steering free); cooldown 8 s; yellow dash bar by the heat bar; swept collision for rams/rocks.
FILES: sim/ship.ts sim/world.ts tune.json src/scenes/flight.ts scripts/test-steroids-alpha-sim.mjs
SEAM: none
CROSS: none
FOR codex: dash bar is a placeholder (flight.ts drawTouch, beside the heat bar).

## 2026-11-12 claude dash-commit
DID: no steering during dash boost; charge 0.8 s; boost 4.5 s (3x distance); cooldown 6 s. Confirmed ram damage hits shields first (test).
FILES: sim/ship.ts sim/liveConfig.ts tune.json scripts/test-steroids-alpha-sim.mjs
SEAM: none
CROSS: none
FOR codex: dash charge effect now lasts 0.8 s; boost trail lasts 4.5 s.

## 2026-11-12 claude hex-sphere-shield
DID: shield hit effect redone as a hex-tiled sphere (owner reference): orthographic hex grid, glowing rim, hit-side cells flash. Live settings 5087bc96d49a (new dash values).
FILES: src/render/shipView.ts
SEAM: none
CROSS: src/render/shipView.ts (drawShield)
FOR codex: the owner's reference is a glowing blue sphere of hexagons; refine colours/glow freely.

## 2026-11-12 claude dash-charge-hullmax
DID: dash = 0.5s charge (hold direction) then 2x top speed for 1.5s; hull max separate from hull (minerals repair then grow; buying spends the max); gun tiers +20% heat; leaderboard KO count; shield hit = hexagon bubble, hit side flashes.
FILES: sim/{ship,shop,world,turrets,protocol,liveConfig}.ts server/src/room.ts src/{net/client,scenes/flight,main}.ts src/render/shipView.ts tune.json
SEAM: protocol 12. ShipState + dashCharge, hullMax (power/size/speed use hullMax). dashSpeed(hp) = topSpeed x dashSpeedFactor; heatCapacity(s). dashAim sent every step.
CROSS: src/render/shipView.ts drawShield rewritten (hex bubble); flight.ts drawDashCharge placeholder.
FOR codex: style the dash charge (flight.ts drawDashCharge; dashCharge 0..0.5s) and boost trail; the hex bubble is yours to refine.

## 2026-11-12 claude shop-overheat
DID: shop (turret/shield/guns, 4 tiers each, power floor + mineral cost; top-left one-tap buttons, keys 1/2/3), gun overheat (+damage 16), aim assist cone, aimed dash, dash ram. Power no longer scales damage/shield. QR now uses the repo's qrcode lib (own encoder removed).
FILES: sim/{ship,shop,turrets,world,protocol,liveConfig}.ts server/src/room.ts src/{input/intents,net/client,scenes/flight,scenes/menu,main,liveConfig}.ts tune.json
SEAM: protocol 11. ShipState + heat, overheated, turrets, shieldTier, damageTier. ShipInput + dashAim. maxShield/damageScale take ShipState. Fx kind 'ram'. New tune groups shop, weapon.assist*/heat*.
CROSS: ../steroids-alpha-lab (preview dashAim, Shop group); src/render untouched.
FOR codex: placeholders to style: shop buttons, heat bar, ram ring. Ship could show shield/gun tiers visually.

## 2026-11-12 claude damage-balance
DID: gun damage 12 (was 10), damage at power cap 3x (was 2x); published live db8d064d62a4.
FILES: tune.json scripts/test-steroids-alpha-sim.mjs
SEAM: none
CROSS: none
FOR codex: nothing.

## 2026-11-12 claude dash-fix
DID: dash holds dash speed through braking (released marker stick); excess speed above top bleeds at braking rate instead of snapping.
FILES: sim/ship.ts scripts/test-steroids-alpha-sim.mjs
SEAM: none (ShipState.speed can now exceed top speed briefly)
CROSS: none
FOR codex: plume can read speed > top speed during/after a dash (speedTrail clamps to 1).

## 2026-11-12 claude share-qr
DID: menu QR code of the itch page ("Scan to join"); tap copies the link (copy on pointerup via intents.copyZone). In-house QR encoder src/ui/qr.ts, verified vs python-qrcode.
FILES: src/ui/qr.ts src/scenes/menu.ts src/input/intents.ts src/base.ts scripts/test-steroids-alpha-qr.mjs scripts/fixtures/steroids-qr.fixture.json .github/workflows/deploy-steroids-alpha-itch.yml
SEAM: none
CROSS: none
FOR codex: menu QR panel is plain (white card + labels); restyle freely, keep the quiet zone (4 modules) and high contrast.
