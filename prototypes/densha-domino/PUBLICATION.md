# Permanent sushi edition

Canonical branch: `codex/densha-domino-sushi`. This is an independent edition; do not merge its game changes over the original Claude prototype.

Claude backup: `codex/densha-domino-claude-backup-2026-11-19`, pinned to `d622721a1208c40b4ec4f1436dcbb580fdec4947`. The original hub path remains `/game-prototypes/prototypes/densha-domino/`.

The sushi edition is published independently with Sites, project `appgprj_6afe5d73f0f08191bbf218a71655d2f9`, at `https://densha-domino-sushi.lw-community-1973.chatgpt.site`. Audience: public. Its separate publication checkout preserves the hosting identity and archive provenance.

Build with `node scripts/build-densha-public.mjs`; the output is `dist/densha-sushi/`. The publication checkout passes `dist` as the output directory. Run the pinned workspace package builds first and prepare the approved art through the existing ignored asset pipeline. Binary artwork is excluded from source commits and travels in the deployment archive.

For a release, use the existing `bump-version.js densha-domino` and version-stamp generator, build/test the exact package, deploy the saved Sites version, and persist the counter on this permanent branch after successful publication. Do not retarget the shared Current WIP itch slot.
