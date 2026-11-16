# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-16 claude tutorial-combat
DID: combat: ram = max(flat, 15% target hull max), slight dash steering (25%), bumps 20 dmg / 380 knockback, corner speed (turn best at cruise; 70% at min, 85% at top), red hull-hit edge flash, hull readouts flash below 50%. Tutorial planet: menu TUTORIAL, the real Room runs in the page in lockstep via an in-memory socket pair, 13 scripted steps with repetition and noob/drone/chaser bots, free play then warp out to finish.
FILES: sim/{ship,world,bots,planets,liveConfig}.ts server/src/room.ts tune.json src/tutorial/{guide,localServer}.ts src/net/client.ts src/scenes/{flight,menu}.ts src/render/combatHud.ts BRIEF.md scripts/test-steroids-alpha-sim.mjs
SEAM: cornerFactor(); tune.ship.{dashRamHullFraction,turnAtMinSpeed,turnAtMaxSpeed,dashSteerFactor}; Room.sim/setManualBots/setLockstep/addTutorialBot; World.spawnAsteroid/spawnPickup/spawnBullet; NetClient transport arg; PlanetId includes 'tutorial'; window.__tutorial with ?debug=1.
CROSS: src/render/combatHud.ts and flight drawHullBorder (yours): colour/threshold only; tutorial panel is placeholder overlay.
FOR codex: tutorial rings/gates/training turret are placeholder shapes; the instruction panel could use your panel style.

## 2026-11-16 claude siege-sim
DID: Siege v0 step 1: rules in the shared sim (World.siege on the Warzone planet: turret/shield/treasury HP, shield regen per live turret until broken, tickets, round timer, defenders cannot attack inside a standing shield, no dock safety at war, no warp at war) and siege bots (attack turrets -> shield -> treasury; defenders guard outside the dome). Headless harness scripts/sim-steroids-alpha-siege.mjs. Warzone is NOT in the menu yet.
FILES: sim/{world,bots,planets,liveConfig}.ts tune.json scripts/{sim-steroids-alpha-siege,test-steroids-alpha-sim}.mjs BRIEF.md
SEAM: tune.siege; World.siege/atWar/attackerClan/startWar/endPeace; events.siegeOver/structureHits; WARZONE/isWarPlanet.
CROSS: none (no client or protocol changes yet).
FOR codex: step 2 (playable Warzone) will need art for damaged/destroyed turrets, a shield health look and a treasury health look; not yet.

## 2026-11-16 codex hyperspace-arrival-release
DID: owner approved motion and live release; added a1400ms world-anchored blue-white completion glint/ion spark, bounded32effects. Replaced vertical dive with heading-aligned hyperspace fading before globe zoom/fast terrain roll, level full-speed ship and reverse departure. Observer entrance fades in, brakes/overshoots and leaves square residuals; no false effect for old ships.
FILES: sim/{ship,world,protocol,liveConfig}.ts, src/net/client.ts, src/render/{orbital*,shipView}.ts, src/scenes/flight.ts, tune.json, affected tests/docs.
SEAM: protocol21 adds f32 arrival at offset99 (103-byte ship). World countdown and prediction drive visual progress; all damage/contact/combat gated until0, no client-ready immunity. Shared warp timings3.2/2.4/0.7s; old hosted records upgrade. ShipPlacement opacity/warpForeground; resize/scene cleanup releases FFD/UI.
CROSS: owner explicitly requested arrival vulnerability; minimal sim/wire/net/test changes. Typecheck/build/rig/sim/live-config/bank pass. Actual Brave desktop/mobile entry/exit and real observer checks pass; WebGL/Canvas held fire, resize, UI restoration and resource stability pass, zero errors. Visual timing captures are isolated fixtures, not authoritative extraction proof.
FOR claude: LIVE0075. PR512 merged39d1b471; client43853040304 + Worker43853040359 succeeded, healthyprotocol21. Public map entry4layouts, own/remote landing spark1400ms expiry and real in-range observer checks pass, zero errors. Proof hyperspace-live-verification and landing-live-verification. New protected arrivals hold bearing/full speed and cannot fire/dash/warp; phase release comes from authority, not local elapsed time. Thread68c1ca78 carries final preview/evidence.

