## Current milestone
Scope steps 9 and 10 done: combat rebuilt around 3 reels (move, target,
mutator) with shields, pocket drops and damage preview; parts viewer,
random-roll starter, rarity with floor gating. Step 7 (3v3) still waits
on a design decision.

## What was implemented
- 3 reels x 3 rows. Move tiles from your parts, target tiles from the
  enemy's remaining parts (Head, Limbs, Legs, Aux, Body), mutators
  (Power+, Quick, Shield) from your parts. Headers WHAT / WHERE / HOW.
- Execute fires the middle row; pocketed duplicates power it up on all
  three reels (move tiers to a super; target and mutator bonuses capped).
  Execute button shows exact damage and target, burnable pocket tiles
  show their damage. Burns hit the current line target.
- Pocket stores the 6 non-line tiles (duplicates first) and skips the
  action. Held target tiles reduce damage on your matching part.
- Shields: Shield mutator grants shield points alongside the attack,
  stacks, capped at 50% max HP; parts scale it. Pale bar segment plus a
  3D bubble. Burning Shield tiles grants shield instantly.
- Hits: shield first, then HP. If damage reaches HP, 1 pocketed move tile
  from the hit part is knocked out. Part breaks drop that part's tiles,
  darken its reel tiles and the attacker's matching target tiles, and
  cancel a pending decision.
- Reels rebuild every spin from current parts. Move reel repeats your own
  moves instead of filler blanks; +1 blank per 2 of your broken parts.
  Target reel padded with Body; +1 blank per 2 enemy parts broken.
- Removed: off-line effects, passive ATK/DEF/SPD buffs, Guard and
  stances, Jam, Snatch, High/Low, fragility readout.
- Icons drawn in code for every tile (moves by damage type colour,
  targets as body-part symbols, mutators), with labels on the player's
  reels.
- Rarity: 1 rare and 1 epic placeholder part per slot (12 new parts,
  3 epic moves: Gore, Inferno, Quake; rare move Rend). Rare from floor 3,
  epic from floor 6, gating enemy parts, drops and level-up offers.
  Coloured borders on tiles and cards. Rarer parts reuse a common look
  at a larger size.
- Parts viewer on starter, prefight, loot and level-up screens: turning
  model, gold outline on the selected part, stats and tiles.
- 4th starter card "Random" rolls random common parts; tap again to
  re-roll.
- Pocket row shrinks its slots to fit any pocket size.

- Balance pass 1 (owner-approved): tier multipliers 1/1.8/2.7/4.5,
  target duplicate bonus +35%, stacked Quick 50% / 100% / 200% with
  carry-over into the following cooldown. Headless balance sim in
  `scripts/sim-chimera-balance.ts` (run `node scripts/sim-chimera-balance.mjs 200`).
  Floor 1 win rates (smart bot): Tuskrel 79%, Skyreave 47%, Bulwark 94%,
  Random 84%. Avg fights 21s to 55s.

- Post-battle combat log: every Execute and Burn from both sides with
  time, action and outcome, paged, plus a per-side summary. Opened from
  the result and game-over screens.

- Pocket auto-sorts by type (moves, targets, mutators; duplicates
  together) and tiles slide into place when the order changes.

- Pocket as 6 type slots with stacks of 3 (owner-approved); Pouch and
  Ember heart add a type slot instead of +2/+3 tiles. Stacks show a
  count badge and slide when re-sorted.
- Burning target tiles: 1/2/3 flat damage to the named enemy part,
  soaked by shields, knocks out a tile if it reaches HP.
- Aim readout: cyan outline on the aimed enemy part, part HP and outcome
  in the enemy panel, at-risk markers on enemy pocket stacks.
- Sim after these changes (F1, smart bot): Tuskrel 83%, Skyreave 47%,
  Bulwark 94%, Random 85%; supers about 0.07 per fight (up from 0.02).

## Key technical decisions
- `computeHit` is a pure function used both for previews and for
  resolution, so the shown damage always matches what lands.
- Reel tiles keep the index of the part that supplied them so breaks and
  knock-outs remove exactly that part's tiles.
- A tile darkened by a break counts as blank if it is on the line.

## Open questions
- "1 blank per 2 parts destroyed for move and target": implemented as
  own broken parts -> own move reel, enemy broken parts -> own target
  reel. BRIEF.md marks this as Claude's reading; confirm.
- Step 7 (3v3): where does Swap go with two combat buttons, and does it
  use the turn? BRIEF.md needs updating.
- Rare and epic parts are placeholders (names, stats, moves) to be
  redesigned by the owner.
- Items still marked (proposed) in BRIEF.md: Body padding on the target
  reel, pocket size 9, burn of Power+/target tiles discards, overflow
  order, first 4 damage types.

- Pocket ordering was ambiguous in the request ("by time"); the owner
  confirmed "by type". BRIEF.md now covers it.
- Part damage ignores shields (shields only protect HP and the pocket),
  so a shielded part can still break. Not stated in BRIEF.md; confirm.

## Known issues
- Not tested on a real phone; verified in headless Chromium at 390x844
  and 1280x720, dev build.
- Rare and epic parts reuse common meshes at a larger size.
- The HUD canvas is redrawn every frame; may cost battery on low-end
  phones.

- Balance still open: Skyreave below the 70-80% F1 target, Bulwark too
  strong and slow, supers rare (about 0.02 per fight with the sim bot),
  move power and a gentler floor 1 not decided.

- Supers may now be too strong: one test fight logged a SUPER Breath on a
  weak spot for 109 damage against a 140 HP enemy.

## Next proposed step
Owner plays the 3-reel build and tunes (`?debug=1`). Confirm the blank
rule reading, decide how Swap fits for 3v3, and supply designs for rare
and epic parts.
