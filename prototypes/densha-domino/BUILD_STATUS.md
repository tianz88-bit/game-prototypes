## Current milestone
Sushi Trains has been moved onto the owner's prototypes site at its own path, beside the unchanged Claude game. The next visual/game-feel pass is proposed in DESIGN_REVIEW.md and has not been implemented.

## What was implemented
- Active sushi URL: https://tianz88-bit.github.io/game-prototypes/prototypes/densha-domino-sushi/ . Claude remains at https://tianz88-bit.github.io/game-prototypes/prototypes/densha-domino/ . Both links are adjacent on the hub and both games boot anonymously.
- Permanent sushi source remains codex/densha-domino-sushi; the Claude backup branch is unchanged. Main's Claude prototype tree still equals backup tree 12e711b2c962dc0e85c219dcfc4abfa1f4479d5c.
- PR #580 adds a checksum-pinned, self-contained sushi release to the GitHub Pages build at dist/prototypes/densha-domino-sushi/. Game sources stay independent rather than being merged over Claude. The installer rejects corrupt artifacts and writes only that dedicated generated directory. Binary game assets are packaged build artifacts, not Git source commits.
- Release 2 uses source 72083b853f50316d6a76f5fee7dd5022863472c3 and the approved four art sheets. The deprecated unused L-shaped tunnel source is excluded from the package. The new public game makes resource requests only to tianz88-bit.github.io, with no ChatGPT-host dependency.
- Updated publication/release records. No train artwork, food sizing, pillar art, track decoration, reward motion, puzzle rules or feel tuning changed in this migration; only the release stamp changes to r0002.

## Key technical decisions
- Pages workflow run 44449640933 succeeded, including typecheck, build, pinned-artifact installation and deployment. The existing game build was hashed before/after local installation and remained unchanged. A deliberate checksum mismatch failed before replacement.
- Local-subdirectory and new public Brave fidelity checks passed art loading, expressive eyes, honk, manual reverse, head-light restoration, carriage cascades and the level-5 three-tap chain. Live DOM checks confirmed adjacent distinct same-site URLs, correct release metadata, and no runtime errors.
- New public GPU benchmark: approximately 59.95 fps idle and chain, four draw calls, CPU p95 2.6 ms idle / 1.9 ms chain. 2x resolution and all existing optimizations remain. Screenshots were inspected in Gamedev/outputs/densha-pages-migration/; isolated browser contexts were closed and user tabs preserved.
- Prior four-exit audit remains valid for unchanged game code: 17 cases across one- through five-car trains, no early culling/despawn, no cover leakage after the north draw-order fix.

## Open questions
- Review DESIGN_REVIEW.md before regenerating/integrating pillar or track-end art. The owner clarified pillars are decorative blockers on existing blocked board cells, not background columns.
- Proposed train-only plum silhouette outline, quieter backdrop contrast, plates +15%, food +20%, and stronger plate-anchored food spring are pending visual review.
- Proposed reward sequencing replaces generic preset motion with clear arrival/impact/settle beats. Current stars use Elastic.Out and panels Back.Out; current confetti starts at 280 ms before the third star settles around 847 ms. Proposed timing is documented, not deployed.

## Known issues
- Current published visual pass still has the old corner pillars, existing plate/food sizing and reward motion until the requested design discussion is resolved.
- Exact internal easing implementations of referenced older puzzle games are not verified; reference footage/style informs the proposal, while proposed timing belongs to this game.
- The old ChatGPT Site is a superseded snapshot, not a deployment target. Existing unrelated Vite warnings remain; physical-phone GPU performance is unmeasured.

## Next proposed step
Agree the pillar blocker/end-cap/outline direction, then generate the replacement art for review and apply the approved readability, food-spring and reward timing pass to the sushi branch only. Publish future releases through the pinned Pages artifact while keeping Claude's source, save key and URL unchanged.
