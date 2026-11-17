# Steroids-Alpha

Status: DRAFT for owner review. Nothing here is built yet. Sections marked
"Default (confirm)" are proposals, not decisions; change them freely.

## Pitch

A space-themed, top-down, real-time PvP extraction shooter for the browser.
Arcade dogfighting feel (top-down shoot 'em up) combined with extraction
survival: players pick a planet from the main menu, drop in with a fresh ship,
grow it during the run (.io style: mine, buy upgrades, fight), and warp out to
bank what they carry as currency. Dying loses the run's haul. Banked currency
buys unlocks, quality of life and options, never raw power (owner, 13
November 2026).

Inspiration: the top-down dogfight feel and layered aircraft look of
Thunderdogs, and the raid/extract/lose-it-all loop of extraction shooters.
All names, ships, pilots and art are original. Nothing is copied from either.

## Platform and stack

- Browser game. Phaser 3, TypeScript (strict), Vite, per the repo stack.
- All game UI drawn in the Phaser canvas. No DOM UI overlay.
- Must be playable on a phone (repo rule kept, no exemption). The game is a
  landscape game. Owner rule (14 November 2026): never block the player, so
  there is no "turn your phone" screen. A phone held upright (screen more than
  1.4 times taller than wide) draws the landscape game turned a quarter, as
  native landscape games look when held upright; the player turns the phone or
  plays it sideways. Near-square screens (open foldables, tablets) play as
  they are. On touch devices, choosing a planet asks for fullscreen and, on
  tall phones, a landscape lock (Android; iPad fullscreen only; iPhone Safari
  allows neither). A refusal never stops play.
- Client deploys to itch.io via Butler (repo default for new prototypes).
- Server deploys to Cloudflare Workers (Durable Objects + D1).
- No new npm dependencies without owner approval.

## Core loop

Owner direction (13 November 2026): each run is .io; extraction banks hard
currency; currency buys unlocks, QoL and options, never raw power.

1. **Main menu / hangar:** spend banked currency on unlocks, choose among
   unlocked options, then pick a planet.
2. **Drop in:** join that planet's running room at any time, always with the
   same base ship as everyone else.
3. **Lockdown:** for the first 3 minutes after dropping in, the player cannot
   leave.
4. **Run (.io):** mine asteroids for minerals (power), buy in-run upgrades
   (turrets, shield, guns, missiles, mines), fight players and bots. Stay as
   long as you want. All of this resets when the run ends.
5. **Warp out:** after lockdown, press Warp and survive the warp run to
   launch off the planet.
6. **Result:** warped out means the minerals carried are banked as currency.
   Destroyed means the run's haul is lost and spills as minerals for others.
   Nothing banked or unlocked is ever lost.

## Planets

- v1 has 2 PvP planets plus 1 practice planet, chosen from the main menu.
  Each PvP planet has its own loot and asteroid setup (differences to be
  defined).
- Practice planet: single-player PvE, a private room per player. It teaches
  flying and shooting asteroids and acts as the tutorial. It drops consumable
  loot only, nothing rare. No lockdown there, and nothing is lost on death
  (owner decision).
- Rooms are persistent drop-in/drop-out: a planet room keeps running while
  players come and go. No fixed match start or end.
- No maximum time on a planet (owner decision, for now).
- Default (confirm): a cap on players per planet room (start at 8 to 12),
  with a second room opened when full.

### Planet shape and rendering

- Planets are pseudo-3D spheres that wrap around the player's perspective.
- Gameplay space: a wrapping 2D map (edges connect left/right and
  top/bottom). Movement, collisions, distance and "who is near me" all use
  wrapped distances. This avoids true-sphere pole problems in movement, loot
  spawning and server checks; players cannot tell the difference from a
  top-down camera.
- Rendering (owner-selected composition "C" from the environment handoff
  v09): the planet is a ball seen from above, centred under the player's
  small ship. Its left and right rims are visible against space and it runs
  off the top and bottom of the screen. Ground distance r from the ship is
  drawn at R sin(r / R); anything a quarter of the way round is over the
  horizon. Ships, asteroids and bullets are placed and scaled through the
  same projection.
- A broad soft rim glow inside the edge and a soft atmosphere halo outside it.
- One sun, fixed in space (owner decision). The planet turns beneath it and
  the ship travels over it; both move the same position on the ball, which
  drives the terrain scroll and the sunlight together. Terrain light, rim,
  ship brightness and the ship's hard ground shadow (direction, length,
  fading out at night) all follow it. Turning the ship in place never changes
  the light. The planet's turn comes from the server clock, so players in the
  same place see the same light.
- Ship shadows are drawn smaller than the ship in flight (render.shadowScale 0.72) and the hover
  glow under a ship is a small round pool (owner, 15 November 2026).
- Ships and other game objects dim only about 10% on the night side, so they
  stay readable; the ground goes properly dark (owner decision).
- Thruster exhaust: steady at idle, a burst when throttle or a turn starts,
  strong while held; turning fires the outside engine. Blue and white with
  some orange, rectangular particles.
- Default (confirm): one lap of the wrapping map is one turn of the ball, so
  the light has no jump at the map seam; the drop zone starts in daylight;
  the planet turns 1 degree per second (a 6 minute day).

## Clan planets v0 (owner, 15 November 2026)

First playable slice of the long game (DESIGN_LONGGAME.md). Scope is this section only.

- **Two demo clans.** The player picks one in the menu; switching is free while testing. No
  clan creation, invites or roles yet. The choice is sent on joining a planet (trusted from the
  client for this demo slice).
- **Four planets in the menu:** each clan's home planet, plus the two existing planets in new
  roles:
  - **Planet A: Lawless.** Bots stay. Joining shows a warning that bots will hunt you down.
  - **Planet B: Satellite** (the clan farming satellite of the design doc; no clan ownership
    yet, players-only as before).
- **Clan home planet layout:** a **treasury** building at a fixed spot, **landing pads** in a
  ring around it, **turrets** around the base, and the **gate** on the opposite side of the
  planet from the treasury.
- **Landing (docking):** a member's ship over a pad may brake all the way to a stop (ships
  never stop anywhere else). A docked ship:
  - is safe (takes no damage);
  - is repaired (hull and shield);
  - unloads its carried fuel into the clan treasury.
  Docking to bank your own credits at home is "maybe later" (owner).
- **Landmark markers (owner, 15 November):** on a clan home planet, while off screen, an edge arrow
  with a label and distance points to key spots. Members always see their treasury; visitors see the
  gate and the enemy treasury. Open planets get none.
