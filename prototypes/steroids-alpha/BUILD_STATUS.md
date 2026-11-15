## Current milestone

Connection and contact pass (15 November, owner): 20 s reconnect grace with automatic resume (same ship and id), lost-ship screen when the grace ran out or the server was updated, close reason and code on the Disconnected screen; ship-to-ship bumps (10 damage each, bounce apart, 0.5 s pair grace); nose chevron on your own ship. Note: a server deploy still restarts the planets and loses ships (state is in memory). Shot look (15 November, owner): both guns fire the standard bolt, switching to the heavy pulse from GUNS tier 2 (was: left gun pulse, right gun bolt). Hangar (15 November, owner): menu button renamed HANGAR; ship and palette cards turn on the rig (45 deg/s), ships tab at relative in-game sizes. Complete combat/title art integration and mobile refinement (15 November, owner): approved portal logo, three energy shots, three mineral variants and animated two-view salvage tokens now use hash-verified R2 sources. Fire/Dash faces reduced 26%; mobile hull/shields share desktop segmented styling. Lower hover light restored and drones palette-match with no ground light/shadow. Typecheck/build/sim/live-config/rig, four DPR2 viewport checks, forced Canvas and the production two-client regression pass (57/57 FPS on PC). Owner authorized live publication; PR485 merged75a909 and itch43705423342 succeeded. Public Brave build151126r0056 verified new art, smaller controls/drawers/energy fire/dash/hover and open live planet in landscape/upright, with zero errors. The Worker workflow exposed a stochastic bank-test issue (random combat killed the pilot during a living-presence assertion); the test now uses the existing invulnerability switch only for that interval, preserving explicit-death coverage. Three fresh bank runs pass; no gameplay changes.

Mobile focus pass (15 November, owner): compact top-left vitals/salvage, collapsible upgrade/rank drawers and small warp header. Secondary panels default closed; combat controls stay usable. Owner explicitly authorized publishing after verification. Typecheck/build/sim/live-config/rig, four-viewport DPR2 touch/layout checks and two-client production-bundle regression pass (57/57 FPS on this PC); PR #483 merged as 5d65cdd; itch run 43700096172 uploaded successfully. Brave verified public build 151126r0055 in landscape and upright touch: collapsed defaults, mutually exclusive drawers, fire/dash and open live planet connection, zero browser errors.

Exhaust (15 November, owner): particles 2x faster, half the lifetime; top-speed and dash plume length now comes from speed instead of lingering particles (clientTune exhaustSpeedScale 2, exhaustLifeScale 0.5). Feel pass (15 November, owner): dash always boosts straight ahead (no direction picking); acceleration and braking doubled (440 / 600); bullets drawn 2x bigger (same hitbox); hit sparks 2x; exhaust plume 2x at top speed, 3x in a dash (new clientTune keys thrusterDashStretch, bulletScale, hitSparkScale); bots stay 60 s after the last pilot is destroyed (bots.lingerSeconds) and leave at once when players disconnect; death screen R respawns, Esc menu, keys shown on the buttons. Live settings republished after deploy. Human Nomad ships are integrated (Scrappy, Interceptor and in-run Battlecruiser evolution). Owner approved publication; PR #476 is merged and live (client run 43687328183). Brave verified the published HUD and live planet snapshots with no browser errors. PR #478 implements and verifies control-driven, per-part FFD on all three ships, with the original sprite rig as fallback. Owner approved publication; PR #478 merged as fd79c5e and client/Worker deployments passed (43689948315 / 43689948353). Brave verified live build 151126r0052: active per-part acceleration/yaw meshes, sprite-disable fallback, return to level, open planet connection and no browser errors.

## What was implemented

- Approved transparent portal title in the menu; three pooled energy shot sprites, three minerals and two fixed-height spinning salvage views. R2 originals hash-verified; nine bounded runtime textures total 469 KiB PNG and 2.12 MiB decoded RGBA. Source images stay out of Git.
- Restored palette-coloured ground hover pool at +2X/+35Y reference offset, independent of dynamic sun shadows. Drones match their carrier palette and have no ground shadow/light.
- Fire/Dash visible diameter reduced from 92 to about 68 logical pixels, with existing centres and proportional touch rectangles. Desktop shield/hull styling reused on mobile without duplicate heat/dash meters.
- Mobile vitals/salvage in a compact top-left header with desktop segmented fills/highlights/reboot strip; upgrade availability and rank as compact header buttons. Upgrades and rank default closed. Heat warning/progress moves onto Fire; Dash retains its cooldown arc. Mobile zone/bounty/self-name/telemetry clutter reduced; urgent missile warning retained.
- Per-part WebGL FFD for acceleration/braking/yaw: approved lab relief and projection, -13/+17 pitch, inverted +/-22 yaw bank, eased return to the exact sprite pose. Heading changes without a control cue stay level.
- Original sprite rig for Canvas, the live disable switch, failed mesh allocation, distant ships and sustained slow frames; healthy pacing restores FFD. No texture baking or per-frame GPU allocation. Tilted engine nozzles keep exhaust attached.

