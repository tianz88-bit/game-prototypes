# Chimera Reels (working name)

A 3D monster battler. Players build chimeras from swappable body parts.
Combat is resolved by each monster's own slot reels: the parts a monster
carries decide which tiles are on its reels, and its speed decides how
often it spins. Single-player tower run first. PvP is the long-term goal.

Mobile-first, portrait, web. Built with Three.js (owner-approved
exception to the Phaser default, see Stack).

Items marked **(proposed)** are Claude's resolution of gaps in the
original notes. Confirm or change them before build starts.

## Core loop (first prototype)

1. Pick a starter chimera.
2. Pay an entry bet in gold to enter the next tower floor.
3. Fight one enemy monster. Reels spin, parts break, one side falls or yields.
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

Starter content **(proposed)**: 2 bodies, 2 heads, 3 limbs (claws, fists,
wings), 2 legs, 3 skins (hide, shell, fur), 2 aux. Three premade starter
chimeras built from these. The debug panel can swap any part for testing.

## Combat

### Format

- 1v1 first. 3v3 (1 forward, 2 reserve) comes later in scope order.
- Both monsters' reels are always on screen, so the fight can be read at
  a glance by a player or a spectator.

### Speed and timing (proposed)

- Each monster has a speed gauge that fills at a rate set by its speed
  stat (legs and wings). When the gauge is full, that monster acts.
- When the player's monster is ready, time pauses until the player
  chooses. The fight feels turn-based but faster monsters act more often.
- One command per ready. There is no "2 commands per turn" rule: speed
  is the source of tempo depth. Revisit when 3v3 swapping is built.

### The two reels

- **Reel 1, command.** The player picks a category (Attack, Defend or
  Brains). Reel 1 spins on that category's strip and lands on the exact
  move. The player chooses the command, never the exact move.
- **Reel 2, mutator.** Modifies the move: attack direction, power up,
  damage type shift, blank, or a temporary tile.
- Each category's strip is built from the tiles the monster's parts
  provide. Duplicate tiles are allowed.
- Potency **(proposed)**: the more copies of the landed tile on its strip,
  the stronger the result. Stacking a tile makes it both more likely and
  more potent.
- Temporary tiles can appear on either monster's strips and expire after
  a set number of spins.

### Attack, Defend, Brains (proposed)

Pseudo rock-paper-scissors. Defend and Brains leave a stance that lasts
until that monster's next spin. An incoming move is checked against the
target's current stance.

- Defend beats Attack (blocks most of it).
- Attack beats Brains (interrupts it).
- Brains beats Defend (feints past the guard, or messes with the
  opponent's reels, for example turning a tile into a temporary blank).

### Attack directions

Set by the mutator reel. Front is the default.

| Direction | Effect |
|---|---|
| Front | Default |
| Low | Powerful ground attack. Misses flying monsters |
| High | Weak, but strong against flyers and high weakspots |
| Back | Only sneak-attack moves can use it. Only useful against certain weakspots. Otherwise counts as Front |

### Hitzones and part breaks

- The part nearest the attack direction (up, down, front, back) takes the
  hit. If no part covers that side, the body takes it.
- Each part has a break threshold: a percentage of body HP, adjusted by
  armour type.
- When a part breaks: its tiles are removed from the reels or weakened,
  related moves deal less damage, and on the turn it breaks it can cancel
  the move in progress.
- Broken parts show visibly on the 3D model.

### Damage types

The full set: slash, crush, pierce, exotherm, endotherm, corrosion,
electron, bio, psychic, gravity, time, wave.

First prototype uses 4 **(proposed)**: slash, crush, pierce, exotherm.
Resistances are a table of damage type x armour type in `tune.json`.

### Yield

A losing player can yield before the final hit. Yield ends the fight as
a loss but keeps the monster. Taking the final hit means the monster is
lost for good (ends the run).

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
- Animation is simple procedural motion on those primitives (lunge,
  recoil, hop, flinch). No skeletal animation yet.
- UI is drawn inside the WebGL canvas, not as DOM overlay **(proposed)**.

## Stack

- Engine: Three.js, chosen by the owner for this prototype only. Other
  prototypes stay on Phaser 3.
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
2. Speed gauges, the two reels, category choice, RPS stances, HP, win
   and loss.
3. Parts give stats and tiles. Starter parts and 3 starter chimeras.
4. Attack directions, hitzones, part breaks, flight.
5. Armour types, the 4 damage types, weakspot and fragility.
6. Tower run: entry bet, payout, level-up tile choice, game over, yield.
7. 3v3: reserves, swapping (costs a command), AoE split 50% forward and
   25% to each reserve.
8. Enemy part drops and part replacement.

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
choosing Attack, Defend or Brains feels like a real decision rather
than a coin flip.
