## Current milestone
Codex's polish art wired on branch (not live yet): art icons (tinted cream on buttons, red heart, plum cab fallback), conveyor-belt track texture, tunnel-mouth glow image, sparkle particles at the tunnel, steam puff on honks, dust puff on stops, and the pack backdrop on portrait screens. Every piece keeps its drawn fallback (checked with ?art=0). R2 now holds Codex's 43-file zip (SHA-256 c4484053...), without the Kenney sounds. Juice and feel pass live (pin 5949369d, PRs #615 and #616): icon buttons, a star-threshold moves bar, big-chain exit counter with hit-stop and shake, level intro, curtain wipe between levels, sliding menus, undo rewind, and Kenney CC0 sound effects. Sounds play the synth fallback until the owner uploads the new kaiten-express_assets.zip to R2 (no code change needed). Icon art is optional in art-sets.json, so the release builds before Codex delivers it. Earlier work (hearts, rewarded Undo and Hint as mocks, tighter 101-level set, framed HUD cards, adaptive full-screen layout) is also live.

## What was implemented
- Icons (src/render/icons.ts): vector placeholders for undo, hint, restart, menu and the ad badge; the art versions load automatically from loose/icon-<name>.webp (art-sets.json) once Codex delivers them.
- Score card moves bar with stars on the par, par + 1 and limit thresholds (piecewise scale so the stars never bunch up).
- Exit counter "×n" at each tunnel with a rising pentatonic note; hit-stop and screen shake on the last exit of a 3+ chain.
- Level intro (trains drop in, cards fade up; the first input finishes it), curtain wipe with a cab on Next, menu and result panel slide up.
- Undo rewind: trains slide back along their tracks over 260 ms.
- GameSfx (src/sfxSamples.ts) extends the pinned dig-kit Sfx locally: plays loose/sfx-*.ogg or .mp3 from the manifest, falling back to the synth sounds. Nine Kenney Interface Sounds (CC0) prepared for the zip.
- New tune.json feel values for all new timings; test hooks next() and setPass().

## Key technical decisions
- dig-kit is not changed: the sample player is a local subclass.
- Sound files are not committed: they go into kaiten-express_assets.zip for R2 (owner upload), like the art.
- Only the Kenney Interface Sounds pack was reachable (kenney.nl and other OpenGameArt pages refuse automated downloads), so whoosh, stop and clack are interface sounds standing in for train sounds. No music jingle yet.
- All new motion respects prefers-reduced-motion.

## Open questions
- Sound picks were chosen by name and length, not by ear: owner listening pass needed (tap click_002, bonk error_004, win confirmation_002, star glass_002, reward maximize_006, exit pluck_001, whoosh minimize_007, stop drop_002, clack click_005).
- Train-specific sounds (wheel clacks, horns, tunnel whoosh) from Kenney's Impact or Sci-fi packs need a manual download by the owner if wanted.
- itch.io demo length (levels 1 to 20 proposed) not built yet. BRIEF.md may need it.

## Known issues
- Store and native app icons (app-icons/ in the zip) have no target yet: there is no iOS or Android project in the repo.
- The new Kenney sounds are not in the R2 zip Codex uploaded; they need adding to it (see the zip handed over in chat).
- ?art=0 runs at 4 to 5 fps in headless Chromium while trains move (same on the live build), so no-art motion was checked by state, not by eye.
- Codex art for icons, belt, effects and backgrounds not delivered yet; placeholders in use.
- Headless 1280x800 checks run at 3 to 5 fps (software rendering), so wide-screen motion was only checked by screenshot.
- Physical-phone audio and haptics untested.
- Generated levels have par 4 to 6 only.

## Next proposed step
Owner plays the live build, uploads the new kaiten-express_assets.zip to R2 for the sounds (a redeploy picks it up), and reviews the sound picks. Wire Codex's art when it arrives.
