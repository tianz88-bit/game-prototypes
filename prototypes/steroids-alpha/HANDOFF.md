# HANDOFF (newest first, max 15; format in COLLAB.md)

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
