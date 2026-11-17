# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-17 codex four-step tutorial LIVE
DID: Fly/Fight/Dash-Ram/Escape +6 brief saved contextual tips live171126r0095. PR542 7b90e92a; itch44032662726/Pages44032662575/Worker44032662716 success; protocol25 healthy, Warzone retained.
FILES: guide/policy/contextTips/tipState, Flight/save, local Room/manual stationary target, CI regressions and CLAUDE_BACKLOG.md.
SEAM: four-stage/Fight-phase policy, optional warp, auto-turret quiet gate, Save.tipsSeen; tutorial only. No new wire/live tuning/economy changes; real extraction completes practice, no bank credit.
CROSS: type/build/rig/sim/config pass;3 local+3 public real-route and18 local+18 public tip cases pass across desktop/mobile landscape/portrait, zero page errors/captures/public-room fixture writes.
FOR claude: owner says sync later. Durable backlog has release details and obsolete-index warning; no immediate execution/review needed. Temporary Vite4187 stopped; evidence four-step-tutorial.

## 2026-11-17 codex four-step tutorial RELEASE
DID: Fly(two rings), Fight(one rock/bundle/upgrade), Dash/Ram(one stationary target), Escape(real extraction); short prompts, no modal/repeat grind.6 contextual first-use tips with persistent seen IDs.
FILES: guide/policy/contextTips/tipState, Flight/save, local Room/manual target kind, sim CI regressions and docs/CLAUDE_BACKLOG.
SEAM: tutorial phases replace old indices; optional warp policy gates queued/held input, buys and auto-turret quiet state. Online rooms ignore it. Save.tipsSeen; no wire/live tune/economy changes, no practice bank credit.
CROSS: type/build/rig/sim/config checks pass;3 Brave full-route and18 tip desktop/mobile orientation cases pass, zero page errors/no captures. RAM waits for dash end before Escape.
FOR claude: owner approved release and says sync later. CLAUDE_BACKLOG.md is the durable deferred handoff; no immediate execution/review requested. Public proof follows.

## 2026-11-17 claude warzone-sessions
DID: Warzone session flow (owner): 20 s start countdown (joinable), sessions end with everyone sent to the menu (CLOSE.ROUND_OVER with the result) after the round-over pause or 10 s after a side empties, then a 20 s wall-clock reset (CLOSE.WAR_RESETTING with seconds). /planets returns status.warzone {phase,left}; stellar map shows it, JOIN AS CRIMSON/AZURE for clanless pilots, NOTIFY ME auto-warps when open. Hyperspace safety net: 10 s without a ship shows the wait reason with RETRY / BACK TO MENU. Warzone hot zone labelled MINERAL ZONE for both sides. Protocol 25. Investigated the reported join freeze: not reproducible locally or live; the safety net covers it either way.
FILES: server/src/{room,index}.ts sim/protocol.ts tune.json src/net/client.ts src/scenes/{flight,menu}.ts src/render/stellarMap.ts BRIEF.md scripts/test-steroids-alpha-sim.mjs
SEAM: Room.siegeStatus/closeSession; SiegePhase 'cooldown'; tune.siege.{overSeconds,cooldownSeconds}; MapAction joinAs/notify; WarStatus/warLabel.
CROSS: src/render/stellarMap.ts (yours): Warzone status line, buttons under the details; flight maskOrbitalUi also skips when stuck.
FOR codex: map buttons and the stuck-in-hyperspace panel are plain panels; style as you like.

## 2026-11-17 codex desktop ordnance/speed UI LIVE
DID: larger PC bottom-left missile/mine badges/counts and violet slow/teal cruise streams live171126r0093. Routine top telemetry removed; mobile/warnings/actions retained. PR539 7b3c11fe.
FILES: Flight, ShipView/Thrusters, stale SPEED wording, existing sim regression and docs.
SEAM: optional speedBand from actual chassis-relative speed; legacy/custom fast flames and emission budgets retained. No wire/tune/gameplay changes.
CROSS: type/build/rig/fullsim and3 local+3 public Brave DPR2 desktop/compact/mobile runtime cases pass, zero page errors/capture. itch44028038724/Pages44028038740/Worker44028038814 success; protocol24 healthy.
FOR claude: tutorial reduction remains discussion ONLY. Proposed one-minute Fly/Fight+upgrade/Dash+Ram/Warp with contextual first-use tips; do not implement before owner response. Evidence ordnance-speed-ui; temporary preview stopped.

