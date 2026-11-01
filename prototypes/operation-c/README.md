# Operation C — core-loop sandbox

Mobile-first local human-v-bot preview. This is the first systems slice, not the full six-player Eurasia game.

## Play

Choose Barracks, Factory, Artillery, Hangar or Airfield, tap an open teal hex, inspect the highlighted connected footprint, then tap that same **gold hammer hex** again to build. **Build here** remains an alternative confirmation. Units produce and act automatically. **Home · Expand** favors territory expansion; **Attack rival HQ** sends your forces toward the rival's buildings. Destroy the rival HQ to win. Drag the map, pinch/scroll to zoom, use **My HQ** to return or **Map** to see the whole field. Reset starts a fresh match.

The resource display is **committed costs / capacity**. Muted inset hexes with a small lock are committed to buildings. They remain traversable and capturable, but cannot fund or host another building. Losing territory does not release commitment. Destroyed production buildings leave passable burnt tiles, release their full cost and leave living units alive. Capturing pauses only while the capturing unit attacks. If that unit dies before completion, its progress slowly shrinks back toward the original controller.

Barracks costs **4**, Factory and Artillery **8**, Hangar and Airfield **12** capacity. No placement cooldown has been added. Ownership changes play a 900 ms lift/full-turn/landing animation with a visible underside and grounded socket. Unit bodies stay upright and mirror horizontally toward movement or the attack target; an external ring chevron points toward the actual combat target. Short bullet traces appear only when a unit actually fires, including its final shot if it dies in that step. Reduced-motion preferences suppress the tile flip.

## Unit roles

Infantry attacks ground and air. Tanks attack ground only. Frail artillery attacks ground at range 2-3, cannot fire adjacent, and retreats after taking a hit. Hangars maintain one helicopter (air-to-ground); Airfields maintain one fighter (air-to-air). Both aircraft cannot capture. G/A labels on cards identify attacker and target domains.

Aircraft in Expand mode defend owned territory against the nearest valid intruder, otherwise return home. In Attack mode they advance toward the selected enemy HQ and seek valid targets; fighters never fire on ground units or buildings. Ground expansion fills reachable neutral land outward from its HQ before hostile land.

All units share one occupancy slot per hex, including air versus ground. Buildings and reserved movement endpoints block every unit. This intentionally tests queues and congestion without air/ground stacking.

## Development

From repository root, after `npm ci`:

```sh
node node_modules/vite/bin/vite.js --config prototypes/operation-c/vite.config.ts
node prototypes/operation-c/tests/run.mjs
node scripts/generate-versions.js
npx tsc --noEmit -p prototypes/operation-c/tsconfig.json
npx vite build --config prototypes/operation-c/vite.config.ts
```

The root hub build also discovers this entry automatically. The game-specific preview workflow builds/tests only Operation C; the established root Pages workflow publishes the hub and its existing multi-game output. Firestorm's dedicated itch and Worker workflows are untouched.

Browser checks use `scripts/screenshot-operation-c.mjs <url> <output-dir>`. Set `OPERATION_C_BROWSER_PACKAGE` to an installed Playwright package.json if the tool is not locally resolvable. On Windows this script launches an isolated headless Brave process and closes it after testing; it never touches existing user tabs. CI Linux uses isolated Chromium. `?test=1` exposes read-only state/coordinates plus virtual-time and cosmetic-clock hooks for testing. Browser checks cover two-tap confirmation, capture through landing, actual-shot traces and horizontal facing. A separate normal-clock Brave phone-sized recording verified capture without advancing or freezing time. Normal play has no test hook.

`?debug=1` opens the existing Tweakpane tool with provisional tuning and JSON copying. Apply tuning restarts the sandbox. All numeric gameplay values live in tune.json.

## Architecture and provenance

- sim.ts/model.ts: pure deterministic fixed-step rules and DTOs, independent of rendering. Explicit commands separate input from rules.
- input.ts: mouse/touch/keyboard intent adapter.
- art.ts: procedural Graphics silhouettes, patterns, ownership glyphs, recoil/walk cycles and effects. No external images, fonts or runtime downloads.
- main.ts: responsive canvas HUD, placement feedback, cached terrain, live units and scripted spawn/movement.
- tests/run.mjs: behavior tests using the existing TypeScript compiler; no new application dependencies.

Firestorm main f584c590d52e0f8802c55b90aaa870d4a9c85fdc, particularly arena-sim and firestorm-net, informed separation of commands, pure rules, deterministic timing and authoritative-state presentation. This prototype has different occupancy, construction and capture rules; it does not connect to Firestorm or alter its server.

## Provisional choices

271-hex radius-nine test map; HQ centre supplies no capacity; capacity capped at 200 while additional land stays capturable; sample unit damage/health/movement/ranges and all combat timers are balance placeholders. All current ground types capture, infantry fastest. No ranged line-of-sight obstruction yet. Elimination removes remaining structures without a burn cascade. HQ pressure retakes unoccupied nearby enemy land using normal enemy capture duration. Movement reserves both endpoints until arrival, so queues cannot exchange places. These are documented test assumptions, not final design decisions.

Pending: complete Eurasia map, six players/networking, three races and tiers/pre-match loadouts, swarm membership/reinforcements, full defense routing, final balance and physical phone performance/orientation testing.
