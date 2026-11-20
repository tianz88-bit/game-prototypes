# Tighter levels and a clearer tutorial (20 November 2026, owner decisions)

Tutorial, one concept per level: 1 swipe, 2 honk, 3 head facing (a honked train always drives the way its face points), 4 Mind the Gap (a honked train needs a gap in front of its face; open one first), 5 Double Departure (two chains, the first opens a gap for the second). Captions follow the board: after a wrong move on levels 4 and 5 they explain what went wrong and suggest Restart, with the highlight hidden. Level 6 is Kyoto Crossing, rebuilt: 9 trains, par 4, two setup moves, a 3-train chain, then the original six-train finale.

Swiping a train straight into another train (no gap) shows a short "No room!" pop and a shake, and does not count as a move.

Levels 6 to 101 must have at least two chain moves and more trains than the move limit (par + limitSlack), so clearing trains one at a time always runs out of moves. Levels 7 to 101 are generated (scripts/build-densha-pack.mjs, rules in src/game/quality.ts): one clever line (at most two optimal first moves), no dead pieces (every train takes part in a bump; every prop is load-bearing, the rest are removed), a trap (greedy play needs at least two extra moves), denser boards (at least 36% train cells, at most one unused row or column), a big finale (the last move is the biggest chain and sends off at least 40% of the trains), and a smooth ramp (ordered by a difficulty score). Props never touch, sit away from corners and use one block type plus one accent per board. The old hand levels 7 to 11 were replaced. Par stays between 4 and 6; difficulty rises through traps and fewer correct openings rather than longer puzzles.

# Full-screen layout (20 November 2026, owner request)

The game fills the whole screen on every shape, with no letterbox bars, and adapts instead of blocking. The 390x844 design grows in one direction to match the screen: wider on unfolded foldables, tablets and desktop (the board grows, height-limited, with clear room under the HUD stars and a caption gap on tutorial levels), taller on tall narrow cover screens (the board keeps its phone size and the tunnels get longer). Dialogs, the title and result panels stay in a centred 390x844 column. Folding, unfolding or rotating rebuilds the game at the new size and keeps the level, board and moves. On touch devices that support it, tapping Play asks for real fullscreen; iPhone Safari does not support this and plays in the page. Safe areas (notches, camera cutouts) are respected.

Framing update (owner): the screen frames the board, not the tunnels. Serving tunnels reach at most 1.6 cells past the board and fade out there (trains are already clipped at the board edge). The HUD (title, moves, stars, any tutorial caption) sits just above the board, and that HUD-plus-board block is centred in the space below the Menu and Restart corner buttons, which stay in the top corners.

# Simplified train facing (19 November 2026, owner decision)

Supersedes the head/tail face and light descriptions below. Only the head end has a face and a socket light. The tail end has no face and no light; its art is replaced by the art owner. The forward cone of floor light is removed. The animated wave light inside the head socket stays: it flashes while a honk could send the train forward, glows solid while it runs forward, and is off when its way forward is blocked or while it is manually reversed. The rule is unchanged: a honked train only drives forward, toward its face, and stays put if that way is blocked; manual swipes may still go either way. The tutorial says "Honked trains drive forward, toward their face."

# Approved art and motion polish (19 November 2026)

The owner approved DESIGN_REVIEW.md and publication. Pillars are now decorative blockers on existing concrete cells, with a full-tile solid base and faded upper shaft; outside-board ghost columns are removed. Recessed dead ends receive flush ivory/plum stop caps only at existing obstacle boundaries. Train silhouettes use a cached warm-plum outer contour, plates are 15% larger and food 20% larger. Food remains plate-anchored, with its own 480 ms spring and the existing 100 ms per-car delay; the short body reaction and end-of-move reset do not truncate it. Award stars use a staged Quad arrival to one controlled overshoot and settle, ascending landing chimes, and a third-star hold before confetti. Unearned slots stay still. Buttons and panels use short controlled motion. These supersede the older elastic-reward and background-pillar descriptions below. Rules, train head preference, saves, levels, tunnels and travelSpeed=0.67 are unchanged.

# Kaiten Express (formerly Densha Domino)

