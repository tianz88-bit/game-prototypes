## Current milestone

LIVE itch r0109, Worker protocol 33 (unchanged). Run-economy redesign in headless review on branch proto/steroids-alpha/run-economy (pushed to ccr-9c88eb84-gwiuel). Not merged or deployed.

## What was implemented

Live, by Codex: see CLAUDE_BACKLOG.md (combined release PR588).

Headless review (owner decisions, 19 November 2026):
- Minerals are the only run currency. Ordinary planets no longer spawn salvage cargo; minerals carried out on warp bank as credits at salvage.bankRate (1). Clan home planets bank at salvage.homeBankRate (0), so they cannot be farmed. Home fuel and the treasury are unchanged (parked).
- Escalating tiers: 10/25/50/80 per track (825 for all 20), carry floors 10/40/100/180. Each upgrade owned adds shop.yieldPerUpgrade (8%) to minerals mined.
- Mineral hold grows with upgrades: shop.holdBase 50 + shop.holdPerUpgrade 30 each (650 at a full build). Carried weight slows the ship up to 30% at ship.powerCap 700.
- Deaths drop the whole wallet (deathSpillFraction 1); hull hits spill 0.5 per hull point. No extra kill payout. Bots carry and drop minerals like players and prefer loaded targets (bots.loadedPreference 200).
- Hot zone multiplies minerals (hotZone.mineralMultiplier 2). Warp lockdown 180 -> 90 s. Evolutions cost 100 in-run (floor 100).
- Economy epoch 5 migration in sim/liveConfig.ts (balanceVersion 5).
- Probe script: scripts/measure-steroids-run-economy.mjs (PROFILE=quiet|bots, BUY=n).

## Key technical decisions

The wallet stays in the legacy hullMax field, so there is no wire layout change. The salvage ShipState field stays (always 0 off home planets) so protocol 33 decodes unchanged. Bank amount = floor(wallet x planet rate), computed by sim bankedMinerals.

## Open questions

Owner to review the probe numbers, and the growing-hold mechanic, which Claude added after the probe showed hoarding beat building. BRIEF.md needs an economy section once approved.

## Known issues

Test gates (sim, pickups, progression-balance, bank, live-config) still assert the old economy and fail. To update once numbers are approved. The client HUD still shows salvage cargo and old prices. The scripted miner never fights back, so bot-profile deaths overstate risk for a real pilot.

## Next proposed step

Owner approves or adjusts the numbers, then: update the gates, HUD/shop/tutorial text, BRIEF, protocol bump and a paired client/Worker release.
