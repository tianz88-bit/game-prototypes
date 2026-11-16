# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-17 codex grounded-buildings-capital RELEASE
DID: muted cylinder supports, independent clan materials, root-contact and ground-projected sun shadows; terrain no longer slips under fixed structures during spin. Capital forked bow/flush side gun pairs, no round lenses, stronger facing offsets.
FILES: render/{buildingGeometry,buildingMaterials,buildingRig,clanBaseArt,planet,shipProfiles}, rigReview, sim/chassis, art/battlecruiser-v3, tests/docs.
SEAM: projectGround optional callback; planet camera=travel, sunlight=travel+spin. Capital GUNS forward81.07,right±38.7/±55.8; future client+Worker release together. No stats/footprint/equipment/wire changes.
CROSS: minimal cannon-origin data and its simulation test; review muzzle uses shared tower height constants. Typecheck/build/sim/config/rig/new grounding tests pass;8 desktop/mobile7-building root/column fixtures and10 lab interaction cases pass, no errors/capture/recording.
FOR claude: owner approved live release. R2-v3 ZIP/10parts now uploaded and publicly hash-verified. Main PR521/522/523 Sparrow/siege/pod/Warzone changes preserved, including protocol23. Release/public checks in progress; no competing ship/ground edits until final handoff.
## 2026-11-16 claude warzone-playable
DID: Warzone playable: in PLANETS (menu, stellar map 5 globes), Room round flow peace -> countdown 10 s (both clans) -> war (+2 bots per side) -> over 8 s -> countdown/peace; release 10 s when a side empties; joins refused at war (CLOSE.WAR_LOCKED) and without a clan (CLOSE.NEED_CLAN); in-place war respawns (warDown/warUp frames; attackers instant at gate, defenders 15 s at pads); towers hold fire outside a war; 'siege' frames drive a top HUD panel, destroyed-tower crosses, shield ring, respawn countdown. Fixed: refused connections no longer stay hidden behind the hyperspace animation (affected planet-full too). Protocol 23.
FILES: sim/{planets,protocol,world,bots}.ts server/src/room.ts src/net/client.ts src/scenes/flight.ts src/render/stellarMap.ts BRIEF.md scripts/test-steroids-alpha-sim.mjs
SEAM: Room.siegePhase/stepSiege/siegeFrame; NetClient.siege/warDown; SiegeView; CLOSE.WAR_LOCKED/NEED_CLAN.
CROSS: src/render/stellarMap.ts (yours): five positions and a Warzone intel/tint; flight maskOrbitalUi skips refused connections.
FOR codex: Warzone needs art: damaged/destroyed towers, shield strength, Nexus health, a Warzone globe look distinct from Crimson.

## 2026-11-16 claude siege-values-pods
DID: siege values for the Sparrow starter (turrets 110, shield 750, treasury 1100, owner: tweak after playtests); siege bots detour for mineral spills within 320 px (power moves to whoever cleans up); sim option attPower/defPower (first life only) and any-tune overrides. Repair pods drawn at render.healDropScale (0.8) of the pickup radius.
FILES: tune.json client.tune.json sim/{bots,liveConfig}.ts src/scenes/flight.ts BRIEF.md scripts/sim-steroids-alpha-siege.mjs
SEAM: clientTune.render.healDropScale.
CROSS: flight.ts pickup radius for heal (painted health-pod uses the same radius).
FOR codex: health-pod art now shows at ~27 px radius; check it still looks crisp at that size.

## 2026-11-16 claude sparrow-gun
DID: owner retune: Sparrow single gun 6 shots/s (sparrow.fireIntervalSteps 6 -> 5) and 90% of Falcon cold-to-lock shots (ammoRatio 0.8 -> 0.9); measured 14 vs 15 shots base, 25 vs 28 at gun tier 2. Live settings republished. Found while re-running the siege sim: Sparrow as the starter had dropped 2v2 attacker wins to 0%; siege structure HP to be retuned with Warzone step 2 (sim suggests turrets 110, shield 750, treasury 1100).
FILES: tune.json BRIEF.md
SEAM: none (values only).
CROSS: tune.sparrow (your Sparrow work): two values, owner-requested.
FOR codex: Sparrow is now 96 vs Falcon 120 damage per second.

## 2026-11-16 codex live-rig-review
DID: lab subject selector and live Hangar Rig Review for Sparrow/Bat/capital/Falcon/Nexus/tower turrets. Rotation, firing, gun-origin guides, palette/clan, control tilt and deck count. Treasury display renamed Nexus. Capital cannon casing matches cobalt and selected palettes; forward steel/alpha retained.
FILES: src/scenes/rigReview, boot/main/hangar/flight, render/{shipArt,palette}; ../steroids-alpha-lab.
SEAM: isolated query route uses production ShipView/BuildingRigs/CombatSprites and stepShip/muzzleShot; no room sockets, accounts, grants or publishing. Checked same-origin parent messages only choose a validated subject or exit.
CROSS: minimal scene flow/query/hangar entry and display strings; no sim/network/tuned values changed. Lab sleeps old preview, reuses one frame and hides draft editor until return.
FOR claude: owner forbids screen grabbing; checks use DOM/runtime/source pixels, no screenshots or recording. Lab selections review each production rig; editable calibration remains Falcon only. LIVE161126r0080: PR519, client43892666337/Pages43892666498 success; ten public desktop/mobile cases and all four capital cannon sides pass. Evidence in BUILD_STATUS.

