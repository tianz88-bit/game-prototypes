# Operation C — core-loop sandbox

Mobile-first local human-v-bot preview. This is the first systems slice, not the full six-player Eurasia game.

## Play

Choose Barracks, Factory or Artillery, tap an open teal hex, inspect the highlighted connected footprint, then tap **Build here**. Units produce and act automatically. **Home · Expand** favors territory expansion; **Attack rival HQ** sends your forces toward the rival's buildings. Destroy the rival HQ to win. Drag the map, pinch/scroll to zoom, use **My HQ** to return or **Map** to see the whole field. Reset starts a fresh match.

The resource display is **committed costs / capacity**. Hatched hexes are committed to buildings. Losing territory does not release commitment. Destroyed production buildings leave passable burnt tiles, release their full cost and leave living units alive. Capturing pauses only while the capturing unit attacks.

Barracks now costs **8** capacity. No placement cooldown has been added. Ownership changes play a short lift/flip/landing animation; unit bodies stay upright and an external ring chevron points toward the actual combat target. Reduced-motion preferences suppress the tile flip.

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

Browser checks use `scripts/screenshot-operation-c.mjs <url> <output-dir>`. Set `OPERATION_C_BROWSER_PACKAGE` to an installed Playwright package.json if the tool is not locally resolvable. On Windows this script launches an isolated headless Brave process and closes it after testing; it never touches existing user tabs. CI Linux uses isolated Chromium. `?test=1` exposes read-only state/coordinates, virtual simulation advance and a separate cosmetic capture clock for reproducible screenshots of actual captures. The cosmetic clock never changes ownership or resource state. Normal play has no test hook.

`?debug=1` opens the existing Tweakpane tool with provisional tuning and JSON copying. Apply tuning restarts the sandbox. All numeric gameplay values live in tune.json.

## Architecture and provenance

- sim.ts/model.ts: pure deterministic fixed-step rules and DTOs, independent of rendering. Explicit commands separate input from rules.
- input.ts: mouse/touch/keyboard intent adapter.
- art.ts: procedural Graphics silhouettes, patterns, ownership glyphs, recoil/walk cycles and effects. No external images, fonts or runtime downloads.
- main.ts: responsive canvas HUD, placement feedback, cached terrain, live units and scripted spawn/movement.
- tests/run.mjs: behavior tests using the existing TypeScript compiler; no new application dependencies.

Firestorm main f584c590d52e0f8802c55b90aaa870d4a9c85fdc, particularly arena-sim and firestorm-net, informed separation of commands, pure rules, deterministic timing and authoritative-state presentation. This prototype has different occupancy, construction and capture rules; it does not connect to Firestorm or alter its server.

## Provisional choices

271-hex radius-nine test map; HQ centre supplies no capacity; capacity capped at 200 while additional land stays capturable; three sample building costs/ranges and all combat timers are balance placeholders. All current ground types capture, infantry fastest. No ranged line-of-sight obstruction yet. Elimination removes remaining structures without a burn cascade. HQ pressure retakes unoccupied nearby enemy land using normal enemy capture duration. Movement reserves both endpoints until arrival, so queues cannot exchange places. These are documented test assumptions, not final design decisions.

Pending: complete Eurasia map, six players/networking, three races and tiers/pre-match loadouts, swarm membership/reinforcements, full defense routing, final balance and physical phone performance/orientation testing.
