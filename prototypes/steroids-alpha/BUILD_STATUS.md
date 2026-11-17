## Current milestone

Desktop ordnance/speed UI is implemented and verified for release. The tutorial shortening is a discussion proposal only; lesson flow/counts remain unchanged.

## What was implemented

PC missile/mine badges are24px radius with22px counts, grouped above bottom-left key hints, preserving recharge rings. Mobile sizing/positions remain unchanged. Routine top planet/population/speed telemetry and debug coordinates are hidden; connection/gameplay warnings and action controls remain.

Steady low-speed exhaust is violet and cruise exhaust teal. Fast/accelerating/turn-driving engine/boost retains the existing hot or custom flame palette. Per-chassis speed ratios preserve Bat/Battlecruiser differences and power scaling. Existing emission rates, bursts and pools are unchanged. Tutorial SPEED wording points to engine trails instead of the removed readout.

## Key technical decisions

Optional ThrusterInput.speedBand preserves older callers; ShipView derives it from actual speed and shipMotion cruise/top ratio. No wire, movement, combat or economy changes. PC badges follow measured key-hint height, including hints disabled. No extra hit areas on PC.

Typecheck, build, rig/building and full simulation tests pass. Three headless Brave DPR2 runtime layouts (1280x720,960x540,844x390 touch) verify readable counts, hint/badge separation, unchanged mobile controls, hidden telemetry and actual ShipView slow/cruise/fast colours. Zero page errors; no capture/recording. Existing thruster regressions also verify distinct colours with unchanged particle counts. Evidence outputs/steroids-alpha/ordnance-speed-ui/.

## Open questions

Tutorial proposal for discussion: roughly one minute, Fly -> Fight/one upgrade -> Dash/Ram -> Warp out. One-sentence contextual prompts; first-use tips for missiles/mines/recovery/evolution. No lesson-flow implementation until discussed with owner.

## Known issues

Physical-phone/Safari visuals not inspected. Existing unrelated build warnings remain.

## Next proposed step

Publish and verify UI/speed cues under continuing release preference, then discuss the shorter tutorial. Stop temporary Vite4187 after verification; no resident publisher/capture service.