## 2026-11-17 codex desktop ordnance/speed UI RELEASE
DID: larger PC missile/mine icons/counts above bottom-left key hints; mobile unchanged. Removed routine top telemetry/debug coords; warnings/actions retained. Slow violet/cruise teal exhaust; hot/custom fast/turn/boost retained.
FILES: Flight, ShipView/Thrusters, SPEED stale-readout wording, sim thruster regressions and docs. No new art/dependencies or gameplay tuning.
SEAM: optional ThrusterInput.speedBand from actual per-chassis speed; legacy callers unchanged. No emission budget/wire changes.
CROSS:3 Brave DPR2 desktop/compact/mobile runtime cases pass, no page errors/capture. Type/build/rig/sim pass; distinct stream colours add no particles.
FOR claude: tutorial shortening is discussion ONLY, no lesson/count/flow edits. Proposed one-minute Fly/Fight+upgrade/Dash+Ram/Warp, contextual first-use tips. Final release proof follows.

## 2026-11-17 codex ram/tutorial/destruction LIVE
DID: all requested ram FX, hull trace, tutorial gates/multi-ring dash and800ms ship collapse are live171126r0091. PR535 909991ff; culling PR536 4efc7680.
FILES: Flight, combatEffects/Hud, shipView/Destruction/Explosion, client-net, tutorial policy/guide, local Room/World and tests/docs.
SEAM: optional ShipPlacement.destroying; LOCAL explosion id/state. Tutorial-only minerals5/shop8/weapons off3. No wire/tune/combat/economy changes; online Room ignores tutorial policy.
CROSS:14 local +14 public Brave DPR2 desktop/mobile cases pass, all4 chassis/own/remote/Warzone deaths, resize/dedup/HUD/tutorial. Type/build/rig/sim/live-config/new policy tests pass; no capture or public-room fixture writes.
FOR claude: itch44019478944/Pages44019478908/Worker44019138494 succeeded, health protocol24. Use main; no implementation handoff remains. Evidence ram-tutorial-destruction; temporary preview stopped.

## 2026-11-17 codex ram/tutorial/destruction RELEASE
DID: orange active-dash bow/crash FX, persistent hull trace, staged800ms darken/shrink with5 small blasts and1 size-aware final explosion; all4 chassis, own/remote/Warzone.
FILES: Flight, combatEffects/Hud, shipView/Destruction/Explosion, client-net, tutorial policy/guide, local Room/World and regressions/docs.
SEAM: ShipPlacement.destroying; LOCAL explosion FX id/copied state before remote removal. Tutorial policy gates minerals5/shop8/weapons off3, including queued/held input. No protocol/tune/combat/economy change.
CROSS: minimal sim/server tutorial-only gates and client death capture. Preplaced swept dash course allows multiple rings per dash. Resize retains collapse; cleanup/dedup bounded.
FOR claude: type/build/rig/sim/live-config and new policy/room/geometry tests pass;14 Brave DPR2 desktop/mobile runtime cases, zero page errors/no capture. Final PR/deploy proof follows; use main after release.

## 2026-11-17 codex rich-crystal chip VFX LIVE
DID: rich hits shed painted crystal chips/gold sparks; split/shatter makes a larger spinning shower live171126r0089. PR533 23cf3aec; itch44014921428/Pages44014921281 success, protocol24 healthy.
FILES: crystalChipMotion/crystalChips, client-net HP/GONE observation, Flight drain/lifecycle, regressions/docs. Existing painted mineral art reused; no new R2 pack.
SEAM: LOCAL NetFx crystal hit|split carries id/size/position/drift from existing records; no spawn/duplicate/heal/ordinary-rock FX or child-spawn retrigger. Generic rock breaks retained; no wire/sim/tune/reward/physics/pickup changes.
CROSS: minimal net observer;16 bursts/128 images, one spark batch, expiry and scene cleanup. Type/build/rig and8 local/8 public Brave desktop/mobile packet→renderer cases pass. No captures or server fixture writes.
FOR claude: shipped under direct-publication preference; use main, no server event/deploy work needed. BUILD_STATUS/output crystal-chip-vfx has proof; localhost preview stopped.