Owner decision (19 November 2026): the game is named Kaiten Express (回転 = revolving, as in kaiten-zushi, conveyor-belt sushi). The logo and any kanji are made by the art owner, as image art. Folder names, save keys (`densha-domino:save:v2`) and code names keep the old name on purpose so no progress is lost. Name conflict checks (App Store, Google Play, Meta Instant Games, trademark) are still open.

Latest review (19 November): the active sushi deployment is `/game-prototypes/prototypes/densha-domino-sushi/`, with Claude retained at its original path and on its backup branch. The owner clarified that replacement pillars must be decorative blockers on existing blocked board cells. Pillar/end-cap art, train-outline direction, larger plates/food and revised food/reward motion are proposed in `DESIGN_REVIEW.md`; those visual changes are pending discussion and are not part of the hosting migration.

## Approved sushi-train integration (18 November 2026)

The restaurant art direction supersedes the railway placeholders below: dimensional sushi on plates, complete peach/lilac/mint/butter head/middle/tail/single cars, a high overhead camera with visible side volume, two expressive windshield eyes per cab, simple recessed guide channels, restaurant obstacles and off-white serving tunnels. Bodies remain grounded and carriage reactions cascade; food stays seated and only springs at braking/startup. Honking uses cream-rimmed coral/mango tapered rays and a soft sound arc, never black collision marks, damage or a megaphone.

The board plane is flat top-down. All four tunnel views come from the original plastic-tunnel-atlas.png set, with matching shell, seams, highlights and proportions; the later generated L-shaped arch is not used. North and south tunnels run vertically at constant width, without receding taper. The north tunnel shows its entrance at its bottom edge facing the board; the south tunnel shows only its closed cover because the entrance is out of view. Their bodies fade toward the screen edge. East/west tunnels retain the corresponding side views of that same set, with registered rear/foreground halves for train occlusion.

Each train has a permanent `headDir`, visibly marked by an integrated teal stripe on the rounded head cab; the flatter tail is unstriped. This identity never changes when reversing. Resting and able to depart toward the head: flashing head band. Resting with that end blocked: no emitted light. Moving: solid band at the actual travel end, including the tail during manual reverse. Stopping restores the fixed head preference.

All chain signals, at ends or sides, request departure toward the receiver's fixed head. A blocked head refuses the signal; it never automatically reverses. Manual swipes still choose either legal direction. A tap with one legal direction moves immediately; with two it selects the train for a swipe or keyboard direction, without ground arrows. Following, obstacles and exits otherwise retain their existing rules. The tutorial, solver, generator and serialized head metadata use this same rule. Progress for this changed puzzle contract uses `densha-domino:save:v2`; the previous save remains untouched.

The floor uses warm cream tiles with sparse, deterministic, slightly off-colour tiles and peach grout, without a checker pattern. Guide channels are blue-grey merged recesses, distinct from green trains, with shading inside the cutout and clean crossings. Restaurant props preserve their artwork's aspect ratios. Chopsticks, saucers and wall/pillar details stay outside legal cells and clear of tunnel covers. Text uses a 2x backing store even on a 1x display, with smooth, unoutlined type. Tutorial focus has an opaque white/plum border and a subdued surrounding board; it remains non-blocking.

Grounding and readability corrections (19 November): channel ends are square and flush with cell/board edges, including tunnel entrances. Fixed obstacles interrupt channels; disconnected pockets beyond blocks have no decorative track or exit. Both north and south covers occlude entering carriages in the foreground; the shared clip plane stays concealed under the opaque tunnel art. Side-view train bodies, their couplings and honk origin are raised together; their plates and seated sushi sit slightly higher again. Latest pillar direction supersedes the earlier corner-accent size: a full-floor-tile footprint and tall shaft fading out at its top to suggest height. Registered socket emission is cool cyan/white with a travelling highlight and resting pulse at the existing lightFlashMs cadence; moving light stays solid underneath the highlight, and blocked light remains off. Socket effects use normal batched sprites rather than per-cab shader flushes. One shared train-layer clip replaces individual stencils, static tunnel roof details are baked, and the original set's side views are split into registered rear/foreground layers. An exited train continues at full size underneath the cover until every carriage's complete bounds, including food and lights, are offscreen; only then is its display root destroyed.

