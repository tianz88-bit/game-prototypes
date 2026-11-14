# Human Nomad ships v2 — integration handoff, not live wiring

The new top-down interceptor and capital rig sources are here for Claude. The existing game is not imported from this directory, and this branch does not change stats, protocol, save data, calibration delivery or deployment configuration.

## Assets and registration

Run from the repository root:

```
node tools/ship-rig/human-nomad-ships-v2/restore-assets.mjs
node tools/ship-rig/human-nomad-ships-v2/kit.test.mjs
```

The restore tool uses the already-installed adm-zip dependency. It verifies each complete R2 archive and each source PNG against SHA256 before writing only the manifest's allowlisted local asset paths. Source canvases are unchanged. ship-assets.json records source dimensions, alpha>12 trim rectangles, and centre-of-trim registration used by the reviewed lab. Create the renderer frame from that rectangle, with origin .5/.5; apply calibrated physical width and preserve aspect ratio. Do not resize or recenter masters, and do not treat the flattened hangar images as flight textures. packed/ is empty because these are independently layered loose parts with transform animation, not authored sprite loops.

- interceptor/: eight new textures, twelve modules. Current design replaces the old shared-part interceptor.
- battlecruiser/: nine new textures, sixteen modules, four forward single-barrel cannons, two shield projectors and two twin-vent engine banks. Per-cannon recoilScale/recoilDelay fields must be used by the renderer; the base recoil curve is unchanged.
- deliveries.json: two ship objects plus the visual-review pack with fifteen asteroid-family assets, four palette choices for all ships/drone, day/night scenes and latest key-art board. These are new objects; the approved live starter asset object was not overwritten. verify-delivery.mjs downloads each URL and verifies hashes.

The pure rigs use nose-up degrees; the game uses radians with zero facing +X. Convert `rigDegrees = headingRadians * 180 / Math.PI + 90`. Module x/y values are absolute ship-plane anchors; parent links accumulate facing offsets only, not anchor positions. Up is the normal separated pose; side gaps reduce; down reduces most. No Z shuffle, no crossfade. Bridge/pod stays above both engine shells. Retain 3% shading per lower layer, core vibration, rigid glass/gun/core tilt and hardline FFD relief. Ordinary heading changes leave FFD off; control input activates it. Never substitute whole-ship wobble.

The two profiles include the exact reviewed FFD/motion/depth files. Interpolation, parent accumulation and pose algorithms match. Capital seed ordering is generated from module bands and its validator accepts widths up to 1200. Keep those limits/profile-specific: do not silently change the approved fighter/live validator. The flight renderer adapter, remote chassis selection, per-chassis liveConfig map and evolution FX are separate integration work; no protocol is assumed by this kit.

## Palettes and proposals

palette-remap.mjs applies the four selected primary/accent/glow mappings to original RGBA pixels before layer/night shading. Alpha, dark outlines and neutral trim are preserved. Palette zero is byte-identical. Cache resulting textures per chassis/palette; do not rebake pixels every frame or use a whole-hull tint multiply. palettes.json contains the four candidates (`palette.0` through `palette.3`); prices and migration of five legacy tint IDs are undecided, not invented here.

footprint-proposals.json separates a proposed gameplay collision circle from art dimensions. It preserves the existing Scrappy radius26/muzzles and proposes interceptor24/capital60 only for owner/Claude review. No value has been applied to tune.json. New muzzle tips are derived from fixed plane anchors and measured aspect ratios at reference art scale .18, mapped to game-local {forward,right}; exclude screen-Y facing offsets, hover, FFD and recoil from authoritative collision/muzzle tables. Turret anchors are formation proposals, not approved base drone counts or combat rules. The capital body measures 860×993 rig units (2.12× starter width, 2.65× length), not 860 world pixels after rendering scale. Do not auto-scale stats or collision from that rectangle.

## Latest peer direction and remaining gates

Claude reported owner confirmation on 14 November (Agent Comms1851d8b7): Scrappy free; Interceptor one-time bank-credit unlock and free swapping afterwards; capital mineral evolution during a run, lost on death/extraction; upgrades+power-floor+extra-cost eligibility; palettes replace hull tints without losing prior purchases. This peer report is recorded for planning, not new authority to deploy numbers or migrate saves. Claude owns pricing/stat/carry-over questions and authoritative logic.

ART_HANDOFF.md preserves the wider recent-art brief and explicitly identifies rejected designs. It contains historical PC paths for reference; use this portable kit and R2 delivery manifests for the new ship integration. Local previews (if running) are menu :5189, interceptor :5342, capital :5343. No private publisher is needed.

Delivery references: Agent Comms thread68c1ca78-6951-42ad-b725-d012a1252ab4, requests e3f56d30 and1851d8b7. Return branch/commit/tests and actual integration status there. Orbital zoom/salvage request2ff99430 remains separate and pending.
