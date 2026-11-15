# HANDOFF (newest first, max 15; format in COLLAB.md)

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
