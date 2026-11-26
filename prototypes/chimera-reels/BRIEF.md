# Chimera Reels (working name)

A 3D monster battler. Players build chimeras from swappable body parts.
Combat is resolved by each monster's own slot reels: the parts a monster
carries decide which tiles are on its reels, and its speed decides how
often it spins. Single-player tower run first. PvP is the long-term goal.

Mobile-first, portrait, web. Built with Three.js (see Stack).

Items marked **(proposed)** are Claude's resolution of gaps in the
original notes. Confirm or change them before build starts.

## Core loop (first prototype)

1. Pick a starter chimera.
2. Pay an entry bet in gold to enter the next tower floor.
3. Fight one enemy monster. Three reels (move, target, mutator) spin on
   each monster's speed cooldown, the player chooses Execute or Pocket,
   parts break, one side falls or yields.
4. Win: collect the payout, gain a level, choose 1 of 3 new reel tiles.
5. Lose: the run ends.
6. Repeat until gold cannot cover the next floor's entry bet.

Goal: the longest win streak with one monster.

## Monster building

A monster is a body plus parts in slots. Every part adds stats (some
visible, some hidden), reel tiles, and sometimes a passive. Parts also
set the monster's colour and element.

| Slot | Role |
|---|---|
| Body | Base HP and which slots exist |
| Head | Mind, jaw and breath moves |
| Limbs | Melee moves (claws, fists, blades). Wings allow flight and add speed |
| Legs | Speed |
| Skin | Armour type: hide, exoskeleton, shell, scale, fur |
| Aux | Utility or extra weapon: spines, tail hammer, horn, ears |

Rules:

- A slotted part covers and protects the body behind it.
- Some parts are built-in weak points that balance out their power.
- Vestigial limbs give almost nothing and cost almost nothing.
- Weakspot: every part has a weakspot value. The part with the highest
  value is the monster's designated weakspot, and the sum of all values
  is its overall fragility (bonus damage taken).

Starter content: each slot has commons plus 1 rare and 1 epic
placeholder part (owner-approved placeholders, to be redesigned).
Three premade starters plus a 4th "Random" option that rolls random
common parts (tap it again to re-roll).

Rarity (Common, Rare, Epic) applies to parts and move tiles:

- Rare parts have better stats and more or stronger tiles; Epic parts
  bring a unique move (Gore, Inferno, Quake).
- Rarer parts and tiles never roll before their floor (Rare from floor
  3, Epic from floor 6, in `tune.json`). This gates enemy parts, drops
  and level-up offers.
- Shown as a coloured border (blue rare, gold epic).

Parts viewer: a "Parts" button on the starter, prefight, loot and
level-up screens opens a viewer: the monster turns slowly, tapping a
slot highlights that part in gold and shows its rarity, hit zone,
stats and the tiles it adds.

## Combat

### Format

- 1v1 first. 3v3 (1 forward, 2 reserve) comes later in scope order.
- Both monsters' reels, pockets and shields are always on screen, so the
  fight can be read at a glance by a player or a spectator.

### Speed and spinning

- Each monster has a speed cooldown set by its speed stat (legs and
  wings). When the cooldown finishes, its reels spin automatically.
- After a spin the player has two buttons: **Execute** or **Pocket**.
  The only other combat input is tapping pocketed tiles to Burn them.
- There is no decision timer and the fight does not pause. The
  cooldown for the next spin keeps running while the player decides,
  but at a reduced rate (`tune.json`; a rate of 0 stops it). If it still
  finishes before the player chooses, the undecided spin is lost and
  the reels spin again.

### The three reels

3 reels, each showing 3 rows, so 9 tiles are visible per spin. Each reel
answers one question.

| Reel | Question | Tiles | Where its tiles come from |
|---|---|---|---|
| Move | What you do | Claw, Bite, Slam, Breath (attacks only) | Your own parts |
| Target | Where it lands | Head, Limbs, Legs, Aux, Body | The enemy's remaining parts |
| Mutator | How it is modified | Power+, Quick, Shield, blank | Your own parts |

- The middle row is the **line**: move + target + mutator is the action.
- Target reel: each unbroken enemy part adds tiles for its zone, plus a
  few Body tiles so the reel is never empty **(proposed)**. When an enemy
  part breaks, its tiles leave the target reel. A flying enemy has no
  Legs tiles. The enemy weakspot's tile is highlighted.
