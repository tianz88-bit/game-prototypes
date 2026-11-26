## Current milestone
Scope steps 1 and 2 done: Three.js portrait scaffold plus the core reel
combat loop (1v1, fixed placeholder monsters).

## What was implemented
- Three.js scene in portrait (390x844 logical), pillarboxed on wide
  windows, never blocked. Two placeholder chimeras built from primitives,
  one mesh per part (torso, head, jaw, horns, legs, claws, tail).
  Procedural motion only: idle bob, lunge, recoil, hit flash, super spin,
  knockdown on defeat, camera shake.
- HUD drawn with the 2D canvas API onto an offscreen canvas and shown as a
  textured quad inside the WebGL canvas (no DOM UI). Enemy panel on top,
  arena in the middle band, player panel and buttons at the bottom.
- Combat sim (`src/sim/combat.ts`), pure logic with an event list:
  - speed cooldown, auto spin, 2 reels x 3 rows, line highlight
  - Execute: line move plus mutator, off-line tile chip effects, pocket
    matches consumed for tiers 1 to 3 (tier 3 = super), mutator matches
    stack
  - Pocket: stores the visible non-blank tiles, overflow priority (held
    matches, then line, then off-line), passive buffs while held
  - Burn: tap a pocket tile to burn its group (up to 3) while deciding
  - Attack / Defend / Brains stances (block, interrupt, feint), Snatch
    drops pocketed tiles, Jam turns opponent tiles into temporary blanks
  - deciding slows the next cooldown; if it finishes first the spin is lost
  - simple enemy AI, win/lose result, Fight again
- Intent layer: Execute = primary (Space, Enter, J, tap), Pocket =
  secondary (K, P, tap), Burn = tap pocket tile or keys 1 to 9.
- `tune.json` holds every number; Tweakpane panel on `?debug=1` with
  Restart fight and Copy JSON. `?seed=` replays a fight.
- Version stamp top-left (`version.json`, counter bumped by
  `.github/workflows/deploy.yml`, which now also persists this counter).
- Hub link added. CLAUDE.md and STACK.md record the Three.js exception.
- `scripts/screenshot-chimera-reels.mjs`: phone-size play-through (Pocket,
  Execute, Burn), wide desktop + debug check, fails on console errors.

## Key technical decisions
- Engine: Three.js 0.187.0 pinned in this prototype's package.json, owner
  approved for this prototype only.
- DPR: `renderer.setPixelRatio(min(devicePixelRatio, 2))`, and the HUD
  canvas is sized at logical size x CSS scale x the same ratio, so text is
  drawn at native resolution.
- dig-kit not used: its barrel export includes Phaser-dependent modules.
  The tune panel is a local copy of dig-kit's. Possible future extraction:
  an engine-agnostic `tune-panel` package both could share.
- Strips are fixed lists in `src/sim/content.ts` until scope step 3
  builds them from parts.
- Pocketing counts as an action (clears stance). Blank tiles are never
  pocketed. Burn fires without changing stance.

## Open questions
- Items still marked (proposed) in `BRIEF.md`: RPS stance rules, pocket
  overflow rule, starter content, first 4 damage types, UI drawn in
  canvas. The current build implements them as written.
- Burn, the pocket and the two-button control scheme were all decided
  during discussion, not in the original notes. BRIEF.md now covers them.
- Whether pocketing should clear the current stance (currently yes) is not
  in BRIEF.md and may need adding.

## Known issues
- Not tested on a real phone. Only verified in headless Chromium at
  390x844 and 1280x720.
- The HUD canvas is redrawn and re-uploaded to the GPU every frame. Fine
  on desktop; may cost battery or frame rate on low-end phones.
- Pocket layout shows 6 slots; pocket sizes above 6 (from parts later)
  need a layout change.
- In an automated test fight no super fired. Super frequency needs
  tuning by play (tune values untouched).
- Damage numbers and pocket count badges can overlap the top panel edge
  when the enemy lunges.

## Next proposed step
Owner plays the build (`?debug=1` to tune). Then scope step 3: parts
give stats and tiles, starter parts, 3 starter chimeras.