- Desktop instrument cluster: labelled shield and hull bars with values, segmented fills, critical hull colour, shield-down/reboot countdown, labelled heat lock and dash charge/cooldown/ready states. Salvage is a separate gold balance above the cluster.
- Navy panel edges, cream highlights and coloured insets shared by the menu, Hangar, leaderboard, upgrade cards, end-of-run panels and touch controls.
- Hangar ship cards and four palette cards composite the actual rig parts. The menu shows the selected fighter and palette; Battlecruiser remains an in-run evolution, with a thumbnail and explicit requirements on its EVOLVE card.
- Capital names sit below the larger silhouette and have a dark outline. Shield breaks emit blue/cream cells and the own ship shows a broken-shield cue while down.
- Salvage-zone markers have readable backed labels and projected beacons. The ground ring draws below ships/UI. Zone and bounty labels avoid the right-hand mobile controls.
- Existing production systems retained: fixed-Z ship rigs with parented cardinal offsets, engine vibration, recoil, per-channel palette remapping, painted asteroid families/fragment variants, world pickups, drones, combat effects, dynamic sun shadows and hover light.
- Existing hosted configuration, D1 banking, account unlocks, two planets, authoritative upgrades/evolution, prediction/interpolation and protocol 19 remain in place.

## Key technical decisions

- Bounded render.ffd* settings upgrade older published records automatically. Own intent gates FFD; remote ships explicitly use filtered observed acceleration/yaw. Gameplay/wire fields are unchanged.
- Canvas-only UI; no new DOM overlay, raster asset, dependency, protocol or gameplay tuning changes.
- Layout reads logicalSize(), including the landscape canvas quarter-turn on upright touch phones. No orientation blocker.
- Fire, dash, missile and mine retain their existing mobile hit locations. The mobile shop now has a 3-by-2 drawer with 44px cards, matched buy rectangles and no hidden buy targets when closed. Header/drawer touches are consumed before steering; only one secondary drawer opens at a time.
- Previews reuse the calibrated profile, fixed layer order and 3% per-layer shading. They create no world shadows, particles or gameplay objects.
- HUD text objects are reused; colour changes are conditional to avoid unnecessary text texture uploads. Scenes destroy their display objects when rebuilt or left.
- Verification: typecheck, production build, 396-pose rig parity, sim and live-config tests pass. Brave desktop 1280x720 and mobile 844x390/667x375 at DPR2 plus upright 390x844 reviewed, including low hull, shield reboot, overheat, weapon charges, evolution-ready and capital states.
- Two-client Brave regression passed: keyboard turn, drop-in/out, phone steering/fire/dash, a new asteroid split, both clients observing it and prediction. About 57 FPS on this PC, phone emulated RTT 140ms, maximum corrections below 0.001 world units, no browser errors. Scratch adapter uses installed Brave and a shooting-phase split baseline; tracked harness is unchanged.

- FFD verification: 14,400 lab-reference panel points plus control gating/inverted-yaw/return tests; WebGL and forced Canvas on all 3 chassis (36 cases), real keyboard and mobile marker/braking, manual disable, slow-frame recovery, simulated allocation failure and WebGL context restoration pass with zero browser errors. Two-client check measured about 58 desktop / 57 emulated-phone FPS, comparable to the prior 57/57 PC baseline.

## Open questions

- No implementation question blocks this UI pass; owner visual/play review follows.
- Gameplay unlock/evolution prices and chassis multipliers remain the owner's current trial values.

## Known issues

- Real phone hardware performance and notch/home-indicator behaviour have not been measured.
- The tracked browser harness tests absolute splits>=1 during its shooting phase. An earlier unrelated split can end the hunt before its bullet assertion samples a shot. The local adapter waits for a new split relative to phase start; Claude has the finding.
- Real Safari/iPhone and Android hardware coverage for FFD remains unmeasured; only Brave WebGL/Canvas and emulated mobile were verified. The fallback preserves play when deformation is unavailable.
- Hosted calibration currently publishes the starter's calibration; new chassis use their checked-in profile calibration. A per-chassis live calibration map is pending.
- Orbital entry/exit zoom, ground props/horizon clipping are pending art work.
- Hosted Access is configured owner-only; a real owner email-code sign-in and browser publish still need direct end-to-end verification. The local private publisher remains stopped.

## Next proposed step

Owner playtests the simplified live mobile flight UI, especially opening upgrades while steering and firing. The title/combat sprite review batch and hover-light fix are integrated. Continue the separate art tasks: per-chassis calibration, orbital entry/exit and salvage/world polish. Playtest the control tilts on real phones. Keep gameplay tuning with Claude and the owner.