- **No salvage on home planets (owner, 15 November):** minerals mined on a clan home planet give
  members **Fuel** (a clan resource, working name) instead of salvage, so safe home planets cannot
  be farmed for credits. Fuel fills the same 400 hold, the hot zone doubles it, it is lost on death,
  and docking unloads it into the treasury. Fuel is what will pay building upkeep once upkeep
  exists. Non-members mine neither, do not see the hot zone and have no cargo readout there. No gold drops on home planets.
  A docked ship comes down onto its pad: it shrinks to its shadow's size and sits on it, and its
  hover glow fades and its engines (exhaust) switch off (owner, 15 November).
- **Anyone can enter a clan planet.** Non-members:
  - arrive at the gate (the fixed entry point opposite the treasury);
  - get a warning that the clan's turrets will fire on them;
  - are shot on sight by the turrets;
  - cannot get through the shield over the treasury and the docks (ships are pushed out, their
    bullets stop at the shield).
- **Treasury:** shows the clan's total, filled by docking deposits; persisted across server
  updates. Spending it comes in a later phase.
- **Art:** placeholders first (recoloured planet surface, simple shapes); Codex is briefed for
  clan planet skins, the treasury, pads, turrets, shield and gate.
- Not in this slice: wars, guest passes, clan techs, buildings, satellites owned by clans,
  prestige points.

## Tutorial planet (owner, 16 November 2026)

- Single player, from the menu (TUTORIAL under WARP). No forced onboarding, no rewards.
- Runs entirely in the browser: the real game room runs in the page (src/tutorial), stepping once
  per pilot input, so the rules are exactly those of online play on any device speed.
- Step by step, each skill repeated until it is done for real (hints never block play):
  1. Steer through 5 rings. 2. Full speed then minimum speed, 3 times. 3. Dash through 3 gates.
  3b. Ram a battered practice Battlecruiser (45% hull, never shoots) to death: 3 rams.
  4. Destroy 4 asteroids. 5. Collect minerals (+15 power). 6. Overheat the guns twice.
  7. A training turret breaks your shield and hits your hull; collect a repair pod.
  8. Buy MISSILES and MINES (power topped up first). 9. 3 locked missile launches at a drone.
  10. 2 mine hits on a chaser. 11. Destroy 3 practice pilots (very weak: slow, inaccurate, rare
  bursts, no dash, missiles or mines). 12. The Battlecruiser evolution explained (GOT IT).
  13. Free play against helpless drones; warp out any time to finish.
- Instructions match the control scheme (mouse, keyboard, touch). Esc leaves to the menu; a
  destroyed pilot respawns and carries on from the same step.

## Siege v0: Warzone (owner, 16 November 2026)

First clan-versus-clan fight. Built in two steps: the rules and a headless bot simulation first,
then the playable planet (both done, 16 November 2026).

- **Warzone planet:** a clan base (treasury, shield dome, 6 turrets, pads, gate) defended by
  **Azure**; **Crimson** attacks. Separate from the clan home planets, which stay peaceful.
- **War start:** when at least 1 Crimson and 1 Azure player (bots do not count) are on Warzone, a
  10 s countdown starts, then the war begins and **no one else can join**.
- **Lockdown release:** when a side has no players left, a 10 s countdown, then Warzone opens again.
- **Bots:** 2 per side.
- **Objective (attackers):** destroy the turrets, break the shield, destroy the treasury, in a
  natural order: everything is attackable at any time, but bullets stop at the shield while it stands,
  and each live turret regenerates it.
- **Shield:** regenerates passively at `siege.shieldRegenPerTurret` per live turret a second. Once
  fully depleted it stops regenerating for the rest of the round. While it stands, attackers cannot
  enter it; once down they can.
- **Treasury:** its health never recovers during the siege.
- **Defenders:** cannot attack (guns, missiles, mines) from inside a standing shield. At war the pads
  are only spawn points: no docking safety, no repair. Defenders respawn at the pads after
  `siege.defenderRespawnSeconds`.
- **Attackers:** respawn instantly at the gate. Shared ticket pool (`siege.attackerTickets`); each
  attacker death costs one.
- **Win:** attackers by destroying the treasury. Defenders when attacker tickets reach 0 or the
  round timer (`siege.roundSeconds`, 5:00) runs out.
- **After a round:** the base, tickets and timer reset, and a new 10 s countdown starts if both sides
  are still there.
- **On Warzone:** mining and upgrades as usual (power only: no salvage, no fuel); no warp-out during
  a war. **No rewards** for now.
- **Playable (step 2):** Warzone is in the menu and on the stellar map. Only clan pilots can join
  (others are told to pick a clan); during a war (and its round-over pause) newcomers are refused
  with a "war is on" message. A pilot destroyed at war stays on the planet and respawns in place
  (no death screen): attackers at once at the gate, defenders after the countdown at the pads; war
  bots respawn the same way. Outside a war the towers hold fire. The top panel shows the phase,
  countdowns, tickets, round timer and tower/shield/Nexus health; destroyed towers are crossed out
  and the shield ring fades with its strength (placeholder looks until art). The round-over pause
  is 8 s, then a new countdown if both clans are still there.
- Idea for later (owner): more minerals and rare mineral-rich asteroids on Warzone for quick
  farming.
- Starting values (to be tuned by the owner after playtests; lowered 16 November for the weaker
  Sparrow starter): turrets 110 HP, shield 750 HP
  regenerating 2 HP/s per live turret, treasury 1,100 HP, 20 tickets, defender respawn 15 s. Headless
  results: `scripts/sim-steroids-alpha-siege.mjs`.

## Lockdown and warp-out

- **Lockdown:** 3 minutes from drop-in. The Warp button is visible but offline,
  with a countdown.
- **Warp button:** comes online when lockdown ends. Pressing it starts warp
  mode, like a recall/teleport in a MOBA.
- **Warp mode:** the ship accelerates, but tops out only slightly above its
  base speed, so other players can pursue and catch it.
- **Warp distance:** the player must travel X distance in warp mode. Reaching
  X launches the ship out of the planet (extracted).
- **Damage:** any damage taken during warp mode resets the warp distance to
  zero. It does not restart the 3-minute lockdown (owner decision).
- Tuned values (`tune.json`): lockdown duration, warp acceleration, warp top
  speed multiplier, warp distance X.
- Heading is locked during warp, with only slight steering allowed (owner
  confirmed, 13 November 2026; `warp.steerFactor`).
- Firing is disabled during warp, including turrets, missiles, mines and dash
  (owner confirmed).
- The player can cancel warp mode and press Warp again later (owner
  confirmed).
- Progress is shown as a bar filling with warp distance (owner confirmed).
- Asteroids: a warping ship plows through them, smashing the rock with no
  damage, no knockback and no warp reset (owner, 13 November 2026). Only
  damage from players, bots, turrets, missiles and mines resets the warp.
