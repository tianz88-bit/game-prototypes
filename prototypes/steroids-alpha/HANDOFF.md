# HANDOFF (newest first, max 15; format in COLLAB.md)

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

## 2026-11-12 claude turrets
DID: auto turrets (1 per 100 minerals, max 4): lock nearest enemy ship else asteroid within 380, turn ≤4 rad/s, 2 dmg shots. Live settings republished (00d655a775e4: top 350, regen 20%).
FILES: sim/turrets.ts sim/world.ts sim/liveConfig.ts server/src/room.ts src/net/client.ts src/scenes/flight.ts src/liveConfig.ts tune.json
SEAM: protocol 9. SHOTS side 10+i = turret i (TURRET_SIDE). Fx kind 'turret' {id,index,angle}. VisualBullet.small. tune.turret group (live-tunable).
CROSS: ../steroids-alpha-lab/draft.ts (added 'Turrets' stat group).
FOR codex: turret domes/barrels/muzzle flash drawn in flight.ts drawTurrets as placeholders; mounts in sim/turrets.ts TURRET_MOUNTS (base-size ship units) should line up with the art; adjust mounts there if needed.

## 2026-11-12 claude io-power
DID: .io power loop: minerals from asteroids are hull (cap 500), add shield max, spill when hit (victim locked 3s), death spills half. Power = more damage, less speed, bigger ship. Leaderboard ranks by power; HUD shows POWER.
FILES: sim/{ship,world,protocol,liveConfig}.ts server/src/room.ts src/net/client.ts src/scenes/flight.ts tune.json
SEAM: protocol 8. Pickups gain kind ('heal'|'mineral') + value. Fx kind 'mineral' (collected). Ships drawn at at.scale * shipRadius(hp)/radius. RosterEntry.power.
CROSS: none in render files; mineral crystal + collect ring drawn in flight.ts as placeholders.
FOR codex: mineral crystals, collect fx and ship growth visuals are placeholder; yours to style (powerLevel(hp) 0..1 in sim/ship.ts is the input). Ship parts could appear with power.

## 2026-11-12 claude dash-back
DID: dash restored (0.5s @450, top 350), shield regen 20%/s, rock outlines now cover hitboxes (fixes "invisible" rams), plume longer near top speed, pilot counts on planet select (GET /planets).
FILES: sim/* server/src/{room,index}.ts src/{input,net,scenes}/* src/render/{shipView,thrusters}.ts tune.json client.tune.json
SEAM: protocol 7 (dash back in ShipState/input). ShipView.update(.., boosting) back. ThrusterInput.speedTrail + update(.., trailStretch). New clientTune.render.thrusterTopSpeedStretch.
CROSS: src/render/thrusters.ts, src/render/shipView.ts, flight.ts rockShape, ../steroids-alpha-lab/ (Dash button back)
FOR codex: restyle the top-speed plume if you like (speedTrail 0..1 is the input). Live record still has maxSpeed 380 / regen 0.05: needs a republish.

## 2026-11-12 codex proto/steroids-alpha/hosted-publisher
DID: owner's calibration is live (ffc177fd2833); hosted owner publisher prepared, closed until Access setup is approved; local publisher stays off.
FILES: ../steroids-alpha-lab/* server/src/admin*.ts server/src/index.ts server/wrangler.jsonc scripts/test-steroids-live-config.mjs
SEAM: new protected /manage/ browser admin route and lab popup handoff; GitHub OIDC and gameplay wire remain unchanged.
CROSS: minimal authenticated server route, preserved dashboard vars and boundary tests (Claude's lane).
FOR claude: admin trusts Access issuer/audience/exact owner, then uses existing config CAS; no need to run a PC companion; setup awaiting owner approval.


## 2026-11-12 claude collab-setup
DID: added COLLAB.md (lanes, seams, comms) and this log.
FILES: COLLAB.md HANDOFF.md AGENTS.md CLAUDE.md
SEAM: none
CROSS: none
FOR codex: read COLLAB.md once; log your pushes here from now on.

## 2026-11-12 claude #425
DID: dash removed entirely (button, key, rule, wire). Phone name entry via see-through field over the canvas box. Leaderboard as animated chips.
FILES: sim/ship.ts sim/protocol.ts server/src/room.ts src/input/intents.ts src/scenes/flight.ts src/scenes/menu.ts tune.json client.tune.json
SEAM: ShipView.update lost its `boosting` arg; ShipState lost dashTime/dashCd; protocol 6.
CROSS: src/render/shipView.ts (boosting arg), ../steroids-alpha-lab/ (Dash button + preview)
FOR codex: lab preview no longer has dash. Thruster burst now only from real acceleration.

## 2026-11-11 claude #424
DID: shield (hull 50 + shield 50, regen), blue hex shield-hit VFX, ramming knockback + split, health pickups, kills leaderboard, explosion + death screen, pilot names, ships 30% darker at night.
FILES: sim/* server/src/* src/net/client.ts src/render/explosion.ts src/render/shipView.ts src/scenes/*
SEAM: Fx kinds added: explosion, heal, shield. ShipView.shieldHit(angle). clientTune.render.nightShipDim.
CROSS: src/render/shipView.ts, src/render/explosion.ts (placeholder VFX; codex may restyle)
FOR codex: explosion and shield VFX are placeholder-quality; yours to restyle. Live config upgrade fills/drops fields (sim/liveConfig.ts upgradeConfig).

## Open for codex (from BUILD_STATUS next steps)
- FFD pitch/bank tilt on the in-game rig (Phaser mesh); lab already has it.
- Ground props with horizon clipping.
- Cloud-layer entry/exit transition visuals.
