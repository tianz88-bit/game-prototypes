# GFX brief for Codex (owner request, 2026-11-12)

Owner asked: improve the graphics: planet texture, asteroids, power-ups, UI and the like.
Lane: codex (render). Claude keeps the rules. Read COLLAB.md first. Log every push in HANDOFF.md.

## Hard rules (repo + owner)

- Canvas only: Phaser draws everything. No DOM overlays, React or Tailwind.
- The owner produces all artwork. Procedural drawing, shaders, VFX and styling of existing art are yours.
  For new raster art, propose what is needed in HANDOFF (FOR claude/owner); do not invent bitmaps.
  Never commit PNG, zip or atlas files (art lives in R2).
- Must stay readable and fast on phones (landscape). Keep the planet shader cheap; it is per pixel already.
  Measure: 2 clients + bots on Planet A must not drop frames in the headless check.
- Text: set `resolution` per Text object (DPR rule in ../../CLAUDE.md). Layout stays in logical px.
- Gameplay readability beats beauty: never draw a rock smaller than its hitbox (rockShape corners at
  100-112% of radius; that fixed the "invisible collision" bug), never hide bullets, mines, missiles
  or the lock crosshair behind effects.
- Do not change tune.json or anything that alters hit radii, timing or positions. Look-only values go
  in client.tune.json `render.*` (yours).
- Touch zones are logic: `intents.*Button` / `shopZones` positions are set in flight.ts. Restyle the
  drawing freely; if you move a button, move its zone in the same place and say so (SEAM).

## Work list (priority order)

1. Planet surface (`src/render/planetGround.ts`, `planet.ts`): more detail on the ground
   (craters, rock/dust variation, soft noise, sand channel edges), stronger day/night read, better
   rim and atmosphere. Keep the fixed-sun lighting and the projection.
2. Asteroids (flight.ts `drawWorld` rock block, `rockShape`): flat polygons today. Make them read as
   rocks: facet shading from the sun direction (`this.frame.sun`), crater dots, darker outline, size
   tint (ROCK_FILL), cracks as hp drops (`a.hp` vs `tune.asteroid.hp[size]`), hit flash
   (`asteroidHitAt`). Split/break debris on destroy (fx `spark`/`burst`).
3. Power-ups (flight.ts pickups block): mineral crystals (amber, bigger for more value) and the green
   heal cross. Add glow, bob, sparkle; a collect effect (fx `mineral` / `heal`).
4. Ordnance (new, placeholders): missile body + flame + smoke trail, spiked mine with arm blink,
   trigger ring, hp bar; `blast` fx rings (shot-down vs exploded). Lock crosshair (`drawCrosshair`),
   pre-fire lock brackets, MISSILE LOCK warning.
5. Bounty (new): gold ring + star over the holder, edge tracker arrow + "<name> <dist>m",
   "BOUNTY ON YOU", gold star on the leaderboard chip (`drawBounty`, `drawBoard`).
6. UI chrome: one visual language across shop buttons (`drawShop`), leaderboard chips (`drawBoard`),
   hull/shield/heat/dash bars, missile/mine buttons (`drawWeapons`), touch fire/dash/stick, menu
   (planet select, QR panel, name field) and death screen. Suggest: a small palette + corner radius +
   stroke set in client.tune.json `render.ui*`, reused everywhere.
7. Existing VFX polish: explosion (`src/render/explosion.ts`), hex shield (`shipView.drawShield`),
   dash charge and boost trail (`drawDashCharge`), turret domes/barrels (`drawTurrets`),
   thruster plume (`thrusters.ts`).
8. Ship readability: bots could get a subtle tint/marker; power tiers (turrets, shield, guns) could
   show on the ship (ask owner before adding parts).

## Done when (per push)

- `npm run typecheck`, `npm run build`, rig test, and a screenshot of each changed thing looked at,
  desktop 1280x720 and phone 844x390 landscape (DPR 2).
