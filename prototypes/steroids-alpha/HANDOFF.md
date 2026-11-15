# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-15 claude converge-exhaust
DID: aim assist locks a target from the ship centre (cone/range, ships first) and each gun leads it from its own muzzle (cap weapon.assistConvergeMaxDeg 20) so both streams land; bots get no assist. Exhaust speed/life scales now ramp with the plume stretch (idle plume back to the original look); landed ships emit no exhaust (ThrusterInput.off).
FILES: sim/{ship,world,liveConfig}.ts src/{net/client,render/thrusters,render/shipView}.ts tune.json scripts/test-steroids-alpha-sim.mjs BRIEF.md
SEAM: AssistTarget.vx/vy; assistPick(); muzzleShot converges on the pick; ThrusterInput.off.
CROSS: src/render/{thrusters,shipView}.ts (yours): scale ramp and engines-off only.
FOR codex: nothing new.

## 2026-11-15 claude ship-ground-cues
DID: shadows drawn at render.shadowScale (0.72) of the ship in flight; hover glow 60 x 60 (round, smaller; was 112 x 38); docked ships ease (250 ms) down to the shadow's size, onto their shadow, hover lift to 0 and glow faded.
FILES: src/render/shipView.ts src/scenes/flight.ts client.tune.json sim/liveConfig.ts BRIEF.md
SEAM: ShipPlacement.landed (0..1); clientTune.render.shadowScale.
CROSS: src/render/shipView.ts (yours): shadow scale, landed shrink/hover/glow fade only.
FOR codex: docked ships sit wherever they stopped on the pad; a snap/settle effect to the pad centre would help.

## 2026-11-15 claude clan-planets-v0
DID: two demo clans (menu pick, save.clan, sent as ?clan=); PLANETS now Lawless A, Satellite B, Crimson Home, Azure Home. Home planets (sim/clanBase.ts): treasury at map centre, 6 pads, 6 base turrets, shield dome, gate at (0,0). Members spawn by the pads and may stop over a pad (stepShip floor 0): docked = safe, repaired, salvage unloaded to the treasury (Room.treasury, DO storage 'treasury'). Non-members spawn at the gate, are fired on by base turrets, pushed out of the dome; their bullets/ordnance stop at it. Arrival warnings and docking banner. Ground tint per clan.
FILES: sim/{planets,clanBase,ship,world,protocol,liveConfig}.ts server/src/{room,index}.ts src/{net/client,input/intents,scenes/menu,scenes/flight,render/planetGround,save,main,liveConfig}.ts tune.json (base group) scripts/test-steroids-alpha-{sim,bank}.mjs scripts/screenshot-steroids-alpha.mjs BRIEF.md GFX_BRIEF.md DESIGN_LONGGAME.md
SEAM: stepShip(..., floor); World.setPlanet/layout/clanOf/addShipNear/docked; WorldEvents.deposits; shots side >= BASE_TURRET_SIDE (40), owner BASE_OWNER (0); text frames 'treasury' {clan,total} and 'deposited' {amount}; RosterEntry.clan; PlanetGround(scene, depth, tint); intents.flight(speed, floor); hooks layout()/docked()/treasury().
CROSS: src/render/planetGround.ts (yours): tint uniform added, default [1,1,1] keeps the old look.
FOR codex: art brief in Agent Comms (thread 07e15987) and GFX_BRIEF.md "Clan planets v0 art".

## 2026-11-15 claude cargo-hold
DID: salvage carried capped at salvage.cargoMax 400 (owner): full ship skips gold pickups (left for others, partial takes leave the rest), mining adds power but no salvage past the cap. HUD salvage reads "SALVAGE n/400", full = "FULL · WARP OUT" (orange).
FILES: sim/{world,liveConfig}.ts src/render/combatHud.ts tune.json scripts/test-steroids-alpha-sim.mjs BRIEF.md
SEAM: tune salvage.cargoMax.
CROSS: src/render/combatHud.ts (yours): salvage label text/colour only.
FOR codex: a full-hold cue near the Warp button would help; the label is the only signal now.

