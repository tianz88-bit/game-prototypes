## Current milestone

LIVE VERIFIED171126r0100 / protocol26. PR559 merge1eccd9e0e6626cc717504a87868314dfbb6518a5; itch44129275449 and Worker44129275517 succeeded. Pages44129275338 succeeded. Owner approved grip/stat Hangar/evolution/regen release18 November2026.

## What was implemented

Shared movement integrates speed-dependent travel bearing before weapons. Nose response, speed and controls unchanged; high-speed slip capped24°, braking restores grip. Snapshots/replay/interpolation and target leading carry actual travel. Hangar shows base speed/turn/shield/main DPS/real cold-shot ammo bars. Evolution requires2 bought turret upgrades and Guns4 plus existing power/cost, upgrades retained. Shields recover min(35% capacity,25 points/sec) after existing quiet delay.

## Key technical decisions

Protocol26 appends travelHeading at103,107-byte ship snapshots. No production lab imports/private bullet repair; client+Worker release together. New config fields upgrade old hosted records and validate bounds; both Room/client apply grip group. Candidate lab disables shared grip to avoid double application; Live Baseline uses production. Other lab turn-band/auto-cruise/pushback experiments stay gated. New regression runs in both deployment workflows.

Type/build, shared sim/new live grip, lab grip/duels, config/rig/bank/layout regressions pass. Eight chassis/power cases show equal nose/speed, exact lab travel parity, brake slip below4° within.2s, snapshot replay/muzzle/lead/knockback/arrival/warp/dock integrity. Seven Brave DPR2 Hangar layouts pass for20 stat rows, text bounds/equip/listener disposal. Two independent local Brave clients (PC and mobile-sized,120ms RTT) share actual Worker snapshots, regain grip/fire, see each other and maintain bounded prediction. Public seven Hangar layouts and five evolution-UI layouts pass, including blocked/ready1–6 purchase requests in isolated fixtures. Actual live beta connection received72 new-format snapshots, ~24° fast slip and.57° braking slip, zero page errors, healthy hull. Public hosted config resolves grip enabled/cap25/min turrets2/guns4; lab eight Grip fields and all three profiles pass. No screenshots/recording/capture. Evidence outputs/steroids-alpha/live-speed-grip/.

## Open questions

Owner may refine regen cap after live play. Existing35% rate retained with25/s ceiling; default shield recovers17.5/s. No approval for other lab handling changes.

## Known issues

Headless checks do not replace physical-phone/Safari or human feel review. Existing unrelated build warnings. Cached old clients need refresh for protocol26.

## Next proposed step

Owner plays the updated public game (refresh cached clients for protocol26). Keep Claude backlog deferred and tune further only on owner feedback. All public checks completed; local preview4187/Worker8788 and task headless browsers are stopped.
