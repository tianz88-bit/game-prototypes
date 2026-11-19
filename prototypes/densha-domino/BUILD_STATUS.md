## Current milestone
All four tunnel exits audited and the north cover overlap fixed in the real game. Local game: http://127.0.0.1:5199/game-prototypes/prototypes/densha-domino/?review=exit-audit . About 60 fps confirmed by the owner in their play browser and by the final normal-GPU benchmark. No lab or deployment.

## What was implemented
- Tested 17 real level/train/direction combinations with one- through five-car trains across north, south, east and west exits. Tests use real canvas swipes and existing game rules, not a separate scene or fixture board.
- Found a north-only overlap: the roof was behind the train, exposing carriage pixels over the mouth just before the shared clip plane. Moved the existing north cover into the foreground, matching the south cover. All tunnel art and the matching original four-view set are retained.
- Existing exit continuation was verified: trains keep moving at full size under their cover until every carriage's complete world bounds, including food and lights, are offscreen. The display root is destroyed only afterward. No change to rules, travel speed, head preference, reaction timing or carriage cascade.
- Added test-only geometry/despawn audit hooks and scripts/verify-densha-exits.mjs. No bounds sampling, screenshot work or audit-array allocation runs during normal play; the despawn callback only checks a null audit flag. The visible fix is one existing sprite's draw order, with no new masks/effects.

## Key technical decisions
- Baseline audit reproduced 151 train pixels drawing over the north mouth. Final audit reports zero leakage at all four three-car mouth captures. Full audit: 17 cases, 2,139 sampled animation frames, no early carriage culling, complete offscreen bounds at every destruction callback, monotonic root travel, and no runtime/console errors.
- Final normal Brave GPU benchmark on NVIDIA/D3D11: empty tab 59.95 fps, dense idle game 59.95 fps, chain 59.95 fps. Four draw calls per frame remain. Idle CPU p50/p95 1.8/2.4 ms; chain 1.6/2.1 ms. This matches the owner's reported approximately 60 fps in the actual play browser. Renderer target stays 60 with no artificial limiter or resolution reduction.
- npm run typecheck and npm run build passed. All four final real-game tail-entering screenshots were inspected. Existing unrelated Vite chunk-size and Punchies locale warnings remain.
- Evidence: Gamedev/outputs/densha-exit-audit/exit-audit.json, performance.json and north/south/east/west-3-tail-entering.png. The before-fix north screenshot/audit are retained for comparison. Isolated Brave contexts were closed; user tabs were preserved.

## Open questions
- No remaining exit-test blocker. Owner visual review remains available in the actual game.

## Known issues
- Physical-phone performance was not measured. Headless scheduling/GPU selection varied in earlier runs, so individual benchmark rates should not be treated as a universal device guarantee.
- Public asset publication/fetch wiring remains separate; no upload, release, version-counter change or save-key change was made.

## Next proposed step
Owner playtest the four exits in the real game. Keep the current matching tunnel set, movement tuning and 60 fps rendering configuration. Publish only when requested.
