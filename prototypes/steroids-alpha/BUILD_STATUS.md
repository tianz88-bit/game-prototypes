## Current milestone

Human Nomad ships are integrated (Scrappy, Interceptor and in-run Battlecruiser evolution). Owner approved publication; PR #476 is merged and live (client run 43687328183). Brave verified the published HUD and live planet snapshots with no browser errors. The current pass updates the game's canvas UI to match the ship materials and improves combat-meter readability while preserving mobile action space.

## What was implemented

- Compact instrument cluster: labelled shield and hull bars with values, segmented fills, critical hull colour, shield-down/reboot countdown, labelled heat lock and dash charge/cooldown/ready states. Salvage is a separate gold balance above the cluster.
- Navy panel edges, cream highlights and coloured insets shared by the menu, Hangar, leaderboard, upgrade cards, end-of-run panels and touch controls.
- Hangar ship cards and four palette cards composite the actual rig parts. The menu shows the selected fighter and palette; Battlecruiser remains an in-run evolution, with a thumbnail and explicit requirements on its EVOLVE card.
- Capital names sit below the larger silhouette and have a dark outline. Shield breaks emit blue/cream cells and the own ship shows a broken-shield cue while down.
- Salvage-zone markers have readable backed labels and projected beacons. The ground ring draws below ships/UI. Zone and bounty labels avoid the right-hand mobile controls.
- Existing production systems retained: fixed-Z ship rigs with parented cardinal offsets, engine vibration, recoil, per-channel palette remapping, painted asteroid families/fragment variants, world pickups, drones, combat effects, dynamic sun shadows and hover light.
- Existing hosted configuration, D1 banking, account unlocks, two planets, authoritative upgrades/evolution, prediction/interpolation and protocol 19 remain in place.

## Key technical decisions

- Canvas-only UI; no new DOM overlay, raster asset, dependency, protocol or gameplay tuning changes.
- Layout reads logicalSize(), including the landscape canvas quarter-turn on upright touch phones. No orientation blocker.
- Fire, dash, missile, mine and shop input rectangles retain their existing locations. The meter cluster and lower badges fit to the left of the fire button's enlarged hit area.
- Previews reuse the calibrated profile, fixed layer order and 3% per-layer shading. They create no world shadows, particles or gameplay objects.
- HUD text objects are reused; colour changes are conditional to avoid unnecessary text texture uploads. Scenes destroy their display objects when rebuilt or left.
- Verification: typecheck, production build, 396-pose rig parity, sim and live-config tests pass. Brave desktop 1280x720 and mobile 844x390/667x375 at DPR2 plus upright 390x844 reviewed, including low hull, shield reboot, overheat, weapon charges, evolution-ready and capital states.
- Two-client Brave regression passed: keyboard turn, drop-in/out, phone steering/fire/dash, a new asteroid split, both clients observing it and prediction. About 57 FPS on this PC, phone emulated RTT 140ms, maximum corrections below 0.001 world units, no browser errors. Scratch adapter uses installed Brave and a shooting-phase split baseline; tracked harness is unchanged.

## Open questions

- No implementation question blocks this UI pass; owner visual/play review follows.
- Gameplay unlock/evolution prices and chassis multipliers remain the owner's current trial values.

## Known issues

- Real phone hardware performance and notch/home-indicator behaviour have not been measured.
- The tracked browser harness tests absolute splits>=1 during its shooting phase. An earlier unrelated split can end the hunt before its bullet assertion samples a shot. The local adapter waits for a new split relative to phase start; Claude has the finding.
- Live FFD acceleration/braking/yaw tilt remains unported. The lab is still the reference; ordinary heading rotation should remain level.
- Hosted calibration currently publishes the starter's calibration; new chassis use their checked-in profile calibration. A per-chassis live calibration map is pending.
- Orbital entry/exit zoom, remaining salvage pickup appearance and ground props/horizon clipping are pending art work.
- Hosted Access is configured owner-only; a real owner email-code sign-in and browser publish still need direct end-to-end verification. The local private publisher remains stopped.

## Next proposed step

Owner reviews the UI on mobile, especially meter readability while steering and firing. Continue the separate art tasks: control-driven FFD, per-chassis calibration, orbital entry/exit and salvage/world polish. Keep gameplay tuning with Claude and the owner.
