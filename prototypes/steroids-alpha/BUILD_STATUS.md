## Current milestone

Lockdown and warp-out in (13 November): 3-minute lockdown, Warp button (R / tap), warp run that resets on damage and plows through rocks, extraction with a result screen. Next: banking salvage on extraction (meta progression, see BRIEF.md Bank and unlocks). Owner-approved asteroid sprite pass (13 November): chunky pixel-painted ochre/teal/purple rocks replace the flat polygon rendering. Nine chipped silhouette/material variants, bolder shadow blocks, fewer highlights and three damage stages bring them closer to the vibrant ship style. Nearest-filtered fixed64px textures and projected4x4 meshes retain planet curvature and collision coverage; hit flash retained. Typecheck/build/rig/sim and desktop/phone DPR2 checks pass (~56FPS AMD D3D11, zero browser errors). Procedural code generates27 fixed textures once (432KiB), with pooled visible objects;300 replacement cycles remain at3active+3pooled meshes. No PNG/ZIP committed. Owner approved Tianz CLI login and verified gh identity tianz88-bit; never use zitian-FF/Venomnom for this repository. Itch namespace stays daily-daily-games.

Mobile HUD follow-up (13 November): upgrades use a shallow top row (86x34px per button at 844x390), leaving the left marker area free; desktop panels shrink to124x30px. Mobile starts marker independently of legacy desktop craft saves, then remembers explicit mobile changes. Small leaderboard Lv. shows the server-counted sum of current turret/shield/gun/missile/mine tiers, beginning at0. Upgrade-only roster changes refresh correctly; binary protocol unchanged. Typecheck/build/rig/sim/live-config and Brave desktop/mobile DPR2 checks pass, including saved preference and actual marker steering. Portrait rotate prompt retained. Asteroids currently remain procedural polygon art; owner asked about this and pixel-painted replacement preference is pending.

Visual follow-up (13 November): three asteroid outline/material families, three amber mineral forms, lance/paired-tracer/drone shot looks and hovering drone-style turrets in #457. Gun origins/targeting and combat stats retained. Hit feedback adds directional sparks and an own-hull-only border flash: outer 28 CSS px, 140ms, peak opacity 7.5%, non-stacking, centre untouched. Server hit metadata distinguishes shield overflow from shield-only hits and invulnerability. Typecheck/build/rig/sim/live-config and desktop/DPR2 border pixel checks pass; about 56 FPS on this AMD D3D11 test environment, zero console/page errors. Claude bot-spread #456 was preserved.