- Everyone sees a warping ship (a ring filling with progress) and its
  warp-out flash. The extracted pilot sees EXTRACTED (with the banking result) and a Menu
  button only: no drop-in straight after warping out (owner, 16 November 2026).

## Ship assembly and art direction

- Ships are assembled from layered parts, using the same approach as the
  Punchies relaunch rig (`experiments/punchies-relaunch/rig-lab`):
  one shared skeleton, a profile maps each slot to a sprite, gaps between
  layers are tuned per facing direction, and draw order switches across
  diagonals.
- Goal: top-down parts that read as a slightly angled 3D ship, not flat.
- Ships rotate continuously; part offsets interpolate between tuned
  directions (down / side / up), as in Punchies.
- Default (confirm) slots: hull, cockpit, wings (left/right), engine(s),
  weapon hardpoint(s).
- Parts change how the ship looks. Any part that changes how it performs must
  be a sidegrade (a trade-off of equal value), never strictly stronger (owner
  rule: progression never adds raw power).
- First approved ship: Human Nomad v1 (twin-engine, 12 parts from 8 PNGs),
  delivered as an owner-approved rig kit (branch
  proto/steroids-alpha/approved-ship-rig-v1, commit 38e7139). Its calibration
  (`art/human-nomad-v1/calibration-approved.json`) is owner-authored and frozen:
  fixed Z order, 3% shading per lower layer, engine rattle, gun recoil, hard
  ground shadow, FFD pitch/bank tilt on thrust/brake/yaw. The game uses a
  TypeScript port of that rig, checked against the kit's own output.
- Owner FFD direction (15 November 2026): each part has its own hardline-aligned
  mesh, enabled only by acceleration, braking or yaw; ordinary rotation stays
  level. Preserve the approved -13/+17 degree pitch and inverted +/-22 degree
  bank, engine vibration, recoil, fixed Z and palette/shading. Retain the current
  sprite rig for Canvas, disabled or failed deformation, distant ships and sustained
  slow frames. FFD changes visuals only; no change to hitboxes, shots or movement.
- Placeholder shapes remain as the fallback when art is not available.
- Art pipeline per repo rules (R2 zip, packed/ and loose/).

## Flight and combat

- Ships have throttle: accelerate and brake between a minimum and a maximum
  speed.
- A ship cannot stop or hover (braking drops to the minimum speed), and
  there is no drift: it moves where the nose points (owner decision).
- Primary fire from equipped weapon(s), fixed forward. Default (confirm):
  wing guns are angled slightly inward so the two streams cross ahead of the
  nose, instead of passing either side of a target dead ahead.
- Dash (owner decision, restored 12 November 2026, "important for io
  games"): a 0.5 s boost at 450 px/s on a cooldown. Normal top speed 350 px/s.
- Hull HP; destroyed at 0.
- Shield (owner decision): a blue meter that takes damage before the hull.
  It equals 50% of the original hull, and the hull was halved to make room
  (hull 50 + shield 50). It starts regenerating 5 s after the last damage,
  at 20% of the shield per second (owner change, 12 November 2026). A blocked hit shows blue hexagons on the
  shield bubble where it landed.
- Ramming an asteroid destroys it (it splits), and the ship and the rock are
  pushed apart in opposite directions (owner decision). The ship still takes
  contact damage.
- Health boost (owner decision): destroyed asteroids sometimes drop a pickup
  that restores 25% of the starting hull.
- Power, .io style (owner decisions, 12 November 2026):
  - Minerals are the hull (one pool). Every destroyed asteroid drops
    minerals by size; collecting them adds hull, up to a cap.
  - Shield regen is a percentage of the shield maximum. (Originally each
    mineral raised the shield maximum; superseded 12 November: shield and gun
    damage are now shop upgrades.)
  - Hull damage spills part of what was lost as minerals anyone can collect
    (the victim cannot take them straight back). Death loses everything and
    spills a share for others.
  - More power: the ship is slower (dash too) and bigger (an easier target).
    Growth has diminishing returns and caps out. Firepower comes from the
    shop, not from power (12 November).
  - The leaderboard ranks by level, then player kills, then mineral balance (owner, 16 November).
  - Arena only for now: minerals do not go to the stash.
  - Balancing is Claude's call.
- Shop (owner design, 12 November 2026): upgrades bought with minerals
  (which are the hull), from one-tap buttons at the top left. Each upgrade
  has 4 tiers; each tier has a power floor and a mineral cost (e.g. 100/50:
  needs 100 power, costs 50). Bought upgrades last until the ship is
  destroyed. Items: auto turrets, shield maximum, main gun damage. Mines and
  homing missiles are planned next.
- Auto turrets (owner decision): fire on their own at enemy ships and
  asteroids within a lock-on radius, turn no faster than a capped rate, do
  tiny but real damage. Bought in the shop (up to 4).
- Main guns overheat (owner idea): about 2 s of continuous fire locks them
  until they cool, so firing has to be timed. Damage per shot was raised to
  compensate.
- Aim assist (owner request): a narrow cone ahead of the ship bends shots
  slightly toward a target, ships before asteroids.
  Owner, 15 November: once a target is locked (in the cone and range), both guns
  turn from their own muzzles to where it will be when the shot arrives, so both
  streams land (up to weapon.assistConvergeMaxDeg 20 off each gun's resting line).
  Bots do not get this assist; they aim for themselves.
- Dash (owner design, Thunderdogs reference, 12 November): press dash to
  start a 0.4 s charge (owner, 15 November: was 0.8 s) during which the ship cannot steer;
  when it completes the ship boosts straight ahead (owner, 15 November: no
  direction picking) at 1.8x the ship's top speed for 0.8 s (1.6 s
  total, about 500 px for a fresh ship), ignoring braking. Only slight steering through the whole dash, charge and boost
  (owner, 16 November: 25% of the turn rate, `ship.dashSteerFactor`, so rams can be aimed and
  dashes used to evade; was fully locked). Cooldown 8 s,
  shown by a yellow bar next to the gun heat bar. Dash ram damage hits shields
  first, like any damage. Exhaust plume: 2x longer at top speed than
  before and 3x in a dash (owner, 15 November). "Top speed" is each ship's
  own top speed (power and chassis lower it), not the fixed 350 (owner, 15 November). Exhaust particles fly 2x
  faster and live half as long; the longer plume comes from particle speed,
  not lifetime (owner, 15 November; clientTune exhaustSpeedScale and
  exhaustLifeScale).
- Gun shot look (owner, 15 November): both guns fire the standard bolt; from
  the second GUNS upgrade on, both fire the heavy pulse (clientTune
  heavyShotGunTier). Turret shots keep their own small bolt.
- Feel pass (owner, 15 November): acceleration and braking doubled (440 /
  600); bullets drawn 2x bigger with the same hitbox; hit sparks 2x bigger.
- Hull: power is the hull maximum. Minerals repair damage first, then raise
  the maximum. Shop purchases lower the maximum; current hull only drops if
  it is above the new maximum (owner design, 12 November).
- Gun upgrades also hold 20% more heat per tier (owner).
- Leaderboard shows each player's kills (players only) and power.
- Bots (owner, 12 November): AI pilots on Planet A only, present only while
  at least one real player is there. Planet B is players-only PvP. Bots spawn
  spread over the planet, as far from every ship as possible (owner).
  Bots leave only when players leave, not when one is destroyed (owner, 15
  November): after the last pilot is destroyed they stay for 60 s
  (bots.lingerSeconds) so a respawn finds them.
  Bots leave like players (owner, 15 November): at 350 power
  (bots.warpPower) or after 5 minutes on the planet (bots.warpAfterSeconds)
  a bot warps out once its lockdown is over (everyone sees the warp, and it
  can be chased and shot down), and a fresh bot replaces it. Bots evolve into
  the Battlecruiser when they qualify, so one can peak as a Battlecruiser
  before it leaves.
  Bots are beaten by out-playing them, not by stat handicaps (owner, 14
  November 2026): they see about a screen around them (600 px), take about a
  second to react to a newcomer, aim where they last saw a target (read four
  times a second, so weaving makes them miss), lose interest after about 6 s
  of fighting and wander off for about 4 s, and only one bot hunts a pilot at
  a time. Duel measure (one bot vs a fresh pilot who does not shoot back):
  before, about 2.6 s to die whatever the pilot did; after, about 3.6 s flying
  straight, about 13 s turning gently, about 27 s weaving hard.
- Missiles and mines (owner, 12 November): shop items with four tiers; each
  tier adds a charge. Charges refill automatically one at a time and are held
  until used. Two buttons with symbols and charge counts (keyboard Q and E).
  Missiles lock onto ships only and home. Mines are visible and steer slowly
  toward nearby enemy ships before going off. Both can be shot down: they
  survive one or two turrets, and the main gun is needed to finish them.
- Bounty (owner, 12 November): the strongest real player (bots never) carries a
  bounty marker; other pilots see a tracker at the screen edge pointing to them.
  Marker only, no extra reward (owner). Needs two or more players on the planet.
- Missile lock (owner, 12 November): a locked missile in flight shows a lock
  crosshair on its target for both the pilot who fired and the target (the
  target only once the missile is launched).
- Forgiving shield (owner, 14 November 2026): the shield is the health a
  pilot can afford to lose. The hit that breaks it is absorbed in full and the
  hull then takes no damage for 0.5 s (a shatter effect), so one burst cannot
  go straight through to death. This save works once per recharge cycle
  (ready again when the shield is back above half). Recharge starts 3 s after
  the last hit (was 5 s) at 35% of the bar per second (was 20%). While the
  shield is down, its bar glows red and fills with flashing red as the
  recharge cooldown runs out.
- Shield hit effect: a glowing sphere tiled with hexagons around the craft
  (owner reference image); some hexagons on the hit side flash (owner).
- Dash ram (owner picked): dashing into a ship damages it and throws both apart. Damage is the
  larger of the flat ram (scaled by gun upgrades) and 15% of the target's hull maximum (owner,
  16 November, `ship.dashRamHullFraction`), so any pilot can hurt a big, decked-out ship.
  Owner, 16 November: the target takes the ram **straight to its hull** (shields skipped); the
  rammer takes the same amount on its **shield**, with nothing spilling over to its hull, or on its
  hull only if its shield is already down (recharging).
