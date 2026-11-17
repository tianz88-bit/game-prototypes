# Chain Slide (working title, DRAFT awaiting approval)

A casual, level-based puzzle game for a general audience aged 13 and up. Slide
colored blocks so they push each other along like a chain, and clear them by
getting three or more of the same color to touch. Endless levels, each generated
by a program and verified solvable by a solver. Free to play with opt-in rewarded
ads. Mobile-first, portrait, one-thumb play.

Built on the repo stack (Phaser 3, TypeScript, Vite) and `packages/dig-kit`
(pinned exact version) for the pillow-block look, sounds, buttons, intent bus and
tune panel.

## The hook (what a 5-second video shows)

Swipe one block and a whole line of blocks slides with it. When same-colored
blocks touch they pop, and the blocks behind them keep sliding and may pop more.
One swipe can clear a big chain. The player is never told "luck": every level can
be solved, and the best moves are visible to a thoughtful player.

## Core loop

1. A level shows a small grid with colored blocks and a few fixed walls.
2. The player swipes a block in a direction. See "Move rules".
3. Groups of 3 or more same-colored touching blocks clear, with a chain.
4. Clear every block within the move limit to win and earn coins and stars.
5. Next level, forever. Fail: out of moves, retry (or optionally continue with a
   rewarded ad, see Ads).

## Move rules (deterministic, no randomness)

- Grid from 4x4 up to 8x8. Cells are empty, a wall, or a colored block.
- Swiping a block pushes it and every block directly in front of it in that
  direction as one train. The train moves until its front block meets a wall or
  the edge. A train that cannot move at all makes no move and costs nothing.
- After a move, any group of 3 or more same-colored blocks that touch along edges
  clears. Blocks that were behind a cleared block keep sliding in the move
  direction until stopped (momentum). If that creates new groups, they clear too.
  Each step is one chain link.
- Winning: no blocks left. Stars: 3 if moves used is at or under par (the
  solver's minimum), 2 if within par + 2, else 1.
- Move limit: par + slack, where slack shrinks as levels get harder.
- Later ideas, not in v1: ice blocks (need two clears), one-way gates, bombs.

## Levels and difficulty

- Levels are generated from a seed and a difficulty target by a generator
  (random layouts with a color count that allows clears), then checked by a
  solver (breadth-first search over board states) that proves solvability and
  returns par, the number of solutions, and how many dead ends there are.
  Levels that fail the checks are discarded. Nothing unsolvable ever ships.
- Difficulty is a score from the solver: par, branching, share of dead-end moves,
  grid size, color count. A curve raises it over levels, with a breather level
  (easier) about every 5th level and a spike level every 10th.
- An LLM is used offline or at build time for flavor (level names, themes, tuning
  suggestions), not to design boards. Boards come from the generator and solver.

## Flow director (adaptive difficulty, fair)

The game keeps a rolling estimate of player skill from recent results (wins,
retries, stars, moves over par). To pick the next level it generates several
candidates and chooses the one closest to a target difficulty: slightly easier
after repeated failures, slightly harder after easy wins, with the usual
tension-then-relief rhythm. Rules that never change:

- Every level is solvable, shown honestly, and plays the same every time. There is
  no hidden luck, no changing a level mid-play, and no fake near misses.
- The director only chooses which solvable level comes next. Its target range is
  bounded so progression still feels like it is getting harder.
- All director values live in tune.json.

## Retention (non-manipulative)

- Daily reward and a soft streak (a missed day pauses it instead of wiping it).
- A chest every few levels, a star collection, level milestones.
- Short sessions: levels take about 30 to 90 seconds.
- Local only: no accounts, no backend. Save to `localStorage` (key
  `chain-slide:save:v1`), on every state change.

## Ads (rewarded and opt-in only in v1)

- All ads are opt-in and labeled, behind one `AdProvider` interface. The
  prototype ships a mock provider (a fake 3 second "ad" screen). A real ad SDK or
  mobile wrapper is a new dependency and needs your approval first.
- Placements: +3 moves when you run out with at most 3 blocks left (a real near
  miss), a hint (shows the first move of a solution), undo, double coins on the
  level reward, and the daily bonus.
- No ads in the first 5 levels. A frequency cap per session. Never required to
  progress. No interstitials in v1.
- Audience 13 and up. If under-13 players are ever intended, the ad setup changes.

## Economy

Coins from levels and chests buy hints and undos. Cosmetic block skins are a later
idea. No real-money purchases in v1.

## Look and feel

Saturated pastel pillow blocks (reuse dig-kit), rounded bevels, soft shadows,
bright backgrounds that change by world (every 25 levels). Juice: blocks stretch
as they slide, a pop and particles per clear, a rising pitch per chain link,
screen shake and punch zoom on big chains, "CHAIN x4" text, a happy level-complete
burst. Sounds are synthesised placeholders. Placeholder-first: no external art.

## Input

Drag or swipe on a block to move it. Also tap a block, then tap a direction arrow.
Keyboard: arrows move a cursor, Space selects. All input goes through the intent
layer (move, undo, hint, pause).

## Tuning

Feel, pacing and difficulty values live in `tune.json` and the `?debug=1`
Tweakpane panel with a copy-JSON button: slide and pop speeds, chain pitch, shake,
move slack, difficulty curve, breather and spike spacing, director bounds, ad
caps.

## Scope order

1. Core rules, a hand-made set of about 10 levels, and the feel pass. Playtest.
2. Solver and generator, endless levels, difficulty score and curve. Playtest.
3. Coins, hints, undo, stars, and the flow director.
4. Mock rewarded ads and the placements above.
5. Daily reward, streak, chests, world backgrounds.

## Out of scope for now

Real ad SDK and store builds, interstitial ads, real-money purchases, accounts,
backend or analytics service, social features, multiplayer, level editor.

## Success test

A player who has just cleared a level wants to swipe into the next one. A short
video of one big chain makes someone want to try it. The first 10 levels teach the
whole game with no text.

## Open questions

- Name. "Chain Slide" is a working title.
- Win condition: clear every block (proposed), or clear target colors only?
- Colors: 3 to 5 across the first 100 levels (proposed).
- Which real ad SDK or wrapper to use later (decide when we reach that step).
