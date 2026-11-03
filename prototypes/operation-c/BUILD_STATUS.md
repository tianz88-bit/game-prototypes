## Current milestone

Bunker/Nuclear Silo and anti-snowball balance update, 2026-11-03. Published standalone preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version stamp 031126r0009. Cloudflare Worker/client deployment 91cc7910-92f0-40e9-a8e3-7291d687f6cd uses the existing Free plan. GitHub Pages still serves the earlier progression milestone; PR #414 remains the review branch. Reload both clients and create a NEW room: protocol/checkpoints are now v2.

## What was implemented

Added two utility base cards sharing the eight loadout slots, with distinct procedural art and utility-specific catalog details. T1 Bunker is a self-contained ground/air gun: provisional 8 tiles, 6s construction, 180 HP, range 2, 5 damage per second. T3 Nuclear Silo: provisional 32 connected tiles, 15s construction, 160 HP and 60s payload production. Stores one nuke indefinitely. Only launch consumes it and starts the next payload timer. New default eight includes Bunker and Silo; all eleven producer cards and five conversions remain available.

Silo contextual LAUNCH NUKE enters targeting. Tap a map hex for a seven-cell centre/adjacent preview, then CONFIRM LAUNCH; Cancel consumes nothing. Actual flight is eight seconds, hidden from defenders. Centre damage 200, outer 80, including both factions, air/ground, buildings/HQs and every squad member. Normal building destruction burns/releases apply; empty terrain is not directly burnt. Launched missiles survive silo loss, but owner elimination cancels flights. Impact uses a scripted flash, shockwave, rising stem and billowing mushroom cap; reduced motion uses a static pose.

HQ now has basic ground-only range-two defence, provisionally 5 damage per second. Supported-unit replacement cooldown begins on death; squad reinforcement cooldown begins on first member death. No healthy-unit precharge, no reset from later casualties. Pending/incoming members remain accounted for; wiped squads still delete incoming reinforcements. First unit still spawns after completed construction/legal placement. Existing upgrade-cancellation production rules remain.

Any FRIENDLY BUILDING can be selected through DEFEND / EXPAND in its contextual menu. Expansion priorities and idle defenders use that building as their anchor; the command ring moves there. Unit IDs and enemy buildings are rejected. Sold/destroyed targets reset to HQ. Actual HQ capture pressure remains at the HQ. Own/enemy HQ taps still reset home defence or order an attack.

## Key technical decisions

Pure deterministic rules remain server-authoritative. Per-seat state/delta baselines redact enemy silo readiness and all private flight IDs, targets and timing, including resync/recovered reconnect. Per-owner flight sequences avoid launch-count leakage. Public nuclear impacts are separate events. Checkpoints retain internal flights, serials and casualty production clocks. v1 rooms fail cleanly with a create-new-room message. No application dependencies, billing changes or unrelated game deployments.

Verification: 64 core and 18 network behavior tests pass, including unsupported infantry rush held by HQ fire, first-casualty timing/no reset, Bunker domains, payload lifecycle/friendly fire, checkpointed flights, building-only targets and per-seat privacy. Full/scoped TypeScript and hub/standalone builds pass; only pre-existing hub warnings remain. Brave desktop, portrait and both landscape canvas flows pass with no console errors, covering T3 progression, silo production, preview/cancel/launch, actual flight delay, friendly bunker destruction and inspected mushroom-cloud screenshots. Two actual browser clients against local Wrangler completed real-time T2/T3 research, silo construction/payload production and flight, with private defender wire data and shared impact/damage. Published-client two-seat smoke checks also pass, including default utility cards, friendly-building anchor commands and same-seat reload, without console errors.

Artifacts remain outside Git: outputs/operation-c-nuclear-regression (four layouts), outputs/operation-c-nuclear-online (two-client real-time nuke flow), outputs/operation-c-nuclear-hosted (published-client checks).

## Open questions

BRIEF.md has been updated to remove the obsolete design-only utility scope and cooldown-on-spawn rule. Owner confirmed Bunker + Silo with provisional tuning, and friendly BUILDINGS ONLY as command anchors. Playtest the new numbers before further balance changes. Additional utility roles, nuclear interception/warnings, full race catalogs and six-player FFA remain later discussion. Existing minimum loadout validation still accepts any T1 ground producer; whether it must specifically capture remains unconfirmed.

## Known issues

New prototype balance numbers are provisional; this is not proof of competitive balance. No physical-phone/cellular-latency or large-concurrency verification. Free hosting quotas remain shared. Original-tab session storage is required to reclaim a seat. This update requires fresh rooms rather than migrating v1 matches. Exclusive air/ground occupancy intentionally permits congestion. A silo needs a connected open footprint, so players may need to reallocate/sell prior buildings despite sufficient total free capacity. Only local two-client verification has exercised the complete real-time nuclear sequence; public smoke verification passes deployment transport, building-anchor commands, defaults and reconnect.

## Next proposed step

Play a new two-device room on the updated preview. Test an infantry rush against HQ, a forward-building defence anchor, and the cost/risk of reaching a ready silo. Record match outcomes and tune damage, cooldowns or costs from those observations. Review PR #414 separately for eventual hub publication.
