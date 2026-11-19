# Bot survival candidate —19 November2026

**LIVE VERIFIED191126r0108/protocol32.** Owner approved the tested changes and500-credit unlocks. PR577 merge076417e1; itch44443795181/Worker44443795129/Pages44443795169 succeeded. Public PC/portrait500 quotes/buy/equip, real home55 snapshots/ack100, Planet A80 snapshots/ack155 with4 bots, and public lab bot/mineral values pass. Account UI uses fixtures; billing/authority was separately tested with SQLite/Room. No capture/live spending. [Machine proof](./bot-survival-proof.json).

## What caused the difficulty?

The one-hunter limit worked: no overlapping committed hunters in the measured cohorts. Gun damage was the main problem; it caused194 of266 deaths (73%) for the unresponsive miner. Delayed aim updates still led straight-line escape accurately. A combat-capable scripted pilot also suffered substantial ordinary ship-bump deaths because the bots kept steering nose-first into a nearby target while braking. Removing bot dashes alone barely changed the blind-miner result (27.5→27 median deaths); removing secondary weapons was not a sufficient solution either. Player ramming damage/knockback did not need a nerf.

Player entries/retries on occupied open planets used centre-area candidates scored only for rocks, unlike bot spawns which avoided other ships. Safe placement alone reduced very short repeated lives but did not solve overall lethality. The earlier stress miner also did not fight back; it was a survival stress test, not proof that every human would fail. We now include a combat controller held to the same live behavior and decision settings on both sides, reset each life.

## Candidate changes

- Bot aim wobble7°→14°, observation interval0.25→0.45s, mean reaction0.9→1.3s (existing±0.5s jitter retained).
- Ordinary bots fire an approach pass then peel away at360px and hold an exit heading for1.2s, rather than constantly steering into a target's hull. Manual guns/missiles/dash stay quiet during the exit; automatic turrets retain their rules. This committed exit avoids distance-boundary jitter. Siege bots retain committed close approach; the shared observation/aim tuning also applies to them.
- Occupied open-planet player arrivals/retries use the existing32-candidate ship/rock clearance selection. Empty first-room arrival and home/Warzone pad/gate positioning remain. No additional spawn immunity.
- Both permanent cruiser unlocks1500→500 bank credits, still bought and explicitly equipped. In-match requirements and50-mineral evolution price remain. No free ownership grants.

Mineral shop5/10/15/20, all20 cost250; minimum cruiser route115. Hull/shield/damage, fire rates, movement/grip/aim, collision/ram rules and the+76.8% fighter benchmark remain. No artwork changes.

## Equal-duration headless comparison

10 deterministic seeds per row, **full10 minutes per attempt even after reaching max**. Deaths reset upgrades/wallet and retry after5s. Real production simulation handles shots, heat, movement, rocks, repair, loot and purchases.

| Scripted pilot | Live median deaths/10min | Candidate | Reached all20 at least once: live→candidate |
|---|---:|---:|---:|
| Mines without evading |27.5|4|0/10→9/10|
| Evades visible threats |10.5|1|0/10→8/10|
| Combat controller, frozen live policy |18|2.5|0/10→9/10|

The combat controller does not receive the candidate's better escape policy. This avoids crediting enemy changes for a smarter test player. Completion does not mean the ship stayed alive/maxed until the end. Death-only lifetime samples exclude surviving final lives and are not reported as population survival estimates. The reduction is large; human playtesting should confirm that bots still feel threatening rather than treating these scripts as a win-rate or beginner-time guarantee.

##500-credit access

40 separate safe mining/banking runs,10 seeds per controller/build. Full zero-credit route uses actual180s warp lock,400 cargo cap and2 successful extractions, then earns115 minerals and performs the evolution on a new mission. Median first Battlecruiser8:23–8:34; Missile Cruiser8:23–8:34. Prior1500 route was~16:49–17:57. Ownership purchase/equip checkpoint assumes success after sufficient credits; real billing is covered separately by SQLite/Room gates. Tutorial/sign-in/human menu time and network delay are excluded.

## Checks and release boundary

Full npm typecheck, production build, sim/progression/grip/capital/tutorial gates, real SQLite bank (499 insufficient;500 exact purchase), live config/OIDC/admin/publisher, rig/FFD/buildings and22 UI layouts pass. New gate checks committed exits/reacquisition, live firing/reaction windows, siege exception,16 occupied player spawns and migration. Two local headless Brave desktop/portrait cases confirm both500 quotes, two500 purchases and explicit equipment with mocked accounts. No live credits, writes, screenshots or recording. Temporary preview and headless browsers are stopped.

Protocol32 keeps wire layout but forces a paired client/Worker refresh for correct catalogue quotes. bot behaviourVersion1 upgrades old observation tuning once while preserving later owner edits and all shop/calibration settings. Deployment-owned evolution quote is normalized to500 in effective config. No D1 schema or resident publisher change. Owner approved the tested candidate; paired release and public verification completed. Historical stored config is unchanged; effective Room/client/lab migration was verified.

Reproduce current fixed sessions from repo root in PowerShell:

```powershell
$env:PROFILES='contested,cautious-contested'
$env:GOALS='max'
$env:SEEDS='10'
$env:SECONDS='600'
$env:PACE_FIXED_TIME='1'
$env:PACE_OUT='survival.json'
node scripts/measure-steroids-progression-pace.mjs
# Frozen combat controller uses PACE_PILOT_SOURCE_ROOT=<read-only live source snapshot>
# Baseline simulation uses PACE_SOURCE_ROOT=<same snapshot>; live source d622721a...
# Access route: unset PACE_FIXED_TIME; PROFILES='coached,hesitant'; GOALS='account-bc,account-mc'; SECONDS='1800'
```
