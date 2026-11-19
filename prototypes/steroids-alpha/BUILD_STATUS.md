## Current milestone

LIVE itch r0109, Worker protocol 33 and calibration lab. PR588 merge 97f6ca80c3312db0531e87846f63b43941c429f2. Itch 44475904101, Worker 44475903983 and Pages 44475904099 succeeded.

## What was implemented

Bat matches Falcon primary gun damage. It retains 52.5 shield, 5.44 rad/s turn rate and its existing speed/acceleration. Sparrow and Falcon start with 75 shield. All fighters have 50 hull. Upgrade prices 1/2/3/4, either cruiser 10 in-run, earlier permanent 500-credit unlocks. Scaled ore and hull spills, plus visible fractional minerals.

Separate ore/salvage/fuel objects, pooled sprites and HUD icons, authoritative short-range magnetism. Tutorial gates require braking, thrust, aimed rock shots, its ore, one purchase, both rings and an actual ram in one dash, then extraction. Fighter missiles preserve late presses and accept desktop HUD clicks. Missile Cruiser has a shorter rear arc and 12-second reload.

## Key technical decisions

Protocol 33 is deployed for the client and Worker. Pickup messages can include fuel/mined metadata and interpolated movement. Economy epoch 4 migrates prior records. Shared authorities and display read the same chassis values. Type/build/full sim/live config/bank/rig/evolution gates passed. Headless Bat and Falcon sustained primary output matched with stock and max gun tiers. Local browser checks cover PC/mobile tutorial and missile buttons, split pickup collection and render pool bounds.

## Open questions

No blocking questions. Claude's deferred backlog is current.

## Known issues

Scripted combat and mining timings do not measure human advantage in a duel. Review public evidence in combined-release-proof.json for the scope of the browser smoke test.

## Next proposed step

Use human duel feedback to compare Bat's close turning advantage against Falcon's shields and top speed.