Bots now spawn spread over the planet, away from players and each other (13 November). Graphics brief delivered (13 November): planet surface (#448), faceted/damaged asteroids (#449), crystal/medical pickups (#450), missiles/mines/lock cues (#451), bounty badges/trackers (#452), unified canvas UI and phone control clearance (#453), explosion/shield/dash/thruster/turret polish (#454), and authoritative bot markers in this change. Desktop 1280x720 and phone 844x390 DPR2 fixtures inspected per item; real relocated STEER taps pass. Typecheck/build/396-pose rig/sim and live-config validation pass. Two clients plus four bots keep the unchanged-main headless pacing (about 32 FPS, p95 31.6ms) with zero console/page errors. Real phone hardware performance remains unmeasured. The older full browser harness has an early keyboard-turn assertion failure reproduced on unchanged main; no claim that full suite passed. New physical power-tier ship modules remain an owner art decision.

Agent Comms completed the owner-approved D1 CI-token update: existing token now has D1: Edit plus Workers Scripts: Edit, GitHub secret unchanged. Stash database 02a083da-e0b9-4ae8-9a7d-d7c0fa292b40 still has zero tables; no schema, binding or migration was created. Actual CI D1 execution awaits Claude's server persistence work.

Bounty tracker and in-flight missile lock crosshairs in (12 November). Graphics brief for Codex in GFX_BRIEF.md. Missiles and mines in (12 November): two new shop items with their own buttons and held, auto-refilling charges. Before that: bots on Planet A, dash retune, shop, overheat, aim assist.

Owner calibration ffc177fd2833 is live (12 November2026), with exact JSON readback and unchanged game/render stats. Hosted publishing has owner-approved Cloudflare Access configured for /manage/ and the owner email only; anonymous /manage/ redirects to sign-in, public /config and /health remain accessible. Real owner email-code sign-in and browser publish still await verification; local publisher remains stopped.

Auto turrets in (1 per 100 minerals, max 4). .io power loop in: minerals from asteroids are the hull, raise the shield
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
- Hosted /manage/ owner publishing verifies Cloudflare Access signatures, issuer, audience, expiry and one owner. Access is configured; a real owner email-code sign-in and publish still need verification. Existing GitHub OIDC workflow publishing remains unchanged. No local companion or browser write credential is needed.
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
  - Rebalanced 12 November (owner agreed; fights took too long): gun damage
    10 → 12, damage at the cap 2x → 3x (`damageBonusAtCap` 2). At 40%
    accuracy: equal ships at 250 die in about 6 s (was 9), at 500 in about
    9 s (was 15). Published live (db8d064d62a4).
  - Shield maximum = 50 + shop shield tiers. Regen is 20% of the maximum
    per second after 5 s quiet.
  - Growth level is the square root of how far to the cap. At the cap: top
    and dash speed -30% (350 to 245,
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
- Dash fix (owner report: "dashing doesn't boost"): a released marker stick
  brakes, and that braking used to run during the dash, so the ship snapped
  back to minimum speed as soon as it ended (and the speed readout never
  showed the boost). Now a dash sets speed to dash speed and holds it for
  the dash whatever the stick says. Afterwards, any speed above top speed
  bleeds off at the braking rate (also when gaining power), instead of
  snapping. Measured on an emulated phone: 140 → 450 for 0.5 s, then a
  smooth 0.9 s ease back down.
- Shop (`sim/shop.ts`, `tune.json` → `shop`, lab group "Shop"): one-tap
  buttons top left (keyboard 1/2/3) for TURRET, SHIELD and GUNS, each 4
  tiers with a power floor and a mineral cost paid from the hull:
  - Turrets: floors 100/150/200/250, costs 50/60/70/80.
  - Shield: +60 maximum per tier; floors 80/130/180/230, costs 40/50/60/70.
  - Guns: +25% damage per tier (2x at 4); floors 90/140/190/240, costs
    45/55/65/75. Gun tiers also scale dash ram damage.
  - The client sends BUY (item, tier on offer); the server applies it at the
    next tick and refuses wrong tiers, so a double tap buys once. Buttons go
    bright green when affordable. Replaces power-based damage and shield
    scaling (owner, 12 November).
- Overheat: each shot adds 11.3% heat; heat cools 35%/s; at 100% the guns
  lock until 30% (2 s). About 2 s of held fire overheats. Upright heat bar
  right of the health bars, red and flashing while locked. Gun damage 12 →
  16 to compensate (bursts hit hard, sustained fire is lower).
- Aim assist: within 10° ahead of each muzzle and 650 range, shots bend up
  to 5° toward a target, ships before asteroids (`weapon.assist*`). The
  server decides; the client predicts its own shots with the same rule
  against what it sees.
- Dash, charge and boost (owner design, replaces the instant dash). Current
  (12 November, after several owner revisions): 0.8 s charge, then 0.8 s
  boost at 1.8x the ship's top speed (`dashSpeedFactor` 1.8; 630 px/s fresh,
  about 500 px), 1.6 s total, with
  steering locked throughout (verified per frame in the browser); cooldown 8 s. Yellow dash bar beside the heat
  bar (refills over the cooldown, pulses while charging). Fast ships now
  collide along their path (`World.sweptHit`), so a dash cannot skip through
  a rock or a ship between ticks. Press →
  charge (`ship.dashChargeSeconds`; placeholder energy ring and sparks,
  plus an arrow on your own ship showing the held direction) → the ship
  snaps to the direction held at that moment and boosts at 2x top speed
  (`dashSpeedFactor`) for 1.5 s (`dashDuration`), ignoring the brake, then
  eases down. Cooldown 4 s from the press. The client sends the held
  direction every step (`dashAim`). Browser: holding S during the charge
  sent the boost straight back at 700 px/s.
- Hull maximum (power) vs current hull: `ShipState.hullMax`. Minerals repair
  first, then grow the maximum (to the 500 cap). Shop prices come off the
  maximum; current hull only drops if above the new maximum. Floors check
  the maximum. Speed, size, death spill and the leaderboard use the maximum.
  The HUD reads "HULL current/max". Also fixed: a live-settings update used to
  clamp every ship's hull to the starting 50.
- Gun tiers add 20% heat capacity each (`shop.gunHeatPerTier`).
- Leaderboard chips show "n KO" (player kills only) beside the power pill.
- Shield hit effect (owner reference image: a glowing hex-tiled sphere): on
  a hit, a sphere fades in over the craft, with a hex grid wrapped onto it
  (cells flatten toward the rim), a translucent blue body and a glowing rim.
  Some cells on the hit side flash, strongest near the impact
  (`render/shipView.ts` drawShield).
- Live settings 5087bc96d49a (12 November): new dash (1.5 s boost, 4 s
  cooldown, 2x speed, 0.5 s charge), calibration unchanged.
- Dash ram: a dashing ship that touches another deals 30 x gun scale, takes
  8 itself, both are thrown apart (smaller further), once per dash; orange
  ring effect. Verified in the rules test and with a real Room (fake
  sockets) that broadcasts the `rams` frame.
- Auto turrets (`tune.json` → `turret`, live-tunable, lab group "Turrets"):
  - Bought in the shop, max 4. Rear pair first, then the front pair
    (`sim/turrets.ts` mounts, scaled with ship size). Kept until death.
  - Each targets the nearest enemy ship in range (380), else the nearest
    asteroid, turns at most 4 rad/s, fires when within 0.12 rad: 2 damage
    every 12 steps (2.5 shots/s), shots at 750 px/s that fly about range.
  - Server-side only. Turret shots go to every client, owner included
    (side 10+i in SHOTS); clients aim the drawn turret from the shots and
    swing it forward after a quiet second. Placeholder domes and barrels.
- Live settings: published version 00d655a775e4 on 12 November (top speed
  350, shield regen 20%, owner calibration unchanged), through the publish
  workflow at the owner's request.
- Share QR on the menu: a QR code of https://daily-daily-games.itch.io/steroids-alpha
  beside the planet list ("Scan to join"); tapping it copies the link and
  shows "Link copied!" (or the link itself if the browser blocks copying).
  Copying runs on finger lift through the intent layer (`intents.copyZone`),
  because phones only allow the clipboard then. The link is fixed in
  `src/base.ts` (`SHARE_URL`), because inside itch the page address is itch's
  file server.
  - Uses the repo's existing `qrcode` library (as Punchies, mp-console and
    suits-mp do). An in-house encoder was written first and then removed
    when it turned out the library was already a dependency (owner decision).