Feedback and pace: buttons spring on appearance and press; menus bounce into place. Award stars arrive with staggered elastic bounce and glints; only three-star awards launch a bounded, short-lived confetti burst above the result card. Travel speed is communicated as a multiplier and as cells per second over a specified distance/link: travelSpeed=0.67 means 33% slower than the previous glide, with 1/0.67 times its duration. First-link three-cell travel changes from 305 ms to about 455 ms; honk/acknowledgement cadence and chain compression remain separately tuned. Rendering targets 60 fps independently of this deliberate movement slowdown; debug mode exposes live renderer fps. Parked geometry is cached, readiness checks occur only when visual grid occupancy changes, and floor/grout vectors are baked once per level at 2x. Performance reports compare an empty browser tab with game pacing and record game CPU time separately, rather than attributing a browser scheduling limit to rendering cost.

The reviewed eyelid paths and clipped pupils are retained, including phased acknowledgement. Emissive bands are registered to the actual diffuser pixels in each cab frame; freehand overlay curves cannot substitute for socket alignment. Each carriage independently plays queued reactions, grounded affine shear and squash/stretch. Food remains seated on its plate through startup and braking.

All 100 boards carry exact-par and optimal-chain proof contracts. The recovery audit identified 19 boards whose par or chain structure changed under fixed heads. Most were repaired through head assignments; levels 8, 49 and 88 were rebuilt under the new rule while retaining their original par and chain targets. Level 5's pink horizontal train E prefers right, initially blocked; two setup moves restore its route, followed by a six-train chain in three taps total. New generated boards serialize `head` and an optimal-chain quality proof with their rows/axes. The builder rejects approximate par or an unproven climax. Approved bitmap sheets enter the existing R2/loose-art pipeline; local integration may prepare the approved source sheets without uploading. Missing art remains playable.

Replaces the earlier slide-and-match idea. Densha is Japanese for an electric train.

