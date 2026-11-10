# Steroids-Alpha

Status: DRAFT for owner review. Nothing here is built yet. Sections marked
"Default (confirm)" are proposals, not decisions; change them freely.

## Pitch

A space-themed, top-down, real-time PvP extraction shooter for the browser.
Arcade dogfighting feel (top-down shoot 'em up) combined with extraction
survival: players drop onto a planet with gear from their stash, loot, fight
other players, and must reach an extraction point to keep what they carry.
Dying loses everything brought in and picked up.

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

1. **Hangar:** pick ship parts from your stash and assemble a ship.
2. **Drop:** matchmaker places you on a planet raid with other players.
3. **Raid:** fly, fight, loot. Other players are a threat and a source of loot.
4. **Extract:** reach an extraction point and survive the extraction timer.
5. **Result:** extracted means gear and loot go to stash. Destroyed means all
   of it is lost and drops as loot for others.

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
- Placeholder-first: coloured shapes per slot until owner art arrives.
- Art pipeline per repo rules (R2 zip, packed/ and loose/).
- The Punchies lab is plain JavaScript and unmerged. Steroids-Alpha ports the
  concept to TypeScript; it does not import from the experiment folder.

## Flight and combat

Default (confirm), Thunderdogs-style arcade controls:

- Ship always moves forward; player steers direction and throttles.
- Primary fire from equipped weapon(s).
- Dash: short burst of speed on a cooldown or energy cost.
- Energy meter shared by firing and dashing (exact rules to confirm).
- Hull HP; destroyed at 0.

Controls through the intent layer (repo rule):

- Desktop: keyboard steer/throttle, fire, dash.
- Phone: left-side virtual joystick to steer, right-side buttons for fire and
  dash.

## Planets and raids

Default (confirm) for v1:

- One planet map, free-roaming top-down (not a scrolling shmup screen).
- 8 to 12 players per raid.
- Raid timer (length to tune). If the timer runs out, everyone still in the
  raid loses their gear.
- One or two extraction points; extracting takes a few seconds of staying
  inside the zone, cancelled if you leave it.
- Loot sources: loot crates on the map and wrecks of destroyed players.
- Space theme visuals: planet surface or orbit backdrop, hazards optional
  (out of scope for v1 unless requested).

## Loot and stash

- Stash is server-side (owner decision). Clients never write stash data.
- Loot = ship parts plus a simple currency or salvage (default, confirm).
- On raid entry the server moves the equipped loadout from stash into
  "in raid". On extract, loadout and carried loot return to stash. On death or
  disconnect beyond a grace period, it is lost.
- Cargo capacity limits how much can be carried (default, confirm).
- Starter loadout so a player with an empty stash can always raid
  (default, confirm).

## Identity

Default (confirm):

- Anonymous account created on first visit. The browser stores a random
  secret; the server stores only its hash.
- A recovery code lets the player move their stash to another device.
- No email, passwords or third-party login in v1.

## Netcode

Server-authoritative. The server decides movement, hits, deaths, loot and
extraction.

- **Raid room:** one Cloudflare Durable Object per planet raid. Simulation
  ticks at 30 Hz; state snapshots sent at 15 to 20 Hz.
- **Matchmaker:** one Durable Object that groups players into raids and
  creates raid rooms.
- **Stash:** Cloudflare D1 database (players, inventory, raid history).
- **Transport:** WebSocket, compact binary messages.
- **Own ship:** client-side prediction with server reconciliation.
- **Other ships:** snapshot interpolation (about 100 ms behind).
- **Hits:** server-side, with lag compensation capped at about 200 ms.
  Clients show local bullets immediately for feel.
- **Interest management:** each client receives only nearby entities.
- **Room location:** use Durable Object location hints so a raid runs near
  its players (verify during implementation).
- **Portability:** all game rules live in a pure TypeScript simulation
  package with no Cloudflare code, so raid rooms can move to another host
  later (for example Colyseus with WebTransport) if playtests show mobile TCP
  stutter is a real problem. Decided from measurements, not up front.

## Tuning

All feel values (speeds, turn rates, dash, energy, fire rates, damage, raid
timer, extraction time, tick and snapshot rates) live in `tune.json`, shared
by client and server. Tweakpane panel via `?debug=1` with copy-to-clipboard,
per repo rules.

## Repo standards that apply

- Version stamp `DDMMYYrXXXX`, counter in `prototypes/steroids-alpha/version.json`.
- Device pixel ratio handling and per-Text `resolution`.
- Intent layer for all input.
- `BUILD_STATUS.md` maintained per session.

## Cost

- Development on the Cloudflare Workers Free plan (estimate: about 6 full
  12-player, 15-minute raids per day).
- External playtests will likely need the Workers Paid plan ($5/month).
  Estimated usage cost beyond that is under one cent per raid.

## v1 scope

- One planet, one ship skeleton, a small set of parts per slot.
- Hangar with stash and loadout assembly.
- Matchmaking into a raid, PvP, loot crates, player wrecks, extraction.
- Server-side stash with anonymous identity and recovery code.
- Phone and desktop controls.
- Placeholder art.

## Out of scope (binding for v1)

- Multiple planets or planet selection.
- AI enemies or bots (PvP only, owner decision). Revisit if raids are too
  empty during playtests.
- Trading, markets, crafting, quests, skill trees.
- Squads, parties, friends, chat, voice.
- Email/password accounts or third-party login.
- Monetisation of any kind.
- Moving off Cloudflare (Colyseus, Nakama, WebTransport) unless playtests
  justify it and the owner approves.

## Open questions

1. Which Thunderdogs gameplay aspects to keep beyond controls: bones-style
   score, leader bounty, special-weapon crates, pickups?
2. Ship slots and how many parts per slot in v1.
3. Do part stats exist in v1 (speed, thrust, handling, armour, power), or is
   v1 cosmetic plus weapons only?
4. Raid length, players per raid, number of extraction points.
5. Should the Punchies part-rig be extracted into a shared package
   (`packages/part-rig`) used by both Punchies and Steroids-Alpha?
6. Empty raids: PvP-only from day one means a raid with one human is empty.
   Accept for v1, or add a minimum-players wait in matchmaking?
