## Current milestone

LIVE itch r0109, Worker protocol 33 (unchanged). Run-economy and run-level redesign in headless review on ccr-9c88eb84-gwiuel. Not merged or deployed.

## What was implemented

Live, by Codex: see CLAUDE_BACKLOG.md (combined release PR588).

Headless review (owner decisions, 19 November 2026):
- One currency: minerals. Ordinary planets no longer spawn salvage cargo. Minerals carried out on warp bank as credits at salvage.bankRate (1); clan home planets at salvage.homeBankRate (0). Home fuel and the treasury are unchanged (parked).
- Run levels replace the shop (shop.levelUp 1). Minerals collected this run are XP and are never spent. Level n needs levelXpBase 6 + levelXpGrowth 3.5 x (n-1) more XP (785 for level 20). Each level offers 3 cards drawn from the 5 existing tracks (sim/levels.ts); the player picks one. Perk values are kept as Codex flattened them on 18 November (about +3% each).
- Evolutions: any owned evolution is a guaranteed card once its requirements are met; tracks it still needs are shop.levelEvolutionWeight (3) times likelier. Evolving is free (it uses the level pick).
- Hold: shop.holdBase 50 + holdPerUpgrade 40 per level picked (850 at level 20), always ahead of the level curve. Carried weight slows the ship up to 30% at ship.powerCap 900.
- Deaths drop the whole wallet; hull hits spill 0.5 per hull point; no separate kill payout. Bots carry and drop minerals and prefer loaded targets (bots.loadedPreference 200). Hot zone x2 minerals (hotZone.mineralMultiplier). Warp lockdown 90 s.
- Proposed hangar prices: evolution 400, ship 800, palette/flame/shield 200, kill effect 300, badge/tag 150, run history 200 (5800 for everything).
- Economy epoch 5 migration (sim/liveConfig.ts). Probe: scripts/measure-steroids-run-economy.mjs (per run, or ACCOUNT=cautious|mid|allin with PILOT=miner|flee|fight and PROFILE=quiet|bots).

## Key technical decisions

The wallet stays in the legacy hullMax field. xp/picks are on ShipState but not yet on the wire (decode fills 0). World.pick(id, card) is the authority path; World.buy refuses while levels are on. Bots pick instantly (an evolution when offered). Bank = floor(wallet x planet rate) via sim bankedMinerals.

## Open questions

- Hangar prices may need raising again: with nothing spent, a cautious pilot carries about 355 at 3:00 (was 130). Career sims are running.
- Owned-evolution cards make the pre-mission evolution equip slot (18 November) unnecessary. Owner to confirm removing it.
- With 4 bots, long runs die often (about 70% for all-in in earlier sims). Possibly a bot-pressure change later, separate from the economy.
- BRIEF.md needs updating to cover the run economy and levels (owner-written brief, not edited by Claude).

## Known issues

Test gates (sim, pickups, progression-balance, bank, live-config) still assert the old economy and fail. Client: no card UI, HUD still shows salvage/shop, tutorial teaches the shop. The scripted pilots are approximations, not human playtests.

## Next proposed step

Owner settles hangar prices and the equip-slot question. Then: protocol fields for xp/picks/cards, the non-blocking card strip (tap or 1/2/3, queued picks), HUD/tutorial text, test gates, Codex card art brief, and a paired client/Worker release on approval.