- Ship bumps (owner, 15 November; harder on 16 November): ships that touch outside a dash no
  longer pass through each other; both bounce apart (380) and take 20 damage (shield first), at
  most once per pair every 0.5 s (ship.bumpDamage, bumpKnockbackSpeed, contactGraceSeconds).
- Ship handling (owner, 16 November): each ship type has its own minimum, cruise and top speed,
  acceleration, braking and turn rate (`tune.ship` for the Falcon, the reference for tuning;
  `tune.interceptor`, `tune.battlecruiser`). Starting values equal the old factors. The starter
  ship Scrappy is renamed **Falcon**.
- Corner speed (owner, 16 November): ships turn best at their own cruise speed (as a share of their
  own top speed, so the slow Battlecruiser turns best around 187) and worse both slower and
  faster: 70% of the turn rate at minimum speed (`ship.turnAtMinSpeed`) and 85% at the ship's own
  top speed (`ship.turnAtMaxSpeed`). Slowing right down no longer wins a turn fight, which breaks
  up circling stalemates.
- Repair pods (owner, 16 November): drawn near their collection size (`render.healDropScale` of
  the pickup radius) so they read clearly.
- Hull damage feedback (owner, 16 November): a subtle red flash at the screen edges when your hull
  (not the shield) takes damage; hull readouts flash red below 50%.
- Nose marker (owner, 15 November): a small chevron just ahead of your own
  ship shows where the guns point.
- Target health bar (owner, 15 November): after you hit a ship, a small bar
  under its name shows its health for 5 s after your last hit. Shield and
  hull share the bar: blue while the shield holds, then the hull.
- Destroyed ship (owner decision): it explodes, then the player chooses
  Respawn (same planet, fresh ship) or Menu. Keyboard: R (or Space) respawns,
  Esc goes to the menu; the keys are shown on the buttons (owner, 15
  November).
- Leaderboard on every planet (owner, 16 November): one chip per player
  (rank, name, level, kills, minerals), sorted by level, then kills, then minerals descending.
  Stable player id breaks exact ties. Mineral balance is the existing hull/shop currency;
  the wire field remains `power`. Chips slide to their new places when
  the order changes, and a chip pops when its kills go up. A player's kills
  reset to 0 when they die.
- Night side (owner decision): ships are drawn 30% darker at full night;
  asteroids and pickups only 10%. The ground goes fully dark.

### Controls

Both schemes are supported (owner decision), through the intent layer:

- **Craft-relative:** left/right rotates the ship, up/down accelerates and
  brakes.
- **Direction marker:** the ship steers toward a chosen direction at its turn
  rate; how far the stick is pushed sets the throttle. With the stick at
  neutral (or released) the ship slows to minimum speed (owner decision). A
  light push accelerates gently; full acceleration needs the stick pushed
  most of the way (thrust follows the push on a curve, `touch.markerThrustCurve`).
- Keyboard uses craft-relative (A/D rotate, W/S throttle). Phones always use
  the direction marker: the STEER toggle was removed (owner, 14 November
  2026). Fire and warp are buttons on both.
