# Human Nomad ship rig — approved baseline

Read this file, `ship-manifest.json` and `calibration-approved.json` before changing or integrating the rig. This package is the user's accepted art/rig reference, frozen on 10 November 2026. Follow the destination repository's root instructions as well.

## What to preserve

- Human Nomad design language: scrappy assembled machinery; vibrant cobalt, orange, cream and teal; broad simple shapes and readable function. Large central cockpit. Avoid dense surface detail and muddy colours.
- Twelve mounted pieces use eight transparent PNG sources. Chassis lower frame/upper deck, cockpit pod/canopy and each thruster core/cowling are separate pieces. Upper pieces cover complete painted lower pieces, not cut-out halves.
- Keep source PNG pixels, transparency and native aspect ratios unchanged. Runtime `trimFrame()` derives alpha bounds (alpha > 12) and does not edit the PNG. Copy this registration behaviour when porting; do not independently trim/recentre exported art.
- Positions in `calibration-approved.json` are owner-authored. `seed()` is a reset/example preset, NOT the approved positions. Never silently replace the approved JSON with `seed()` or old screenshots.
- Fixed Z for the entire turn: wings 10/11, lower chassis 20, upper deck 30, engine cores 42/43, cowlings 44/45, cockpit pod 50, canopy 51, guns 60/61. Cockpit stays above both cowlings. No Z shuffle, overlap crossfade, scanline, or forced separation.
- Top object has no black overlay; each lower object gets another 3% black overlay: brightness `0.97 ** objectsAbove`. Index tie-breaking is stable. Do not multiply shading by numeric Z gaps.
- Engine cores rattle independently, with lateral/axial oscillation and tiny angular vibration. Cowlings receive 12% of that engine's motion. Preserve the paired phase without making the two sprites rigidly identical.
- Gun recoil: sharp rearward kick (~22px peak, 28px envelope), wider/shorter squash, stretched recovery, 600ms duration, right gun delayed 80ms. Scaling is temporary and must not mutate calibration.
- Hard ground shadow, no blur; cached union of source module footprints. Aircraft lift 28px is independent of layer offsets. Shadow offset/opacity comes from approved JSON. Ground shadow does not inherit hover/raised-piece offsets or warp with FFD.

## Coordinates and interpolation

Source art faces Up. Heading 0/90/180/270 means Up/Right/Down/Left, increasing clockwise. Module `x/y` are ship-space mount coordinates in `rig.mjs`; per-facing corrections are screen-space values in the calibration JSON. Positive UI Layer Y gap becomes a negative JSON Y correction.

`blendOffsets()` uses a periodic monotone cubic Hermite curve through the four authored values. It is exact at cardinal views, has continuous first derivatives across them and across 360/0, and does not overshoot scalar endpoint ranges. Do not restore the previous smoothstep-at-every-cardinal implementation: larger owner-authored cockpit offsets made its repeated stopping visible as wobble.

`stackOffset()` recursively accumulates parent corrections. The hierarchy is recorded in `ship-manifest.json`. Preserve this accumulation; do not apply a child's corrections twice. Vibration/recoil are temporary transforms after calibration. Main source sprites rotate continuously, rather than switching directional textures.

The original visual calibration rule was Up normal, Side shorter upper-layer spacing, Down most foreshortened. Owner edits override those starter proportions. Do not reapply an automatic 62.5%/25% preset to schema 7 data.

## FFD and control response

This is **per-part mesh deformation with a shared ship tilt**, not a flattened whole-ship image warp. Chassis/deck/cowlings have shallow, piecewise linear ridge relief. Glass, guns and engine cores are planar panels. The current 5x5 vertex/32-triangle grid follows broad panel bands and centre ridges; it is not yet a fully traced hard-line cage.

- Ordinary heading changes and Auto rotate are level by default: no FFD deformation.
- Actual positive acceleration dips nose toward -13 degrees; braking raises it toward +17 degrees while speed decreases.
- Yaw left banks toward **+22 degrees**; yaw right toward **-22 degrees**. This inversion is the owner's latest correction. Preserve yaw heading direction independently: left decreases heading, right increases it.
- Pitch/bank act relative to the ship's heading. `bodyTiltPoint()` rotates into ship axes, projects, then rotates back. A right turn must not become an unrelated screen-axis tilt when the nose points sideways.
- Smooth response/release uses exponential settling. Releasing inputs returns to level. Default position interpolation, engine vibration and fixed Z continue normally.
- Manual tilt/animated tilt are lab overrides only. Production gameplay reads acceleration/deceleration and yaw intents/state, not the lab DOM buttons or preview speed.