## 2026-11-16 codex warp-stellar-map-release
DID: pulsing menu WARP opens spinning four-globe chart; first tap selects/details, second enters. Shows real populations, relationship and resource types. Leaderboard and compact rank now sort level, kills, minerals; labels say MINERALS.
FILES: src/render/{stellarMap,planetGround}.ts, src/scenes/{menu,flight}.ts, src/main.ts, sim/leaderboard.ts, sim/protocol.ts comment, sim tests, BRIEF/BUILD_STATUS.
SEAM: existing power wire field remains mineral balance; rankPilots shared by board/nav. PlanetGround adds bounded positioning/disposal. Debug menuScene exposes preview state; buttons are destination hit areas only while popup open.
CROSS: requested menu behavior/rank and minimal sim-test extension; no server, wire version or economy changes. Fixed inherited removeAll(true) text-texture leak by destroying old menu children. Required checks and Brave DPR2 four viewports pass; ten cycles stable53objects/133textures, WebGL/Canvas ~60FPS; details/resize/offline/actual entry and board order pass.
FOR claude: LIVE161126r0074. PR510 merged969638bd; itch43829523905 and Worker43829523419 succeeded. Public Brave PC/phone/small/upright: globe selection/details, rotation, actual second-tap entry and open connection pass; desktop/mobile ranking fixtures agree, zero errors. Proof outputs/steroids-alpha/warp-live-verification; thread b837277b. Menu tests open WARP, select, then tap selected globe again. No economy/protocol change.

## 2026-11-16 codex orbital-buildings-hud-release
DID: owner approved orbital arrival/departure, layered treasury Nexus/twin-cannon towers, and joined translucent HUD v3. Uploaded/re-fetched exact building source ZIP with matching SHA-256.
FILES: src/render/{orbital*,buildingRig,clanBaseArt,combatHud,shipView,flightIndicators}.ts, src/scenes/{boot,flight}.ts, art/buildings-v1, art/prepare-assets.mjs.
SEAM: ShipPlacement optional orbital lift/ground alpha; BuildingRigs lifecycle; CombatHud anchor then hold selector. COLLAB records contracts. No new wire/gameplay changes.
CROSS: flight lifecycle and config test only; merged main 1fb8b45 preserving menu-only extraction, mouse/key hints, fuel/visitor cargo, own-top-speed exhaust and zoom 1000. Desktop cargo clears key hints. Typecheck/build/rig/sim/live-config/bank pass; integrated Brave orbital/mobile input and 36 building captures pass, 2 clients ~60 FPS DPR2, zero errors.
FOR claude: LIVE 161126r0073. PR508 merged7e5b2158; itch43824697720 succeeded. Public Brave PC/mobile/upright and both clans connect protocol20,12combat+14building textures,7rigs/40images, phone fire/dash/drawer, zero errors. Proof outputs/steroids-alpha/orbit-live-verification/result.json; thread68c1ca78. Reticle/landmark/fuel-icon follow-ups stay separate; R2 SHA d34070bccdb67d0e901d7972504a5b2478f477dcc712a8e796bf41c6d6c30a15.

## 2026-11-16 claude mouse-aim
DID: PC mouse scheme reworked (owner): the ship always steers toward the cursor (not over the ship or buttons); left click fires, right click missile, W accelerates, S brakes, neither eases to min speed. KEY HINTS (bottom left, PC) with a menu ON/OFF setting. View zoomed out: render.referenceHeight 810 -> 1000 (also republished to live settings).
FILES: src/input/intents.ts src/scenes/{flight,menu}.ts src/save.ts client.tune.json BRIEF.md
SEAM: clientTune.mouse is now {deadZone} only; Save.keyHints; Intents.mouseSteering (cursor aim) and mouse fire.
CROSS: src/scenes/flight.ts: reticle and key hints are placeholder overlay drawing.
FOR codex: the zoom-out makes ships and rocks about 19% smaller on screen; check painted art still reads well, and a styled aim reticle would help.

## 2026-11-16 claude mouse-marker
DID: PC mouse marker scheme (default): hold left mouse, ship steers to the cursor, thrust by distance (clientTune.mouse markerRadius 240 / deadZone 40, touch thrust curve), cursor on ship brakes, release eases to min speed; WASD still works. Menu CONTROLS row (PC only): MOUSE / KEYBOARD. After warping out the result screen offers Menu only (no Drop in).
FILES: src/input/intents.ts src/scenes/{flight,menu}.ts client.tune.json sim/liveConfig.ts BRIEF.md
SEAM: Intents.mouse/mouseOrigin/mouseSteering/setScheme; clientTune.mouse (deployment-locked like touch).
CROSS: src/scenes/flight.ts: cursor ring drawn on the overlay while steering (placeholder look).
FOR codex: the cursor ring/line is a placeholder; a styled steering reticle would help.

## 2026-11-16 claude visitor-cargo
DID: the cargo readout (SALVAGE/FUEL n/400 and its full cue) is hidden for visitors on another clan's home planet, where they can mine nothing.
FILES: src/render/combatHud.ts src/scenes/flight.ts BRIEF.md
SEAM: CombatHud.draw(..., hold: 'salvage' | 'fuel' | 'none') replaces the boolean home flag.
CROSS: src/render/combatHud.ts (yours): wraps the cargo block in hold !== 'none' only.
FOR codex: nothing new.

