# Wow! Reel Chimeras! Prep (Spin, Plan, Clash)

Folder and code name: `chimera-reels-prep`. A variant of `chimera-reels`
that tests a different core loop. The original stays live so both can be
compared.

## Why this variant exists

Owner playtest: the real-time loop felt random despite the agency, with
too much happening on screen. Reference: Slotbound (Korean slot-machine
auto-battler, 2026) puts the slot in a calm preparation phase and lets the
fight play out automatically. This variant moves all decisions into a
preparation phase with no timer, shows the enemy's plan before the player
commits, and makes the fight a short automatic clash to watch.

## Core loop

Same run as `chimera-reels`: title, starter select (3 starters plus
Random), entry bet per floor, fight, payout, part drop, level-up tile,
game over when gold cannot cover the bet or the monster is lost.

A fight is a series of **rounds**. Each round:

1. **Prep** (no timer): spin, nudge, choose actions, burn stash tiles,
   see the enemy plan.
2. **Clash** (automatic, about 6 to 10 seconds): both monsters perform
   their queued actions in speed order with full 3D effects. No input
   except Yield.

The fight ends when a monster's HP reaches 0. Yield is available in prep.

## Prep

- **The grid.** The three reels (Move, Target, Mutator) form a 3x3 grid.
  Each **row** reads as one action: "Bite > Head + Power+". Only rows
  count (no columns or diagonals).
- **Spins.** Each round starts with one free spin. Re-spinning costs
  gold from the run, rising with each extra spin in the round and
  resetting next round (`tune.json`).
- **Nudge** (replaces Hold, owner decision after the first playtest).
  Arrows above each reel shift that reel one row up or down for a small
  gold price (`prep.nudgeCost`). The player can see the tiles one row
  away, so a nudge is a planned fix, not a gamble. Queued rows stay
  queued while still valid.
- **Choose actions.** The player picks which rows go into the queue, up
  to the monster's action slots this round: 2, +1 for fast monsters,
  +Soul, capped at 3 (one per row). Each slot past the cap becomes
  initiative (half an action gap) and one free nudge per round. Rows
  without a move or a target cannot be queued.
- **Stash.** On Fight, the tiles of rows that were not queued go into
  the stash: type slots with stacks of 3, as in the pocket of
  `chimera-reels`. A queued action consumes stashed duplicates of its
  move, target and mutator for power-ups (1, 2, 3 move duplicates; 3 is
  the super).
- **Stash roles** (owner decision): each tile type has one job.

  | Stash tile | Role |
  |---|---|
  | Move | Charge: stacks power up that move when queued; 3 = super |
  | Target | Sabotage: burn to damage that enemy part by 20% / 40% / 65% of its max HP (1, 2, 3 tiles). Part HP only, never the monster's HP; shields soak it first. Breaking the part makes every enemy action from it fizzle. Body tiles cannot break anything and chip 1 / 2 / 3 HP instead |
  | Quick | Initiative: burn to act sooner this round (half, one, two action gaps) |
  | Shield | Burn to shield now |
  | Power+ | Burn to boost this round's first action (+25% / 50% / 80%) |

  Burning happens in prep only (tap a stack). Moves are not burned for
  effect; burning them only frees space.
- **Clash order** is shown in prep: every queued action, yours and the
  enemy's, carries its place in the clash (1, 2, 3...).
- **Enemy plan.** The enemy spins and queues its actions at the start of
  prep, and the plan is shown with each action's target, damage on the
  player, clash order and the part its move comes from (with that part's
  HP). When the player's stash can break that part, the action is
  highlighted ("BREAK IT"); once the part breaks it shows FIZZLES. The
  player commits knowing all of it. (Shown against the AI only; a PvP
  mode would hide it, see Out of scope.)

## Clash

- Actions from both sides are ordered on a timeline by speed: a monster
  acts every `actionGap / speed` seconds, the faster side first on ties.
- Each action resolves with the same rules as `chimera-reels`: damage
  types, armour, weak spot, shields (also protecting parts), part breaks,
  knock-out of a stashed move tile when damage reaches HP.
- **Fizzle.** If the part that supplied an action's move tile has broken
  before the action fires, the action fizzles. This is the main
  counterplay: break the part behind their big queued attack first.
- A Quick mutator makes the monster's next action come sooner (50%,
  100%, 200% of a gap for 1, 2, 3 stacked Quicks).
- Shield mutators grant shield when the action fires.

## Souls (adjusted for rounds)

| Soul | Species | Ability |
|---|---|---|
| Tailwind | Skyreave | Extra speed every round: past the 3-slot cap it becomes initiative and a free nudge |
| Hoarder | Tuskrel | One extra stash type slot; supers on a weak spot hit harder |
| Stoneheart | Bulwark | Starts each fight shielded, bigger shield cap |
| Adaptive | Random roll | Small attack, defence and speed boost |
| Wild | Enemies | Nothing |

## Strategies

- **Rush:** fill every round with actions, Quick for tempo.
- **Charge:** queue few actions, stash duplicates, land a super later.
- **Utility:** read the enemy plan, sabotage the part behind its big
  attack so it fizzles, use Quick to act first, keep a shield up.

## Screen

- **Prep:** enemy panel on top with the enemy plan (up to 3 action chips)
  and its stash; 3D arena in the middle; player panel with the 3x3 grid
  (rows selectable, nudge arrows above each reel), stash, and two
  buttons: Spin (shows the price and the nudge price) and Fight.
- **Clash:** the grid is replaced by the player's queued actions; both
  plans light up as each action fires. Nothing else moves on the HUD.

Everything else (3D toon art, attack effects, title screen, saving,
fullscreen, responsive layout, parts, rarity, Souls, parts viewer, battle
log) carries over from `chimera-reels`.

## Stack

Same as `chimera-reels`: Three.js 0.187.0, TypeScript, Vite, Tweakpane,
Playwright. Hosting: GitHub Pages via `.github/workflows/deploy.yml`.

## Out of scope

PvP (possible later as simultaneous hidden plans, not built), 3v3, breeding, economy beyond the run, status effects, more damage
types, counter-triangle parts, final art, music. Balance is first-pass.

## Success test

Losing feels like a plan that did not work rather than bad luck, and the
clash is fun to watch.
