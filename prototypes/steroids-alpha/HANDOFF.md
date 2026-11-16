# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-16 codex warp-stellar-map-preview
DID: pulsing menu WARP opens spinning four-globe chart; first tap selects/details, second enters. Shows real populations, relationship and resource types. Leaderboard and compact rank now sort level, kills, minerals; labels say MINERALS.
FILES: src/render/{stellarMap,planetGround}.ts, src/scenes/{menu,flight}.ts, src/main.ts, sim/leaderboard.ts, sim/protocol.ts comment, sim tests, BRIEF/BUILD_STATUS.
SEAM: existing power wire field remains mineral balance; rankPilots shared by board/nav. PlanetGround adds bounded positioning/disposal. Debug menuScene exposes preview state; buttons are destination hit areas only while popup open.
CROSS: requested menu behavior/rank and minimal sim-test extension; no server, wire version or economy changes. Fixed inherited removeAll(true) text-texture leak by destroying old menu children. Required checks and Brave DPR2 four viewports pass; ten cycles stable53objects/133textures, WebGL/Canvas ~60FPS; details/resize/offline/actual entry and board order pass.
FOR claude: LOCAL REVIEW ONLY, no push/deploy. Preview outputs/steroids-alpha/warp-map-preview/index.html. Await owner visual review before PR auto-merge. Counts use existing /planets; unavailable remains unknown. New menu tests must open WARP before planet selection, then tap the selected globe again. Previous live161126r0073 unchanged.

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

## 2026-11-15 codex P3-progression-preview
DID: Evolution assembly/shield lock, capital escorts/name clearance, warp aperture/launch and two painted asteroid fracture stages.
FILES: render/{progressionArt,rockPainted}.ts scenes/flight.ts
SEAM: progression/followId visual effect tags; chassis observed from server, no control lock/gameplay changes. Damage textures share original alpha/registration/coverage.
CROSS: placeShip/event drawing only.14 desktop/mobile frames; all30 damage variants preserve alpha exactly and change RGB; no browser errors.
FOR claude: LOCAL PREVIEW, not published. Owner must review screenshots before live. Gallery outputs/steroids-alpha/backlog-review/index.html; branch codex/steroids-combat-backlog-preview. No PR opened because repository auto-merge would publish.

## 2026-11-15 codex P4-HUD-preview
DID: Authored hangar emblems, segmented target health, nose chevron, full cargo cue, reconnect/lost banners and projected salvage ring. Connection alerts take precedence over informational labels.
FILES: render/{flightIndicators,combatHud}.ts scenes/{hangar,flight}.ts
SEAM: drawing helpers only; preserved compact mobile controls/uiZones, authoritative values and desktop-style own vitals.
CROSS: scene styling only.27 desktop/mobile/small captures +6connection/2cargo rechecks pass, no errors; alert placement clears combat and upgrade drawer.
FOR claude: LOCAL PREVIEW, not published. Owner must review screenshots before live. Gallery outputs/steroids-alpha/backlog-review/index.html; branch codex/steroids-combat-backlog-preview. No PR opened because repository auto-merge would publish.

## 2026-11-15 claude clan-planets-v0
DID: two demo clans (menu pick, save.clan, sent as ?clan=); PLANETS now Lawless A, Satellite B, Crimson Home, Azure Home. Home planets (sim/clanBase.ts): treasury at map centre, 6 pads, 6 base turrets, shield dome, gate at (0,0). Members spawn by the pads and may stop over a pad (stepShip floor 0): docked = safe, repaired, salvage unloaded to the treasury (Room.treasury, DO storage 'treasury'). Non-members spawn at the gate, are fired on by base turrets, pushed out of the dome; their bullets/ordnance stop at it. Arrival warnings and docking banner. Ground tint per clan.
FILES: sim/{planets,clanBase,ship,world,protocol,liveConfig}.ts server/src/{room,index}.ts src/{net/client,input/intents,scenes/menu,scenes/flight,render/planetGround,save,main,liveConfig}.ts tune.json (base group) scripts/test-steroids-alpha-{sim,bank}.mjs scripts/screenshot-steroids-alpha.mjs BRIEF.md GFX_BRIEF.md DESIGN_LONGGAME.md
SEAM: stepShip(..., floor); World.setPlanet/layout/clanOf/addShipNear/docked; WorldEvents.deposits; shots side >= BASE_TURRET_SIDE (40), owner BASE_OWNER (0); text frames 'treasury' {clan,total} and 'deposited' {amount}; RosterEntry.clan; PlanetGround(scene, depth, tint); intents.flight(speed, floor); hooks layout()/docked()/treasury().
CROSS: src/render/planetGround.ts (yours): tint uniform added, default [1,1,1] keeps the old look.
FOR codex: art brief in Agent Comms (thread 07e15987) and GFX_BRIEF.md "Clan planets v0 art".
