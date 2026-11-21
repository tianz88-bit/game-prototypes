## Current milestone
Hearts and rewarded-ad placeholders on branch (not live): 5 hearts, 1 per 25 min, lost attempts cost a heart, move limit par + 2. Ads and the Pass are mocks. HUD split into three cards (level, moves+stars, trains left with cab icon), placed in a row (portrait) or side columns (wide), whichever gives the bigger board. Tutorial teaches by showing (guided wrong move + rewind on levels 4 and 5, short labels, No gap! cue in all levels) and the play area is framed (soft veil outside the board, HUD card). On branch ccr-1e26354f-01jcy9; live after the owner approves a pin update. Tighter levels on branch ccr-1e26354f-01jcy9 (not released): tutorial levels 4 to 6 rebuilt, "No room!" cue, and a regenerated 95-level pack (levels 7 to 101) under the new rules. All 101 pass check-densha-quality.mjs. Board-framed layout: tunnels capped at 1.6 cells past the board, HUD anchored above the board, block centred below the corner buttons. Full-screen adaptive layout: the canvas fills any screen shape (phones, foldable cover and inner screens, tablets, desktop) with no bars, and a fold, unfold or rotate rebuilds the game at the new size while keeping the level, board and moves. Local music and sushi-bar art review after public release 15.

## What was implemented
Gemini generated separate title and gameplay instrumentals. Edited loop exports are 24.00 and 20.76 seconds. A music control remembers the player's preference. Plays switch to the gameplay arrangement when the title closes.
Plates and sushi are 50% larger in both dimensions, with the cargo centered over the available deck. Four pastel counter props occupy existing obstacle cells. Up to two faint wave decals decorate tiles outside active lanes.

## Key technical decisions
One looping audio player switches cues, pauses while hidden, and uses a local Ogg or MP3 file. All four decorative objects share a single texture. Floor decals are baked with the existing floor drawing.

## Open questions
- itch.io demo length (e.g. levels 1 to 20) not decided. BRIEF.md may need it.
- Rewarded hint and +3 moves placements not built yet; real ad and purchase SDKs need dependency approval.
Owner review of the music mix, prop palette and cargo placement.

## Known issues
- Generated levels have par 4 to 6 only; longer late levels need bigger boards with 14+ trains, which the builder generates slowly. Saves keep stars by level number, so earned stars attach to whatever level now has that number; best-move records start fresh (new names).
- Layout: real fullscreen is requested on Play only on touch devices that support it (not iPhone Safari). Dual-screen devices with a visible hinge (viewport segments) are not handled specially. A rebuild after a fold restarts any background music and drops an open menu or result panel. Not tested on a physical foldable.
Mobile layout and playback were checked at phone size in Brave. Physical-phone playback remains unverified.

## Next proposed step
Review the two local loops and Level 5 board before publishing.