- Bots (`sim/bots.ts`, `tune.json` → `bots`, live-tunable, lab group "Bots"):
  Planet A only (`PLANETS[].bots`), 4 of them, only while a real player is in
  the room; they all leave with the last player and respawn 5 s after
  dying. Named "BOT Vega" and so on, on the leaderboard; their kills count, and
  killing one counts. Brain: fight the nearest ship within 700 (leading the
  target, aim wobble ±7°, fire in bursts that stop at 85% heat and resume
  at 40%, dash in occasionally), flee below 30% hull, otherwise collect
  minerals, shoot rocks, avoid ramming them, wander; buys upgrades now and
  then. Planet select counts real pilots only.
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
- Missiles and mines (owner design, 12 November). Shop items 4 and 5, four
  tiers each (each tier = one more charge, more damage, missiles turn
  harder, mine blasts grow). Charges refill one at a time
  (`missile.refillSeconds` 6, `mine.refillSeconds` 8) and are held until
  used.
  - Missile (Q, or the touch button above fire): locks the nearest ship
    within 30 degrees of the nose and 900 px (asteroids are never locked; red
    corner brackets show the lock), homes at a capped turn rate and speeds up
    to 800 px/s, 35 damage on hit, fizzles after 3.5 s. Without a lock it flies
    straight and still hits whatever it meets.
  - Mine (E, or the touch button above dash): dropped behind the ship, arms
    after 0.7 s (blinks red), creeps at 90 px/s toward the nearest enemy ship
    within 260 px, and blows up when one comes within 70 px: 40 damage at the
    centre, half at the 110 px edge, to every enemy ship in the blast. Up to 4
    per pilot (oldest goes), 20 s life. Owners are never hurt by their own.
  - Both are visible and can be shot down (36 hp each). Turrets target
    incoming missiles first, then ships, then mines; two turrets on a missile
    for its whole flight do 35, so they need the main gun (16 a hit) to
    finish it.
  - Bots fire missiles while engaging and drop mines while fleeing.
