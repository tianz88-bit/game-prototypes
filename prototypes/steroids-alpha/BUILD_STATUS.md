## Current milestone

Owner approved all reviewed orbital, building and HUD updates on 16 November 2026. Release candidate on codex/steroids-orbit-nexus-preview integrates current main 1fb8b45; public deployment and final live verification are the remaining release steps.

## What was implemented

- Orbital entry begins on the first own snapshot: 34% zoom, 1.8s descent, atmosphere streak and ground-cue fade. Prediction/input continue; resize preserves time. Extraction retains the departing craft for 1.5s before results. Current main's MENU-only extraction is preserved; ordinary death keeps its delay and respawn replays arrival.
- Approved translucent ship instruments: left shield switches to hull on depletion; one division per 10 maximum capacity. Joined right arcs show inner dash and outer remaining weapon capacity (1-heat), with staggered symbols, no right notches, and existing recovery/warning animations. Hull numbers sit beside buying. Desktop cargo is bottom-centre to clear PC key hints.
- Seven new painted parts form a raised three-layer Nexus and dual-cannon tower rigs, with projected bearing/foreshortening, clan palettes, separate shadows and alternating visual recoil. No collision, placement or firing-count changes.
- Preserved latest main mouse aim/click fire/W-thrust/S-brake, key hints, member Fuel/visitor-hidden cargo, own-top-speed exhaust and referenceHeight 1000. Existing approved ship positions, per-part control FFD and sprite fallback remain.
- Corrected only the concurrent-publisher test's winner assumption; no live-config server behavior changes.

## Key technical decisions

Original PNGs, generation records and ZIP remain in outputs/steroids-alpha/buildings-rig-v01. R2 object steroids-alpha_buildings-rig-v1_assets.zip was uploaded and publicly re-fetched: 7,939,933 bytes, SHA-256 d34070bccdb67d0e901d7972504a5b2478f477dcc712a8e796bf41c6d6c30a15. Metadata/hashes only in Git. Boot prepares 14 shared clan textures and removes raw sources. Runtime copies are capped at 384px Nexus/256px tower. Fixed layers and per-scene cleanup retain the existing sprite-rig approach.

Required typecheck/build/rig/sim/live-config/bank checks pass. Rig suite covers 396 poses and 14,400 FFD points. Brave desktop/mobile DPR2 integrated orbital entry/input/resize, extraction/result timing, death/respawn pass with zero errors (4 GIFs, outputs/steroids-alpha/orbit-release-check/report.json). Updated 36 building captures inspected. Pool stays 7 views/40 images across 120 camera updates. Two real connected desktop/mobile clients: alpha +4 bots and Crimson, about 60 FPS / p95 16.8ms, real phone-emulated fire/dash pass, zero errors. Earlier Canvas fallback and 30-state HUD checks remain recorded in the art workspace.

## Open questions

None blocking this approved release. Claude's placeholder mouse reticle and landmark icons are separate future art follow-ups.

## Known issues

Phone emulation on this PC is not physical phone/Safari performance evidence. Extraction/death visual timing uses isolated local scene fixtures; simulation tests cover authoritative rules. Existing unrelated bundle-size/dynamic-import build warnings remain.

## Next proposed step

Merge the approved release, monitor itch deployment to daily-daily-games/steroids-alpha:html5, verify the fresh public version/planet connection/art on desktop and mobile, and send final release proof to Claude in Agent Comms thread 68c1ca78.
