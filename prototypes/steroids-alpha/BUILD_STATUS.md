## Current milestone

LOCAL PREVIEW ONLY on codex/steroids-orbit-nexus-preview, based on main472a0ed. Owner requested orbital entry/exit, quieter ship UI, a larger treasury nexus and rigged twin-cannon towers, with preview before live. Review gallery: outputs/steroids-alpha/orbit-review/index.html. Nothing in this pass has been uploaded to R2, pushed, merged or deployed. Previous approved public release remains151126r0067 (PR500/501).

## What was implemented

- OrbitalTransition starts on the first own snapshot: whole globe at34% play zoom,1.8s descent and atmosphere streak, ground light/shadow fade-in and arrival pulse. Input/prediction continue. Entry begins below the fixed Warp chip.
- On extraction, the server state remains extracted while a cached own ship plays a1.5s visual departure. The usual extracted-result panel follows; ordinary death retains its700ms panel delay. DROP IN and RESPAWN replay entry; resize preserves elapsed time.
- Persistent neon selection circumference replaced by small navy/cream/cyan plates. Nose cue is smaller; engaged target meters share the panel material language.
- Seven new original painted building parts:3-layer treasury nexus and4-part towers with a duplicated barrel. Fixed layers, projected bearing/foreshortening, separate ground shadows, clan palettes and alternating visual barrel recoil/flash. Treasury foundation260world units; no simulation footprint/radius/firing change.
- Boot/pipeline loads bounded shared runtime textures; procedural building fallback remains. Scene rebuild/shutdown releases owned views. Seven original PNGs, exact generation metadata and ZIP stay in outputs/steroids-alpha/buildings-rig-v01; content-addressed cache supports local builds.
- Required config regression test had a pre-existing concurrent-publish winner assumption. It now verifies the actual winner, then uses a separate deterministic edited record for later fixtures. Server code unchanged.

## Validation

- Typecheck and production build pass (existing repo bundle-size/dynamic-import warnings only).
-396rig poses and14400FFD points pass; sim suite passes; live-config suite passes3consecutive runs after the test-only race correction.
- Brave desktop1280x720/mobile844x390 DPR2: real entry input/prediction, resize continuity, extraction retention/result timing, real DROP IN/RESPAWN and normal death timing pass, zero browser errors. Four animated renderer captures plus phase screenshots. Entry/departure deterministic frames use local visual fixtures; real input was checked separately.
-36building captures (24scene states plus12camera-orbit frames), both clans and viewports. Alternating barrel recoil verified.14shared clan textures plus1shadow texture; raw source textures released;7views/40images stable across120camera updates.
- Canvas fallback renders all7buildings with14shared textures and completes arrival; no page errors.
- Two real connected desktop/mobile clients atDPR2: alpha with4bots56.34/56.28FPS, Crimson56.28/56.30FPS, p95~18.1ms; real fire/dash pass, zero browser errors.

## Assets and publication gate

Proposed object steroids-alpha_buildings-rig-v1_assets.zip is NOT uploaded. Source ZIP7,939,933bytes; SHA-256 d34070bccdb67d0e901d7972504a5b2478f477dcc712a8e796bf41c6d6c30a15. Metadata: art/buildings-v1/assets.json. No PNG/ZIP is in Git. A clean remote build will need this exact source object uploaded only after owner review approval. No PR is opened because repo auto-merge would publish.

## Known limits

- Phone emulation is not real phone/Safari/Android performance evidence.
- Departure/death visual timing tests stage local flags rather than performing real extraction/banking; existing simulation tests cover authoritative extraction rules.
- Per-chassis hosted calibration remains a separate task.

## Next proposed step

Owner reviews orbital motion, nexus proportions, tower readability and restrained ship markers in the local gallery. After approval: upload/re-fetch/hash-verify the exact source ZIP, rebase against current main while preserving Claude's changes, run required checks, PR/merge/deploy and verify the public itch build. Current publication approval has not been given for this preview.