## 2026-11-16 codex ship-release LIVE
DID: PR517 merged7965bcdf; all approved ships live161126r0079. Client43887481908/Worker43887482153/settings43888409949 successful; protocol22.
FILES: ship art/profiles, sim/unlocks/protocol/config, hangar/menu/tune/tests; BUILD_STATUS has full proof and limits.
SEAM: Sparrow free/chassis3/centre recoil0; Falcon paid for everyone, no grant. Bat max315/cruise234/turn5.44 published via hosted OIDC, other owner data preserved. Capital4 platforms observe existing turret state.
CROSS: preserved PR515/516 behavior. R2 ZIPs+27parts verified; all suites and public desktop/mobile Sparrow/fire/unlock/menu/tutorial pass. Browser emulation, not physical-phone evidence.
FOR claude: use current main; settings and art now live, no further release action required. Evidence outputs/steroids-alpha/ship-release/live and fleet-revision-review; original Comms e31061e9.

## 2026-11-16 codex bat-capital-revision REVIEW
DID: Bat cobalt cowlings, base315 top speed and1.7x Falcon turn rate. Detailed battlecruiser with framed bridge,4 forward cannons and4 fixed rig deck platforms; painted heads show only equipped count, aim/recoil independently, with control-only FFD/sprite fallback.
FILES: art/{bat-v3,battlecruiser-v2}, render/{shipProfiles,shipArt,shipView,shipPreview}, flight, hangar caption, tune, sim/chassis, sim tests, docs.
SEAM: optional setTurrets(count,angles,firedAt); shared capital deck mounts right±36, forward−9/25.2. Main cannon origins/equipment counts/upgrade rules unchanged. Capital textures2x budget capped512; fighters unchanged.
CROSS: owner-requested Bat handling and deck turret origins; minimal flight observation bridge. Typecheck/build/sim/bank/live-config/rig pass. Brave desktop/mobile previews,24-part FFD,0/2/4 heads, Canvas flight and5 rebuilds stable150textures; no errors. Local~32FPS matches same Falcon baseline, not a60FPS claim.
FOR claude: review only; do not deploy yet. R2 ZIPs still local/cache. Future release needs Bat speedFactor0.9/turnFactor1.7 published to hosted settings, preserving all other owner values. Evidence outputs/steroids-alpha/fleet-revision-review; comms e31061e9. Everyone must buy Falcon; no grandfathered grant.

## 2026-11-16 codex sparrow-falcon-bat REVIEW
DID: Sparrow free starter with original8-part/11-module top-down rig, centre recoil, Falcon base stats,5shots/s and12-versus15 cold burst, bounded3deg launch drift. Scrappy display renamed Falcon and Interceptor Bat; Falcon is a paid sidegrade. Four compact hangar cards.
FILES: art/sparrow-v1, render/shipProfiles, sim/{chassis,ship,unlocks,protocol,liveConfig}, room, menu/hangar, tune, tests.
SEAM: protocol22 permits chassis3 and recoil side0 (unchanged byte layout); stable old IDs0/1 preserved. Shared sparrow tunings upgrade into old records. Publish client/Worker together only after review/R2 verification.
CROSS: minimal requested weapon/default/ownership/menu behavior and tests; existing siege preserved. Owner confirmed everyone must unlock Falcon, including existing players; no grandfathered grant or migration.
FOR claude: do not merge/deploy this preview yet; new ZIP only local cache until review/upload. Art source/evidence outputs/steroids-alpha/sparrow-review; details art/sparrow-v1/README.md. Comms e31061e9.

## 2026-11-16 claude ship-stats-rams
DID: per-ship handling: tune.interceptor/battlecruiser now hold explicit minSpeed/cruiseSpeed/maxSpeed/acceleration/braking/turnRate (old factors removed; same effective values); Falcon (renamed from Scrappy in UI) = tune.ship. Corner speed peaks at each ship's own cruise/top ratio. Rams: target straight to hull; rammer same amount to shield, no overflow, hull only if shield down (dashRamSelfDamage removed). Tutorial RAM step: battered practice Battlecruiser, 3 rams; tutorial drones/chasers' turret drones never fire (World.quiet).
FILES: sim/{chassis,ship,world,clanBase,liveConfig,unlocks}.ts server/src/room.ts tune.json src/tutorial/guide.ts src/scenes/menu.ts BRIEF.md scripts/test-steroids-alpha-sim.mjs
SEAM: shipMotion(chassis, tune); damageShip mode 'hull' | 'shield'; World.quiet.
CROSS: none in your files (unlock display name only).
FOR codex: the ship formerly named Scrappy is now Falcon in UI copy.

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
