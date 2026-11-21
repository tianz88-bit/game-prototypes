## Current milestone

Local preview of graphite main menu, Hangar, and Warp map for owner review. Live itch remains 201126r0113 from PR605, with Worker protocol 35.

## What was implemented

- One currency: minerals. Ordinary planets no longer spawn salvage cargo. Minerals carried out on warp bank as credits at salvage.bankRate (1); clan home planets at salvage.homeBankRate (0). Home fuel and the treasury are unchanged.
- Run levels replace the mineral shop (shop.levelUp 1). Collected minerals are XP and are never spent. Level n needs levelXpBase 6 + levelXpGrowth 3.5 x (n-1) more XP (785 for level 20).
- Each level offers 3 cards from the 5 existing tracks (perk values unchanged, about +3% each), in a non-blocking strip top left. Tap a card or press 1/2/3. Play never pauses and unpicked levels queue.
- Any owned evolution is a guaranteed gold card once its requirements are met. Tracks it still needs are 3x likelier. Evolving uses the pick and costs nothing.
- Hold: 50 + 40 per level picked (850 at level 20). Carried weight slows the ship up to 30% (ship.powerCap 900).
- Deaths drop the whole wallet; hull hits spill 0.5 minerals per hull point; no separate kill payout. Bots carry and drop minerals and prefer loaded targets.
- Hot zone x2 minerals. Warp lockdown 90 s. Hangar prices unchanged (evolution 500, ship 1500).
- HUD: MIN carried/hold, level and XP to next, "BANKS ON WARP" or "HOME: MINERALS DON'T BANK", "HOLD FULL · WARP TO BANK". Results show minerals banked.
- Mobile speed (owner, 21 November 2026): the stick steers. A half push (inside the faint ring, under 55% of the radius) brakes to minimum speed and lands on your pad. A fuller push, or no finger, holds cruise. Hold MAX (right above Dash) for top speed. A new touch gets 150 ms to move out before braking counts.
- Tutorial: "Mine & level up" lesson teaches picking a card.
- Evolution equip slot removed (owner, 20 November 2026). The menu has a full-width Learn to fly button. Hangar EVOLVE shows owned evolutions as "OWNED · OFFERED IN RUNS"; tapping an owned one only explains it. The Ships tab card shows how many are owned. The menu tagline now reads "Mine. Level up. Fight. Warp out with minerals."
- The preview uses shared graphite frames, monochrome equipment glyphs and tier pips. Gold identifies evolution offers and their confirmation flash. The same three standard cards are shown in a staged fight at 1280×720 and 848×344.
- In-match buttons share the graphite palette. The cargo HUD shows one mineral total with a text-only banking or haul bonus line. The haul bonus remains +10% per full minute starting at 3:00, capped at +50% (PR604).
- Preview extends graphite and steel to the menu and Hangar. The main ship display and Warp button lead the layout. The Hangar reserves gold for evolutions, with larger fighter previews in compact ship cards.
- Preview map uses the spinning terrain globes and a neutral selection ring. Warp In and selecting the same globe again both enter through the existing warp action. The detail pane shows player count, danger, and the current mineral banking rules.

## Key technical decisions

- Protocol 35: ship records gain xp (f32) and picks (u8). The server sends {type:'cards'} to the pilot when the offer changes. BUY(card, picks) is a pick, and the pick count stops double taps.
- The room fills World.evolutionsOwned from the account's unlocks. The old pre-mission equip slot no longer gates evolutions.
- Economy epoch 5 (shop.balanceVersion 5): older live records adopt the economy on parse, so no settings publish is needed.
- Stick bands live in client.tune.json touch.markerBrakeBelow (0.35) and markerBoostAbove (0.75).

## Open questions

- With 4 bots, long runs die often (about 50% of all-in runs in the headless sims). A bot-pressure pass may be needed after playtesting.
- Should pushing past 3:00 pay clearly more than bailing early (for example a visible haul bonus)? Undecided.
- BRIEF.md needs a section on the run economy and levels (owner-written brief, not edited by Claude).

## Known issues

- The menu previews use a sample local account and fixture population counts.
- Headless pace numbers come from scripted pilots, not human playtests.
- Local browser checks staged the card offer client-side. The real server pick path is covered by the bank and sim gates.

## Next proposed step

Review menu, Hangar, and Warp map on PC and folded phone before release.