- Reel length and blanks:
  - Move reel never has filler blanks: if your parts give too few moves,
    your own moves repeat to fill it.
  - Target reel is padded with Body tiles.
  - Mutator reel is padded with blanks ("no modifier").
  - Intensity: your move reel gains 1 blank per 2 of your parts
    destroyed, and your target reel gains 1 blank per 2 enemy parts
    destroyed **(Claude's reading of the owner's rule)**.
  - Reels are rebuilt from the current parts at every spin.
- Tiles show an icon plus a small text label. Labels may be dropped
  later once the icon set is learned. Icons are placeholder shapes drawn
  in code until the owner supplies art.

### Execute

- Fires the line action.
- Pocketed tiles that duplicate a line tile are consumed to power it up,
  on all three reels:
  - **Move duplicates**: 1 boosted, 2 stronger, 3 super. Supers come
    from the move reel only.
  - **Target duplicates**: extra damage to that part (small, capped).
  - **Mutator duplicates**: stack the mutator (small, capped).
- Tiles only power up spins after the one they were pocketed on.
- Damage preview: when the line move deals damage, the Execute button
  shows the exact final damage and target before the player commits
  (for example "Bite > HEAD 34, weak spot").

### Pocket

- Stores the 6 tiles that are not on the line. The line action does not
  fire this spin.
- The pocket keeps itself sorted by type: moves, then targets, then
  mutators, with identical tiles side by side. Tiles slide to their new
  place when the order changes.
- Held target tiles reduce damage taken on your own matching part by a
  percentage per tile (capped). This is the only passive effect of held
  tiles.
- Pocket space: every monster has a default size, and parts change it.
  Default 9 (`tune.json`) **(proposed)**, since a Pocket now adds up
  to 6 tiles. Some parts start the fight with tiles already pocketed.
- Overflow **(proposed)**: tiles already held are never pushed out. New
  tiles fill free space, duplicates of held tiles first, then move,
  target and mutator tiles in that order. The rest are discarded.

### Burn

- Between a spin landing and the Execute or Pocket choice, the player
  may tap a group of identical pocketed tiles to burn them (up to 3).
- Burned move tiles fire on their own at the **current line target**:
  1 tile weak, 2 normal, 3 strong, never the super. Each burnable move
  tile shows its exact damage.
- Burned Shield tiles grant shield points at once. Burned Quick tiles cut
  the next cooldown. Burned Power+ and target tiles are simply discarded
  to free space **(proposed)**.
- Burning does not use up the turn. The player still chooses Execute or
  Pocket afterwards. Time spent burning counts as deciding.

### Quick

- Quick cuts the next cooldown, scaling with how many are stacked (line
  tile plus pocketed duplicates): 1 Quick 50%, 2 Quicks 100% (the next
  spin starts at once), 3 Quicks 200% (the next two spins start at once,
  a double move). Values in `tune.json`. Burning Quick tiles uses the
  same table. This is the rapid-offence strategy (Skyreave).
- The Execute button names the Quick effect before the player commits.

### Shields

- Shield is a mutator tile. Executing with Shield on the line fires the
  attack **and** grants shield points, so defending never costs a turn.
- Shield points absorb damage before HP. They stack across Executes and
  last until broken, capped at a share of max HP (`tune.json`, default
  50%).
- Parts add Shield tiles to the mutator reel, and some parts raise how
  much each Shield tile gives (for example Shell more, Fur less).
- Shown as a pale segment on the HP bar and a bubble on the 3D monster.

### Hits, drops and part breaks

- Every hit lands on the part named by the line target tile.
- Damage goes to shield points first, then HP. The hit part also takes
  the damage towards its break threshold.
- **Pocket drop**: if any damage reaches HP, 1 pocketed move tile that
  came from the hit part falls out. If the shield absorbs the whole hit,
  nothing drops ("shield up = pocket safe").
- Each part has a break threshold: a percentage of body HP, adjusted by
  armour type.
- When a part breaks: its tiles leave its owner's reels, every pocketed
  tile from that part drops, the matching target tiles leave the
  attacker's target reel, and a result the owner is deciding on is
  cancelled. The part visibly comes off the 3D model.
- Weakspot: the part with the highest weak value takes extra damage.
  Total weak value adds hidden fragility (not shown on the HUD).

### Damage types

The full set: slash, crush, pierce, exotherm, endotherm, corrosion,
electron, bio, psychic, gravity, time, wave.

First prototype uses 4 **(proposed)**: slash, crush, pierce, exotherm.
Resistances are a table of damage type x armour type in `tune.json`. The
HUD only says "RESISTED" or "EFFECTIVE", never the numbers.

### Removed in the 3-reel redesign

