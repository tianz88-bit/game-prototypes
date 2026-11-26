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
- Combat input is two buttons only: Execute or Pocket. Reels auto spin
  when the speed cooldown finishes. Category and direction choice were
  dropped; parts and the mutator reel decide them.
- Reels are 2 x 3 (6 visible tiles). The middle line executes, off-line
  tiles give small effects. Pocket stores all 6 tiles for passive buffs;
  matching pocketed tiles power up later executes (1, 2, 3 tiles up to a
  super version) and are consumed.
- No decision timer and no pause. Deciding slows the next cooldown.
- Pocketed mutator tiles match and power up the same as move tiles.
- Default pocket size 6.
- Hosting: GitHub Pages static site via the existing `deploy.yml`.

## Open questions
- Items marked (proposed) in `BRIEF.md` are gaps in the original notes
  and need owner confirmation: RPS stance rules, pocket overflow rule,
  starter content,
  damage type subset, UI drawn in canvas.
- Hesitation cost was decided mid-session: the next cooldown keeps
  running at a reduced rate while the player decides, and an undecided
  spin is lost if it finishes. BRIEF.md now covers it, but the slow-down
  rate (or full stop) still needs tuning.
- Combat controls changed a lot during discussion (category choice,
  direction choice, wait, pocket). BRIEF.md now reflects the latest
  decision but the original notes did not cover it.
- CLAUDE.md and STACK.md still say Phaser 3 is fixed for every
  prototype. They need a line recording the Three.js exception.
- Working name "chimera-reels" is a placeholder.

## Known issues
None, no code yet.

## Next proposed step
Owner reviews the brief. Then scope step 1: Three.js scaffold in
portrait with two placeholder monsters, intents, version stamp and
debug panel.