## 2026-11-15 claude target-bar
DID: hits[] carry `by` (attacker id); the client keeps net.engaged (ships we hit -> time) and draws a small bar under their name for 5 s: blue shield fraction while shield > 0, then orange hull fraction.
FILES: sim/world.ts src/net/client.ts src/scenes/flight.ts scripts/test-steroids-alpha-sim.mjs BRIEF.md
SEAM: WorldEvents.hits[].by; NetClient.engaged; FlightScene.drawTargetBar (placeholder style).
CROSS: none
FOR codex: the bar is a placeholder (two rects); restyle freely, keep blue = shield, then hull.

## 2026-11-15 claude bot-warp-evolve
DID: bots warp out (owner) at bots.warpPower 350 or after bots.warpAfterSeconds 300 once lockdown ends, broadcast as warpouts, replaced after respawnSeconds; bots buy EVOLVE when canEvolve. Dash charge 0.8 -> 0.4 s (owner).
FILES: sim/bots.ts server/src/room.ts tune.json scripts/test-steroids-alpha-sim.mjs BRIEF.md
SEAM: BotBrain.bornAt (room sets the drop-in tick); tune bots.warpPower, bots.warpAfterSeconds.
CROSS: none
FOR codex: a bot's warp-out uses the player warp visuals; nothing new needed.

## 2026-11-15 claude reconnect-bumps-nose
DID: reconnect grace: a dropped socket keeps the ship 20 s (idle input), client auto-resumes with a token (same id); unknown token -> close 4005 RESUME_LOST -> "ship lost" screen (R/tap drops in again). Disconnected screen shows reason + code. Ship bumps outside a dash: bounce apart (220), 10 damage each, 0.5 s pair grace. Own-ship nose chevron.
FILES: server/src/{room,index}.ts sim/{protocol,world}.ts src/net/client.ts src/scenes/flight.ts tune.json scripts/test-steroids-alpha-{sim,bank}.mjs BRIEF.md
SEAM: text frame {type:'resume',token,seconds} after welcome; ws ?resume=<token>; CLOSE.RESUME_LOST 4005; NetStatus 'reconnecting' | 'lost'; net.closeInfo, closeReason(); Player.resume/awayUntil; tune net.reconnectGraceSeconds, ship.bumpDamage, ship.bumpKnockbackSpeed. Protocol 19 unchanged.
CROSS: none
FOR codex: nose chevron (flight.ts drawNose), the "Reconnecting… Ns" line and the lost-ship message are placeholders.

## 2026-11-15 claude shot-look
DID: gun shots no longer alternate looks by side (owner): both guns fire energy-bolt-standard; from GUNS (damage) tier 2 both fire energy-pulse-heavy. Remote shots use the shooter's last snapshot damageTier.
FILES: src/net/client.ts client.tune.json sim/liveConfig.ts BRIEF.md
SEAM: clientTune.render.heavyShotGunTier (2); bullet look = damageTier >= it ? 1 : 0 (combatSprites/drawBullet unchanged).
CROSS: none
FOR codex: the pulse now marks an upgraded gun; a small muzzle change at tier 2 would sell the upgrade.