- **PC mouse aim (owner, 16 November 2026), the default on PC:** the ship always
  steers toward the cursor (no click needed; not while the cursor rests on the
  ship, within `mouse.deadZone`, or on an on-screen button). Left click (held)
  fires, right click launches a missile, W accelerates, S brakes; with neither W
  nor S held the ship eases back to minimum speed. A/D still turn while pressed.
  A ring at the cursor shows it. Space/J, Q, E, Shift and R keep working.
- **Menu settings (PC only):** CONTROLS: MOUSE (default) or KEYBOARD (the
  keyboard-only craft-relative scheme); KEY HINTS: ON (default) or OFF, a small
  list of the current scheme's keys in the bottom-left corner during flight.
  Both remembered per browser.
- **View (owner, 16 November 2026):** zoomed out so players see further: the
  screen shows 1000 world pixels top to bottom (`render.referenceHeight`, was
  810). HUD and labels keep their size.
- Both schemes share the same turn rate and speed limits, so neither has an
  advantage.

## Asteroids

- Look (owner, 14 November 2026): broad cel-shaded painted rocks matching the
  ships (owner art, R2 visual-review-v4), replacing the pixel rocks. Three
  colour families (ochre, lavender, teal), each with a parent, two medium and
  two small variants. Fragments keep the parent's colour family (server);
  siblings use different variants. A painted rock is never drawn smaller than
  its hitbox: it is scaled so the circle inside its body is the collision
  circle (drawn width 1.3-1.7x the hitbox, depending on the shape).
Asteroids replace bots as the non-player targets (owner decision).

- They float over the planet surface in straight lines and wrap around it.
- Shooting one down splits it into smaller asteroids; the smallest size just
  breaks.
- Split vectors depend on the damage: Default (confirm) pieces keep the
  parent's motion, are pushed along the direction of the killing shot, and
  spread sideways; a harder hit throws them faster and wider.
- Asteroids damage ships on contact, and they drop loot on every planet
  (consumables only on the practice planet) (owner decision).
- Default (confirm): three sizes; a ship that rams an asteroid damages it
  too; asteroids do not collide with each other; each planet keeps a target
  amount and spawns new large ones to maintain it.
- Run on the server. Because they move in straight lines, the server sends
  only spawn, split and destroy events and clients compute positions.

## Orbital zoom transition

Owner correction (16 November 2026): hyperspace arrival replaces the vertical dive/shockwave.

- Arriving pilot: heading-aligned background speedlines, then the hyperspace background fades while the ship holds full normal speed. The planet subsequently zooms to normal play scale, with fast surface travel along the ship bearing. The ship stays level and centred; no vertical drop. HUD returns at completion.
- Departure reverses the presentation after authoritative extraction: globe pulls away, fast terrain travel increases, hyperspace returns, then the results panel. Existing warp-out eligibility/run and banking rules remain.
- Authoritative remaining arrival time drives both animation and protection. No incoming damage or contact/ram displacement; no guns, turrets, ordnance, dash or warp initiation during arrival. Full normal speed and fixed bearing until release. Client rendering or a ready message cannot extend immunity.
- Observers: only genuinely arriving ships fade in, brake sharply with a short overshoot and leave blue-white/orange square residuals. Already-established ships entering view or reconnecting do not replay a spawn entrance.
- Shared bounded defaults: arrival3.2s, departure2.4s, observed final approach0.7s. Protocol21 appends remaining arrival to each snapshot. Client and Worker must release together after motion review.
- Stellar map (owner, 16 November): a pulsing WARP button on the main menu opens a canvas popup
  containing all four destinations as spinning globes, using the gameplay terrain materials.
  First tap highlights a globe and shows real player count, hostile/neutral/friendly territory
  relative to the selected clan, resource types and entry notes. Tapping that selected globe
  again starts the existing orbital entry. Closing/Escape returns to the menu; menu controls
  underneath the popup cannot receive taps. Counts refresh from `/planets`; unavailable counts
  stay unknown. No shared-space or free-flight hub is added in this pass.

## Ships (owner, 14 November 2026)

- Four Human Nomad ships (owner art via Codex, R2 packs interceptor-v2 and
  battlecruiser-v1, rig kit tools/ship-rig/human-nomad-ships-v2):
  - **Sparrow:** free starter. Same base movement, hull, shield and shot damage as Falcon. One centre gun, 6 shots/s (owner, 16 November 2026; was 5. Falcon 7.5 combined, 3.75 per barrel), so 80% of Falcon's damage per second. Holds 90% of Falcon cold-to-overheat shots (owner, 16 November 2026; was 80%), rounded to the nearest whole shot including cooling at each gun tier. Deterministic launch drift up to ±3 degrees after aim assist weakens long-range accuracy. Normal cooling/unlock animations stay unchanged.
  - **Falcon** (formerly Scrappy): twin-gun unlockable sidegrade, existing ship-slot price.
  - **Bat** (formerly Interceptor): a one-time credit unlock (Hangar), then chosen freely in
    the Hangar before a run. Slower top speed and much quicker turning, weaker shield and guns.
  - **Battlecruiser:** never bought with credits (it is raw power). A fighter
    evolves into it during a run from the shop's EVOLVE card once it has enough
    upgrades and power, paying minerals. Lost at the end of the run (death or
    extraction); the next run starts in the Hangar ship. May dash and warp.
- Palettes (4, owner art) repaint hull, trim and glass on every ship; the
  default is free, the others are credit unlocks. They replace the hull tints,
  which are no longer sold: crimson/emerald/violet tint owners own the
  matching palette, gold and ice tint owners may claim any one palette free.
- First values (Claude's educated guess, to be tested; tune.json
  `interceptor`, `battlecruiser`, `unlockPrices`, all live-tunable):
  Bat and Falcon cost 1500 credits each. Bat has radius 24, speed x0.9, acceleration x1.2 and turn
  x1.7, shield x0.7, damage x0.85. Battlecruiser: needs 6 upgrades and 300
  power, costs 120; radius 60, speed x0.72, acceleration x0.6, turn x0.55,
  shield x2.5, four cannons (damage x1.6, every 5 steps), two mounted turrets, with four deck platforms for upgrades. Palettes 400 credits. Gun and turret positions come from the art;
  hit sizes and stats never from the art size.
- On evolving: upgrades, missile/mine charges and salvage are kept; hull keeps
  its points under the new maximum; the shield keeps its share of the larger
  maximum; gun heat resets. The chosen ship applies only right after drop-in.

## Bank and unlocks

Owner direction (13 November 2026). Replaces the earlier gear-stash design.

