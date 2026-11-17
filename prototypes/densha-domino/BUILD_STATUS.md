## Current milestone

Scope step 1: core rules, 10 levels and the feel pass (including the horn and
spook animation). Ready to playtest. Not yet tried on a real phone. Solver and
generator (step 2), economy, ads and retention are not built.

## What was implemented

- Station yard board (5x5 up to 7x8) with drawn rails along every line a train
  uses, ties, green exit arrows where open rails reach the edge, and unmovable
  concrete, kiosk, signal, tree, vending machine and buffer stop.
- Trains of 1 to 5 cars in ten generic liveries, drawn as pastel pillow cars with
  couplers and headlights at both ends.
- Rules (`src/game/rules.ts`): a train runs along its track either way until it
  leaves the board or stops. Convoy rule: if it stops head to tail against a
  train on the same line that can move the same way, that train takes off first
  and the tapped train follows. A bump on a train's side sets it off too, running
  along its own track away from the bump. Par is the fewest taps; stars: 3 at par, 2 within par + 2, else 1; limit par + 4.
- Input: tap a train (runs if one way is open, two arrow buttons if both are),
  or swipe along its track. Keyboard: arrows move a cursor or pick a direction,
  Space taps, R restarts. Holding a finger down during a chain speeds it up.
- Animation: trains accelerate and brake with a squash. At each hit the runner
  blows a two-note horn with expanding sound rings and puffs; the hit train is
  startled (stretches, narrows, shears car by car, tilts, shakes, "!" pops) and
  then springs away while the first train follows. Beats overlap and compress
  with each link (85% per link, floor 50%). Exits chime; chains of 3 or more get
  a banner, shake and punch zoom. All timings and amounts are in tune.json and
  the `?debug=1` panel.
- Solver (`src/game/solver.ts`, breadth-first over states): every level is proved
  solvable and par is computed at level load (at most 15 ms on the biggest level).
  `node scripts/check-densha-levels.mjs` lists all levels with par and longest
  chain. Levels 1 and 2 are hand-made teaching boards; levels 3 to 10 were found
  by a search and verified by the solver.
- Save (`densha-domino:save:v1`): current level and best stars, on every change.
- Playwright (`scripts/screenshot-densha-domino.mjs`): plays all 10 levels with
  real swipes using optimal moves from the solver, clears each in exactly par
  taps, checks the save across a reload, and fails on console errors. Frames from
  a slowed-down run confirmed the horn, spook pose and follow.

## Key technical decisions

- Convoy rule instead of the originally proposed "hit train leaves, tapped train
  stays": with the latter every solvable level has par equal to the train count
  (checked over thousands of random boards), so chains could never save a tap. This
  is a change to what I told the user; it is in BRIEF.md under open questions.
- Skew is faked (Phaser 3 has no skew on Container): per-car sideways offsets,
  stretch and tilt.
- Uses `dig-kit` pinned to 0.1.0 (pillow baking, sounds, button, intent bus, tune
  panel). The folder was renamed from `chain-slide` to `densha-domino`.
- Worked on branch `ccr-1e26354f-01jcy9`, restarted from `main` after PR #388.

## Open questions

- Is the convoy rule what the user wants? Is the tap-or-swipe input clear?
- Level 3 to 10 are search-found under the current rules and may need hand polish for
  teaching order. They were re-searched after side bumps started to chain, because
  the stronger cascades had made the earlier set too easy (par fell to about a third
  of the train count).
- Is the side-bump direction rule (away from the bump) readable?
- BRIEF.md was drafted from a discussion and may need updating after playtest.

## Known issues

- Fixed in this session: trains moving by themselves at the start of a round. Cause: the
  press on the "Next level" button also counted as a tap on the board and ran the
  train under it; presses on buttons are now ignored by the board. Scheduled animation
  from the previous round is also cancelled when a level starts. Checked with Next
  after a win and with Restart in the middle of a chain.

- Frame rate was not measured on a phone, only in a software-rendered test browser.
- No undo, hints, coins, ads, daily reward or flow director yet (later steps).
- Only 10 levels until the generator (step 2).

## Next proposed step

Playtest, adjust the rules and timings from feel, then build step 2: a backwards
generator and difficulty score for endless levels.
