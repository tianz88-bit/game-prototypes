## Current milestone

Four-step tutorial and one-time contextual tips are implemented for live release. Owner approved Fly -> Fight -> Dash/Ram -> Escape and immediate deployment after checks. Claude's later sync is tracked in CLAUDE_BACKLOG.md; no execution/review is required from her now.

## What was implemented

Fly uses two steering rings with one short control prompt. Fight requires one marked rock, collection of one marked mineral bundle and one upgrade; the bundle funds a tier-one choice without a grind. Dash/Ram uses two aligned gates and one stationary weakened target, with guns/manual ordnance/automatic turrets disabled. Escape appears after the dash finishes and completes only on real warp extraction. Early shop/warp controls are hidden and gated; all GOT IT screens, repeated drills and mandatory dogfights/ordnance/evolution lectures are removed.

Six short contextual tips cover overheat, shields, hull repair, missiles, mines and available evolution. One at a time for5.5s with a3.5s gap; seen IDs persist across runs in the existing save. During Fight, a relevant tip temporarily replaces the task sentence instead of adding another panel. Tips create no input zones and never stop play. PC control-key wall is hidden in the tutorial; normal flight retains its setting.

## Key technical decisions

Four semantic stages replace old14-step indices. Fight phase gates buying until minerals actually fund an upgrade. Adaptive ram-course reach uses the current chassis/power-adjusted dash range. Room.setTutorialRules gates tutorial-only queued/held weapons, buys, automatic turret quiet state and warp; online rooms ignore it. Manual tutorial target bots stay stationary. No protocol, live combat/movement/economy tuning, new assets or dependencies changed. Practice still banks nothing.

Typecheck/build/rig/building/sim/live-config and updated tutorial/tip regressions pass; tutorial regressions now run through the CI sim suite. Three Brave DPR2 desktop/mobile-landscape/mobile-portrait full-route cases use real sim bullet damage, collection, purchase, a real dash ram and real extraction.18 additional tip cases verify all six tips, normal-flight integration, save persistence and layout-rebuild continuity. Zero page errors; no screenshots/recording or public-room fixture writes. Evidence outputs/steroids-alpha/four-step-tutorial/.

## Open questions

None for release. The roughly one-minute duration is a design target awaiting human play feedback, not a measured human completion time.

## Known issues

Physical-phone/Safari visuals not inspected. Existing unrelated build warnings remain.

## Next proposed step

Publish and verify public full-route/tip tests, then stop temporary Vite4187. Keep CLAUDE_BACKLOG.md ready for her later sync; no resident publisher or capture service.
