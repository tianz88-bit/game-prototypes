# Densha Domino: art replacement handoff

Owner-approved update, 18 November 2026: the sushi train family and fixed-head chain/light rule have been approved for real-game integration. The original restrictions on changing `src/game/` below described the earlier art-only handoff; the approved BRIEF integration section now governs head metadata, chain direction, tutorial and puzzle generation. Other tuned values remain intact; new presentation-only controls cover carriage cascade, light flash, seated sushi spring and brake compression. Complete body sprites replace cab overlays, with separate animated eyes/food and an optional-art fallback. Local approved art is prepared by `node scripts/prepare-densha-art.mjs <approved-lab-folder>`; upload/public deployment is a separate step. No bitmap files are committed.

For: Codex (or any agent) replacing the placeholder visuals with real art.
Written by Claude Code. Read `BRIEF.md` (rules and look) and `BUILD_STATUS.md`
(what exists) first. The repo-wide rules are in the root `CLAUDE.md`.

## What this task is

Today every visual in Densha Domino is drawn in code (Phaser Graphics and baked
rounded "pillow" textures). The goal is to let real artwork replace those
visuals without touching the game logic, and to keep the game fully playable when
no art is present (placeholder-first, per `CLAUDE.md`).

You do two things, in this order:

1. Add a small art layer so each visual element can be swapped for an image.
   Procedural drawing stays as the fallback for any missing image.
2. Wire in the art the owner supplies, element by element.

## Hard rules (do not break)

- Do not change `src/game/` (rules, solver, levels) or the values in `tune.json`.
  The levels are tuned and proven solvable under the current rules. If an art need
  seems to require a rule change, stop and ask the owner.
- Stack is fixed: Phaser 3, TypeScript strict, Vite, Tweakpane. No new
  dependencies without asking. `dig-kit` stays pinned at `0.1.0`.
- Artwork lives in Cloudflare R2, never in this repo. Never commit PNG, WebP, zip
  or atlas files (`.gitignore` enforces this). The owner supplies or approves the
  art. If you generate stand-in art for testing, label it as placeholder, keep it
  out of git, and say so in your report.
- The game must still boot and play with zero art files (all 10 levels). Every
  image lookup needs a procedural fallback.
- Do not block the player (owner rule): no "rotate your phone" or "use a bigger
  screen" screens. The layout already adapts to any screen shape.
- Keep device pixel ratio sharpness: author at 2x, display at logical size
  (`PIXEL_RATIO` is capped at 2).
- No real railway branding or logos. Generic Japanese-style commuter and express
  trains, saturated pastel look, rounded, readable at small sizes.

## How the art pipeline works in this repo

- Art for a prototype is one zip in R2: `densha-domino_assets.zip`
  (underscore after the name). Public bucket URL is in `CLAUDE.md`. No credentials.
- Zip layout: `loose/<name>.png` for single images (backgrounds, tiles, one-off
  sprites), `packed/<animation-key>/0001.png, 0002.png, ...` for frame animations
  (packed into an atlas). Source frames are full size with fixed registration;
  trimming is done only by the packer.
- Build steps: `npm run fetch:assets densha-domino` then
  `npm run pack:assets densha-domino`. They write
  `public/prototypes/densha-domino/assets/` with `manifest.json` (content hashes),
  `atlas/` and the copied loose files.
- Load pattern used by `prototypes/digger-legacy/src/main.ts`: in `preload()`
  load `assets/manifest.json`, then for each entry under `loose/` call
  `this.load.image(<filename without extension>, 'assets/<path>')`. Paths are
  relative to the page, which works for GitHub Pages and itch.io.
- CI gotcha: `scripts/fetch-assets.js` fails with a 404 if the zip is not in R2.
  Do not add a `densha-domino` fetch block to `.github/workflows/deploy.yml`
  until the zip exists, or make that step tolerant of a missing zip. A build with
  no art must keep working. Never cache by filename (cache on ETag; see the
  existing blocks).
- Keys: a loose file `car_mid_0.png` becomes Phaser texture key `car_mid_0`.

## The art layer to add

Create `src/render/art.ts` and call it from a new `preload()` in `GameScene` (the
scene has none today, because nothing is loaded).

```
preloadArt(scene)            // loads manifest if it exists, ignores a 404
art.has(key): boolean        // true if that texture was loaded
```

Each draw site below becomes: `if (art.has(key)) use the image else existing code`.
Keep the existing procedural code as the fallback. Nothing else should need to
know whether art is present.

## Elements to replace

Cell size on screen is `cs = floor(min(350 / cols, 570 / rows))`, so it ranges
from about 43 logical px (8 columns) to 70 (5 columns). Author at the 2x size of
the largest case: a cell tile is **140 x 140 px**. Sprites are scaled down with
`setDisplaySize`, so keep detail readable when small.

