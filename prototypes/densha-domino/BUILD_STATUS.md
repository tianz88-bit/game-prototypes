## Current milestone
Scope step 1 plus level selector, now with a 100-level pack: 10 hand-picked levels and 90 made by the backwards generator.

## What was implemented
- Core rules (run, chain, side bump, follow-after-bump via `rules.followAfterSide`), solver, intent layer, procedural trains and yard, horn and spook animation, stars, save (`densha-domino:save:v1`), `?debug=1` panel, `?test=1` hooks.
- Level selector, paged (20 per page, previous and next buttons), opens on the page of the current level.
- Backwards generator (`src/game/generator.ts`): scatters obstacles, builds a long climax chain first (one tap clears it), then adds blockers backwards, keeping each only if the plan gets one tap longer. The plan is replayed with the real rules. Solvable by construction.
- Pack (`src/game/pack.ts`, levels 11 to 100) written by `scripts/build-densha-pack.mjs`. Ramp: 6x7 with 8-9 trains, 7x8 with 10-12, 8x9 with 12-14. Do not hand-edit.
- Guided tutorial on levels 1 to 3: a caption above the board plus a pulsing ring and arrow on the train an optimal solution taps next (from the solver, so it tracks the real state). Hint only, never blocks input. Captions are in `COACH` in `GameScene.ts`; level 3 changes its caption after the first tap.
- `scripts/gen-densha-levels.mjs` prints generator stats per board size.
- `ART_HANDOFF.md` for Codex (art layer plan, replacement table). Not acted on yet.

## Key technical decisions
- Generate backwards instead of random search: no wasted tries on unsolvable boards.
- The last tap of every generated plan is the biggest chain (the climax), per owner request.
- Par comes from the solver when it finishes; otherwise the plan length is used (an upper bound). A `~` in the build log marks approximate par.
- Pack is committed as data so levels are stable between builds.

## Open questions
- Art: source, direction, liveries, side view or top-down (see `ART_HANDOFF.md`). BRIEF.md may need these added once answered.
- Hosting for a public build (itch.io or Pages) is the owner's choice.
- Does the 100-level ramp feel right? Generated boards have randomly placed obstacles and have not been playtested by a person.

## Known issues
- Tutorial text is English only and shown every time on levels 1 to 3 (no first-run flag). It is not covered by the BRIEF yet.
- Generator is not yet tuned for variety: boards may look alike.
- Solver stops at 400k states; boards above about 8x9 get approximate par.
- Exact par is sometimes lower than the plan, so the optimal solution may not end on the climax chain.
- Stars use the old slack values from tune.json, which were set for the hand-made levels.

## Next proposed step
Playtest levels 11 to 100, adjust the ramp, then a faster solver (numeric keys, independent-group split) for bigger boards and new mechanics for variety.
