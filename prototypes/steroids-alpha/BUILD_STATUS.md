## Current milestone

Run economy, level cards and mobile stick throttle: released through this session's PR (protocol 35, paired client and Worker). Previous live: itch 201126r0110 (Codex's Missile Cruiser centerline cannon, PR597).

## What was implemented

- One currency: minerals. Ordinary planets no longer spawn salvage cargo. Minerals carried out on warp bank as credits at salvage.bankRate (1); clan home planets at salvage.homeBankRate (0). Home fuel and the treasury are unchanged.
- Run levels replace the mineral shop (shop.levelUp 1). Collected minerals are XP and are never spent. Level n needs levelXpBase 6 + levelXpGrowth 3.5 x (n-1) more XP (785 for level 20).
- Each level offers 3 cards from the 5 existing tracks (perk values unchanged, about +3% each), in a non-blocking strip top left. Tap a card or press 1/2/3. Play never pauses and unpicked levels queue.
- Any owned evolution is a guaranteed gold card once its requirements are met. Tracks it still needs are 3x likelier. Evolving uses the pick and costs nothing.
- Hold: 50 + 40 per level picked (850 at level 20). Carried weight slows the ship up to 30% (ship.powerCap 900).
- Deaths drop the whole wallet; hull hits spill 0.5 minerals per hull point; no separate kill payout. Bots carry and drop minerals and prefer loaded targets.
- Hot zone x2 minerals. Warp lockdown 90 s. Hangar prices unchanged (evolution 500, ship 1500).
- HUD: MIN carried/hold, level and XP to next, "BANKS ON WARP" or "HOME: MINERALS DON'T BANK", "HOLD FULL · WARP TO BANK". Results show minerals banked.
- Mobile speed back on the stick (owner, 20 November 2026): near the centre brakes (also lands on your pad), the middle band holds cruise, the outer band accelerates. The + / − buttons are gone.
- Tutorial: "Mine & level up" lesson teaches picking a card.

## Key technical decisions

- Protocol 35: ship records gain xp (f32) and picks (u8). The server sends {type:'cards'} to the pilot when the offer changes. BUY(card, picks) is a pick, and the pick count stops double taps.
- The room fills World.evolutionsOwned from the account's unlocks. The old pre-mission equip slot no longer gates evolutions.
- Economy epoch 5 (shop.balanceVersion 5): older live records adopt the economy on parse, so no settings publish is needed.
- Stick bands live in client.tune.json touch.markerBrakeBelow (0.35) and markerBoostAbove (0.75).

## Open questions

- The hangar's evolution equip slot is now redundant. Remove it, or keep it for show?
- With 4 bots, long runs die often (about 50% of all-in runs in the headless sims). A bot-pressure pass may be needed after playtesting.
- Should pushing past 3:00 pay clearly more than bailing early (for example a visible haul bonus)? Undecided.
- BRIEF.md needs a section on the run economy and levels (owner-written brief, not edited by Claude).

## Known issues

- The card strip uses plain panels (no card art yet).
- Headless pace numbers come from scripted pilots, not human playtests.
- Local browser checks staged the card offer client-side. The real server pick path is covered by the bank and sim gates.

## Next proposed step

Playtest on phone and PC. Then decide the equip slot, a possible haul bonus and bot pressure, and brief Codex on card art.