## 2026-11-17 codex rich-crystal chip VFX RELEASE
DID: rich hits shed2–3 painted chips/12 gold sparks; split/shatter scatters6–12 pieces/32–44 sparks with wider arcs/spin/drift. Existing approved art reused, no new R2 pack.
FILES: crystalChipMotion/crystalChips, NetClient local FX observation, Flight drain/lifecycle, regressions/docs.
SEAM: new LOCAL NetFx crystal hit|split observes rich HP decrease/GONE; no initial/duplicate/heal/ordinary FX, child spawn suppression. Generic stone breaks retained; no protocol/sim/tune/pickup/reward changes.
CROSS: minimal client-net observation;16-burst/128-image pool, spark batch, scene cleanup. Type/build/rig and8 Brave desktop/mobile packet→renderer cases pass; no capture/recording or server fixture writes.
FOR claude: continuing owner's direct-to-live preference; final PR/deploy proof follows. No new server event/wire implementation needed.

## 2026-11-17 codex rich-crystal readability LIVE
DID: protruding gold crystals on all15 rich painted rocks live171126r0088. PR531586c1295; itch44012011364/Pages44012011412 success; protocol24 healthy. Veins/families/siblings and ordinary rocks retained.
FILES: v2 rich pack manifest/bodyOffset metadata, rockRegistration/rockPainted, registration regressions/docs.
SEAM: original normal RockBodyFrame anchors decorated texture, preserving body centre/scale/collision coverage. Debug body vs decorative fields; source-hash URLs prevent stale metadata/image mismatch. Existing pools/damage/lighting unchanged.
CROSS: no sim/tune/reward/wire changes. R2 exactZIP/all15 hashes verified (4,956,322bytes/hash4df28e3e4f3bbac1db3ac57f5213df74e3f2bfd42f332cd45e18fb63f66f20ab). Type/build/rig/9 math/15 body-protrusion/local180/public180 checks pass; no capture/recording or server fixture writes.
FOR claude: refinement shipped under owner's prior direct-publication instruction. Use main; no further deploy required. BUILD_STATUS/output rich-crystal-art have proof; temporary localhost stopped.

## 2026-11-17 codex rich-crystal readability RELEASE
DID: chunky protruding gold crystal clusters on all15 gold-veined painted variants;2 groups on parents,1 clear group on medium/small, proportionally larger small forks. Direct-publication preference retained; R2 upload/readback complete.
FILES: rich-asteroids-v1 manifest now v2 pack/bodyOffset metadata, rockRegistration/rockPainted, registration regressions/docs.
SEAM: original normal RockBodyFrame anchors padded decorated texture; original body world centre/scale/collision coverage unchanged. Debug coverage separates body vs decorative extents; hash URL queries prevent stale image registration.
CROSS: no sim/tune/HP/reward/wire changes. Type/build/rig,9 transform/15 preserved-body/protrusion/180 Brave runtime cases pass; no capture/recording or fixture writes to server.
FOR claude: v2 ZIP4,956,322bytes/hash4df28e3e4f3bbac1db3ac57f5213df74e3f2bfd42f332cd45e18fb63f66f20ab, all15 sources publicly verified. Final live proof follows; no gameplay work required.

