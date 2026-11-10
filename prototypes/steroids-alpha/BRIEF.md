# Steroids-Alpha

Status: DRAFT for owner review. Nothing here is built yet. Sections marked
"Default (confirm)" are proposals, not decisions; change them freely.

## Pitch

A space-themed, top-down, real-time PvP extraction shooter for the browser.
Arcade dogfighting feel (top-down shoot 'em up) combined with extraction
survival: players pick a planet from the main menu, drop in with gear from
their stash, loot, fight bots and other players, and warp out to keep what
they carry. Dying loses everything brought in and picked up.

Inspiration: the top-down dogfight feel and layered aircraft look of
Thunderdogs, and the raid/extract/lose-it-all loop of extraction shooters.
All names, ships, pilots and art are original. Nothing is copied from either.

## Platform and stack

- Browser game. Phaser 3, TypeScript (strict), Vite, per the repo stack.
- All game UI drawn in the Phaser canvas. No DOM UI overlay.
- Must be playable on a phone (repo rule kept, no exemption).
- Client deploys to itch.io via Butler (repo default for new prototypes).
- Server deploys to Cloudflare Workers (Durable Objects + D1).
- No new npm dependencies without owner approval.

## Core loop

1. **Main menu / hangar:** assemble a ship from stash parts, then pick a
   planet.
2. **Drop in:** join that planet's running room at any time.
3. **Lockdown:** for the first 3 minutes after dropping in, the player cannot
   leave.
4. **Raid:** fly, fight bots and players, loot. Stay as long as you want.
5. **Warp out:** after lockdown, press Warp and survive the warp run to
   launch off the planet.
6. **Result:** warped out means gear and loot go to stash. Destroyed means all
   of it is lost and drops as loot for others.

## Planets

- v1 has 2 planets, chosen from the main menu. Each planet has its own loot
  and bot setup (differences to be defined).
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
- Rendering: the surface curves away from the player's ship toward a horizon,
  and objects rise over the horizon as they approach.
- Default (confirm): curvature done by projecting and scaling each sprite by
  its distance from the camera (cheap, sharp, phone-friendly). A full-screen
  shader is used for the background only, if at all.

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
- Bots use the same ship rig and parts.
- Placeholder-first: coloured shapes per slot until owner art arrives.
- Art pipeline per repo rules (R2 zip, packed/ and loose/).
- The Punchies lab is plain JavaScript and unmerged. Steroids-Alpha ports the
  concept to TypeScript; it does not import from the experiment folder.

## Flight and combat

Default (confirm), Thunderdogs-style arcade controls:

- Ship always moves forward at base speed; player steers direction.
- Primary fire from equipped weapon(s).
- Dash: short burst of speed on a cooldown or energy cost.
- Energy meter shared by firing and dashing (exact rules to confirm).
- Hull HP; destroyed at 0.

Controls through the intent layer (repo rule):

- Desktop: keyboard steer, fire, dash, warp.
- Phone: left-side virtual joystick to steer, right-side buttons for fire,
  dash and warp.

## Bots

- Each planet has bot enemies alongside players.
- Bots fight players and drop loot when destroyed.
- Bots run on the server inside the planet room, so their count is limited by
  the room's server time. Default (confirm): a handful per planet, tuned.
- Behaviour, difficulty and whether bots fight each other: to define.

## Loot and stash

- Stash is server-side (owner decision). Clients never write stash data.
- Loot sources: loot crates on the planet, destroyed bots, destroyed players.
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

Default (confirm):

- Anonymous account created on first visit. The browser stores a random
  secret; the server stores only its hash.
- A recovery code lets the player move their stash to another device.
- No email, passwords or third-party login in v1.

## Netcode

Server-authoritative. The server decides movement, hits, deaths, loot,
lockdown, warp progress and extraction.

- **Planet room:** one Cloudflare Durable Object per running planet room.
  Simulation ticks at 30 Hz; state snapshots sent at 15 to 20 Hz. Runs bots.
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
  down when empty. Default (confirm): a room's world (crates, bots) resets
  when it restarts.
- **Portability:** all game rules live in a pure TypeScript simulation
  package with no Cloudflare code, so planet rooms can move to another host
  later (for example Colyseus with WebTransport) if playtests show mobile TCP
  stutter is a real problem. Decided from measurements, not up front.

## Tuning

All feel values (speeds, turn rates, dash, energy, fire rates, damage,
lockdown duration, warp acceleration, warp speed, warp distance, bot counts,
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

- Main menu with hangar (stash and loadout assembly) and planet select.
- 2 planets, persistent drop-in/drop-out rooms.
- Pseudo-3D wrapping planet rendering.
- PvP, bots, loot crates, wrecks of bots and players.
- 3-minute lockdown and warp-out.
- Server-side stash with anonymous identity and recovery code.
- Phone and desktop controls.
- Placeholder art.

## Out of scope (binding for v1)

- More than 2 planets.
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
- PvP from day one, plus bot enemies.
- Server-side stash. Phone play kept.
- Netcode: Cloudflare Durable Objects + D1, server-authoritative, custom
  realtime netcode (not Firestorm's slow-paced sim).
- Planets: pseudo-3D spheres wrapping around the player's perspective.
- 2 planets in v1, entered from the main menu, drop in/out at any time.
- No maximum time on a planet, for now.
- 3-minute lockdown on entry; then a Warp button comes online.
- Warp: acceleration mode, only slightly faster than base speed so pursuit is
  possible; launch out after X distance; damage resets the distance only.

## Open questions

1. Which Thunderdogs gameplay aspects to keep beyond controls: score-style
   pickups, leader bounty, special-weapon crates, health/ammo pickups?
2. Ship slots and how many parts per slot in v1.
3. Do part stats exist in v1 (speed, thrust, handling, armour, power), or is
   v1 cosmetic plus weapons only?
4. Warp-mode details: steering allowed, firing allowed, cancellable?
5. What makes the 2 planets different (loot tables, bots, size, look)?
6. Bot behaviour and difficulty.
7. Should the Punchies part-rig be extracted into a shared package
   (`packages/part-rig`) used by both Punchies and Steroids-Alpha?
8. BRIEF.md was drafted by Claude from the design chat, not written by the
   owner as the repo rules expect. The owner should review and take
   ownership of it.
