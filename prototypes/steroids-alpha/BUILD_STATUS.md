## Current milestone

Milestone 2 in progress: controls, shooting and splitting asteroids are built
and verified locally. Still to build from the owner's latest direction: the
cloud-layer transition, the solo space hub (planet select as a space scene),
and the single-player practice planet. The server is deployed
(steroids-alpha-server.tianz-88.workers.dev answers /health with protocol 3)
after the owner replaced the Cloudflare token, so the itch draft is playable
online.

## What was implemented

- Milestone 1: shared sim in `sim/`, Cloudflare Worker planet rooms in
  `server/`, Phaser client with prediction, reconciliation and interpolation,
  two planets, the approved Human Nomad ship rig.
- Throttle: ships accelerate and brake between a minimum and maximum speed,
  never stop, and do not drift.
- Both control schemes:
  - Craft-relative: left/right rotates, up/down accelerates and brakes.
    Keyboard uses this (A/D or arrows, W/S).
  - Direction marker: the ship steers toward the stick direction; how far the
    stick is pushed sets the target speed. The phone stick defaults to this.
  - A STEER button on touch switches the stick between the two; the choice is
    remembered in localStorage (`steroids-alpha:save:v1`).
- Shooting: hold fire (Space or J, or the touch fire button). The two wing
  guns alternate and kick with the approved rig's recoil. Your own bullets
  appear at once; the server decides every hit.
- Asteroids (replace bots): three sizes, straight-line travel that wraps
  around the planet. Shooting one down splits it in two; the smallest just
  breaks. Pieces keep the parent's motion, are pushed along the killing shot
  in proportion to its damage, and spread sideways, wider for a harder hit.
  Asteroids hurt ships on contact, and a ship that rams one damages it. Each
  planet keeps itself stocked with new large asteroids, away from ships.
- Landscape only on phones: a phone held upright shows a "turn your phone
  sideways" screen over everything and all input is ignored until it is turned
  (`src/scenes/rotate.ts`, `Intents.portraitBlocked`).
- Steroids-Alpha-only changes no longer redeploy the Punchies "Current WIP"
  itch slot (`.github/workflows/deploy-wip-itch.yml`).
- Hull points with a bar; bullets also damage other players' ships. A
  destroyed ship is removed from the planet and returns to planet select.
- `sim/world.ts` holds all of these rules with no networking, so the same code
  runs in the Cloudflare room and in Node tests.
- `scripts/test-steroids-alpha-sim.mjs`: rules test (throttle, fire rate,
  split vectors, contact damage, deaths, population, wire format). Runs in
  both deploy workflows.

## Key technical decisions

- Asteroids are sent as events, not in snapshots: the server sends an
  asteroid when it appears or its hp changes and when it is destroyed; clients
  compute positions from the straight-line record. Cheap on bandwidth.
- Asteroids are drawn where they will be when the player's current input
  reaches the server, so steering and shots line up with what the server sees.
- Fire cooldown counts whole simulation steps, so client and server always
  agree on which step fires.
- Wing guns are angled slightly inward (`weapon.convergeDistance`), because
  the gun mounts are wider than a small asteroid or a ship.
- A new ship drops in at the candidate point farthest from any asteroid and
  has two seconds of contact immunity.
- Protocol version is 3. Client and server must be deployed together.
- `TEST_SHIP_HP` (a `--var` on `wrangler dev`) raises ship hull points for the
  local browser check only. Unset in production.
- Weapon, asteroid and speed values in tune.json are first values, not tuned
  by playing.

## Open questions

- PvP bullets have no lag compensation yet (the brief plans up to 200 ms).
  Hitting another player needs leading the target for now.
- What should happen on death before wrecks and loot exist? Currently the
  ship is removed and the player returns to planet select.
- Loot drops from asteroids wait for the stash milestone.
- FFD pitch/bank tilt for the ship (needs a Phaser Mesh renderer).
- Ship art download is about 7 MB.
- Planet names, and the open questions at the bottom of BRIEF.md.
- BRIEF.md was drafted by Claude from the design chat; the owner should review
  it and take ownership.

## Known issues

- Not yet tested on a real phone or over a real network.
- The itch embed's orientation is still "Default"; it could be set to
  Landscape so mobile itch launches sideways (an itch page setting).
- Landscape phones show about 195 px above and below the ship; the camera may
  need to zoom out once tested on a real phone.
- Asteroids, bullets and effects are placeholder shapes.
- A bullet fired by another player appears slightly ahead of that ship's
  drawn position (the ship is drawn about 100 ms in the past).
- On a narrow phone the fire button sits in the left half, where the stick
  also lives; the button takes priority.
- With `?debug=1` on a narrow phone, the Tweakpane panel covers the status line.

## Next proposed step

Cloud-layer entry transition, then the solo space hub replacing the planet
menu, then the practice planet (a private single-player room). Owner plays
the itch draft on a phone in landscape and reports on feel.

### Run locally

```sh
node scripts/fetch-assets.js steroids-alpha steroids-alpha_human-nomad-v1_assets.zip
node scripts/pack-assets.js steroids-alpha
npx --yes wrangler@4.143.0 dev --config prototypes/steroids-alpha/server/wrangler.jsonc --ip 127.0.0.1 --port 8787 --var TEST_SHIP_HP:100000
npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort
# open http://127.0.0.1:4173/game-prototypes/prototypes/steroids-alpha/
node scripts/test-steroids-alpha-sim.mjs
node --experimental-strip-types scripts/test-steroids-alpha-rig.mjs
node scripts/screenshot-steroids-alpha.mjs http://127.0.0.1:4173/game-prototypes/prototypes/steroids-alpha/ outputs/steroids-alpha
```