- **Bank:** server-side (Cloudflare D1), per anonymous account. Clients never
  write it. The planet room credits it when a ship extracts; each extraction
  pays out once (idempotent).
- **Currency:** earned only, by extracting. No purchase path (monetisation is
  out of scope).
- **Salvage (owner, 13 November 2026):** a separate counter carried during
  the run, shown in the HUD. In-run upgrades never spend it, so fighting and
  upgrading never cost earnings.
  - Earned by mining (each mineral picked up also adds salvage) and by
    destroying bots (bots carry little, so farming them is no faster than
    mining).
  - A destroyed ship drops all of its carried salvage as gold pickups that
    anyone can collect. Being hit spills power only, never salvage.
  - Kill payout (owner, 13 November 2026): a destroyed ship also drops gold
    worth a share of its power above the starting value (default 50%,
    tuned; a fresh ship's share is 0, so new or alternate accounts are worth
    nothing to farm), on top of its carried salvage, so a big upgraded ship or the bounty holder is a jackpot.
    Guards: a ship still in its spawn protection drops no power gold, and
    repeat kills of the same pilot by the same killer pay less each time
    (default: halved per repeat within 10 minutes).
  - Hot zone (owner, 13 November 2026): one area per planet at a time has
    richer asteroids paying double salvage. It moves every few minutes and
    is shown to everyone (edge tracker, like the bounty), pulling farmers
    together so fights happen. Radius, duration and multiplier are tuned.
  - Extracting banks carried salvage as credits, 1:1. Dying loses it.
  - Cargo hold (owner, 15 November 2026): at most 400 salvage carried
    (salvage.cargoMax). When full, mining still adds power but no salvage,
    gold pickups stay on the ground for others (a nearly full hold takes what
    fits), and the HUD reads "FULL · WARP OUT", so banking beats farming.
  - Practice planet: no salvage.
  - First values (tune.json `salvage`, `hotZone`; not tuned by playing): 1
    salvage per mined mineral, kill share 50%, repeat-kill window 10 min,
    bot drop 50% of the share, gold lasts 30 s and is never pushed out by
    other pickups; hot zone radius 600 px, moves every 3 min, x2, and half of
    newly spawned rock appears inside it. Until accounts exist, repeat kills
    are matched by pilot name.
- **Economy shape (owner: farming is the baseline, PvP pays more; tuned to a
  free-to-play pace):**
  - New salvage enters only from mining and bots, at a fixed, tuned rate.
    That rate is the free-to-play baseline, and unlock prices are set
    against it (for example, a typical run's farming buys a small cosmetic
    in a few runs).
  - PvP mostly moves salvage: the victim's whole stack goes to whoever
    collects it. The kill payout adds a share of the victim's power, so
    hunting pays more than farming; the guards above keep feeding between
    friends or alternate accounts from beating plain farming by much.
  - The hot zone raises the farming rate only inside it, so it counts toward
    the baseline when prices are set.
  - Gold nobody collects before it expires is gone. Credits leave the
    economy only through unlocks.
  - No daily caps: farming cannot beat the baseline because the baseline is
    all it produces.
- **Death:** loses the run's haul (power spills as minerals, salvage as
  gold). Banked credits and unlocks are never lost.
- **Unlocks never add raw power** (owner rule). Test: an unlock may change
  how you play, not how strong you are. Allowed: cosmetics (colours, trails,
  tags; owner art where art is needed), quality of life (loadout presets, run
  stats, settings), and options that are sidegrades of equal value (for
  example a ship variant trading speed for hull, or a choice between equal
  weapon styles). Not allowed: starting tiers, extra hull or shield, cheaper
  in-run prices, faster warp, longer missile range, anything strictly better.
- First unlock catalogue (owner approved items 1-6, 13 November 2026; ship
  variants skipped for now): hull tints (5, 300 each), thruster flame colours
  (4, 400), shield colours (3, 400), Nova kill effect (600), name badges (3,
  250) and name colours (3, 250), Run history (500, QoL: last 10 runs).
  Prices in tune.json `unlockPrices`, provisional until real runs are timed.
  The menu button is HANGAR (owner, 15 November). Ship and palette cards
  show the real ship turning on its rig; on the ships tab the ships are drawn
  at their in-game sizes relative to each other (Battlecruiser largest).
  Bought in the Hangar (menu); two taps to buy, tap an owned item to wear or
  remove it. The server sets prices, checks the balance in the same
  statement, and shows other pilots only the looks an account owns.
- Reconnect grace (owner, 15 November 2026): a dropped connection leaves the
  ship on the planet (flying on, nothing pressed, still vulnerable) for 20 s
  (net.reconnectGraceSeconds); the client reconnects on its own and takes the
  ship back. After that the ship is gone (it vanishes; no spill). A server
  update restarts the planet, so a ship cannot survive one: the client then
  says the ship was lost and offers to drop in again. The Disconnected
  screen shows why the connection closed (reason and code).

## Identity

- Pilot name (owner decision): entered on the main menu, remembered in the
  browser, shown under the player's ship and on the leaderboard.

Default (confirm):

- Anonymous account created on first visit. The browser stores a random
  secret; the server stores only its hash.
- The account holds the bank and unlocks. A recovery code lets the player
  move it to another device; losing both the browser data and the code loses
  the account.
- Built (13 November 2026): the menu creates the account on first visit and
  shows credits and the recovery code (XXXX-XXXX-XXXX, Crockford base32,
  forgiving of case, spaces and O/I/L look-alikes). RESTORE ACCOUNT turns the
  name box into a code box. Restoring gives this device a new secret; the old
  device's secret stops working (it starts a fresh account on its next visit).
  The client sends the secret once per planet connection, as its first
  message, never in a URL.
- No email, passwords or third-party login in v1.

## Netcode

Server-authoritative. The server decides movement, hits, deaths, loot,
lockdown, warp progress and extraction.

- **Planet room:** one Cloudflare Durable Object per running planet room.
  Simulation ticks at 30 Hz; state snapshots sent at 15 to 20 Hz. Runs
  asteroids.
- **Matchmaker:** one Durable Object that assigns players to a room for the
  chosen planet and opens new rooms when full.
- **Bank:** Cloudflare D1 database `steroids-alpha-stash`, created
  2026-11-10, database_id `02a083da-e0b9-4ae8-9a7d-d7c0fa292b40`, in the same
  Cloudflare account as firestorm-arena-server. Bound to the Worker as
  `STASH`. Schema in `server/migrations/` (accounts, ledger, unlocks), applied
  by the Worker deploy workflow before each deploy. Balances are the sum of
  ledger rows; one row per extraction run, so a credit can never pay twice.
