## Current milestone

Owner calibration ffc177fd2833 is live (12 November2026), with exact JSON readback and unchanged game/render stats. Hosted publishing is prepared and closed pending owner approval of Cloudflare Access; local publisher remains stopped.

.io power loop in: minerals from asteroids are the hull, raise the shield
maximum, spill when hit, and make ships hit harder but slower and bigger,
with a cap; the leaderboard ranks by power. Before that, combat feel was
adjusted after the owner's play sessions: dash
back (0.5 s at 450 px/s, top speed 350), faster shield regen, asteroid
outlines matched to their hitboxes, longer plume at top speed, pilot counts
on planet select, the pilot name typeable on phones, leaderboard chips. Also in: explosion and death screen, marker-mode throttle, ramming,
health boosts, shield with hex hit effect, darker ships at night. Still integrating the owner's environment
handoff v09 (from Codex) in steps: the planet view, fixed-sun lighting and
thruster exhaust are done. Next: FFD tilt, then ground props with horizon
clipping, then the cloud transition, solo space hub and practice planet. The
server is live and the itch page is public and unlisted.

## What was implemented

- Permanent Calibration & Balance Lab below the live itch link on the GitHub hub, with approved reference rig/FFD, shared movement preview, validated browser drafts, JSON import/export and allowlisted stat controls.
- Hosted /manage/ owner publishing verifies Cloudflare Access signatures, issuer, audience, expiry and one owner. It remains closed until Access is configured. Existing GitHub OIDC workflow publishing remains unchanged. No local companion or browser write credential is needed.
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
  dims the ground to 30% and removes the shadow.
- Thruster exhaust (port of the handoff's ThrusterVFX, same rates, sizes and
  colours): steady idle, a burst when throttle or a turn starts, strong
  emission while held, outside engine on turns. Driven by how each ship is
  actually moving, so it also shows on other players' ships.
- Terrain art is generated at pack time from the handoff's own SVG
  definitions and checked against its manifest hashes; nothing is committed.
