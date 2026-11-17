## Current milestone

Ram readability, persistent hull trace, tutorial clarity and universal staged ship destruction are implemented for the next live release. Continue the owner's direct-publication preference after verification.

## What was implemented

Orange bow attack envelope on active dash frames and an orange crash impact. Thin inner hull arc remains visible beside the main shield/hull arc, retaining critical-hull flashing and shield recovery. Tutorial suppresses early mineral drops, hides and blocks purchases before UPGRADES, disables weapons during RAM, and places three swept-crossing dash gates so one dash can pass several rings.

All four visible ship chassis retain their rig after authoritative death, darken/shrink over800ms, emit five small blasts, then a size-aware final explosion. Own, remote and Warzone deaths share this path; death menu follows the animation. Layout rebuild preserves its progress and shutdown cleans it up.

## Key technical decisions

Local explosion FX copy ShipState before remote deletion; no protocol change or gameplay death delay. ShipPlacement.destroying suppresses hover/exhaust/shields. Tutorial policy is enforced in the in-page Room, including queued/held weapons and BUY frames; online worlds ignore it. No tuning, damage, economy, new art assets or dependencies changed.

Typecheck/build, rig/building/crystal regressions, complete simulation and live-config suites pass. New ram/tutorial regression covers policy, buys, held weapons, online isolation, mineral gating, swept/wrapped gates, bow geometry and800ms timing. Brave DPR2 desktop/mobile runtime exercises all4 chassis, own/remote/Warzone death, resize continuity, duplicate suppression, HUD trace and tutorial gates (14 cases, zero page errors). No captures/recording; no fixtures written to public rooms. Evidence: outputs/steroids-alpha/ram-tutorial-destruction/.

## Open questions

None.

## Known issues

Physical-phone/Safari visuals not inspected. Existing unrelated build warnings remain.

## Next proposed step

Publish client and Worker, verify public tutorial/runtime and protocol24 health, then send Claude the original-thread seam/release proof. Stop temporary Vite4187 when complete.
