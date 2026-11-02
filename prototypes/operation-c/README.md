# Operation C — RTS roster sandbox

Mobile-first local human-v-bot preview. This is the first systems slice, not the full six-player Eurasia game.

## Play

The loadout catalog has three tier sections and a pinned eight-socket tray. Toggle its portraits between buildings and units. Choose up to eight unique BASE cards on the loadout page (eleven currently available), including a T1 ground producer, then Start Match. Arrow buttons flip each eligible card between base and upgrade previews without selecting a separate card. T1 starts unlocked; use the TOP RESEARCH BAR to reserve 20 free territory cells for 30 seconds to T2, then 20 cells for 60 seconds to T3. Click active research to cancel and lose progress.

Building cards sit in the LEFT HALF of the BOTTOM RTS command panel; selected units/buildings show their commands in the right half. Select one, tap an open owned hex, inspect the gold hammer, then tap the hammer hex again. Selecting an occupied/committed/burnt hex exits building mode. Construction reserves resources and blocks immediately, but the first unit waits for completion and a legal spawn hex. The subsequent production cooldown starts when it spawns. My HQ and Map recenter the view; drag and pinch/scroll navigate. Loadout returns to pre-match selection; Start Match creates a fresh game.

Click a unit/building hex for the contextual panel. Tap your own HQ to expand/defend or an enemy HQ to attack it; the same command is available in its contextual panel. Selection follows the entity ID when it moves. Your buildings expose permanent Upgrade and Sell commands. Armoury costs +2 resources/5 seconds; Bomber Command needs T3 and 8 seconds, with no surcharge. Upgrading recalls current forces and incoming reinforcements immediately. Cancellation loses progress and starts a fresh full base production cooldown. Conversion does not heal the building.

Resources display committed / capacity, including stranded debt. Dark owner-colour cells support buildings; arrows mark permanent upgrade support and bobbing flasks mark temporary research support. New buildings need connected open support, while upgrade and research allocations may be disconnected. Selling releases only still-assigned support immediately; enemy destruction holds it committed for 10 seconds, showing a clock/countdown on its hexes, then releases surviving assignments; lost assignments leave debt for the match. Sale leaves an open tile and retires its forces; destruction burns its tile and leaves a living orphan. Research releases its full temporary commitment on completion/cancellation, even after territory loss.

## Units and squads

Infantry attacks ground/air; tanks and Artillery ground; helicopters ground; fighters air. Aircraft never capture and share the same exclusive hex occupancy as ground units/buildings. Artillery fires at range 2-3 and retreats after actual damage. T3 adds Bombers, Artillery-to-MLRS conversion (range 3-5 splash), Motor Pool-to-Siege Tank and the Assault Carrier. New T1 options are Scout Buggy, Machine-gun Squad and Flak Rover; T2 adds Assault Walker, Tank Destroyer and the Helipad-to-Gunship conversion. Flak cannot capture. Every T3 type has a documented close-range or air vulnerability.

Regular and Missile Infantry occupy one hex as five-member squads. Members have individual HP/damage and focus one target. Single hits affect one member with no damage spillover; splash can damage multiple members. Producers dispatch only missing members after cooldown, counting members already travelling. Reinforcements are visual/non-interactable until arrival, add full-HP members without healing survivors, and vanish if their target squad dies.

The provisional stats and remaining full-game design are in BRIEF.md and tune.json. The current bot can research/upgrade; this is still a local systems preview, not six-player multiplayer.

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

Browser checks use `scripts/screenshot-operation-c.mjs <url> <output-dir>`. Set `OPERATION_C_BROWSER_PACKAGE` to an installed Playwright package.json if the tool is not locally resolvable. On Windows this script launches an isolated headless Brave process and closes it after testing; it never touches existing user tabs. CI Linux uses isolated Chromium. `?test=1` exposes state/coordinates and virtual-time/cosmetic-clock hooks. Add `&bot=0` only with test mode for peaceful progression verification; normal play always keeps the bot. Browser checks exercise loadout validity, construction, squads, persistent selection, upgrade/cancel/cooldown, territory earned by actual autonomous capture, research/cancel/T2/T3, Bomber conversion/sale and MLRS. Simulation tests separately cover combat, debt and reinforcements. Normal play has no test hook.

`?debug=1` opens the existing Tweakpane tool with provisional tuning and JSON copying. Apply tuning restarts the sandbox. All numeric gameplay values live in tune.json.

## Architecture and provenance

- sim.ts/model.ts: pure deterministic fixed-step rules and DTOs, independent of rendering. Explicit commands separate input from rules.
- input.ts: mouse/touch/keyboard intent adapter.
- art.ts: procedural Graphics silhouettes, patterns, ownership glyphs, recoil/walk cycles and effects. No external images, fonts or runtime downloads.
- catalog.ts: shared military building/unit names and role descriptions.
- main.ts: scrollable split-stat loadout, pinned sockets, classic RTS canvas HUD, placement feedback, cached terrain, live units and scripted spawn/movement.
- tests/run.mjs: behavior tests using the existing TypeScript compiler; no new application dependencies.

Firestorm main f584c590d52e0f8802c55b90aaa870d4a9c85fdc, particularly arena-sim and firestorm-net, informed separation of commands, pure rules, deterministic timing and authoritative-state presentation. This prototype has different occupancy, construction and capture rules; it does not connect to Firestorm or alter its server.

## Provisional choices

271-hex radius-nine test map; HQ centre supplies no capacity; capacity capped at 200 while additional land stays capturable; sample unit damage/health/movement/ranges and all combat timers are balance placeholders. Infantry prioritizes capture; other capturing ground units capture only in Expand mode while friendly territory is clear of intruders. Flak guards against air instead of capturing. Non-neutral capture takes 1.5x neutral duration. No ranged line-of-sight obstruction yet. Elimination removes remaining structures without a burn cascade. HQ pressure retakes unoccupied nearby enemy land using normal enemy capture duration. Movement reserves both endpoints until arrival, so queues cannot exchange places. These are documented test assumptions, not final design decisions.

Pending: complete Eurasia map, six players/networking, three races and tiers/pre-match loadouts, full race catalogs, final balance and physical phone performance/orientation testing.