- **Transport:** WebSocket, compact binary messages.
- **Own ship:** client-side prediction with server reconciliation.
- **Other ships:** snapshot interpolation (about 100 ms behind).
- **Hits:** server-side, with lag compensation capped at about 200 ms.
  Clients show local bullets immediately for feel.
- **Interest management:** each client receives only nearby entities, using
  wrapped distance.
- **Room location:** use Durable Object location hints so a room runs near
  its players (verify during implementation).
- **Persistent rooms:** a room stays alive while it has players and shuts
  down when empty. Default (confirm): a room's world (crates, asteroids) resets
  when it restarts.
- **Portability:** all game rules live in a pure TypeScript simulation
  package with no Cloudflare code, so planet rooms can move to another host
  later (for example Colyseus with WebTransport) if playtests show mobile TCP
  stutter is a real problem. Decided from measurements, not up front.

## Tuning

All feel values (speeds, turn rates, fire rates, damage,
lockdown duration, warp acceleration, warp speed, warp distance, asteroid counts, sizes and split behaviour,
tick and snapshot rates) live in `tune.json`, shared by client and server.
Tweakpane panel via `?debug=1` with copy-to-clipboard, per repo rules.

## Repo standards that apply

- Version stamp `DDMMYYrXXXX`, counter in `prototypes/steroids-alpha/version.json`.
- Device pixel ratio handling and per-Text `resolution`.
- Intent layer for all input.
- `BUILD_STATUS.md` maintained per session.

## Cost

- Development on the Cloudflare Workers Free plan.
- Persistent rooms run continuously while anyone is on a planet, so server
  time scales with how long players stay, not with match count. External
  playtests will likely need the Workers Paid plan ($5/month); usage cost to
  be re-estimated once a room's real tick cost is measured.

## v1 scope

- Solo space hub for planet select, with hangar (bank, unlock shop, choice
  of unlocked options).
- 2 PvP planets with persistent drop-in/drop-out rooms, plus 1 single-player
  practice planet.
- Pseudo-3D wrapping planet rendering.
- PvP, splitting asteroids, minerals spilled by hit ships, gold salvage
  dropped by destroyed ships (carried salvage plus a share of power), a
  moving hot zone.
- Orbital zoom transition when entering and leaving a planet.
- Two control schemes (craft-relative and direction marker) with throttle.
- 3-minute lockdown and warp-out.
- Server-side bank and unlocks with anonymous identity and recovery code.
- Phone and desktop controls.
- Placeholder art.

## Out of scope (binding for v1)

- More than 2 PvP planets and 1 practice planet, except the two clan home planets (owner, 15
  November 2026: Clan planets v0).
- Bots / AI enemy ships on Planet B (owner, 12 November: Planet A has bots,
  Planet B stays players-only PvP).
- Clouds over the map during play.
- Shared space (other players in the space hub).
- A true-sphere gameplay model (wrapping map rendered as a sphere instead).
- Trading, markets, crafting, quests, skill trees.
- Squads, parties, friends, chat, voice.
- Email/password accounts or third-party login.
- Monetisation of any kind (including buying currency).
- Persistent progression that adds raw power (owner, 13 November 2026).
- Moving off Cloudflare (Colyseus, Nakama, WebTransport) unless playtests
  justify it and the owner approves.

## Decisions recorded from the design chat

- Name: Steroids-Alpha. Browser game, space theme.
- Ship art: top-down layered parts with a slightly angled 3D look, assembled
  the way Punchies assembles fighters.
- PvP from day one. Splitting asteroids instead of bots.
- Server-side stash. Phone play kept. (Became the server-side bank, 13
  November 2026.)