## 2026-11-17 codex rich-asteroid art LIVE
DID:15 gold-veined painted variants,3 families/all3 sizes/sibling shapes live171126r0087. Owner waived preview and authorized direct go-live. PR5290bf0383a; itch44000505243/Pages44000505433 success. Existing protocol24 healthy.
FILES: art/rich-asteroids-v1, prepare-assets, rockSelection/rockPainted, flight observation wiring, selection regression/docs.
SEAM: optional rich=false on draw/rockArtFor observes Asteroid.rich; exact original alpha/coverage and family/id-parity retained. Existing pooled projection/damage/lighting; orbit cue only for PixelRocks fallback. No gameplay/tune/wire changes.
CROSS: R2 exactZIP/all15 hashes verified (4,194,394bytes,4a3daf131dbefe44901fd16253094b04d29820f3b9ac6be247532f2db1045baf). Type/build/assets/rig and15alpha/45size/local180/public180 runtime checks pass; no capture/recording or fixture writes to server.
FOR claude: your rich-asteroid art follow-up is complete; use main, no additional deploy required. Public game version87; Warzone updates retained. BUILD_STATUS gives evidence; localhost preview stopped.

## 2026-11-17 codex rich-asteroid art RELEASE
DID:15 gold-veined painted variants across3 families/all3 sizes and sibling shapes. Owner waived preview gate and authorized go-live. R2 exactZIP/all15 sources verified; publication pending.
FILES: art/rich-asteroids-v1, prepare-assets, rockSelection/rockPainted, flight observation wiring, selection regression and docs.
SEAM: optional rich=false on PaintedRocks.draw/rockArtFor observes existing Asteroid.rich; source alpha/registration/coverage equal originals. Existing pooled projection/damage/lighting retained; gold orbit cue only for PixelRocks fallback.
CROSS: no sim/tune/wire/HP/reward changes. Type/build/assets/rig pass;15 exact alpha +45 source-scale checks;180 Brave desktop/mobile damage/day-night cases pass, no captures or game-fixture writes.
FOR claude: this implements your rich-asteroid art follow-up. R2 hash4a3daf131dbefe44901fd16253094b04d29820f3b9ac6be247532f2db1045baf,4,194,394bytes. Final PR/live proof follows; no additional gameplay work required.

## 2026-11-17 codex warzone-art LIVE
DID: all owner-approved Warzone damage/shield/Nexus-health/terrain art, neutral tower/Nexus rubble and final-hit debris blasts live171126r0086. PR52746db3f81; itch43997031396/Pages43997031451 success. Existing Worker protocol24 healthy.
FILES: render/buildingCondition/buildingBlast/buildingDestruction/buildingRig/clanBaseArt/planetGround/stellarMap, flight art wiring, rigReview/lab, art/warzone-v1 and regressions/docs.
SEAM: optional normalized health/siege observations, shared neutral keys, one-shot visible health→zero,16/36 painted ballistic chunks,8-burst pool. Existing support/root shadows and repair restore retained. No new sim/tune/wire values.
CROSS: preserved main PR526 rich-asteroid/protocol24 work; public R2 exactZIP/all7 parts verified. Type/build/assets/rig/sim/live-config pass; public4 destruction/2 lab/2 disconnected Flight cases pass; no capture/recording.
FOR claude: release complete; use main and public lab ?review=warzone. Proof in BUILD_STATUS/outputs warzone-art-review. Rich-asteroid veins/gold remain separate art follow-up. No further deploy needed; localhost preview stopped.

## 2026-11-17 codex warzone RELEASE APPROVED
DID: owner approved all Warzone terrain, damage/shield/Nexus-health art, neutral tower/Nexus rubble and final-hit explosion/debris updates. R2 exact ZIP/all7 parts verified; release pending deploy checks.
FILES: art/warzone-v1 manifest now approved-uploaded/public URL; preserved main PR526 mineral-rich asteroid/protocol24 changes during merge (docs-only conflicts).
SEAM: existing SiegeView/tune health observations; shared neutral wreck/debris keys, one-shot transitions, bounded effects. No new gameplay/wire values from this pass.
CROSS: source/regression merge checked before push. No screenshots/recording; owner manually approved the local lab.
FOR claude: go-live authorized directly by owner; source ZIP638189c64011a03ed3c05a5c6e2fc8fd5a87f14201e66c20e3693b79eb3f5caf. Await PR/run/public proof in this entry's successor.
