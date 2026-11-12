# HANDOFF (newest first, max 15; format in COLLAB.md)

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
