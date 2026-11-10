## Current milestone

Milestone 1 (netcode test) is complete and deployed to the itch draft, plus the
approved Human Nomad ship rig brought forward from milestone 5 at the owner's
request. The server is NOT deployed yet: the repo's CLOUDFLARE_API_TOKEN
secret is invalid, so the Worker deploy fails and planets show "Disconnected"
on itch.

## What was implemented

- Netcode test (milestone 1): shared sim in `sim/`, Cloudflare Worker planet
  rooms in `server/`, Phaser client with prediction, reconciliation and
  interpolation, keyboard and touch controls, menu with two planets. See git
  history for details.
- Human Nomad ship rig in the game:
  - `src/render/shipRig.ts`: TypeScript port of the approved kit's rig math
    (module mounts, periodic monotone Hermite facing offsets, parent-accumulated
    corrections, fixed Z, 3% per-layer shading, engine rattle, wing flex,
    canopy/cockpit lean on turns, gun recoil curve).
  - `src/render/shipArt.ts`: loads the 8 parts, registers each by the kit's
    alpha-bounds trim (alpha > 12), resamples once to at most 256 px, builds
    the hard ground-shadow silhouette.
  - `src/render/shipView.ts`: draws a ship (own and remote) with hover lift,
    shadow, and a ground ring (cyan for you, orange for others).
  - Boot scene loads art with progress; ships fall back to placeholder
    triangles if any part is missing.
- Art pipeline: `art/prepare-assets.mjs` (pack-assets hook) verifies every
  part's SHA-256 against the approved kit and stages it; the itch workflow
  fetches `steroids-alpha_human-nomad-v1_assets.zip` from R2 and packs it.
- `scripts/test-steroids-alpha-rig.mjs`: the port matches 396 reference poses,
  brightness, depth and recoil values generated from the original kit
  (`art/human-nomad-v1/rig-parity.fixture.json`). Runs in the itch workflow.
- Deploys: `deploy-steroids-alpha-itch.yml` (client, itch draft
  daily-daily-games/steroids-alpha:html5) and `deploy-steroids-alpha-worker.yml`
  (server, steroids-alpha-server.tianz-88.workers.dev).

## Key technical decisions

- The approved calibration is copied verbatim (SHA-256 matches the kit's
  calibrationSha256) and never edited. `seed()` is not used.
- Game heading (radians, 0 = +x) maps to rig degrees as heading + 90.
- Parts are resampled at runtime to 256 px, the same resolution the kit's own
  renderer bakes at. Source PNGs (1024-1774 px) are untouched; drawing them at
  full size would cost about 50 MB of GPU memory and alias badly at the 0.2
  ship scale.
- Netcode: one input per server step, 2-input jitter buffer, guessed steps for
  late inputs with forgiveness; client prediction runs on performance.now()
  (Phaser's smoothed frame delta under-reported time at low frame rates).
- Ship scale (`render.shipScale` 0.2), ring radius and part texture size are in
  client.tune.json. They are first values, not tuned by playing.

## Open questions

- Should FFD pitch/bank tilt come next? It needs a Phaser Mesh renderer and
  profiling on phones (the kit's Canvas bake is explicitly not production).
- Ship art download is about 7 MB (eight 0.4-1.4 MB PNGs). Owner to decide
  whether smaller delivery files are acceptable.
- Is the ground ring the right way to tell your ship from others, now that
  every ship uses the same art?
- Planet names, and all open questions at the bottom of BRIEF.md.
- BRIEF.md was drafted by Claude from the design chat; the owner should review
  it and take ownership.

## Known issues

- Server not deployed: CLOUDFLARE_API_TOKEN is rejected ("Invalid access token
  [code 9109]"). The owner needs to create a new Cloudflare API token ("Edit
  Cloudflare Workers" template) and update the GitHub secret; Firestorm's
  Worker deploys are affected too.
- Not yet tested on a real phone or over a real network.
- FFD tilt and gun recoil are not active in game: FFD needs the Mesh port;
  recoil is ported but there is no firing until milestone 2.
- The dash flame behind the rig is a placeholder shape.
- With `?debug=1` on a narrow phone, the Tweakpane panel covers the status line.

## Next proposed step

Owner replaces the Cloudflare token so the server deploys, then plays on a
phone from the itch draft. Then milestone 2 (firing with gun recoil, hits,
HP, death, bots), or the FFD tilt port if the owner wants the ship feel first.

### Run locally

```sh
node scripts/fetch-assets.js steroids-alpha steroids-alpha_human-nomad-v1_assets.zip
node scripts/pack-assets.js steroids-alpha
npx --yes wrangler@4.143.0 dev --config prototypes/steroids-alpha/server/wrangler.jsonc --ip 127.0.0.1 --port 8787
npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort
# open http://127.0.0.1:4173/game-prototypes/prototypes/steroids-alpha/
node --experimental-strip-types scripts/test-steroids-alpha-rig.mjs
node scripts/screenshot-steroids-alpha.mjs http://127.0.0.1:4173/game-prototypes/prototypes/steroids-alpha/ outputs/steroids-alpha
```