## 2026-11-15 claude base-markers
DID: clan home planets show edge arrows with label and distance for off-screen landmarks: members see their treasury; visitors see the gate and the enemy treasury. Own outer ring, kept clear of touch buttons, bottom HUD and the bounty/hot-zone arrows.
FILES: src/scenes/flight.ts BRIEF.md
SEAM: FlightScene.drawBaseMarkers (client only, no protocol change).
CROSS: none.
FOR codex: placeholder triangles + text; a landmark icon set (treasury, gate) would fit here.

## 2026-11-15 claude clan-fuel
DID: no salvage on clan home planets: members mine Fuel (ShipState.fuel, same 400 hold, hot zone x2, lost on death) and docking unloads it to the treasury; non-members mine nothing and do not see the hot zone; no gold drops at home. Exhaust full plume now keys on each ship's own top speed (topSpeed(hullMax, chassis)), not 350.
FILES: sim/{ship,protocol,world}.ts src/render/{combatHud,shipView}.ts src/scenes/flight.ts scripts/test-steroids-alpha-{sim,bank}.mjs BRIEF.md DESIGN_LONGGAME.md
SEAM: PROTOCOL_VERSION 20 (ship +f32 fuel at offset 95); CombatHud.draw(..., home); ShipView.update(..., top).
CROSS: src/render/{combatHud,shipView}.ts (yours): FUEL label/full cue text and the plume threshold only.
FOR codex: the cargo coin icon also stands for Fuel on home planets; a distinct fuel icon would help (low priority).

## 2026-11-15 codex backlog-release
DID: owner reviewed all4priority boards and explicitly approved publication. Uploaded/re-fetched the3sprite source ZIP with matching SHA-256; integrated newer gun convergence, idle exhaust and72%shadow/60pxglow/docked landing from PR498/499.
FILES: approved P1–P4 art pass; source manifest/README, GFX_BRIEF, BUILD_STATUS, COLLAB.
SEAM: prior preview contracts retained; no new gameplay/tuning/protocol/input/rig changes from this art pass. Upstream authoritative changes preserved.
CROSS: latestmain flight.ts merged cleanly; status-note conflict keeps both agents' work. Typecheck/build/rig/sim/live-config/bank pass; integrated2client+4bot and member-clan tests56–57FPS DPR2, real fire/dash, no errors.
FOR claude: owner said go live with all and sync; gate satisfied. R2 object steroids-alpha_combat-backlog-v1_assets.zip SHA155c58afbb103592a20075b35f5e2b92ca4a77b9d51fc1c0e966083ccd283218; PR500 merged398b045; itch43733278666 succeeded. Public Brave151126r0067 verified12textures, ordnance/repair, mobile/upright inputs, both clan skins and open planet; no errors. Evidence outputs/steroids-alpha/backlog-live-verification/result.json; thread07e15987.

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

## 2026-11-15 codex P1-combat-preview
DID: Painted missiles/mines/repair pods; smoke, armed/search/observed-seeking cues and lock brackets; differentiated death/missile/mine/split/Nova/ram/hit/shield-shatter effects; heading-only dash charge and subtle hull-border accents.
FILES: art/combat-backlog-v1/* art/prepare-assets.mjs render/{combatSprites,combatEffects,worldArt}.ts scenes/flight.ts
SEAM: optional painted/seeking ordnance cue, CombatImpact render tag; existing sim/wire/radii unchanged. Three new source PNGs/ZIP local, hash-verified preview cache; reserved R2 object NOT uploaded.
CROSS: scene event/draw wiring only, no tuning/input. Typecheck/build/rig/sim/live-config,22 desktop/mobile frames + Canvas checks pass; actual fire/dash and2clients+4bots ~57FPS on PC, no errors.
FOR claude: LOCAL PREVIEW, not published. Owner must review screenshots before live. Gallery outputs/steroids-alpha/backlog-review/index.html; branch codex/steroids-combat-backlog-preview. No PR opened because repository auto-merge would publish.

## 2026-11-15 codex P2-clan-preview
DID: Crimson fractured dust and Azure glacial terrain, fortified treasury, pads/over-pad/docked states, rotating turrets/flash, projected dome/hit/push, gate and compact banners.
FILES: render/{clanBaseArt,planetGround}.ts scenes/flight.ts drawBase
SEAM: drawClanBase/styleClanBanner read existing layout/tune; exact coordinates/radii/projection retained.
CROSS: drawBase render integration only.24 WebGL +2Canvas captures, real docked/over-pad getter and GLSL checks pass; labels/limb clipping corrected.
FOR claude: LOCAL PREVIEW, not published. Owner must review screenshots before live. Gallery outputs/steroids-alpha/backlog-review/index.html; branch codex/steroids-combat-backlog-preview. No PR opened because repository auto-merge would publish.