| # | Element | Drawn today in | Art needed (file name, size at 2x) | Notes |
|---|---------|----------------|------------------------------------|-------|
| 1 | Train car body | `src/render/train.ts` `bakeCar`, key `dd_car_<color>` | `car_mid_<n>.png`, 129 x 98, n = 0..9 (livery index, see `LIVERIES` in `src/game/levels.ts`) | One car per cell. Horizontal, facing along x. **Vertical trains reuse the same image rotated 90 degrees**, so it must still read well rotated (top-down or flat side view). A train runs either way, so it must look right with the front at either end. |
| 2 | End car (cab) | same | optional `car_cab_<n>.png`, same size | Used for the first and last car of a train when present. Falls back to `car_mid_<n>`. |
| 3 | One-car train | same | optional `car_single_<n>.png`, same size | A one-car train has both ends. Falls back to `car_mid_<n>`. |
| 4 | Coupler | `train.ts` (small dark rectangle between cars) | optional `coupler.png`, 24 x 16 | Drawn between cars. |
| 5 | Headlights | `train.ts` (yellow dots at both ends) | optional `headlight.png`, 12 x 12 | Drawn at both ends of the train. Can be baked into the cab art instead. |
| 6 | Track, straight | `src/render/yard.ts` `drawYard` (ties + two rails) | `track_h.png`, 140 x 140 tile | Horizontal. Vertical lines use the same image rotated. Must tile seamlessly cell to cell. |
| 7 | Track, crossing | same | `track_cross.png`, 140 x 140 | Used where a horizontal and a vertical line cross. |
| 8 | Exit arrow | `drawYard` (green triangle outside the board edge) | `exit_arrow.png`, 48 x 48, pointing right | Rotated and placed just outside the board where an open track reaches the edge. |
| 9 | Obstacles | `drawYard` `drawObstacle` | `obs_concrete`, `obs_kiosk`, `obs_signal`, `obs_tree`, `obs_machine`, `obs_buffer`, each `.png`, 140 x 140 | One cell each, with a soft shadow baked in or a separate `obs_shadow.png`. All block trains the same way. The buffer stop sits on a track. |
| 10 | Yard ground | `drawYard` (rounded beige rectangle) | `yard_tile.png`, 140 x 140 tileable, or `yard_panel.png` as a 9-slice | Sits under everything on the board. |
| 11 | Backdrop | `GameScene.create` (gradient and cloud circles) | `bg_station.png`, 780 x 1688 | Portrait. Must extend gracefully on taller or wider screens (the game uses `Phaser.Scale.FIT`). |
| 12 | Horn effect | `GameScene.horn` (white arcs, particles) | optional `fx_horn.png`, 96 x 96, an arc burst pointing right | Rotated to the train's front. Plays about 280 ms. |
| 13 | "!" bubble | `GameScene.spook` (text "!") | optional `fx_bang.png`, 64 x 64 | Pops above a startled train. |
| 14 | Puffs and sparks | 4 x 4 white square texture `px` | optional `fx_puff.png`, `fx_spark.png`, 16 x 16 | Used by the particle emitter. |
| 15 | Stars | `GameScene.drawStar` polygons | optional `ui_star_on.png`, `ui_star_off.png`, 64 x 64 | HUD and result panel. |
| 16 | Buttons and panels | `dig-kit` `Button` (pillow) and graphics panels in `GameScene` | phase 2, only after the rest works | `dig-kit` is shared and pinned. Do not change it. Wrap or replace locally if needed. |

Not in scope: sounds (synthesised placeholders from `dig-kit`), fonts, rules,
levels, ads.

## Animation constraints (important for art)

- The "spook" beat stretches and shears a train. Phaser has no skew, so
  `TrainView.pose` (in `src/render/train.ts`) moves each car sideways by a
  different amount, scales the whole train along its track, and tilts it. **Each
  car must be its own image** so this works. Do not bake a whole train into one
  sprite.
- A train container is centred on the train's middle. Car `i` is placed at
  `(i - (n - 1) / 2) * cs` along the track. Keep the car art centred in its image.
- Trains are destroyed when they exit. Nothing else holds on to them.
- Timings (run speed, horn, spook, chain compression) live in `tune.json` and are
  tuned by feel. Art must not require different timings.

## Test and report

Run all of these and report what you actually verified:

1. `npm run typecheck` passes.
2. `npm run build` succeeds. Build once with no art (fallback) and once with art.
3. `node scripts/check-densha-levels.mjs` still lists 10 levels as ok (you must
   not have changed `src/game/`).
4. `node scripts/screenshot-densha-domino.mjs <url> <outDir>` against a dev
   server (`npx vite --port 5199`, then
   `http://localhost:5199/game-prototypes/prototypes/densha-domino/`). It plays all
   10 levels with real swipes, checks the level selector and the save, and fails
   on console errors. Inspect the screenshots, not just the exit code.
5. Take before and after screenshots of level 1, level 4 and level 10 on a
   phone-sized viewport, and one frame of the horn and spook beat.
6. Check a one-car train, a three-car train, a vertical train and a crossing.

Then update `BUILD_STATUS.md` (overwrite the whole file, keep its six headings).
Use small PRs on a branch named `proto/densha-domino/<short-description>`. Commit
messages are imperative, one line, no trailing period.

## Open questions for the owner

- Where do the art files come from, and where should they be uploaded (R2 object
  name `densha-domino_assets.zip`)?
- Art direction: keep the current pastel pillow look, or a different style?
- How many liveries are final (the code supports 10)?
- Should train cars have a side view or a top-down view? This decides whether
  rotated vertical trains look right.

## Reply

Post results in the original Agent Comms thread with the branch or PR link,
screenshot paths, and the exact outcome of each check above, including anything
you could not run.