Cut to keep combat readable: off-line tile effects, passive attack,
defence and speed buffs from held tiles, the Guard move and the
Attack/Defend/Brains stances, Jam and Snatch, High/Low/Back attack
directions, and the fragility readout.

### Battle log

After a fight, a "Battle log" button on the result and game-over screens
opens a paged list of every Execute and Burn from both sides: time, who,
the tile, move > target + mutator, and the outcome (damage, shield
absorbed, weak spot, resisted or effective, part broken, tile knocked
out, shield gained, Quick effect, or a miss). A summary line per side
shows total damage, breaks and supers.

### Yield

A losing player can yield before the final hit. Yield ends the fight as
a loss but keeps the monster. Taking the final hit means the monster is
lost for good (ends the run).

Yield is a small button in the player panel, outside the two combat
buttons, and needs a second tap within 2 seconds to confirm. After a
yield the player retries the same floor if gold covers the bet.

## Run and progression

- Each floor has an entry bet. Winning pays out more than the bet.
- Each win gives one level. Each level offers a choice of 3 tiles,
  rolled from a pool that gets stronger with level. No manual reel
  editing outside these choices.
- Game over when gold cannot cover the next entry bet.
- Defeated enemies drop a part that can replace one of yours (later in
  scope order).

## Presentation

- Three.js scene, portrait. One monster in front of each side, reels in
  the lower half of the screen.
- Placeholder first: monsters are built from primitives (box body, sphere
  head, cylinder limbs, flat wings, coloured by part). Each part is its
  own mesh, so hitzones and breaks are visible.
- Placeholder art follows the Kimberly Tank Study workflow (owner
  request): cel-shaded toon materials, inverted-hull outlines, chamfered
  primitives, damped springs for secondary motion, toon smoke puffs. All
  generated in code; no art files.
- Animation is simple procedural motion on those primitives (lunge,
  recoil, hop, flinch, wing flap, hover). No skeletal animation yet.
- The slots must feel juicy (owner request): blurred spins with ticks,
  landing overshoot and thunk, a slowed tease when a super is about to
  land, tiles flying between reels and pocket, sparks, hit-stop, screen
  shake and flash on supers, coin shower on payouts. Sounds are
  synthesised placeholders.
- UI is drawn inside the WebGL canvas, not as DOM overlay.

## Stack

- Engine: Three.js (approved for 3D prototypes repo-wide), `three`
  pinned to 0.187.0.
- TypeScript (strict), Vite, Tweakpane, Playwright, as elsewhere.
- All repo rules still apply in Three.js form: intent layer for input,
  `tune.json` plus Tweakpane on `?debug=1` with copy-to-clipboard,
  version stamp top-left, devicePixelRatio capped through
  `renderer.setPixelRatio`, playable on phone, never block the player.
- Hosting: static site on GitHub Pages, built and deployed by the
  existing `.github/workflows/deploy.yml` alongside the hub. The version
  counter is bumped by that workflow.

## Scope order

1. Three.js scene in portrait, two placeholder monsters, touch and mouse
   input through intents, version stamp, debug panel.
2. Speed cooldowns, auto spin, the 2x3 reels, Execute and Pocket,
   pocket buffs and power-ups, Burn, RPS stances, HP, win and loss.
3. Parts give stats and tiles. Starter parts and 3 starter chimeras.
4. Attack directions, hitzones, part breaks, flight.
5. Armour types, the 4 damage types, weakspot and fragility.
6. Tower run: entry bet, payout, level-up tile choice, game over, yield.
7. 3v3: reserves, swapping (costs a command), AoE split 50% forward and
   25% to each reserve.
8. Enemy part drops and part replacement.
9. 3-reel redesign (move, target, mutator), shields, pocket drops on
   hit, damage preview, icon tiles. Replaces the 2-reel combat built in
   steps 2, 4 and 5.
10. Parts viewer, random-roll starter, rarity with floor gating and
    placeholder rare and epic parts, reel blank rules.

Feel (spin timing, hit stops, recoil, break effects) is tuned before any
later step is added.

## Out of scope

PvP and networking, breeding and part transfer between monsters, genes,
DNA values, mutator genes, training points and caps, blue and red exp,
breeder economy, eggs and pulls, betting between players, tournaments,
clans, spectating features, seasons, cyborg parts, real-money anything,
skeletal animation, training mini-games, final art, the 8 damage types
not listed above.

## Success test

Watching both reels land and seeing a part break feels exciting, and
choosing Execute or Pocket feels like a real decision rather than a
coin flip.
