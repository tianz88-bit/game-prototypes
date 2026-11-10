## Current milestone

Milestone 1 of 6: netcode test. Built and verified locally only. Nothing is
deployed (no Worker, no itch.io upload).

## What was implemented

- Shared simulation in `sim/` (pure TypeScript, no Phaser or Cloudflare code),
  used by both client and server:
  - `ship.ts`: fixed-step ship movement. Ships always fly forward at base speed,
    steer by keyboard turn axis or joystick target heading, dash on cooldown.
  - `wrap.ts`: wrapping map helpers (planet edges connect).
  - `protocol.ts`: binary wire format (inputs, pings, snapshots).
  - `planets.ts`: the two v1 planets (placeholder names "Planet A" / "Planet B").
- Server in `server/` (Cloudflare Worker + Durable Object `PlanetRoom`):
  - `/ws/<planet>` routes to one room per planet (`<planet>:1`).
  - Room ticks at 30 Hz, sends snapshots at 15 Hz, only nearby ships per player
    (wrapped distance, `interestRadius`).
  - Drop in and out at any time; the tick loop stops when the room is empty.
  - Server-authoritative movement with a 2-input jitter buffer per player, guessed
    steps for late inputs, and recovery when a client falls behind.
- Client in `src/`:
  - Main menu with planet select (`?planet=alpha` skips it).
  - Flight scene with placeholder triangle ships on a wrapping grid.
  - Own ship: client-side prediction and reconciliation, with visual smoothing.
  - Other ships: snapshot interpolation 100 ms behind.
  - Intent layer: keyboard (A/D or arrows, Shift or K to dash) and touch (left-half
    floating joystick, dash button with cooldown ring).
  - DPR-sized buffer and per-Text resolution, version stamp top-left.
  - Tweakpane via `?debug=1`: client values live-editable, game rules read-only,
    net stats, copy-to-clipboard for both tune files.
  - `?debug=1&lag=<ms>` adds simulated round-trip lag for local feel testing.
- `scripts/screenshot-steroids-alpha.mjs`: end-to-end check with real clients
  against the local server (desktop via menu and keyboard, phone via touch with
  120 ms simulated lag, a third client dropping in and out).

## Key technical decisions

- One Durable Object per planet room, WebSocket transport, binary messages.
  Hosting stays portable: game rules live in `sim/` with no Cloudflare code.
- Server consumes exactly one client input per step so prediction lines up.
  A ship waits at spawn until 2 inputs have arrived (jitter buffer); missing
  inputs are guessed and the late ones dropped; a deficit lasting longer than
  `forgiveGuessAfterTicks` is forgiven (one correction) so a client that fell
  behind returns to real inputs.
- Client prediction runs on `performance.now()`, not Phaser's frame delta.
  Phaser smooths its delta and under-reports time at low frame rates; a 24 fps
  client was sending 22 inputs/s against the server's 30, which caused constant
  corrections. Fixed, measured at 30.0 vs 30.2.
- Server sockets set `binaryType = 'arraybuffer'` on accept (the runtime default
  for this compatibility date delivers Blobs), with an in-order Blob fallback.
- Worker `compatibility_date` is 2026-10-02 because the pinned wrangler
  (4.143.0, same as Firestorm) only supports dates up to 2026-10-03.
- Milestone 1 spawns everyone in a drop zone near the map centre so testers
  find each other. Real spawn points come with loot and bots.
- All tuning values in `tune.json` (game rules, shared, read-only in the panel)
  and `client.tune.json` (client feel). The ship values in `tune.json` are first
  placeholders, not yet tuned by playing.

## Open questions

- Planet names (currently "Planet A" / "Planet B").
- Hosting for the client: Current WIP itch slot, a new itch project, or local
  only. Deploying the Worker also needs owner approval.
- All open questions listed at the bottom of BRIEF.md still stand.
- BRIEF.md was drafted by Claude from the design chat; the owner should review
  it and take ownership, since the repo rules expect the owner to write briefs.

## Known issues

- Not deployed, so not yet tested over a real network or on a real phone.
  Local results (3 consecutive passing runs): phone with 120 ms simulated lag
  (measured RTT 154-183 ms) and a desktop at about 24 fps (software rendering
  in a container) both had 0 visible corrections in 46 snapshots; remote ships
  drawn within 44-64 px of their true position.
- No D1 binding yet. The database `steroids-alpha-stash` exists (created by
  Codex), but schema and binding come with the stash milestone.
- No version-counter bump or deploy workflow yet (nothing deploys).
- With `?debug=1` on a narrow phone screen, the Tweakpane panel covers the
  status line. Debug only.
- No off-screen indicator for nearby ships beyond the screen edge.

## Next proposed step

Owner decides where to host so milestone 1 can be tested on real phones over
a real network (approve the Worker deploy and pick the itch slot). Then
milestone 2: firing, server-side hits with lag compensation, HP and death,
and simple bots.

### Run locally

```sh
npx --yes wrangler@4.143.0 dev --config prototypes/steroids-alpha/server/wrangler.jsonc --ip 127.0.0.1 --port 8787
npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort
# open http://127.0.0.1:4173/game-prototypes/prototypes/steroids-alpha/
node scripts/screenshot-steroids-alpha.mjs http://127.0.0.1:4173/game-prototypes/prototypes/steroids-alpha/ outputs/steroids-alpha
```
