# Steroids-Alpha

Status: DRAFT for owner review. Nothing here is built yet. Sections marked
"Default (confirm)" are proposals, not decisions; change them freely.

## Pitch

A space-themed, top-down, real-time PvP extraction shooter for the browser.
Arcade dogfighting feel (top-down shoot 'em up) combined with extraction
survival: players pick a planet from the main menu, drop in with gear from
their stash, loot, shoot asteroids, fight other players, and warp out to keep what
they carry. Dying loses everything brought in and picked up.

Inspiration: the top-down dogfight feel and layered aircraft look of
Thunderdogs, and the raid/extract/lose-it-all loop of extraction shooters.
All names, ships, pilots and art are original. Nothing is copied from either.

## Platform and stack

- Browser game. Phaser 3, TypeScript (strict), Vite, per the repo stack.
- All game UI drawn in the Phaser canvas. No DOM UI overlay.
- Must be playable on a phone (repo rule kept, no exemption). Phones play in
  landscape only (owner decision): held upright, the game asks the player to
  turn the phone sideways.
- Client deploys to itch.io via Butler (repo default for new prototypes).
- Server deploys to Cloudflare Workers (Durable Objects + D1).
- No new npm dependencies without owner approval.

## Core loop

1. **Main menu / hangar:** assemble a ship from stash parts, then pick a
   planet.
2. **Drop in:** join that planet's running room at any time.
3. **Lockdown:** for the first 3 minutes after dropping in, the player cannot
   leave.
4. **Raid:** fly, shoot asteroids, fight players, loot. Stay as long as you
   want.
5. **Warp out:** after lockdown, press Warp and survive the warp run to
   launch off the planet.
6. **Result:** warped out means gear and loot go to stash. Destroyed means all
   of it is lost and drops as loot for others.

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
- Ships and other game objects dim only about 10% on the night side, so they
  stay readable; the ground goes properly dark (owner decision).
- Thruster exhaust: steady at idle, a burst when throttle or a turn starts,
  strong while held; turning fires the outside engine. Blue and white with
  some orange, rectangular particles.
- Default (confirm): one lap of the wrapping map is one turn of the ball, so
  the light has no jump at the map seam; the drop zone starts in daylight;
  the planet turns 1 degree per second (a 6 minute day).

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
- Default (confirm): heading is locked during warp, with only slight steering
  allowed.
- Default (confirm): firing is disabled during warp.
- Default (confirm): the player can cancel warp mode and press Warp again
  later.
- Default (confirm): progress is shown as a bar filling with warp distance.

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
- Each part is both visual and functional: equipping a different part changes
  how the ship looks and how it performs.
- First approved ship: Human Nomad v1 (twin-engine, 12 parts from 8 PNGs),
  delivered as an owner-approved rig kit (branch
  proto/steroids-alpha/approved-ship-rig-v1, commit 38e7139). Its calibration
  (`art/human-nomad-v1/calibration-approved.json`) is owner-authored and frozen:
  fixed Z order, 3% shading per lower layer, engine rattle, gun recoil, hard
  ground shadow, FFD pitch/bank tilt on thrust/brake/yaw. The game uses a
  TypeScript port of that rig, checked against the kit's own output.
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
  - The leaderboard ranks by power.
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
- Dash (owner design, Thunderdogs reference, 12 November): press dash to
  start a 0.8 s charge (energy effect); hold a direction during the charge,
  and when it completes the ship snaps to that direction and boosts at 2x top
  speed for 4.5 s (3x the first version's distance), ignoring braking. No
  steering during the boost: the player commits. Dash ram damage hits shields
  first, like any damage. Touch: stick direction; keyboard: hold
  S (back) or A/D (sides) during the charge.
- Hull: power is the hull maximum. Minerals repair damage first, then raise
  the maximum. Shop purchases lower the maximum; current hull only drops if
  it is above the new maximum (owner design, 12 November).
- Gun upgrades also hold 20% more heat per tier (owner).
- Leaderboard shows each player's kills (players only) and power.
- Shield hit effect: a glowing sphere tiled with hexagons around the craft
  (owner reference image); some hexagons on the hit side flash (owner).
- Dash ram (owner picked): dashing into a ship damages it, scaled by gun
  upgrades, and throws both apart.
- Destroyed ship (owner decision): it explodes, then the player chooses
  Respawn (same planet, fresh ship) or Menu.
- Kills leaderboard on every planet (owner decision): one chip per player
  (rank, name, kills), sorted by kills. Chips slide to their new places when
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
- Default (confirm): keyboard uses craft-relative (A/D rotate, W/S throttle);
  the phone stick defaults to direction marker with a toggle to
  craft-relative. Fire and warp are buttons on both.
- Both schemes share the same turn rate and speed limits, so neither has an
  advantage.

## Asteroids

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

## Atmosphere transition

- Entering and leaving a planet passes through a cloud layer that visually
  simulates atmosphere. Transitions only: no clouds over the map during play.
- Entering: the view starts inside cloud, which rushes past and parts to
  reveal the surface (a descent).
- Leaving: after the warp ("TP") completes, the reverse (an ascent).
- Space hub (owner decision): the planet select is a space scene. The player
  flies their ship in space and dives into a planet to enter it, descending
  through the cloud layer; after the warp they rise back through the clouds
  into space. The hub is solo: only the player is in it, and it runs on the
  client. Shared space with other players is out of scope for v1.

## Loot and stash

- Stash is server-side (owner decision). Clients never write stash data.
- Loot sources: loot crates on the planet, asteroids, destroyed players.
- Loot = ship parts plus a simple currency or salvage (default, confirm).
- On drop-in the server moves the equipped loadout from stash into
  "in raid". On warp-out, loadout and carried loot return to stash. On death
  it is lost.
- Default (confirm): disconnecting leaves the ship on the planet for a grace
  period; if it is not reconnected in time, it is lost as if destroyed.
- Cargo capacity limits how much can be carried (default, confirm).
- Starter loadout so a player with an empty stash can always drop in
  (default, confirm).

## Identity

- Pilot name (owner decision): entered on the main menu, remembered in the
  browser, shown under the player's ship and on the leaderboard.

Default (confirm):

- Anonymous account created on first visit. The browser stores a random
  secret; the server stores only its hash.
- A recovery code lets the player move their stash to another device.
- No email, passwords or third-party login in v1.

## Netcode

Server-authoritative. The server decides movement, hits, deaths, loot,
lockdown, warp progress and extraction.

- **Planet room:** one Cloudflare Durable Object per running planet room.
  Simulation ticks at 30 Hz; state snapshots sent at 15 to 20 Hz. Runs
  asteroids.
- **Matchmaker:** one Durable Object that assigns players to a room for the
  chosen planet and opens new rooms when full.
- **Stash:** Cloudflare D1 database `steroids-alpha-stash` (players,
  inventory, raid history). Created 2026-11-10 (empty, automatic location),
  database_id `02a083da-e0b9-4ae8-9a7d-d7c0fa292b40`, in the same Cloudflare
  account as firestorm-arena-server. No schema or binding yet.
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

- Solo space hub for planet select, with hangar (stash and loadout assembly).
- 2 PvP planets with persistent drop-in/drop-out rooms, plus 1 single-player
  practice planet.
- Pseudo-3D wrapping planet rendering.
- PvP, splitting asteroids, loot crates, wrecks of players.
- Cloud-layer transition when entering and leaving a planet.
- Two control schemes (craft-relative and direction marker) with throttle.
- 3-minute lockdown and warp-out.
- Server-side stash with anonymous identity and recovery code.
- Phone and desktop controls.
- Placeholder art.

## Out of scope (binding for v1)

- More than 2 PvP planets and 1 practice planet.
- Bots / AI enemy ships (replaced by asteroids; may return later).
- Clouds over the map during play.
- Shared space (other players in the space hub).
- A true-sphere gameplay model (wrapping map rendered as a sphere instead).
- Trading, markets, crafting, quests, skill trees.
- Squads, parties, friends, chat, voice.
- Email/password accounts or third-party login.
- Monetisation of any kind.
- Moving off Cloudflare (Colyseus, Nakama, WebTransport) unless playtests
  justify it and the owner approves.

## Decisions recorded from the design chat

- Name: Steroids-Alpha. Browser game, space theme.
- Ship art: top-down layered parts with a slightly angled 3D look, assembled
  the way Punchies assembles fighters.
- PvP from day one. Splitting asteroids instead of bots.
- Server-side stash. Phone play kept.
- Netcode: Cloudflare Durable Objects + D1, server-authoritative, custom
  realtime netcode (not Firestorm's slow-paced sim).
- Planets: pseudo-3D spheres wrapping around the player's perspective.
- 2 PvP planets in v1, entered from the main menu, drop in/out at any time.
- A third, single-player PvE practice planet as the tutorial; consumable
  loot only, nothing rare.
- Both control schemes allowed: craft-relative and direction marker.
- Cloud layer when entering and leaving a planet, transitions only.
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
- Main menu QR code of the game's itch page for quick joining; tapping it
  copies the link (owner decision, 12 November 2026). The QR encoder is
  written in-house rather than added as a dependency (owner choice).

## Open questions

1. Which Thunderdogs gameplay aspects to keep beyond controls: score-style
   pickups, leader bounty, special-weapon crates, ammo pickups? (Health
   pickups and a kills leaderboard are now in.)
2. Ship slots and how many parts per slot in v1.
3. Do part stats exist in v1 (speed, thrust, handling, armour, power), or is
   v1 cosmetic plus weapons only?
4. Warp-mode details: steering allowed, firing allowed, cancellable?
5. What makes the 2 PvP planets different (loot tables, asteroids, size,
   look)?
6. Does a respawn on a PvP planet need a cost or delay once the stash
   exists? Right now Respawn is free and instant.
7. Should the Punchies part-rig be extracted into a shared package
   (`packages/part-rig`) used by both Punchies and Steroids-Alpha?
8. BRIEF.md was drafted by Claude from the design chat, not written by the
   owner as the repo rules expect. The owner should review and take
   ownership of it.


## Owner-approved calibration and live settings lab (11 November 2026)

Keep a permanent Calibration & Balance Lab link immediately below the Steroids-Alpha live game on the GitHub prototypes hub. The public lab previews the approved per-part rig and shared movement simulation, edits calibration and allowlisted gameplay/client values, and saves browser drafts. Editing does not affect live players. An explicit Publish to live action uses the owner's private loopback publisher and existing GitHub authentication; no public browser credential. A fixed main-branch GitHub workflow obtains a short-lived OIDC identity and activates one validated, content-hashed configuration in the server's transactional PlanetConfig object. Client/server prediction and rendering receive the same version at runtime without a game rebuild. Preserve code-deployment boundaries for topology, network timing and texture resolution. Reject stale publications; retain prior configurations for rollback.

Protocol v4 adds server-to-client settings messages before initial/cutover snapshots. The server remains authoritative for movement, hits, damage, cooldowns and state. Input floods cannot advance ships more than one step per server tick; packet size/rate, queues and sequence windows are bounded. This is baseline cheat resistance, not completed account authentication or bot detection. Publishing presently requires the private companion on the owner's PC; public visitors can only preview/export.
