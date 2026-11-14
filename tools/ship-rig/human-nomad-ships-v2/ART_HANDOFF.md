Delivery update: the local-only status below is historical. The ships are now in this portable kit; all three R2 objects in deliveries.json have been downloaded and SHA256 verified. See README.md for restore commands and current gates.

# Steroids-Alpha — current art and ship/menu handoff to Claude

Owner request, 14 November 2026: update the menu review with the new ships and palette choices, send Claude all recent art, and let Claude think through changing ships. This is an art handoff and planning request; it does not authorize deploying new gameplay/balance values. These files are in `C:/Users/Zitian/Documents/ChatGPT/Gamedev/outputs/steroids-alpha/`.

## Start here: current files

| Surface | Current source / review |
|---|---|
| Main-menu hangar | `hangar-review-v02/` — index.html, hangar.mjs, hangar-data.json, 16 palette PNGs in assets/, build-assets.py, asset-manifest.json, desktop/mobile screenshots and verification.json. Local preview :5189. Standalone review, no game connection. |
| Current interceptor | `human-nomad/interceptor-overhead-lab/` — ship-profile.mjs, calibration-draft.json, assets/new-v2/*.png, rig.mjs, ffd.mjs, flight-motion.mjs, depth-effects.mjs, prompts/provenance, tests and rotation GIF. Eight new textures / twelve modules. Local lab :5342. |
| Current battlecruiser | `human-nomad/battlecruiser-lab/` — ship-profile.mjs, calibration-draft.json, assets/capital-v1/*.png, accepted rig/motion files, defence-preview.mjs, prompts/provenance, scale-check.json, tests and rotation GIF. Nine new textures / sixteen modules. Local lab :5343. |
| Approved starter | `releases/human-nomad-rig-v1-20261110/` and the existing production Human Nomad source. Remains unchanged. Current assembled stills are `key-art-v04/inputs/ship-locked-{0,35,315}.png`. |
| Lighting / depth / palettes | `key-art-v04/human-nomad-key-art-v04.png`, compose-v04.py, study-settings.json, scene-day-left.png, scene-day-right.png, scene-night.png and ship/drone-palette-{0..3}.png. Uses captured game terrain, not a generated scene. |
| Asteroid families | `key-art-v02/`: candidate-rock-0/1/2.png are ochre, lavender, teal parents. Each colour has medium-1/2 and small-1/2 PNGs (e.g. ochre-medium-1.png). Fifteen assets total, scale-and-families.json specifies proposed family sizes/inheritance. |
| Drone | `key-art-v04/drone-palette-{0..3}.png`; base reference also key-art-v02/candidate-drone.png. One generic design, owner primary/accent/glow inherited. New menu exports use the same remapping as ships. |
| Source captures / existing effects | `key-art-v01/` export-current-assets.cjs, export-thrusters.cjs, source-poses.json, live-config.json, assembly-registration.json, source-manifest.json; exported existing minerals/heal/shot/hit images are references, not newly released replacements. |

Localhost and Windows paths are accessible only on this PC. They are not hosted releases. A remote Claude cannot fetch these automatically. No new R2 asset version or GitHub PNG commit was made. Keep binaries out of Git and preserve the existing approved asset storage workflow when integration is authorized.

## Superseded — do not integrate

`human-nomad/interceptor-lab/` is the earlier shared-part interceptor, not the current new-part craft. `ship-lineup-v01/`, `ship-redesign-v02/` and `hangar-review-v01/` contain superseded shared-part/stretched or tilted-camera designs. The current sources are the two overhead labs and hangar-review-v02. Key art v01/v02/v03 boards are historical; v04 supersedes the lighting and drone-ground-effect presentation, while v02's individual asteroid family assets remain current candidates.

## Non-negotiable art/rig contract

True top-down orthographic plan with shallow visible edges like Zelda map objects, not a tilted camera or front elevation. Keep the approved fighter's vibrant cobalt/orange/cream, deep navy contours, broad shaded planes, rounded bevels and readable module functions. New silhouettes/components share the language, not copied major parts. The rig supplies apparent height through parented cardinal X/Y offsets: Up normal, side gaps reduced, Down most compressed. Use exact endpoint interpolation with continuous velocity and no overshoot. Fixed Z, cockpit/bridge above engine hoods, no Z shuffle or crossfade. Top layer has no black overlay; each lower layer adds 3%. Core vibrations, slight shell motion, exaggerated gun recoil with squash/stretch remain. Ordinary rotation has no FFD; acceleration/braking/yaw activate module FFD, with the accepted reversed yaw-bank direction. Do not replace this with whole-ship wobble.

The capital rig uses the same interpolation/pose/depth algorithms. Its order seed is generated from module bands so all four cannon IDs are included; its isolated width validator allows 1200. Recoil displacement has a per-cannon multiplier/delay. Do not globally alter fighter calibration or limits when integrating the capital profile.

## Menu / ship-change planning requested from Claude

- Start menu chooses **Scrappy or Interceptor + palette**. Combat upgrades remain earned in-game. No starting weapon kit selection.
- Either fighter can evolve into the battlecruiser through a **mineral purchase during the current run**, replacing the current ship. It is not a permanent unlock or initial menu choice.
- Capital native assembly is 860×993 world units excluding shield/drones/shadow: 2.12× starter width and 2.65× length; 2.51× interceptor width and 4.49× length. Preview zoom is not world scale or collision radius.
- Four independent single-barrel cannons fire forward. Flank survival relies on turrets and heavy shields. The art has two shield generators and the lab demonstrates two palette-matched floating turret drones. The two-drone count is a demonstration, not approved progression balance.
- Define a server-authoritative chassis/palette identity and atomic mineral-spend/evolution transaction with duplicate-request protection. Propose rules for carrying upgrades, HP/shield state, weapons and drones; updating collision/physics/reconciliation; remote-client rendering; death/extraction/reconnect; and compatibility with hosted calibration delivery. Do not trust client-supplied stats or mineral balances.
- Price, eligibility, upgrade transfer, HP, shield capacity/recharge, cannon damage/cadence, turret scaling and movement stats are still undecided. Return a concrete plan and questions for the owner instead of inventing or deploying them.
- Preserve each rig's part anchors/trim metadata, mirrored wings, layer parenting, exact new module widths and per-facing offsets. Do not treat flattened menu PNGs as flight sprites or auto-scale fighter stats to the art footprint.

## Other recent visual decisions

Ship dynamic shadow follows projected sun direction and fades below the horizon. A separate hover-light pool stays visible at night; its reference anchor is +2 screen X and +35 screen Y from ship centre at 1600×900. Drone ground lights and shadows are removed; only the drone's own emissive core/jet remains. Planet lighting follows planet rotation plus traversal, with no independent sun clock. Key-art ship width is 75.733px against a 1351.667px planet diameter in the 1600×900 comparison. Rim glow is wide/soft. Source scenes use the current captured terrain/shader. Read the real game renderer before converting screen-space reference constants into dynamic viewport/world calculations.

Asteroids are broad cel-shaded painted rocks matching the ship, not the earlier rejected flat polygon or pixel-painted look. Splits retain parent colour family but choose visually different sibling fragments within that colour. Three parents plus twelve child variations are candidates; family inheritance is not implemented by these art files.

## Verification and gates

Interceptor: four Node suites; capital: three suites, 360-degree finite poses, four parallel cannon axes, fixed stacking, calibration round trip and byte-equivalent accepted FFD/motion/depth files. Brave verified eight headings, default FFD off, control FFD, vibration, capital salvo and flank/shield demonstration. New menu: desktop 1280×720 and mobile 844×390 DPR2, all palettes, persistence, confirmation, capital preview excluded from starting loadout, zero page errors. Palette export alpha is preserved; manifests include SHA256 values.

These are local review-ready assets, not a production asset release or a multiplayer balance implementation. The new ships were advanced by the owner to the next art/menu stage, but that is not blanket deployment approval. GitHub is tianz88-bit/game-prototypes, never Venomnom/zitian-FF. itch is daily-daily-games. Keep the retired private publisher off.

Reply with the ship-change plan and any access/implementation blockers in Agent Comms thread `68c1ca78-6951-42ad-b725-d012a1252ab4`, citing this handoff and the message ID. Do not report mailbox delivery as execution.

## Separate incoming work recorded

Claude message `2ff99430-ef5a-4a30-a1f4-0d240db1a6d0` requests orbital entry/exit zoom plus salvage visual polish, replacing the cloud transition. Received and tracked separately for Codex; it is not implemented by this menu/art update. Source is the current repo's GFX_BRIEF.md/BRIEF.md and PR464 handoff, to reconcile against main before implementation.
