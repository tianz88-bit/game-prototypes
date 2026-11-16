# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-16 codex semicircle-HUD-preview
DID: LOCAL PREVIEW: two ship-centred instrument halves. Left shield becomes hull when depleted, with inner shield-reboot progress; hull/total below. Right weapon capacity counts down as heat rises and refills on cooling, plus dash charge/active/cooldown. Old panel, duplicate button meters, own marker plates/name and broken-shield icon removed.
FILES: render/{combatHud,shipView}.ts scenes/flight.ts; BUILD_STATUS/COLLAB/GFX_BRIEF.
SEAM: CombatHud.draw optional CombatHudAnchor {x,y,radius,visible}; Flight supplies projected, chassis/power-scaled clearance and hides meters during orbital transitions. No input zone, simulation, tuning or network change.
CROSS: flight.ts render anchor and bounty-plate avoidance only; own bounty uses star without another full ring. Phone fire/dash buttons keep their original positions and hit areas.
FOR claude: preview before live remains the gate. Evidence outputs/steroids-alpha/semicircle-hud-preview/index.html:21 state captures across desktop/mobile/small-phone DPR2,2 recovery GIFs, real mobile fire/dash/upright check; no browser errors. Typecheck/build/rig/sim/config pass. Ship and building art stay on the prior unshipped local branch.

## 2026-11-16 codex orbital-nexus-preview
DID: LOCAL REVIEW ONLY: 1.8s globe arrival / 1.5s departure with active controls, ground-anchored light/shadow and arrival pulse; quieter ship plates/nose/engaged meter; larger3-part treasury nexus and twin-cannon tower rigs in both clan palettes.
FILES: render/{orbitalTransition,orbitalEffects,buildingRig,clanBaseArt,flightIndicators,shipView}.ts; scenes/{flight,boot}.ts; art/{buildings-v1,prepare-assets.mjs}; scripts/test-steroids-live-config.mjs.
SEAM: optional ShipPlacement.orbitalLift/orbitalGroundAlpha; BuildingRigs queue/prepare/begin/draw/end/destroy and treasury label bounds. Existing sim/protocol/positions/weapon counts/tuned values/input zones/FFD remain intact.
CROSS: flight.ts camera/cached departure visual + result delay; boot asset hooks. Config test now accepts either concurrent publisher as winner and uses a separate deterministic record for later fixtures; no server behavior changed.
FOR claude: owner must see/approve preview before any R2 upload, PR merge or deploy. Source ZIP local only (d34070bccdb67d0e901d7972504a5b2478f477dcc712a8e796bf41c6d6c30a15); review outputs/steroids-alpha/orbit-review/index.html. Typecheck/build/rig/sim/config and Brave desktop/mobile lifecycle/Canvas pass;14shared textures,7views/40images stable;2clients+4bots and clan ~56.3FPS DPR2. See Agent Comms68c1ca78.

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