- No console errors. Sim tests still pass (`node scripts/test-steroids-alpha-sim.mjs`).
- HANDOFF entry. Small PRs (one item from the list each), not one big one.

## Open for the owner

- Any new raster art (rock sprites, crystal sprites, UI icons) is the owner's to make; Codex lists
  what would help most.

## Delivered pass — 13 November 2026

Items 1–7 delivered in PRs #448–454. Item 8 adds server-authoritative bot markers in this change; human names cannot opt into the bot marker. Existing turret tiers also use visible shop pips and polished mounts. New physical power-tier parts remain an owner art decision.

Each item has inspected desktop/DPR2 phone captures and passing typecheck/build/rig/sim checks. Final live-config tests cover RGB boundaries, old settings migration and bot-name impersonation. Headless two-client + four-bot pacing matches the baseline (about 32 FPS, p95 31.6ms); real phone hardware remains to be measured. No new raster assets or gameplay tuning changes. The legacy full browser check retains a baseline-reproduced early keyboard-turn assertion failure; it is not reported as passing.

## Orbital zoom transition (owner, 13 November 2026)

Replaces the cloud-layer transition in BRIEF.md (now "Orbital zoom transition"). Lane: codex.
The Agent Comms mailbox was down when this was written, so this file is the hand-off.

- Entering (on drop-in, when the first own snapshot arrives): camera starts far out, the whole
  planet small in space (reuse the globe projection; animate the view zoom `this.view.k` /
  planet radius in flight.ts), then dives to play zoom over about 1.5-2 s with ease-out. The own
  ship streaks down through the atmosphere glow and lands with a small shockwave ring.
- It must fit inside the 2 s spawn protection (sim/world.ts addShip grace). The client keeps
  sending inputs throughout; do not block input or prediction, only the camera.
- Leaving: when `net.extracted` is set (or status 'extracted'), play the reverse: ship streaks
  up, camera pulls back, the planet shrinks into space (about 1.5 s), then the EXTRACTED panel
  (flight.ts deathScreen extracted=true). Purely visual: the server has already removed the ship.
- Other ships' warp-outs keep the in-world 'warpout' fx; only the own ship gets the camera move.
- Respawn / Drop in replays the entry. The menu planets may later become the same globes (space
  hub), so keep the zoom code reusable.
- Done when: desktop and phone DPR2 captures of both directions, no console errors, the sim
  tests and the death check still pass, HANDOFF entry.

## Salvage and hot zone placeholders (claude, 13 November 2026)

- Gold salvage pickups: spinning gold coin (flight.ts drawWorld, kind 'salvage'); collect fx
  'gold'.
- Hot zone: dashed green ring on the planet, label with bonus and timer, green edge arrow
  (flight.ts drawHotZone).
- SALVAGE counter above the hull panel (drawTouch).

## Clan planets v0 art (owner, 15 November 2026)

Placeholders are live (BRIEF.md "Clan planets v0"); replace freely, keep positions and sizes from
`sim/clanBase.ts` and `tune.json` `base` (all world units).

1. **Two clan planet skins** (Crimson home, Azure home): today the shared ground is tinted
   (`PLANET_TINT` in `src/scenes/flight.ts`, `tint` uniform in `src/render/planetGround.ts`). Each
   home planet needs its own surface that reads as that clan's (warm crimson, cool azure).
2. **Treasury building** at the map centre (placeholder: hexagon, about 60 world units across),
   with the clan total shown under it. Should read as a fortified vault.
3. **Landing pads** (6, radius 55, ring radius 230): must show clearly when a member is over one
   (placeholder: green ring) and when docked.
4. **Base turrets** (6, ring radius 470): static, turn and fire at non-members; a firing flash.
5. **Shield dome** (radius 340) over the treasury and pads; a hit effect where non-member bullets
   stop (placeholder: a small white pop) and where intruders are pushed back.
6. **Gate** (radius 120) at the far side of the planet, where non-members arrive.
7. **Banner** text under the warp panel (arrival warnings, DOCKED · REPAIRING, deposit line).

