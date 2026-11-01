## Current milestone

Owner visual feedback iteration, 2026-11-01: stronger capture lift/flip/landing, horizontal unit facing, actual-shot bullet lines, committed locks and gold hammer confirmation. Canonical live entry: https://tianz88-bit.github.io/game-prototypes/prototypes/operation-c/ . Game-specific PR publication and live verification follow completed local checks.

## What was implemented

Capture transitions lift higher, complete a full turn with visible underside/edge, and land with squash and a pulse over a grounded socket. Units remain upright and mirror only their body horizontally; health, ownership rings and target direction stay unmirrored. Actual firing emits short bullet traces; aiming or reloading does not emit phantom shots.

Committed tiles use muted inset shading and a small lock while preserving ownership colour. The selected build hex shows a gold hammer; other supporting hexes stay subdued. A second tap/click on the same hex builds, with Build Here retained as an alternative. Barracks remains 8 resources; no gameplay tuning or construction cooldown changes.

## Key technical decisions

Presentation is independent of deterministic rules. Shot IDs use a separate bounded sequence (128 events); renderer effects expire after 220 ms and discard stale fast-forwarded shots. Capture lasts 900 ms with lift 0.9 times tile radius. Numeric presentation values live in tune.json and the debug pane. Reusable Graphics layers avoid per-shot/per-tile GameObjects. Existing movement, capture, resource and production rules remain unchanged.

Verification: 20 behavior tests, scoped and full TypeScript checks, standalone and hub production builds pass. Development and production bundles pass isolated Brave flows at desktop 1440x900, portrait 390x844 and landscape 844x390/667x375, with no console errors. Screenshots inspected for hammer placement, locks, flip/landing and actual bullet traces. A normal-clock unpaused Brave portrait recording independently confirms capture lift, turn and landing without virtual advance or cosmetic freezing. GitHub CI and deployed checks remain the publication step.

## Open questions

Assess opening expansion with Barracks cost 8 before discussing another construction timer. Full-game questions remain in BRIEF.md (capacity cap, HQ exceptions, factions/loadouts, swarm reinforcements, geography and match duration). Owner confirmed Brave as the affected browser; this implementation was tested in Brave.

## Known issues

Two-HQ local bot sandbox only; six-player networking, final map and factions remain outside scope. Physical phones and sustained mobile performance are unverified. OS reduced-motion preferences intentionally suppress capture flips. Existing provisional rules are listed in README.md. Legacy hub publication still builds multiple games; this change does not modify other games, deployment configuration or pending account-migration PRs.

## Next proposed step

Publish this game-specific change, verify the new live version in Brave, then have the owner assess capture readability, hammer confirmation and opening expansion. Add no new pacing timer without discussion.