- Netcode: Cloudflare Durable Objects + D1, server-authoritative, custom
  realtime netcode (not Firestorm's slow-paced sim).
- Planets: pseudo-3D spheres wrapping around the player's perspective.
- 2 PvP planets in v1, entered from the main menu, drop in/out at any time.
- A third, single-player PvE practice planet as the tutorial; consumable
  loot only, nothing rare.
- Both control schemes allowed: craft-relative and direction marker.
- Cloud layer when entering and leaving a planet, transitions only.
  (Replaced by the orbital zoom, 13 November 2026.)
- Planet select is a solo space hub: fly in space, descend to enter, reverse
  after the warp.
- Ships cannot stop and do not drift. Asteroids damage ships on contact and
  drop loot. The practice planet has no lockdown and no loss on death.
- No maximum time on a planet, for now.
- 3-minute lockdown on entry; then a Warp button comes online.
- Warp: acceleration mode, only slightly faster than base speed so pursuit is
  possible; launch out after X distance; damage resets the distance only.
- Pilot name on the main menu, shown under the ship. Kills leaderboard that
  re-orders itself; kills reset on death.
- Explosion on destruction, then Respawn or Menu.
- Marker mode slows to minimum speed at neutral; thrust scales with push.
- Ramming destroys and splits the asteroid and pushes ship and rock apart.
- Asteroids sometimes drop a health boost (25% hull).
- Shield of 50% of the old hull, hull halved; regen after 5 s at 5%/s; blue
  hexagon hit effect.
- Ships 30% darker on the night side; other objects 10%.
- Dash removed, then restored the same day: 0.5 s at 450 px/s; top speed
  350 px/s. Shield regenerates 20% of the bar per second after the delay.
- Thruster plume grows longer near top speed and in a dash.
- Planet select shows the pilot count on each planet.
- Pilot name must be typeable on phones (tap the box, the keyboard opens).
- Meta progression (owner, 13 November 2026): per run is .io; extraction
  banks hard currency; currency buys unlocks, QoL and options, never raw
  power. Gear is no longer brought in or lost. Currency comes from salvage:
  mined or taken from bots (the free-to-play baseline), taken from destroyed
  players (PvP pays more: their stack plus a share of their power), banked
  1:1 on extraction, all lost on death. A moving hot zone pays double to pull
  players together. No loot crates or wrecks.
- Main menu QR code of the game's itch page for quick joining; tapping it
  copies the link (owner decision, 12 November 2026). The QR encoder is
  written in-house rather than added as a dependency (owner choice).

## Open questions

1. Which Thunderdogs gameplay aspects to keep beyond controls: score-style
   pickups, leader bounty, special-weapon crates, ammo pickups? (Health
   pickups, a kills leaderboard and the leader bounty are now in.)
2. Ship slots and how many parts per slot in v1, now that parts are
   cosmetic or sidegrades only.
3. Tuned numbers for the economy: salvage per mineral and per bot, the
   baseline credits per typical run, and unlock prices. Claude proposes,
   owner approves.
4. Warp-mode details: steering allowed, firing allowed, cancellable?
5. What makes the 2 PvP planets different (loot tables, asteroids, size,
   look)?
6. Does a respawn on a PvP planet need a cost or delay? Right now Respawn is
   free and instant; with nothing to lose but the run, free may be right.
9. Resolved (owner, 13 November 2026): no loot crates or wrecks; gold
   salvage dropped by destroyed ships replaces them.
7. Should the Punchies part-rig be extracted into a shared package
   (`packages/part-rig`) used by both Punchies and Steroids-Alpha?
8. BRIEF.md was drafted by Claude from the design chat, not written by the
   owner as the repo rules expect. The owner should review and take
   ownership of it.


## Owner-approved calibration and live settings lab (11 November 2026)

Keep a permanent Calibration & Balance Lab link immediately below the Steroids-Alpha live game on the GitHub prototypes hub. The public lab previews the approved per-part rig and shared movement simulation, edits calibration and allowlisted gameplay/client values, and saves browser drafts. Editing does not affect live players. An explicit Publish to live action uses the owner's private loopback publisher and existing GitHub authentication; no public browser credential. A fixed main-branch GitHub workflow obtains a short-lived OIDC identity and activates one validated, content-hashed configuration in the server's transactional PlanetConfig object. Client/server prediction and rendering receive the same version at runtime without a game rebuild. Preserve code-deployment boundaries for topology, network timing and texture resolution. Reject stale publications; retain prior configurations for rollback.

Protocol v4 adds server-to-client settings messages before initial/cutover snapshots. The server remains authoritative for movement, hits, damage, cooldowns and state. Input floods cannot advance ships more than one step per server tick; packet size/rate, queues and sequence windows are bounded. This is baseline cheat resistance, not completed account authentication or bot detection. Publishing presently requires the private companion on the owner's PC; public visitors can only preview/export.

### Mobile flight information density (15 November 2026, owner)

Keep shield/hull and salvage in a small top-left header. Upgrades and leaderboard default closed, with one shallow drawer open at a time from header buttons; Warp is a compact header control. Keep the marker steering and current fire/dash/missile/mine positions. Heat feedback belongs on Fire and dash cooldown on Dash. Ground-zone ring remains, with a small mobile directional cue; omit repeated own-name/bounty plates and flight telemetry during normal combat. Desktop retains its existing layout. Owner authorized publishing this mobile UI pass after verification.

### Full art integration and mobile refinement (15 November 2026, owner)

Install the approved portal STEROIDS–α title, three blue-white energy shot sprites with baked glow, three mineral variants and two salvage coin views. Keep gameplay trajectories, hitboxes and prices unchanged. Restore the separate hover pool below ships while retaining dynamic sun shadows; drones match the carrier palette and have no ground shadow/light. Shrink mobile Fire/Dash faces by 26%, retaining their centres and usable touch targets. Use the desktop segmented hull/shield styling, including highlights/reboot/critical states, in the compact mobile header. Keep secondary mobile panels collapsed. Owner explicitly authorized integrating this set and publishing live.

### Starter transition review (owner, 16 November 2026)

Sparrow is chassis3 / ship.sparrow; Falcon retains chassis0 / ship.scrappy and Bat retains chassis1 / ship.interceptor, preserving stable ownership IDs. Protocol22 accepts chassis3 and centre-gun side0. Publish client and Worker together after review. Owner decision (16 November 2026): everyone must unlock Falcon, including existing players. No grandfathered grant or account migration. New Sparrow source has eight distinct top-down parts, 11 rig modules, the established fixed layers/facing offsets/3% shading, twin engine vibration, centre recoil, hover pool/sun shadow and per-part control FFD with sprite fallback.

### Bat and battlecruiser revision (owner, 16 November 2026)

Bat default cowlings have cobalt primary casing with ivory caps instead of an orange main panel; palette remapping follows hull colour. Requested handling is315 top speed versus Falcon350, and70% faster peak turning. With the newer explicit per-ship schema this is maxSpeed315, cruiseSpeed234 and turnRate5.44; minSpeed140, acceleration528 and braking600 are preserved. Sparrow shares Falcon movement, including the new corner-speed/dash steering rules. A later live release must publish these requested settings into the hosted record while preserving other owner tuning.

Battlecruiser-v2 adds panel seams, service hatches, vents and rivet pairs to existing silhouettes, a framed command bridge, four forward long cannons and four parented octagonal turret platforms. Two turrets are built in; existing upgrades populate up to four platforms. Painted compact turret heads aim and recoil independently within the existing fixed-Z/control-FFD rig, with no ground light/shadow of their own. Shared turret mounts now sit on deck (right±36, rear forward−9/front25.2) instead of the previous outboard escort positions. Main cannon mounts and upgrade/evolve requirements are unchanged. The existing shield emitter modules move inward slightly to make room on deck; shield gameplay is unchanged.

### Production rig review and Nexus name (owner,16 November2026)

The former Treasury is named Nexus in player-facing text; internal wire/storage names and rules remain unchanged. The permanent lab must select Sparrow, Bat, Battlecruiser, Nexus and dual-cannon tower turrets for rotation/firing and mount review using the production renderers. Falcon draft calibration remains separate from isolated production reviews, which cannot grant equipment, join rooms or publish. Capital cannon enamel casing uses the hull palette, retaining dark exposed steel barrels. The owner stopped screen grabbing; this review uses no screenshots or recordings.

### Grounded buildings and forked capital (owner,17 November2026)

Nexus/tower layers connect with muted cylindrical supports. All building enamel, trim and lights use dedicated clan ramps, independent of pilot palettes. Foundations and terrain share planet-fixed coordinates; remove spin-only texture scrolling beneath static objects, preserving travel scrolling and spin/travel sunlight. Contact shadow stays at the root; directional shadow extends from the root through the common ground projection. Tower head/barrels lift60/62 world units for a visible supported column; no footprint/rule changes.

Battlecruiser: two flush forward guns per side and a transparent open central bow channel, no two forward round glass details, stronger cardinal layer offsets. Four turret platforms and the rear bridge remain. Main cannon origins move with the approved design; weapon stats/shields/equipment stay unchanged. Local interactive review first, no recordings or computer-use visual checks; owner inspects the links manually.

## Warzone art review (owner, 17 November 2026)

Add painted damaged/destroyed towers, shield-strength coverage, Nexus health cues and a distinct charcoal/ochre Warzone planet material. Reuse production clan-colour building rigs, root-anchored shadows and authoritative siege durability. Expose independent health presets and mixed tower states in the permanent lab's isolated review scene. Preview locally for owner inspection before any live release. No simulation/tune/wire changes.

Owner refinement, 17 November2026: destroyed towers and Nexus need only neutral palette-independent damaged debris bases. Prioritize the final-hit explosion with flying physical-looking fragments. Add repeatable final-hit/repair controls to the lab; retain preview-before-release gate.
