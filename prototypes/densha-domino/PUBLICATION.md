# Permanent sushi edition

Canonical branch: `codex/densha-domino-sushi`. This is an independent edition; do not merge its game changes over the original Claude prototype.

Claude backup: `codex/densha-domino-claude-backup-2026-11-19`, pinned to `d622721a1208c40b4ec4f1436dcbb580fdec4947`. The original hub path remains `/game-prototypes/prototypes/densha-domino/`.

The sushi edition is published on the owner's prototypes site at `https://tianz88-bit.github.io/game-prototypes/prototypes/densha-domino-sushi/`. Claude remains at `https://tianz88-bit.github.io/game-prototypes/prototypes/densha-domino/`. The separate paths use distinct save keys (`save:v2` for sushi and `save:v1` for Claude).

Release 2 corrects the original hosting choice through PR #580. GitHub Pages installs a checksum-pinned, self-contained build artifact after its normal build, so the sushi source remains on its permanent branch without overwriting main's Claude game. The original Claude folder remains byte-identical to its backup tree. The two shortcuts are adjacent. See `releases/2026-11-19-pages.json` for current release provenance; `releases/2026-11-19.json` records the superseded first publication.

Build with `node scripts/build-densha-public.mjs`; the output is `dist/densha-sushi/`. Run the pinned workspace package builds first and prepare the approved art through the existing ignored asset pipeline. Binary artwork is excluded from Git commits and included in the versioned build archive.

For a release, use the existing `bump-version.js densha-domino` and version-stamp generator, build/test the exact package, attach its ZIP to a versioned GitHub release, and update `.github/densha-sushi-release.json` on main with its source provenance and SHA-256. `scripts/install-densha-sushi-release.mjs` verifies integrity and writes only `dist/prototypes/densha-domino-sushi/`. The Pages workflow publishes it alongside the existing games. Persist the counter on this permanent branch after successful publication. Do not retarget the shared Current WIP itch slot.

The former ChatGPT Sites project is a superseded snapshot, not the active publishing target or an asset dependency. Do not publish further game updates there.
