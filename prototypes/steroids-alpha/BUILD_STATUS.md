## Current milestone

Ram readability, hull trace, tutorial clarity and universal ship destruction are LIVE in171126r0091. Runtime PR535 merged909991ffb4aeb9c7eb7d75903b8dcacc551f6e90; projected-cue visibility follow-up PR536 merged4efc7680467023604760e60d2442747eea517413. Final itch44019478944, Pages44019478908 and Worker44019138494 succeeded; protocol24 healthy. Game: https://daily-daily-games.itch.io/steroids-alpha . No new art upload.

## What was implemented

Orange bow attack envelope on active dash frames and an orange crash impact. Thin inner hull arc remains visible beside the main shield/hull arc, retaining critical-hull flashing and shield recovery. Tutorial suppresses early mineral drops, hides and blocks purchases before UPGRADES, disables weapons during RAM, and places three swept-crossing dash gates so one dash can pass several rings.

All four visible ship chassis retain their rig after authoritative death, darken/shrink over800ms, emit five small blasts, then a size-aware final explosion. Own, remote and Warzone deaths share this path; death menu follows the animation. Layout rebuild preserves its progress and shutdown cleans it up. Bow cues follow projected visibility.

## Key technical decisions

Local explosion FX copy ShipState before remote deletion; no protocol change or gameplay death delay. ShipPlacement.destroying suppresses hover/exhaust/shields. Tutorial policy is enforced in the in-page Room, including queued/held weapons and BUY frames; online worlds ignore it. No tuning, damage, economy, new art assets or dependencies changed.

Typecheck/build, rig/building/crystal regressions, complete simulation and live-config suites pass. New ram/tutorial regression covers policy, buy messages, held weapons, online isolation, mineral gating, swept/wrapped gates, bow geometry and800ms timing.14 local plus14 public Brave DPR2 desktop/mobile runtime cases exercise all4 chassis, own/remote/Warzone death, resize continuity, duplicate suppression, HUD trace and tutorial gates with zero page errors. Final public version91, existing asset coverage and Worker24 health verified. No captures/recording or fixture writes to public rooms. Evidence: outputs/steroids-alpha/ram-tutorial-destruction/{runtime-check,public-runtime-check,live-game}.json.

## Open questions

None.

## Known issues

Physical-phone/Safari visuals not inspected. Existing unrelated build warnings remain.

## Next proposed step

Collect owner feedback. Claude receives original-thread seam and release proof. Temporary Vite4187 stopped; no resident publisher, capture or preview service.
