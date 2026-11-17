## Current milestone

Owner approved live Speed Grip, responsive aiming, stat-bar Hangar,2 turret/Guns4 evolution and capped shield regen on18 November2026. Implementation verified locally; coordinated client/Worker protocol26 release pending. Previous live171126r0099/25.

## What was implemented

Shared movement integrates speed-dependent travel bearing before weapons. Nose response, speed and controls unchanged; high-speed slip capped24°, braking restores grip. Snapshots/replay/interpolation and target leading carry actual travel. Hangar shows base speed/turn/shield/main DPS/real cold-shot ammo bars. Evolution requires2 bought turret upgrades and Guns4 plus existing power/cost, upgrades retained. Shields recover min(35% capacity,25 points/sec) after existing quiet delay.

## Key technical decisions

Protocol26 appends travelHeading at103,107-byte ship snapshots. No production lab imports/private bullet repair; client+Worker release together. New config fields upgrade old hosted records and validate bounds; both Room/client apply grip group. Candidate lab disables shared grip to avoid double application; Live Baseline uses production. Other lab turn-band/auto-cruise/pushback experiments stay gated. New regression runs in both deployment workflows.

Type/build, shared sim/new live grip, lab grip/duels, config/rig/bank/layout regressions pass. Eight chassis/power cases show equal nose/speed, exact lab travel parity, brake slip below4° within.2s, snapshot replay/muzzle/lead/knockback/arrival/warp/dock integrity. Seven Brave DPR2 Hangar layouts pass for20 stat rows, text bounds/equip/listener disposal. Two independent local Brave clients (PC and mobile-sized,120ms RTT) share actual Worker snapshots, regain grip/fire, see each other and maintain bounded prediction. No screenshots/recording/capture. Evidence outputs/steroids-alpha/live-speed-grip/.

## Open questions

Owner may refine regen cap after live play. Existing35% rate retained with25/s ceiling; default shield recovers17.5/s. No approval for other lab handling changes.

## Known issues

Headless checks do not replace physical-phone/Safari or human feel review. Existing unrelated build warnings. Cached old clients need refresh for protocol26.

## Next proposed step

Release client+Worker together, verify public version/protocol/config/Hangar and network grip. Keep Claude backlog deferred. Local preview4187/Worker8788 and headless browsers are stopped.
