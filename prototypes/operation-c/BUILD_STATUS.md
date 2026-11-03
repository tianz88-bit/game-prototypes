## Current milestone

Light/Armoured/Structure damage-class update, 2026-11-03. Published preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version stamp 031126r0010; Worker/client deployment c82a271b-4e2a-444f-a95e-1e8dc712a984 on the existing Free plan. Reload both clients and create a NEW room for protocol/checkpoints v3. GitHub Pages and unrelated game deployments remain unchanged; PR #414 contains the review branch.

## What was implemented

Added Light, Armoured and Structure target classes, independent of tier and air/ground domain. Every building/HQ is Structure regardless of its produced unit. Each weapon hit adds its matching flat bonus. Each living squad member contributes separately, retaining single-hit no-spill behavior and casualty-triggered production. Each splash recipient uses its own class before existing falloff. No numerical armor reduction or tier multiplier. HQ/Bunker fire and nuclear centre/outer damage keep their previous calculations.

Provisional bonuses: Machine-gun Squad +0.5 per member vs Light; Missile Squad +2 per member and Tank Destroyer +24 vs Armoured; Bomber +15 and Siege Tank +20 vs Structure. Every previous base damage, health, cost, movement, weapon cadence and production setting is unchanged. T1 infantry, scouts, field artillery, Flak and lighter aircraft are Light; tanks, walkers, tank destroyers, MLRS and heavier aircraft are Armoured. Detailed assignments are in BRIEF.md and tune.json.

Catalog building sections identify Structure, unit sections identify their own class, and damage text makes squad bonuses explicit, e.g. 5 × (4 +2 vs ARMOURED). Unit/building inspectors show the correct class and unit weapon bonuses. Catalog cards have enough vertical space for the added details. Mini building cards remain concise. Producer unit classes/bonuses are editable in the existing debug pane. All prior utilities, nuclear effects, HQ defence, building anchors, research, conversions and resource lifecycle rules remain.

## Key technical decisions

One targetDamageClass/weaponDamage path resolves ordinary unit hits and each splash victim. It never bypasses target-domain validation. Actual buildings classify by entity role, not their producer card's unit metadata. Optional class bonuses are additive; nuclear and static defensive weapons keep their explicit damage paths. No new dependencies or assets.

The authoritative server supplies class/bonus tuning in welcome data and retains it in v3 checkpoints. Older v1/v2 rooms fail cleanly with the version-change/new-room message. Per-seat nuclear flight/readiness redaction is retained. Clients continue to mirror server state rather than advancing online rules.

Verification: 71 gameplay and 19 network tests pass. They cover matching/nonmatching bonuses across all classes, producers always being Structure, per-member volleys, mixed-class splash before falloff, no-spill casualties, invalid-domain rejection, no tier-based damage reduction, unchanged defensive/nuclear damage and authoritative tune/recovery. Existing T1-versus-unsupported-T3 tests still pass. Full/scoped TypeScript and hub/standalone builds pass; pre-existing hub warnings remain. Brave production flows pass desktop, portrait and two landscape profiles with no console errors; screenshots were inspected. Two independent local-Worker clients completed a full match at 69.9 seconds with identical final worlds, alongside placement/production, building-anchor and reconnect checks. Published v3 two-seat smoke checks also pass placement/production, friendly-building anchor commands and same-seat reconnect without console errors.

Evidence outside Git: outputs/operation-c-classes-regression (four layouts and PR screenshot), outputs/operation-c-classes-online (two-client full match), outputs/operation-c-classes-hosted (published transport checks).

## Open questions

The three-class system and absence of numerical armor reduction are owner-approved. Exact bonus values/class assignments remain provisional playtest tuning. BRIEF.md now records the system and current values; no unresolved implementation question blocks this build. Additional utilities, full races/map and six-player FFA remain later work. The earlier question whether the minimum T1 ground card must specifically capture remains unconfirmed; its validation is unchanged.

## Known issues

Passing counter tests does not establish competitive balance or remove territorial snowballing by itself. Physical-phone/cellular-latency and large-concurrency performance remain unverified. Free hosting quotas are shared, session storage is required to reclaim seats, and old rooms need replacement after this rules update. Exclusive hex occupancy intentionally permits congestion. Only two-human private rooms are supported online; no matchmaking or spectators.

## Next proposed step

Play a fresh two-device room. Compare Missile Squads/Tank Destroyers against armour, Machine-gun Squads against Light units, and Bombers/Siege Tanks against structures. Check T1 swarm counterplay against unsupported T3 before changing other numbers. Review PR #414 separately for eventual hub publication.