A casual, level-based puzzle game for a general audience aged 13 and up. The board
is a Japanese-style station yard full of colored trains on tracks. Tap a train and
it runs along its track as far as it can. If it stops against another train, that
train takes off too, and so on, like dominoes. Send every train off the screen,
within par taps. Endless levels, each generated by a program and verified
solvable by a solver. Free to play with opt-in rewarded ads. Mobile-first,
portrait, one-thumb play, and it adapts to any screen shape (never a "rotate your
phone" wall).

Built on the repo stack (Phaser 3, TypeScript, Vite) and `packages/dig-kit`
(pinned exact version) for the pillow look, sounds, buttons, intent bus and tune
panel.

## The hook (what a 5-second video shows)

One tap sets off a train. It slams to a stop against the next one, which pulls away
and bumps the next, and a whole line of trains rolls off the screen one after
another. It reads instantly and needs no text. The player is never told "luck":
every level can be solved with the visible information.

## Core loop

1. A level shows a station yard: a grid with track lines, trains on them, and fixed
   obstacles. The tracks are drawn on the board, so legal moves are visible.
2. The player taps a train (see Input). It runs along its track.
3. Any train it stops against may take off (chain reaction).
4. Win by sending every train off the screen within the tap limit. Stars come from
   how close the player is to par.
5. A Levels button opens a grid of all levels with the stars earned; tap one to play
   it. In the prototype every level is open (`rules.unlockAll` in tune.json); set it to
   0 to unlock levels in order, by clearing the one before.
6. Next level, forever. If the player runs out of taps, retry (or continue with a
   rewarded ad, see Ads).

## Rules (deterministic, no randomness)

- **Board:** grid from 5x5 up to 9x9. Cells are empty, concrete, station decor
  (platform edge, kiosk, signal mast, vending machine, tree; all unmovable
  and drawn differently but they behave like concrete), track, or train.
- **Tracks:** straight lines along a row or column. A train only moves along its
  own track. Where a track meets the board edge with an open end, a train can
  leave the board there (an exit). Where a track ends in a buffer stop, the train
  stops there. Tracks can cross; a crossing cell can hold a train for another
  track to be blocked by it. That is the unblock part of the puzzle.
- **Trains:** different lengths, from 1 to 5 cells (a single railcar up to a long
  express), one color each (the liveries are for looks and for telling trains apart;
  they do not change the rules). A train sits on one track. Length is part of the
  puzzle: long trains need long free runs and block more of the yard. Early levels
  use short trains (1 to 2 cells) and longer ones come in with difficulty. The
  maximum length per level range is in tune.json.
- **Moving:** tapping a train that has free cells along its track makes it run
  all the way along the track in one direction until it leaves the board through
  an exit or stops (blocked by concrete, decor, a buffer stop, or another train).
  A train with no free cell in either direction cannot be moved and a tap costs
  nothing.
- **Direction:** a train can run either way along its track. If only one way has
  free cells, a tap runs it that way. If both ways are open, a swipe along the
  track picks the direction (a tap shows two arrows to pick from).
- **Chain reaction:** when a running train stops against another train, the horn
  blows and that train takes off. After a bump, each train tries again: once the
  train it hit has gone, the bumping train follows if its way is now clear. A train
  with no free cell in either direction cannot be tapped.
  - Hit at its end (head to tail, same line): the hit train runs on in the same
    direction. When it has gone, the first train follows behind it and carries on,
    so one tap can send a whole line out: the last train clears the exit while the
    rest follow.
  - Hit on its side (crossing track): the hit train is set off too and runs along
    its own track, away from the bump. A bump near its low end sends it toward the
    high end and the other way round. If only one way is open it takes that. A
    dead-centre bump goes whichever way has more room (the way off the board counts
    most), then the positive way. If neither way is open it just takes the bump.
    Then the bumping train tries again: if the hit train has cleared its path it
    carries on, otherwise it stays where it stopped.
  - Rule switch: `rules.followAfterSide` in tune.json. 1 (current) lets the bumping
    train follow after a side bump; 0 makes it stay put. Par is solved under the
    chosen rule when a level loads. The level set is searched for the current rule,
    so under the other setting some levels play differently.
  Why followers at all: with "hit train leaves, the first one stays", every solvable
  level has par equal to the number of trains (checked on thousands of random
  boards), so par and chains would mean nothing. With followers a chain saves taps,
  and par becomes the puzzle.
- **Winning:** no trains left on the board. Stars: 3 if taps used is at or under
  par (the solver's minimum), 2 if within par + 2, else 1.
- **Tap limit:** par + slack, with slack shrinking at higher difficulty.

## Levels and difficulty

- Levels are generated from a seed and a difficulty target. The generator builds
  a station backwards: it starts with an empty yard and adds trains one at a time
  so that the finished board is solvable by construction, then adds obstacles and
  decoys. A solver (breadth-first search over board states) then proves
  solvability and returns par, the number of solutions and how many taps are dead
  ends. Levels that fail are discarded. Nothing unsolvable ever ships.
- Difficulty is a score from the solver: par, branching, dead-end share, grid
  size, train count, track crossings. A curve raises it over levels with a
  breather (easier) about every 5th level and a spike every 10th.
- An LLM is used offline or at build time for flavor (station names, theme
  ideas, tuning suggestions), not to design boards.

## Flow director (adaptive difficulty, fair)

A rolling estimate of player skill from recent results (wins, retries, stars, taps
over par). To pick the next level the game generates several candidates and
chooses the one closest to a target difficulty: slightly easier after repeated
failures, slightly harder after easy wins, with the usual tension-then-relief
rhythm. Rules that never change:

- Every level is solvable, shown honestly, and plays the same every time. No
  hidden luck, no changing a level mid-play, no fake near misses.
- The director only chooses which solvable level comes next, within bounds, so
  progression still feels like it is getting harder.
- All director values live in tune.json.

## Retention (non-manipulative)

- Daily reward and a soft streak (a missed day pauses it instead of wiping it).
- A chest every few levels, a train collection (each new livery or train type is a
  collectible), level milestones.
- Short sessions: levels take about 30 to 90 seconds.
- Local only: no accounts, no backend. Save to `localStorage` (key
  `densha-domino:save:v1`), on every state change.

## Ads (rewarded and opt-in only in v1)

- All ads are opt-in and labeled, behind one `AdProvider` interface. The prototype
  ships a mock provider (a fake 3 second "ad" screen). A real ad SDK or mobile
  wrapper is a new dependency and needs your approval first.
- Placements: +3 taps when you run out with at most 3 trains left (a real near
  miss), a hint (shows the first tap of a solution), undo, double coins on the
  level reward, and the daily bonus.
- No ads in the first 5 levels. A frequency cap per session. Never required to
  progress. No interstitials in v1.
- Audience 13 and up. If under-13 players are ever intended, the ad setup changes.

## Economy

Coins from levels and chests buy hints and undos. Cosmetic train liveries are a
later idea. No real-money purchases in v1.

## Look and feel

Saturated pastel pillow trains (reuse dig-kit) on a bright station yard with drawn
tracks, ties, platform edges and little decor. Generic Japanese-style commuter and
express trains, with no real line branding or logos. Juice: a squash on tap, trains
accelerate and brake, a rising pitch per chain link, a station chime on each train
that exits, "CHAIN x4" text, screen shake on big chains, a level-complete burst.
Sounds are synthesised placeholders. Placeholder-first: no external art, since you
provide the artwork later.

## Character animation (horn and spook)

Trains get personality from one short beat at every hit, built to stay snappy:

1. **Horn.** When a running train stops against another train, it brakes with a
   small squash and blows its horn: a short "toot" sound and an animated burst
   (a few rounded sound rings and puffs from the front). About 120 ms.
2. **Spook.** The train that was hit is startled. Its whole length skews and
   stretches (a long train ripples car by car), sideways and up, with a little shake and a "!" pop above it, as anticipation
   before it takes off. About 120 ms, then it springs forward with a quick
   stretch that settles to normal as it speeds up.
3. **Go.** The spooked train runs, and the same beat repeats at the next hit.

Not draggy, by rules:

- The beat overlaps: the horn and the spook start together, so one chain link
  adds about 150 to 200 ms, not 250.
- Long chains compress. Link k plays faster than link k-1 (for example 85% of the
  previous beat, down to a floor), so a chain of 8 does not feel 8 times longer.
- A tap during a chain never waits: input stays live, and extra taps queue or
  are ignored cleanly. A "skip animation" speed-up is available if the player
  holds a finger down during a chain.
- Everything is tunable in tune.json and the `?debug=1` panel: horn time, spook
  time, skew and stretch amounts, shake, ring count, pitch step, the chain
  compression factor and its floor. The rules and the solver ignore all of it:
  the animation is only presentation and never changes the result.

## Input

Tap a train; swipe along the track to pick a direction when both are open. Keyboard:
arrows move a cursor, Space taps. All input goes through the intent layer (tapTrain,
undo, hint, pause). Never blocks the player: the layout adapts to any screen shape.

## Tuning

Feel, pacing and difficulty values live in `tune.json` and the `?debug=1`
Tweakpane panel with a copy-JSON button: train speed and acceleration, horn and
spook timing, skew and stretch, chain compression, pitch step, shake, tap slack, difficulty curve, breather and spike
spacing, director bounds, ad caps.

## Scope order

1. Core rules, about 10 hand-made levels, and the feel pass. Playtest.
2. Solver and backwards generator, endless levels, difficulty score and curve.
   Playtest.
3. Coins, hints, undo, stars, and the flow director.
4. Mock rewarded ads and the placements above.
5. Daily reward, streak, chests, train collection, world backgrounds.

## Out of scope for now

Real ad SDK and store builds, interstitial ads, real-money purchases, accounts,
backend or analytics service, social features, multiplayer, level editor, curved
tracks, real railway branding.

## Success test

A player who just cleared a level wants to tap into the next one. A short video of
one big chain makes someone want to try it. The first 10 levels teach the whole game
with no text.

## Open questions

- Convoy rule (the tapped train follows the hit train out) versus the stricter
  "hit train leaves and the first one stays". Built the convoy rule because the
  strict one makes par meaningless. Confirm it feels right.
- Side bumps set the hit train off, running away from the bump. Is that direction
  rule readable, or should the player pick?
- Either-way direction input: tap when one way is open, swipe or two arrows when
  both are open. Clear enough on a phone?
- Hosting for the client (itch.io, GitHub Pages or Cloudflare): the owner picks per
  prototype, decide before the first deploy.
- Which real ad SDK or wrapper to use later.
