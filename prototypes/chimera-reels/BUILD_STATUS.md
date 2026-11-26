## Current milestone
Brief drafted. No code yet.

## What was implemented
- `BRIEF.md` first draft, built from the owner's original design notes.
  It combines the part-based monster battler and the slot-reel roguelike
  into one game: a monster battler whose combat is resolved by two reels
  per monster.

## Key technical decisions
- Engine: Three.js, owner-approved exception to the Phaser 3 default, for
  this prototype only.
- Portrait, mobile-first, web.
- Placeholder monsters built from primitive meshes, one mesh per part.
- One command per ready monster. The "2 commands per turn" idea is
  dropped for 1v1 and will be revisited with 3v3 swapping.
- Hosting: GitHub Pages static site via the existing `deploy.yml`.

## Open questions
- Items marked (proposed) in `BRIEF.md` are gaps in the original notes
  and need owner confirmation: speed gauge timing, RPS stance rules,
  tile potency rule, starter content, damage type subset, UI drawn in
  canvas.
- CLAUDE.md and STACK.md still say Phaser 3 is fixed for every
  prototype. They need a line recording the Three.js exception.
- Working name "chimera-reels" is a placeholder.

## Known issues
None, no code yet.

## Next proposed step
Owner reviews the brief. Then scope step 1: Three.js scaffold in
portrait with two placeholder monsters, intents, version stamp and
debug panel.
