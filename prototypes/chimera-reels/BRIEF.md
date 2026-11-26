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
3. Fight one enemy monster. Reels spin on each monster's speed cooldown,
   the player chooses Execute or Pocket, parts break, one side falls or
   yields.
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

### The reels

- 2 reels, each showing 3 rows, so 6 tiles are visible per spin.
- **Reel 1, move.** Tiles are moves supplied by the monster's parts.
- **Reel 2, mutator.** Tiles modify the move: attack direction, power
  up, damage type shift, blank.
- The middle row is the **line**. The line's move plus its mutator is
  the action.
- The 4 off-line tiles (above and below) are also in play: each gives a
  small effect when the player Executes.
- Strips are built from the tiles the monster's parts provide.
  Duplicates are allowed.
- Temporary tiles can appear on either monster's strips and expire
  after a set number of spins.
- Off-line effects are kept small and shown as one combined readout per
  spin, so the line result and pocket triggers stay the focus.

### Execute

- Resolves the line action, plus the small effects of the 4 off-line
  tiles.
- Any pocketed tiles matching the line move or the line mutator are
  consumed to power it up:
  - 1 matching tile: boosted version.
  - 2 matching tiles: stronger version.
  - 3 matching tiles: super version.
- Tiles only power up spins after the one they were pocketed on.

### Pocket

- Stores all 6 visible tiles in the monster's pocket. No action
  resolves this spin, and the off-line effects do not apply.
- While held, each pocketed tile gives a passive buff.
- Using pocketed tiles for a power-up removes them, so their passive
  buff ends. Holding versus spending is the core decision.
- Pocket space: every monster has a default size, and parts change it.
  Some parts start the fight with tiles already pocketed.
- Default pocket size is 6 (`tune.json`).
- Overflow **(proposed)**: tiles already held are never pushed out.
  New tiles fill free space in this priority order: tiles matching
  something already held, then the line tiles, then the off-line tiles.
  Whatever does not fit is discarded. A full pocket is the signal to
  Execute.

### Burn

- Between a spin landing and the Execute or Pocket choice, the player
  may tap a group of identical pocketed tiles to burn them.
- Burned move tiles fire their move on its own, weaker than a matched
  power-up: 1 tile weak, 2 tiles normal, 3 tiles strong. Burning never
  gives the super version, which stays exclusive to matching on the
  line.
- Burned mutator tiles give their small off-line effect once per tile.
- Burning does not use up the turn. The player still chooses Execute or
  Pocket afterwards. Time spent burning counts as deciding, so the next
  cooldown runs at the reduced rate meanwhile.
- Burned tiles leave the pocket, so their passive buff ends.
- The pocket needs large, grouped tap targets on a portrait phone.

### Pocket counterplay

- Some moves make the opponent drop pocketed tiles.
- When a part breaks, pocketed tiles that came from that part are
  dropped.
- Both monsters' reels and pockets are always visible.

### Attack, Defend, Brains (proposed)

Every move tile is one of three types, which counter each other in a
pseudo rock-paper-scissors. Executing a Defend or Brains move leaves a
stance that lasts until that monster's next action. An incoming move is
checked against the target's current stance.

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
2. Speed cooldowns, auto spin, the 2x3 reels, Execute and Pocket,
   pocket buffs and power-ups, Burn, RPS stances, HP, win and loss.
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
choosing Execute or Pocket feels like a real decision rather than a
coin flip.