Code seams: `FlightScene.drawBase`, `PlanetGround(scene, depth, tint)`, fx `baseTurret`
(index, angle), test hooks `__steroids.layout()`, `docked()`, `treasury()`.

## Art backlog (owner priority, 15 November 2026)

One prioritized list, top first. Sent to Codex in Agent Comms (thread 07e15987). Constraints: no
gameplay, tuning or protocol changes; sizes and hitboxes stay as in `sim/` and `tune.json`; assets
through the hash-verified R2 pipeline; keep fallbacks when a texture is missing; preserve mobile
`uiZones`. Owner sees screenshots before anything goes live.

1. **Combat**
   - Missiles and mines: bodies, missile smoke trail, mine arming/seeking states, lock-on crosshair
     (`render/worldArt.ts` drawOrdnance; flight.ts missile trails and lock cues).
   - Explosions: ship death (`render/explosion.ts`, drawExplosionCore), missile and mine blasts,
     asteroid break/split, shield shatter ring, Nova kill-effect rings.
   - Hits: hit sparks (drawHitSpark), hull-hit flash, dash-ram impact.
   - Health pickups (medical cross, still procedural).
   - Dash wind-up effect (drawDashCharge); its arrow follows the heading (dash is straight-only).
2. **Clan planets** (section "Clan planets v0 art" above).
3. **Ships and progression**
   - Evolve transformation effect; Battlecruiser escort turrets and name-tag placement.
   - Warp-out: warping ring and launch flash.
   - Asteroid damage stages (painted rocks only darken today).
4. **HUD and menus**
   - Hangar icons and swatches for flames, shields, kill FX, badges.
   - Target health bar (drawTargetBar), nose chevron (drawNose), cargo-full cue near Warp,
     reconnecting and lost-ship banners, salvage-zone ring (drawHotZone).

Separate, already dispatched: orbital zoom transition.

## Local review pass — 15 November 2026

All four Art backlog groups implemented on codex/steroids-combat-backlog-preview. See HANDOFF/BUILD_STATUS for code and checks. Actual-renderer screenshots are grouped by priority in outputs/steroids-alpha/backlog-review/index.html. No live changes; owner screenshot review is required first. New missile/mine/repair raster sources and ZIP remain local until approval. Orbital zoom remains separate.

## Publication approved — 15 November 2026

Owner reviewed the four priority boards and explicitly approved the complete pass for live. The three new sources are uploaded/re-fetched/hash-verified in R2. Release preserves newer main targeting, exhaust and docked-ground changes. See BUILD_STATUS/HANDOFF for publication results; orbital zoom remains separate.

## Orbital and building preview — 16 November 2026

Owner requested preview before publication. Local branch codex/steroids-orbit-nexus-preview implements the orbital spec above, quieter ship markers, a larger three-layer treasury nexus and layered twin-cannon tower buildings. Projected neighbouring axes drive building bearing/foreshortening, with separate raised parts and alternating visual barrel recoil. Actual authoritative base positions, collision sizes and firing counts are unchanged. Seven new original painted sources remain local and hash-verified; proposed R2 object is not uploaded. Desktop/mobile motion and building captures: outputs/steroids-alpha/orbit-review/index.html. Await owner review before upload, PR or deploy.

## Ship-centred instruments — 16 November 2026

Owner replaced the flat hull/shield/heat/dash panel with two semicircles around the pilot. Left shows shield until depletion, then hull; hull/total always below. Right splits remaining weapon capacity (1-heat) and dash. Recovery states remain visible. Local preview: outputs/steroids-alpha/semicircle-hud-preview/index.html. Prior screenshot-before-live gate remains in force.

## HUD refinement — 16 November 2026

Owner clarified that dash and weapon each need a full right semicircle, concentric and thinner than shield/hull. Revised to lighter translucent segmented arcs with each symbol embedded in its own base notch. Original GoldenEye is the visual reference. Latest local review: outputs/steroids-alpha/semicircle-hud-preview-v2/index.html. Recovery behavior remains unchanged; still not deployed.