The lab controls W/S or Up/Down for thrust/brake, A/D or Left/Right for yaw, Space for fire. Pointer buttons hold or pulse for 0.9 seconds. The preview stays centred and simulates speed 0–300; it is not gameplay movement or a production physics model. Ignore keyboard controls while editing form fields; clear held inputs on focus loss.

The current mesh implementation bakes textured triangles into pooled Canvas textures at up to 256px source resolution, with cached/quantized updates. It proves the visual treatment. It is **not a performance-approved production renderer**: for game integration, use the existing Phaser/WebGL Mesh facility or equivalent vertex pipeline, preserve the look, and profile on target devices. Keep straight panel edges, attachment alignment and triangle winding; do not turn metal into rubber. No new dependency is required merely to use meshes.

## Asset storage and restoration

GitHub stores source, calibration, manifest, hashes and this guide. PNG/ZIP/atlas assets belong in Cloudflare R2 under the destination repo's art policy. Do not force-add binary art to Git to bypass its ignore rules.

`ship-manifest.json` lists each active texture's SHA-256, size, lab `path` and production-style `deliveryPath`. The prepared art ZIP uses `loose/ships/human-nomad/scrappy-v1/*.png`. Its staged object name is `steroids-alpha_human-nomad-v1_assets.zip`; **check `storage-status.json` before assuming it was uploaded**. Do not invent a public URL or silently overwrite an existing R2 object. The local full baseline ZIP includes the art and Phaser vendor bundle needed to run this lab immediately.

For a GitHub-only checkout, restore assets by copying each delivery file to the manifest's lab `path`; verify SHA-256 before running. Restore `assets/concept.png` and `review/approved-preview.png` from the full baseline archive if reference previews are wanted. Vendor Phaser is the same lab bundle, with its MIT notice under `vendor/`.

## Run and verify

Use Node.js 22+ (this freeze was checked with Node 24). From this folder:

```sh
node rig.test.mjs
node depth-effects.test.mjs
node flight-motion.test.mjs
node ffd.test.mjs
node verify-baseline.mjs
node server.mjs
```

Open http://127.0.0.1:5340/ . Use a different `PORT` if 5340 is already occupied. Do not stop another project's server or replace the owner's working lab. The only editable runtime file is `calibration-draft.json`; Save draft writes it. Keep `calibration-approved.json` immutable. To restore approved working positions, copy the approved file to the draft explicitly; do not Reset selected part expecting the approved snapshot.

Visually check four cardinal and four diagonal headings, level rotation, thrust/brake, both yaw directions, release to level, FFD on/off, recoil during level and bank, engine/core relative movement, native art aspect and hard shadow. Verify the console and all asset loads. For production integration, also run the target repo's typecheck/build/browser checks and update its build status.

## Replicate for a new ship

1. Copy this baseline into a NEW ship folder/ID. Keep this approved version intact. Start with a different Human Nomad silhouette to prove adaptability.
2. Supply complete transparent nose-up modules, with obvious cockpit/engine/weapon roles. Keep split core/cowling and pod/canopy where useful; finish covered lower surfaces.
3. Author the new module list: unique ID, source texture, native size/aspect, mount X/Y, parent, fixed Z, mirror, motion group and motion role. Export a new manifest. Do not assume every ship has exactly twelve pieces.
4. Calibrate Up/Right/Down/Left X/Y corrections against the assembled ship; inspect the full turn. Save a NEW approved calibration; never change the Human Nomad v1 calibration to fit a second ship.
5. Adapt `relief()` and the mesh grid to that ship's panel corners/ridges, pin important attachment points and preserve rigid glass/barrels. Verify no triangle inversion. A uniform grid is the prototype starting point, not final authored topology.
6. Reuse the interpolation, cumulative parenting, stable shading, control response, recoil and idle motion. Current code has ship-specific IDs/asset-role tests in `rig.mjs`, `ffd.mjs` and the renderer; extract those as ship profile data when generalising. It is a reference rig, not already a drop-in arbitrary-ship engine.
7. Bind gameplay's intent/physics state to the reusable motion functions. Do not copy lab keyboard listeners or DOM UI into gameplay; follow the destination's input and Phaser UI rules.
8. Run the tests above plus new-ship calibration/asset checks. Preserve an approved snapshot and versioned asset manifest before using it as another baseline.

Do not revive rejected Z/crossfade experiments from the original output folder or historical screenshots. This snapshot contains only the accepted active runtime.
