## Current milestone

LIVE VERIFIED 181126r0101/protocol27. PR562 merge29bb41a4db28900f1c00a4e028b8fb1aff1b6172; itch44232567195, Worker44232567203 and Pages44232567296 succeeded. Owner approved full capital release18 November2026. New R2 art uploaded through Brave and hashes verified.

## What was implemented

Narrow CIWS tracers; Hangar EVOLVE build selection with graphical criteria and stats; Missile Cruiser chassis4 with8 rear-launch missiles/no primary guns, +50% damage/range and larger painted projectile. Shared cooldown/capacity/prediction and server-validated evolution. Both capitals fire7-shot CIWS bursts, pause and reacquire. Heavy towers warn/fire doublets/reload. Siege locks shared with HUD; existing clan/arrival/docking protections retained. Approved18-part profile uses current cardinal rig, palettes, hover/shadow and per-part FFD/Canvas fallback.

## Key technical decisions

Protocol27 keeps107-byte ships, adds chassis4/ordnance kind2; BUY5 tier0/1 selects BC/MC with authority checking criteria/cost/repeats. New bounded config groups upgrade old records and appear in lab stats. R2 ZIP/part/shared turret hashes verified; no binary art or workflow edits. Capital regression runs through existing sim release gate.

Type/build/shared sim+capital/config/rig/bank checks pass. Seven local production Hangar layouts, two actual local Worker clients including120ms RTT, WebGL/Canvas fixtures pass. PUBLIC: two PC/touch Hangar layouts verify selection/persistence/criteria/bounds/rebuilds; two lab layouts verify evolution/8 missiles/no primary/mines/FFD/reset; both public renderers receive47 healthy planet snapshots and draw18-module MC/hover/shadow/no gun modules, CIWS2.61px short axis versus7px main. Public flight receives75 binary snapshots, fast slip24°→.53° after braking; no page errors/capture. Proof ../steroids-alpha-lab/evolution/release-proof.json; raw evidence outputs/steroids-alpha/missile-cruiser-lab/.

## Open questions

Owner can tune balance after live play; selection is in Hangar → EVOLVE, purchase remains earned during the run. No immediate Claude action.

## Known issues

Cold itch CDN loading exceeded the earlier30s test timeout; public checks allow120s. A wall-clock movement probe was timing-sensitive; actual36/12 input-step checks passed. Headless checks do not replace human feel or physical Safari review.

## Next proposed step

Owner plays live after refreshing cached clients for protocol27. Claude deferred backlog and release proof saved. Task upload duplicate closed; no screenshots/recording/native input; temporary preview/Worker and headless test browsers stopped.
