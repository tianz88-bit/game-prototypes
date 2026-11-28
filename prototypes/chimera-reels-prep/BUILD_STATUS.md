## Current milestone
Second pass of the "Spin, Plan, Clash" variant after the owner's first
playtest: Nudge replaces Hold, the stash gets one clear role per tile
type with target sabotage as the main counterplay, and action slots are
capped at 3 with extra speed turned into initiative.

## What was implemented
- Copied from `chimera-reels` (3D toon art, attack effects, title screen,
  saving, fullscreen, responsive layout, parts, rarity, Souls, viewer,
  battle log, tower run), with its own save key
  (`chimera-reels-prep:save:v1`), version counter and hub entry.
- Prep: the 3x3 grid, rows read as actions (Move > Target + Mutator).
  One free spin per round, paid re-spins (10 gold, +10 each, reset per
  round). Tap rows to queue them. Fight stashes the unqueued rows' tiles.
- Nudge (replaces Hold): arrows above each reel shift it one row up or
  down for 5 gold (`prep.nudgeCost`), with a short slide. Keyboard Q/W/E
  down, A/S/D up. Queued rows stay queued while valid.
- Action slots capped at 3 (`clash.maxSlots` was 4). Each slot past the
  cap gives 0.5 gap of initiative and 1 free nudge per round
  (`clash.overflowInitiative`, `clash.overflowNudges`). Skyreave
  (Tailwind) gets this every round.
- Stash roles: move tiles charge supers (unchanged). Target burns are
  Sabotage: 20/40/65% of the part's max HP (`combat.sabotagePct`) to the
  part only, shields soak first; Body tiles keep the old 1/2/3 HP chip.
  Quick burns give initiative (0.5/1/2 gaps). Power+ burns boost the
  first action this round (+25/50/80%, `combat.powerBurnBonus`). Shield
  burns unchanged. Stash badges show the outcome (-N, BRK, +25%, 1st).
- Clash order badges on your rows and the enemy's chips (both sides
  counted), from the same timeline rules the clash uses.
- Enemy plan chips show the part behind each action and its HP, glow
  "BREAK IT" when your stash can break it, and show FIZZLES once broken.
  Plans keep the raw reel tiles, so actions whose part broke in prep
  still fizzle in the clash (was a latent bug).
- Battle log: sabotage, initiative and Power+ burns and boosted actions.
- Battle log layout fix (stacked entries on non-390x844 screens).
- `scripts/screenshot-chimera-reels-prep.mjs` now nudges instead of holds.

## Key technical decisions
- Separate prototype rather than a mode, so the original stays playable
  for comparison. If this loop wins, the 3D kit, combat rules and HUD
  compositing are good candidates for a shared package.
- `projectedOrder` computes the clash order from the queues, initiative
  and Quick mutators; the clash fires by the same rules, so the badges
  match what happens (except when a break changes the plan mid-clash).
- Sabotage never touches monster HP, so it cannot replace attacks as a
  damage source.

## Open questions
- Values new in this pass are first guesses, not owner-tuned: nudge 5
  gold, sabotage 20/40/65%, Power+ burn 25/50/80%, overflow 0.5 gap and
  1 free nudge. `clash.maxSlots` 4 -> 3 was the owner's decision.
- The passive "stashed target tiles reduce damage to your matching part"
  rule from `chimera-reels` (`combat.holdReducePerTile`) is still on. It
  overlaps the new "target = sabotage" role; keep or remove? BRIEF.md
  does not mention it.
- The enemy AI does not sabotage, nudge or use initiative burns yet; it
  only burns Shield when low. Should it fight back with sabotage?
- PvP: simultaneous hidden plans are the proposed model; not in scope.

## Known issues
- Balance untested: the strategy bots and balance sim are not ported to
  this variant. Test fights end in about 3 rounds.
- Popups for part damage can sit over the enemy panel's lower lines for
  a moment on short screens.
- Not tested on a real phone.

## Next proposed step
Owner plays the new prep loop and tunes the new values with `?debug=1`.
Decide on the passive target reduction and enemy sabotage, then port the
strategy bots to measure win rates per strategy.
