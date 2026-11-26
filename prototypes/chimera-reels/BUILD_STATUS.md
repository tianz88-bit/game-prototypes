## Current milestone
Scope steps 1 to 6 and 8 done: toon-art 3D scene, juicy reel combat,
parts, hitzones and part breaks, armour and damage types, weakspot, the
single-player tower run, and enemy part drops. Step 7 (3v3) is waiting
on a design decision. Live on GitHub Pages and linked from the hub.

## What was implemented
- Monsters are assembled from parts (body, head, limbs, legs, skin, aux),
  3 options per slot except body and legs (2). Parts set HP, speed,
  attack, defence, weak value, pocket size, armour, flight, and which
  tiles go on each reel. Short reels are padded with blanks.
- 3 starters (Tuskrel, Skyreave, Bulwark); enemies get random parts and
  scale per floor.
- Directions from the mutator reel (front, High, Low). The hit lands on
  an unbroken part facing that way, else the body. Low misses flyers,
  High is weak but strong vs flyers.
- Part breaks at a share of body HP (scaled by armour): the part's tiles
  become broken blanks, its pocketed tiles are dropped, a pending result
  is cancelled, and the 3D part tumbles off. Wings breaking grounds a
  flyer.
- Armour (hide, shell, fur) x damage type (slash, crush, pierce,
  exotherm) resistance table. Weakspot = highest weak value, takes x1.5,
  shown as a pulsing red outline on the enemy; total weak adds fragility.
- Tower run: starter select, entry bet, fight, payout, level up with a
  choice of 3 tiles (rarer tiles unlock with level), game over when gold
  cannot cover the bet or the monster takes the final hit. Yield button
  (two taps) keeps the monster and retries the floor.
- Part drops: after a win the enemy drops one of its parts that differs
  from yours; a loot screen compares stats and tiles, and Take swaps it
  into that slot (the 3D model rebuilds), Keep skips. Then level-up.
- Toon art following the Kimberly Tank Study: toon shader, outlines,
  chamfered parts, springs, toon puffs, contact-shadow floor.
- Juice: blurred reel spins with ticks, landing overshoot and pop, super
  tease (mutator reel stops first, move reel crawls with a pulsing frame
  and "!!!"), tiles flying reel to pocket and pocket to line, discarded
  tiles falling, burn sparks, match glow on pocket tiles, hit-stop, HUD
  and camera shake, super flash and stamp, impact puffs, coin shower,
  pressable buttons with a gleam, synthesised WebAudio sounds.

## Key technical decisions
- Custom toon shaders call `linearToOutputTexel`: three 0.187 colour
  management otherwise renders them too dark (the tank study used 0.147).
- Springs run at a fixed 1/240 s substep; a frame-sized step made the
  9 Hz hull spring explode and hid the body.
- Hit-stop freezes the sim and 3D view only; HUD effects keep animating.
- The sim keeps tile provenance (which part supplied each strip and
  pocket tile) so breaks remove exactly that part's tiles.
- Sounds are generated with WebAudio (no files, no dependency) and start
  on the first tap.
- Merged main: Three.js is now an approved 3D engine repo-wide (CHANGELOG
  2026-11-25), so the earlier per-prototype exception note was dropped.

## Open questions
- Step 7 (3v3) needs a design decision before building: swapping costs
  a command, but combat input is two buttons (Execute, Pocket). Where does
  Swap go, and does a swap use the turn? BRIEF.md needs updating.
- Back attacks: aux parts face "back", and only sneak moves may attack
  from behind, but no sneak move exists yet, so aux parts cannot be hit.
  BRIEF.md does not say which moves sneak.
- Items still marked (proposed) in BRIEF.md: stance rules, overflow
  rule, starter content, first 4 damage types.
- Pocketing clears stance (implemented); not stated in BRIEF.md.
- Level-up tiles are permanent for the run. A dropped part is offered
  every win (if it differs); BRIEF.md does not say how often parts drop.

## Known issues
- Not tested on a real phone; verified in headless Chromium at 390x844
  (phone) and 1280x720 (desktop, debug panel), dev and production builds.
- Balance is untouched first guesses. In automated test fights the player
  often ends near 1 HP, and Skyreave's move reel has 2 blanks (whiffs).
- The HUD canvas is redrawn and uploaded every frame; may cost battery on
  low-end phones.
- Pocket grid shows at most 9 slots.
- Enemy pocket tiles flying in can briefly overlap the "Pocket" label.

## Next proposed step
Owner plays the live build and tunes feel (`?debug=1`). Decide how
swapping fits the two-button controls, then build step 7 (3v3).
