# Punchies relaunch rig and combat lab

This is the new Punchies experiment, copied from the approved local development lab on 10 November 2026. It is separate from the original production game in prototypes/punchies. Nothing in this folder deploys to itch or staging.

## Run locally (Windows, Node.js required)

From this directory:

```powershell
./setup-assets.ps1
$env:PORT='5338'
node ./rig-lab/server.mjs
```

Open http://127.0.0.1:5338/ for the calibration lab or http://127.0.0.1:5338/?combat=1 for combat. Stop your previous server before starting a replacement; run one instance only.

The setup script downloads the versioned artwork/Phaser bundle from this repository's GitHub release, verifies its SHA-256 and extracts it. Artwork stays outside Git, following repository policy. No npm install or production build is required.

## For Claude

Start with rig-lab/CALIBRATION_LAB.md, rig-lab/COMBAT_PROTOTYPE.md and rig-lab/PERFORMANCE_CHECK.md. Older design notes in rig-lab are historical; these three documents and current source take precedence. The rig-lab README links back here.

- Marco boxer is the frozen approved baseline; casual Marco and a stationary wooden dummy use the same layered puppet.
- Face and hair/crown are separate layers. Offsets interpolate between four independently tuned directions; rendering order switches across diagonals.
- Movement continues during attacks. Punch direction is committed until the animation finishes.
- Tap Attack for jab; flick/drag aim for a quick cross; hold to charge up to +50% cross damage over one second. An incoming hit cancels charging. Stop and flick movement to cancel a charge into a dash.
- Neutral frontal guard, deliberate perfect guard, directional flick dash and a separate placeholder super are implemented.
- This is a plain JavaScript/Phaser experiment, preserved as tested; it is not yet integrated with the production TypeScript/Vite game.

Run model and gait regression checks:

```powershell
node ./rig-lab/combatModel.test.mjs
```

## Calibration and persistence

rig-calibration/marco-boxer contains the immutable approved-2026-10-27.json plus renderer/geometry snapshots. Do not overwrite it. The three punchies-rig-tuning-*-draft.json files are editable local working calibrations; the server saves beside rig-lab so code updates do not erase them. The included copies preserve the current local tune.

Browser/device feel testing remains necessary. The previous performance audit found stable object/texture counts and no sustained heap growth in a short stress run; it did not prove that all lag reports are resolved.
