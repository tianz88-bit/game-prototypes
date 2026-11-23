## Current milestone
Juice and feel pass on branch ccr-1e26354f-01jcy9 (not live): icon buttons, a star-threshold moves bar, big-chain exit counter with hit-stop and shake, level intro, curtain wipe between levels, sliding menus, undo rewind, and Kenney CC0 sound effects. Live after the owner uploads the new kaiten-express_assets.zip (adds the sounds) and approves a pin update. Earlier branch work (hearts, rewarded Undo and Hint as mocks, tighter 101-level set, framed HUD cards, adaptive full-screen layout) is already live.

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
- Codex art for icons, belt, effects and backgrounds not delivered yet; placeholders in use.
- Headless 1280x800 checks run at 3 to 5 fps (software rendering), so wide-screen motion was only checked by screenshot.
- Physical-phone audio and haptics untested.
- Generated levels have par 4 to 6 only.

## Next proposed step
Owner uploads the new kaiten-express_assets.zip to R2, listens to the sound picks, then approves the pin update to put the juice pass live. Wire Codex's art when it arrives.