- Bounty: the server marks the strongest real player (two or more players
  needed; bots never; the holder keeps it on a tie) and sends id + position
  twice a second (`bounty` JSON frame). The holder gets a gold ring and star;
  everyone else gets a gold arrow on an inner screen ellipse with
  "<name> <distance>m" while the holder is out of view, and a gold star on
  the leaderboard chip. The holder sees "BOUNTY ON YOU". Marker only.
- Missile lock in flight: missiles carry their target on the wire. The pilot
  who fired and the target both see a red turning crosshair on the target;
  the target also sees a blinking MISSILE LOCK.
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
- Protocol version is 15 (15: lockdown, warping, warpDist in ShipState, input bit4 warp, CLOSE.EXTRACTED 4004, 'extracted' and 'warpouts' JSON frames; 14: missile target in ORDNANCE; 13: missiles and mines: 2 input flags, 16 more ship bytes, ORDNANCE frame and `blasts` JSON frame; 12: dash charge and hull maximum; 10: heat, turrets, dash aim, BUY; 11: shield and gun tiers. Earlier: 5 added shield, knockback and the JSON frames; 6
  removed the dash; 7 restored it; 8 added power and pickup kinds; 9 turret
  shots reach their owner). Client and server deploy together;
  old clients reload once. Validated live settings still need no rebuild.
- Live settings published before the shield existed are upgraded on load
  (`upgradeConfig` in `sim/liveConfig.ts`): missing new fields are filled
  from the bundled values, removed ones (such as the dash) are dropped, and
  an old hull is split half hull, half shield.
- `TEST_SHIP_HP` (a `--var` on `wrangler dev`) makes ships take no damage for the
  local browser check only. Unset in production.
- Ordnance is sent as its own ORDNANCE frame with each snapshot (interest radius only); the client carries missiles forward between frames. Missile hits are swept so a fast missile cannot pass through a ship. Live settings published before missiles get the new groups from tune.json on load, so no republish was needed.
- Weapon, asteroid and speed values in tune.json are first values, not tuned
  by playing.

## Open questions

- Bounty needs at least two real players on the planet (Claude's call: with one player there is nobody to hunt them). BRIEF.md records it; owner may want otherwise.
- Tracker distance is shown in world pixels as "m".
- Missile and mine numbers (damage, hp, refill, lock cone, shop floors 120/100 and costs) are Claude's first pass under the owner's rules; untested with real players. BRIEF.md now records the rules.
- Mine blasts hurt only enemy ships, not asteroids; missiles do hit asteroids. Owner may want either changed.
- Copy-on-tap inside itch's frame is untested on a real phone; if itch
  blocks copying, the link is shown instead.
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

- Fixed in this pass: when a client's input arrived late, the server's guessed steps repeated one-shot presses (a missile could fire again; a warp press would toggle back off). Guessed steps now drop missile, mine and warp presses; a late warp press is owed like a late dash.
- Warp values (lockdown 180 s, distance 3000 px, about 8 s of warp at 1.15x top speed, steering 20%) are first values, not tuned by playing.
- Missile, mine, lock bracket and blast visuals are placeholders (Codex lane).
- The two-client check now ignores bots on the roster; a bot bumping the test ship can still trip its prediction-correction assert (seen once, passed on rerun).
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

Owner reviews the delivered GFX_BRIEF pass and plays missiles/mines, adjusting gameplay numbers through live settings. Claude can proceed with D1 schema/binding/migrations and investigate the existing browser-harness assertion. Future art work: FFD tilt through a Phaser mesh (the last missing piece of the approved rig),
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
