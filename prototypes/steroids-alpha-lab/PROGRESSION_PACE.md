# Progression pace study —19 November2026

Measured live107/protocol31 rules headlessly at30Hz using the real simulation:210 seeded runs,10 seeds per condition. No gameplay changes, live account spending or capture. These are scripted mining experiments, not measured beginner playtimes. Raw cases/settings/limits: [progression-pace-proof.json](./progression-pace-proof.json).

## Safe mining

Times start at mission launch and include arrival. Fresh Sparrow with no upgrades/minerals; actual shots, heat, drift, steering, travelling to pickups, collisions, repairs and purchases. Coached policy reacts every167ms; delayed policy every400ms with aim wobble and70% trigger duty. Neither teleports, spawns money nor gets invulnerability.

| Milestone | Before107, focused miner | Now, focused miner | Now, delayed miner |
|---|---:|---:|---:|
| First upgrade |32s|7s|7s|
| All20 fighter upgrades |14:01|2:32|2:46|
| Battlecruiser, already owned/equipped |6:31|1:15|1:18|
| Missile Cruiser, already owned/equipped |6:43|1:17|1:19|
| Bank1500 credits from zero |not measured|15:30|16:33|
| Zero credits → first Battlecruiser evolution |not measured|16:49|17:57|
| Zero credits → first Missile Cruiser evolution |not measured|16:52|17:55|

Medians across10 seeds each. Focused all20 middle80% range2:15–2:46; delayed2:36–2:52. Focused cruiser paths roughly1:05–1:33 across their middle80%. The first-account route includes4 successful extractions (400 cargo cap,180s warp lockdown), obtaining1500 credits, a3-second relaunch policy, then gathering prerequisites and performing the actual in-run evolution. Ownership purchase/equipment is assumed successful after earning the credits; tutorial/sign-in/human menu time/network delay are excluded. It does not falsely grant a fresh account a free cruiser.

## Combat interruption stress

Four stock production bot brains with normal stats, shop purchases, new spawn ages and5-second replacement delay. The player controller either keeps mining or flees visible threats with throttle/dash. It does not fight skillfully or deliberately use secondary weapons. Player death resets upgrades/money and retries after5 seconds. These conditions test interruption sensitivity, not human PvP averages. Unfinished runs are censored at20 minutes.

| Completed within20 minutes | Mine through threats | Evade threats |
|---|---:|---:|
| All20 upgrades |0/10|1/10|
| Battlecruiser |2/10|9/10|
| Missile Cruiser |3/10|9/10|

Do not report the successful few as an average completion time. The safe economy is fast; survival/reset losses can dominate a hostile planet. Human playtesting is still needed before claiming fair or achievable beginner combat progression.

## Are the reductions proportionate?

Shop spend1240→250 is79.8% lower. Matched focused-miner median14:01→2:32 is81.9% shorter (5.5x faster). Existing-unlock cruiser paths are roughly81% shorter too. On measured grinding time, the reduction is close to proportional.

Combat power is a separate axis: the prior fully loaded Falcon benchmark was34.91x a fresh Sparrow; current max is1.7676x (+76.8%). That95% drop in the absolute index includes removing wallet-driven hull growth; the old fully loaded state required retained minerals beyond the1240 upgrade bill. A linear percentage comparison with shop spend would be misleading. The benchmark excludes accuracy, regeneration, tactical ordnance and capital roles, and never predicts win rate.

Recommendation: keep current mineral prices pending human playtests; do not lower them again based on cost percentages. The first-cruiser bottleneck is now permanent1500-credit ownership (16–18 minutes to first evolution even in safe scripts). Discuss that unlock track separately if the desired first-session cruiser is earlier. Address survival/onboarding before inferring shop costs from the hostile stress cohort. No tuning was changed by this study.

## Reproduce

Run from repo root in PowerShell, using existing esbuild (no new dependencies):

```powershell
$env:PROFILES='coached,hesitant'
$env:GOALS='max,bc,mc'
$env:SEEDS='10'
$env:SECONDS='1200'
$env:PACE_OUT='pace-safe.json'
node scripts/measure-steroids-progression-pace.mjs
# Bank/first account: GOALS='bank,account-bc,account-mc'; SECONDS='3600'
# Stress: PROFILES='contested,cautious-contested'; GOALS='max,bc,mc'; SECONDS='1200'
```

Optional PACE_SOURCE_ROOT points to a read-only historical source snapshot; PACE_TUNE_JSON supplies its tune or ConfigData. Before107 used source0e4d467d62da4a188afd0b7fcfb61bcd27ba40e1 and the previously captured published configuration. Current uses mainb6d68c2 and bundled tune identical to effective107 balance. Exact seed1 replay checks pass for current max/BC/MC, historical max/BC/MC and complete first-account BC.
