## Current milestone
The sushi edition is publicly deployed as release 1 on its permanent independent branch, with a shortcut beside the preserved Claude game on the live prototypes page.

## What was implemented
- Sushi game: https://densha-domino-sushi.lw-community-1973.chatgpt.site/ . Public audience; anonymous access and approved artwork verified.
- Permanent source branch: codex/densha-domino-sushi. Game source committed as cedb81551e775485e9bb58640db1a575cb13f98a; successful release counter 1 persisted afterward. The sushi gameplay changes were not merged over main's Claude game.
- Claude backup: codex/densha-domino-claude-backup-2026-11-19 at d622721a1208c40b4ec4f1436dcbb580fdec4947. A local full source ZIP is also retained in Gamedev/outputs/densha-publication/claude-source-backup-2026-11-19.zip. Original game URL: https://tianz88-bit.github.io/game-prototypes/prototypes/densha-domino/ . Its entire prototype tree matches the backup: 12e711b2c962dc0e85c219dcfc4abfa1f4479d5c.
- Hub: https://tianz88-bit.github.io/game-prototypes/ . PR #579 merged only the index shortcut/labels, with Claude immediately followed by Sushi Trains (Codex). GitHub Pages run 44445288696 succeeded and the live DOM was checked.
- Added the standalone public build script and publication/release provenance. The independent Sites checkout is Gamedev/publication/densha-domino-sushi. Artwork is excluded from Git source commits and included in the deployment archive.

## Key technical decisions
- Reused the complete verified Phaser game, fixed-head puzzle pack and original matching tunnel set. No game mechanics, art, tuned movement, rendering resolution or dependencies changed for publication. The Current WIP itch slot was not retargeted.
- Public Site project appgprj_6afe5d73f0f08191bbf218a71655d2f9, saved version 1, deployment appgdep_6afe5f628a488191b784e346c53e7910 succeeded. Hosted source: be6b4b867d3715a8ae22cacaf9ba014c8bb29bff. Exact provenance is in releases/2026-11-19.json and PUBLICATION.md.
- Standalone-format and anonymous public Brave fidelity checks passed: four approved art sheets, 120 eye frames, registered light bands, honk, manual reverse, restored head preference, independent carriage poses and level-5 three-tap chain. Both hub links booted anonymously; original Claude was independently identified. No browser errors.
- Public GPU benchmark: approximately 59.95 fps idle and chain, four draw calls, CPU p95 1.9 ms idle / 1.7 ms chain. Previous four-exit audit remains valid: 17 cases, one- through five-car trains, all carriages fully offscreen before despawn, no clipping/cover leakage after the north layer fix.
- Final npm run typecheck and npm run build passed. Public and hub tab-only screenshots were inspected. Evidence is in Gamedev/outputs/densha-publication/. Isolated Brave contexts were closed; user tabs preserved.

## Open questions
- None required for this publication.

## Known issues
- Existing unrelated Vite chunk-size/Punchies locale warnings remain. Physical-phone GPU performance is not measured. The GitHub connector lacks mutation permission for this repository; authorized Git/GitHub credential-manager operations handled pushes and the hub PR.
- Future sushi releases use its separate branch/publication checkout. Main still hosts the original Claude edition; do not overwrite it or retarget the shared itch slot inadvertently.

## Next proposed step
Playtest the public sushi URL through the new hub shortcut. Future updates should preserve the independent branch, Site identity and Claude backup, and increment the existing release counter only for a successful publication.