- Hull points with a bar; bullets also damage other players' ships.
- Dash (removed and restored on 12 November at the owner's request): touch
  button bottom right with a cooldown ring, Shift or K on keyboard, 0.5 s at
  450 px/s (`ship.dashSpeed/dashDuration/dashCooldown`). Top speed 350 px/s.
  The lab preview has its Dash button again.
- "Invisible collisions": measured in the browser, client and server agree
  (ship and rock overlapped by the client's own positions at every hit). The
  rock outline was drawn at 78-108% of the hit radius, so rams landed on empty
  space. Corners now sit at 100-112%, so the outline covers the hit circle.
- Thruster plume: longer (particles live longer and stretch) over the top
  quarter of the speed range, longest at max speed or in a dash; both engines
  run strong at max speed (`render.thrusterTopSpeedStretch`, 1 = twice as long).
- Power (owner idea, Claude's balance; all in `tune.json`):
  - Hull = minerals. Start 50 (`ship.maxHp`), cap 500 (`ship.powerCap`).
    Asteroids drop 5/3/2 minerals by size (`asteroid.mineralYield`), so a
    whole large rock is worth 19. A bot farming alone went 50 to 191 in 70 s.
  - Shield maximum = 50 + minerals above the start (500 at the cap). Regen
    is 20% of the maximum per second after 5 s quiet.
  - Growth level is the square root of how far to the cap. At the cap: guns
    x2 (`damageBonusAtCap` 1), top and dash speed -30% (350 to 245,
    `speedPenaltyAtCap`), hit radius and drawn size +50% (`radiusBonusAtCap`).
    Guns move out with the size, so shots leave the drawn wing tips.
  - Hull damage spills 50% of the hull lost (`hullSpillFraction`); death
    spills 50% of everything (`deathSpillFraction`). Spills are locked to
    the victim for 3 s (`spillLockSeconds`). Chunks of about 5, at most 12
    per spill, at most 200 pickups on a planet (oldest go first).
  - HUD: "POWER n" over the bars. The hull bar is measured against the most
    you carried this life. Leaderboard chips show and rank by power.
  - `TEST_SHIP_HP` now just makes ships take no damage (local checks only);
    a huge hull would have counted as maximum power.
- Planet select shows "N pilots" under each planet, from a new Worker route
  `GET /planets`, refreshed every 5 s (`net.planetCountRefreshMs`).
- Pilot name: typed on the menu, saved in `steroids-alpha:save:v1`, sent
  when joining, shown under every ship. The box is drawn on the canvas with
  a see-through text field placed exactly over it, so a tap lands on a real
  field and the phone opens its keyboard (the earlier hidden field was
  focused from script, which phones ignore). The field is hidden outside
  the menu.
- Kills leaderboard, top right: one chip per player (rank, name, kills
  pill; your chip outlined in cyan). Chips slide to their new rank when the
  order changes; a chip whose kills go up pops with an orange pill, and a
  climbing chip glows and draws over the one it passes. The server credits a kill to the living shooter; a player's kills
  reset to 0 on death (a respawn is a new ship).
- Death: white flash, fireball, rings and a spark spray for every destroyed
  ship. Your own death shows "Destroyed by <name>" (or "Your ship was
  destroyed"), then RESPAWN and MENU buttons after 0.7 s. Space/J respawns,
  Esc goes to the menu.
- Marker mode: at neutral or with the finger off the stick the ship brakes to
  minimum speed; thrust is push^2 (`touch.markerThrustCurve`), so a light
  push accelerates gently. Keyboard throttle still overrides.
- Ramming: the asteroid is destroyed and splits away from the ship; the ship
  is knocked back the opposite way (`ship.knockbackSpeed`, decays at
  `knockbackDecayPerSecond`) and takes contact damage.
- Health boost: 15% of destroyed asteroids drop a green cross that heals 25%
  of the hull; it disappears after 20 s.
- Shield: hull 50 + shield 50 (was hull 100). The shield takes damage first,
  regenerates after 5 s without damage at 20% a second. Blue bar above the
  green hull bar. A blocked hit lights a honeycomb of blue hexagons on the
  shield bubble where it landed (hits now carry their impact point).
- Night side: ships 30% darker (`render.nightShipDim`), asteroids and pickups
  10% (`render.nightObjectDim`).
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
- Protocol version is 8 (5 added shield, knockback and the JSON frames; 6
  removed the dash; 7 restored it; 8 added power to the roster and
  kind/value to pickups). Client and server deploy together;
  old clients reload once. Validated live settings still need no rebuild.
- Live settings published before the shield existed are upgraded on load
  (`upgradeConfig` in `sim/liveConfig.ts`): missing new fields are filled
  from the bundled values, removed ones (such as the dash) are dropped, and
  an old hull is split half hull, half shield.
- `TEST_SHIP_HP` (a `--var` on `wrangler dev`) makes ships take no damage for the
  local browser check only. Unset in production.
- Weapon, asteroid and speed values in tune.json are first values, not tuned
  by playing.

## Open questions

- Power balance is a first pass (owner delegated it). It's untested with
  real players: snowballing, how hard a capped ship is to kill (1000 hull
  and shield at the cap), and how fast the cap comes.
- The phone name fix is verified with emulated touch taps in Chromium, not
  yet on a real iPhone or Android keyboard.
- Frame rate of the planet shader on real phones is unmeasured. It does the
  projection per pixel; in this headless test without a GPU it halved the
  frame rate. If phones struggle, switch to the handoff's mesh approach.
- Day and night depend on where you are as well as the time: about a quarter
  of the map away from the lit side it is dusk. Is that the intent for play?
- The planet turns 1 degree per second (the art lab used 4 for inspection).

- PvP bullets have no lag compensation yet (the brief plans up to 200 ms).
  Hitting another player needs leading the target for now.
- "Darken the ships in the shadows to 30%" was read as 30% darker (ships at
  70% brightness at full night). If 30% brightness was meant, set
  `render.nightShipDim` to 0.7. BRIEF.md now records the 30%-darker reading.
- Respawn is free and instant on PvP planets; should it cost something once
  the stash exists? (Added to BRIEF.md open questions.)
- Tuned values for the new systems (knockback 320, heal drop 15%, pickup
  life 20 s) are first values, not tuned by playing.
- Loot drops from asteroids wait for the stash milestone.
- FFD pitch/bank tilt for the ship (needs a Phaser Mesh renderer).
- Ship art download is about 7 MB.
- Planet names, and the open questions at the bottom of BRIEF.md.
- BRIEF.md was drafted by Claude from the design chat; the owner should review
  it and take ownership.

## Known issues

- Live settings override tune.json: the published record (ffc177fd2833)
  still has top speed 380 and shield regen 5%, so the new 350 and 20% only
  apply once a new record is published. The dash values are new fields, so
  they arrive from tune.json.
- The two-client browser check is flaky in the current cloud environment
  (prediction-correction and bullet-count asserts), on unchanged main too.
  Prediction measured directly per flight phase shows 0 corrections.
- Hosted publishing awaits direct owner confirmation to create the Access application and set its issuer/audience/owner variables. Until enabled, /manage/ remains closed.
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
- Pilot names are not unique and not checked for abuse; anyone can pick any
  name.
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
# death check: a second server WITHOUT TEST_SHIP_HP on port 8788
node scripts/check-steroids-alpha-death.mjs http://127.0.0.1:4173/game-prototypes/prototypes/steroids-alpha/ ws://127.0.0.1:8788 outputs/steroids-alpha-death
```
