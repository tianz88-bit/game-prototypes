## Current milestone

LIVE VERIFIED181126r0104/protocol29. PR568 merge983a497d2cf6af8f13234f8211b88cd35348de6d; itch44295327666 and Pages44295327839 succeeded. Main-menu evolution loadout shortcut released. Existing Worker29 unchanged.

## What was implemented

Main menu shows the owned equipped Battlecruiser/Missile Cruiser, or Choose evolution. Tap opens Hangar directly on EVOLVE, overriding a previously selected tab; ordinary Hangar entry still remembers its tab. Equipment changes refresh on returning to the menu. Shares the44px secondary row with Learn to fly, preserving ship/Warp focus and mobile height.

## Key technical decisions

Reuses selectedEvolution with current account unlocks and saved look; unowned/forged selections and legacy numeric preferences display empty. Explicit scene tab option changes navigation only. No account schema, protocol, Worker, balance, dependencies or assets changes. Existing1500-credit unlock/equip and in-match gates remain.

Typecheck/build/rig and22 layout combinations pass. Eight local headless Brave desktop/touch/portrait cases plus two actual public itch cases pass owned/empty labels, ownership filtering, action bounds/separation, direct EVOLVE navigation, equip-return refresh and utility isolation. No page errors, screenshots or recording. Proof ../steroids-alpha-lab/evolution/menu-slot-proof.json; raw outputs/steroids-alpha/missile-cruiser-lab/menu-evolution-*.

## Open questions

None. Deferred Claude handoff saved; no immediate action requested.

## Known issues

Browser account responses are intercepted fixtures; no live credits spent. No physical Safari or visual screenshot review, per owner's no-capture instruction. Previously recorded randomized bot-spacing/Pages housekeeping remains deferred; this release passed on first attempt.

## Next proposed step

Refresh the live game for104. Review the equipped evolution beneath Warp and use it to open Hangar EVOLVE before launch. Temporary preview/headless processes closed after checks; no resident publisher.
