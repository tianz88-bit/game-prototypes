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
