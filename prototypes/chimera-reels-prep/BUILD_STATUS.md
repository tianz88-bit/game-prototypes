## Current milestone
First playable of the "Spin, Plan, Clash" variant: a fight is rounds of a
no-timer prep phase and an automatic clash. Built as a separate prototype
next to `chimera-reels` for comparison.

## What was implemented
- Copied from `chimera-reels` (3D toon art, attack effects, title screen,
  saving, fullscreen, responsive layout, parts, rarity, Souls, viewer,
  battle log, tower run), with its own save key
  (`chimera-reels-prep:save:v1`), version counter and hub entry.
- Prep: the 3x3 grid, rows read as actions (Move > Target + Mutator).
  One free spin per round, paid re-spins (10 gold, +10 each, reset per
  round), hold any reel, tap rows to queue up to the monster's action
  slots (2, +1 for speed 1.25+, +1 Tailwind, + Quick burns, max 4).
  Damage previews on rows. Fight stashes the unqueued rows' tiles.
- Enemy plan shown during prep (action chips with damage on the player);
  enemy picks its highest-damage rows, one free re-roll on a poor board.
- Clash: both plans on a timeline (gap 1.6 s / speed), at least 0.75 s
  between actions, all existing combat rules. Actions whose move part
  broke before they fire FIZZLE. Quick pulls the side's later actions
  forward. Shield mutators shield when they fire.
- Stash burns in prep: target tiles chip the named part, Shield shields,
  Quick adds an action slot, others discard.
- Souls adjusted: Tailwind = +1 action slot, Hoarder = +1 stash slot and
  bigger weak-spot supers.
- `scripts/screenshot-chimera-reels-prep.mjs`: plays a full fight with
  real taps (queue, hold, re-spin, Fight) then auto rounds, result and log.
- Battle log fix (owner bug report, stacked entries): on screens other
  than 390x844 the log was split across the three HUD bands and the bands
  overlapped. The log now shows the whole HUD as one uniformly fitted
  image, and taps map through the same fit. Quick log lines now read
  "+N action slot" for burns.

## Key technical decisions
- Separate prototype rather than a mode, so the original stays playable
  for comparison. The code is a copy; if this loop wins, the shared parts
  (3D kit, combat rules, HUD compositing) are good candidates for a shared
  package.
- The sim keeps all `chimera-reels` rules and replaces only the turn
  structure (rounds, plans, timeline). Enemy AI is off during headless sims
  as before.

## Open questions
- All four structural choices came from Claude's recommendations,
  confirmed by the owner: rounds per fight, rows only, full enemy plan,
  gold-priced re-spins.
- Arena aim highlight (cyan outline) is not shown in prep yet.
- Owner feedback after first play, under discussion (not built): Hold
  feels pointless, stash needs utility and counterplay rather than more
  damage, fast monsters get more slots than the 3 rows can fill, and
  whether PvP stays possible. BRIEF.md will need updating once decided.

## Known issues
- Action slots can exceed 3 (speed + Tailwind + Quick burns, max 4)
  while the grid has only 3 rows, so extra slots are unusable.
- Balance is untested first-pass: test fights end in about 3 rounds and
  9 seconds of clash; the strategy bots and balance sim have not been
  ported to this variant.
- Not tested on a real phone.

## Next proposed step
Owner plays both versions and compares feel. If this loop wins, port the
strategy bots, tune slots, spin costs and clash pacing, and decide whether
to retire the real-time version.
