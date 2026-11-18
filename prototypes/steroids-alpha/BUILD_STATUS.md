## Current milestone

LIVE VERIFIED181126r0102/protocol28. PR564 merge74dd2ced9c85c359983d4ffc421b68bfffd83b28; itch44251753113 attempt2 and Worker44251753080 succeeded. Pages44251753017 deployment step succeeded; unrelated post-deploy counter push failed.

## What was implemented

Missile Cruiser grants zero free turrets and keeps only bought turret upgrades. Minimum speed140→90 for artillery positioning; cruise170/top225/turning and Battlecruiser base2/min140 unchanged. MC requirement fields for guns/turrets0; actual criteria remain Missiles4/Mines2 plus300 mineral balance/120 cost. Select Hangar → EVOLVE → Missile Cruiser, then earn/purchase evolution in-run. Lab model/preview matches ownership; four empty mounting pads stay visible.

## Key technical decisions

Protocol28 keeps the layout but refreshes cached27 clients with older bundled defaults under the unchanged legacy config hash. Existing hosted record omits MC; no hosted record or art upload changed. Shared turretCount already respects base0; lab removes its hardcoded base2. Native menu previews already hide heads above base ownership.

Type/build/shared sim+capital/config/lab regression pass. Tests cover0/1/2/4 bought turrets retained after evolution, braking to90, BC base2/min140 and bought CIWS bursts. Public fresh client receives MC min90/base0/cruise170/top225 over49 healthy snapshots; Hangar shows0 MC heads/2 BC heads. Public lab gives0 turrets/min90/ammo8. No page errors/capture. Portable proof ../steroids-alpha-lab/evolution/artillery-release-proof.json; evidence outputs/steroids-alpha/missile-cruiser-lab/artillery-*.

## Open questions

Owner can refine artillery speed after play. No immediate Claude action; deferred handoff saved.

## Known issues

Existing randomized bot-spacing test failed client attempt1 (848px vs900), retry passed. Pages actually deployed, then unrelated Operation C counter persistence push raced main. Both deferred for CI housekeeping. Cold itch asset loading can exceed30s; public checks use120s. No physical Safari review.

## Next proposed step

Owner refreshes cached game for28, selects MC in Hangar → EVOLVE, earns Missiles4/Mines2 and evolves through UPGRADES. No native input/screenshots/recording; temporary headless tests closed, no local publisher or dev server running.
