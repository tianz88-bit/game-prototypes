## Current milestone

Integrating the owner's environment handoff v09 (from Codex) in steps. Done:
the planet view (composition C), fixed-sun lighting, and thruster exhaust.
Next: FFD tilt, then ground props with horizon clipping, then
the cloud transition, solo space hub and practice planet. The server is live
and the itch page is public and unlisted.

## What was implemented

- Permanent Calibration & Balance Lab below the live itch link on the GitHub hub, with approved reference rig/FFD, shared movement preview, validated browser drafts, JSON import/export and allowlisted stat controls.
- Private Publish to live companion uses existing GitHub login and a fixed main-branch workflow. The Worker verifies the short-lived OIDC signature and repository/branch/workflow/audience/expiry before activating data. No browser write credential.
- Transactional PlanetConfig storage retains a content-hashed active version and ten prior versions, rejects stale publications, and delivers updates to rooms within 15 seconds. Config records precede new snapshots; prediction and rendering follow server-issued values without a game rebuild.
- Input floods cannot buy extra movement steps; server queues, packet rates/sizes and sequence windows are bounded.

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
- Planet view: the map is drawn as a ball seen from above with visible side
  rims, a soft rim glow and an atmosphere halo, using the handoff's terrain
  (base tile and sand channels). Ships, asteroids, bullets and effects go
  through the same projection and vanish over the horizon.
- Fixed sun: terrain, rim, ship brightness and the ship's hard shadow follow
  one sun as the planet turns (server clock) and as the ship travels. Night
  dims everything to 30% and removes the shadow.
- Thruster exhaust (port of the handoff's ThrusterVFX, same rates, sizes and
  colours): steady idle, a burst when throttle or a turn starts, strong
  emission while held, outside engine on turns. Driven by how each ship is
  actually moving, so it also shows on other players' ships. A dash counts
  as throttle. Replaces the placeholder dash flame.
- Ships and asteroids dim only 10% on the night side (owner decision,
  `render.nightObjectDim`); the ground still goes dark.
- Terrain art is generated at pack time from the handoff's own SVG
  definitions and checked against its manifest hashes; nothing is committed.
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
- Protocol version is 4. Initial client/server upgrade must deploy together and old clients reload once; subsequent validated live settings need no rebuild.
- `TEST_SHIP_HP` (a `--var` on `wrangler dev`) raises ship hull points for the
  local browser check only. Unset in production.
- Weapon, asteroid and speed values in tune.json are first values, not tuned
  by playing.

## Open questions

- Frame rate of the planet shader on real phones is unmeasured. It does the
  projection per pixel; in this headless test without a GPU it halved the
  frame rate. If phones struggle, switch to the handoff's mesh approach.
- Day and night depend on where you are as well as the time: about a quarter
  of the map away from the lit side it is dusk. Is that the intent for play?
- The planet turns 1 degree per second (the art lab used 4 for inspection).

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

- Publishing needs the private publisher on the owner's PC (npm run steroids:lab); phone-only administrator login is not included.
- Baseline cheat resistance is in place, but player authentication, anonymous multi-session abuse, bots/aim automation and competitive telemetry remain future work.

- Not yet tested on a real phone or over a real network.
- The itch embed's orientation is still "Default"; it could be set to
  Landscape so mobile itch launches sideways (an itch page setting).
- Landscape phones show about 195 px above and below the ship; the camera may
  need to zoom out once tested on a real phone.
- Asteroids, bullets and effects are placeholder shapes.
- Ground props (crater, rocks, wreck, landing pad) are not drawn yet.
- The rig is not complete against the lab: FFD pitch/bank tilt is missing, so
  thruster nozzles are placed without tilt.
- The sand channels use a slightly sheared layout so they repeat across the
  map seam; the lab's rotated layout did not divide the map.
- A bullet fired by another player appears slightly ahead of that ship's
  drawn position (the ship is drawn about 100 ms in the past).
- On a narrow phone the fire button sits in the left half, where the stick
  also lives; the button takes priority.
- With `?debug=1` on a narrow phone, the Tweakpane panel covers the status line.

## Next proposed step

FFD tilt through a Phaser mesh (the last missing piece of the approved rig),
then ground props with horizon clipping. Owner checks the planet
view on a real phone for frame rate.

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
