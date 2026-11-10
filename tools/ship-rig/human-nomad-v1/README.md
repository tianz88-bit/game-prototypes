# Human Nomad — approved scrappy ship rig v1

Frozen 10 November 2026, after the owner's acceptance and inverted yaw-bank correction. This is an independent snapshot of the local Steroids-Alpha art lab, not a deployment or a gameplay integration.

Start with **[CLAUDE.md](CLAUDE.md)** for reuse/integration instructions. **[ship-manifest.json](ship-manifest.json)** contains module mounts, parenting, approved calibration, active asset hashes and motion conventions. **[calibration-approved.json](calibration-approved.json)** is the frozen owner calibration; the lab edits only `calibration-draft.json`.

Run `node verify-baseline.mjs`, then the four `*.test.mjs` files named in the guide, then `node server.mjs`. Open http://127.0.0.1:5340/ . Set `PORT` to run beside an existing server. No npm install is required for this self-contained lab archive.

The accepted treatment is fixed Z with cockpit above both cowlings, continuous four-facing offsets, engine-core vibration, exaggerated recoil with squash/stretch, 3% black per lower layer, and control-driven per-part FFD. Ordinary heading rotation stays level.

Storage:

- Local approved baseline: this folder, plus its sibling ZIP.
- Working art lab: `outputs/steroids-alpha/human-nomad/rotation-lab/` under the shared Gamedev workspace.
- GitHub: code/calibration/manifests/guide only; see `storage-status.json` for actual save status/link.
- R2: binary art delivery; see `storage-status.json` for upload status. A staged object name is not proof of upload.
- Source-art archive: sibling `human-nomad-source-art-v1-20261110.zip`, preserving originals, prompts and design iterations.

Art sources are AI-generated from the approved Human Nomad direction; per-part prompts are included. Runtime does not edit PNG pixels. Phaser is third-party MIT software; its notice is included under `vendor/`.

The FFD renderer is a Canvas triangle-bake prototype with coarse ridge topology. Review texture softness and performance before production; use the existing engine's GPU mesh support when porting. All motion is currently transform/mesh animation, not authored sprite animation loops.