## 2026-11-15 claude hangar-spin
DID: menu button "SHIP + PALETTE" -> "HANGAR" (owner). Hangar ship/palette previews turn on the rig (45 deg/s); the ships tab draws Scrappy, Interceptor and Battlecruiser at sizes relative to each other (by hit radius).
FILES: src/render/shipPreview.ts src/scenes/{menu,hangar}.ts BRIEF.md
SEAM: shipPreview(..., opts?: { spin?, relative? }); no options = the old static fit (menu, evolve preview unchanged).
CROSS: src/render/shipPreview.ts (yours, #477): options added, default path untouched; spin re-poses parts each frame and unhooks on destroy.
FOR codex: at true scale the two fighters are small next to the Battlecruiser card; a pedestal or scale ruler would help if it reads oddly.

## 2026-11-15 codex combat-art-live
DID: integrated approved portal title, three energy shots, three minerals and two coin views; restored lower ship hover light/dynamic shadow, palette-matched drones without shadows; Fire/Dash faces 26% smaller, mobile hull/shields share desktop segmented styling. Secondary mobile panels remain collapsed.
FILES: art/combat-title-v1/* art/prepare-assets.mjs render/{combatSprites,combatHud,hoverLight,shipView,worldArt}.ts scenes/{boot,menu,flight}.ts client.tune.json sim/liveConfig.ts scripts/test-steroids-{live-config,alpha-bank}.mjs BRIEF/COLLAB/BUILD_STATUS.md
SEAM: queue/prepareCombatArt and pooled CombatSprites, optional drone palette index; hoverLight* live render keys upgrade older records. Nine original PNG hashes checked from R2; runtime textures bounded to 192/1024. No wire or gameplay tuning changes.
CROSS: scene art wiring/action hit rectangles and bounded config validation/tests. Typecheck/build/sim/live-config/rig pass; 4 DPR2 Brave viewports + forced Canvas, nine assets, warnings, controls with drawer, buy/warp routing and stable pool verified with no errors; production two-client check passes at 57/57 FPS on PC.
FOR claude: PR485 merged75a909, itch43705423342 succeeded; public Brave151126r0056 landscape/upright verified all9textures, painted shots, smaller controls, drawers, hover and open planet, zero errors. PR482 superseded/closed. Worker bank test could randomly kill its respawn pilot during62s presence interval; use existing world.invulnerable only for that interval, restoring damage before explicit-death checks. Three fresh bank runs pass.

## 2026-11-15 codex mobile-focus
DID: mobile flight defaults to compact top-left shield/hull/salvage and header upgrade/rank/warp buttons; upgrades and rank open one at a time. Heat is on Fire, dash cooldown stays on Dash; smaller zone cue and no own-name/bounty text clutter. Desktop unchanged.
FILES: src/render/{combatHud,mobileFlightUi}.ts src/scenes/flight.ts src/input/intents.ts COLLAB.md BRIEF.md BUILD_STATUS.md
SEAM: intents.uiZones consumes non-combat panel touches before the floating marker; FlightScene clears on redraw/shutdown. Hidden shop has no buy zones; open drawer preserves combat controls.
CROSS: minimal scene tap routing/input capture. Typecheck/build/sim/live-config/rig pass; Brave DPR2 844x390,667x375,upright390x844 and desktop reviewed; marker acceleration, drawer/fire/dash, buy routing, warp once and warning/weapon states pass; two-client production test passed at 57/57 FPS on PC, no console errors.
FOR claude: Owner explicitly authorized publication. PR #483 merged; itch 43700096172 succeeded. Brave verified live 151126r0055 landscape/upright drawers, fire/dash, open planet, no errors. Pending hover-light PR482 and unintegrated logo/bullet/mineral assets are separate; gameplay and client tuning unchanged.

## 2026-11-15 claude exhaust-speed
DID: exhaust particles 2x faster and half the lifetime (owner); the top-speed/dash stretch now multiplies particle speed instead of lifetime, so plume lengths stay as approved but particles no longer linger.
FILES: src/render/{thrusters,shipView}.ts client.tune.json sim/liveConfig.ts scripts/test-steroids-alpha-sim.mjs BRIEF.md
SEAM: ThrusterVFX.speedScale / lifeScale (default 1; shipView sets them from clientTune.render.exhaustSpeedScale / exhaustLifeScale).
CROSS: src/render/thrusters.ts (your lab port): spawn() speed now x speedScale x stretch, life x lifeScale.
FOR codex: with half as many live particles the plume reads thinner; if it needs density back, the emission rate (credits per second) is the knob.

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
