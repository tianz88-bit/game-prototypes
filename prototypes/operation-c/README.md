# Operation C — private-room 1v1 prototype

Mobile-first RTS with online two-human private rooms and a local human-versus-bot mode. The current map and roster are a systems slice of the eventual FFA game.

## Online play

Choose your eight-card loadout, click HOST 1V1, then COPY INVITE and share that link with one opponent. Each player chooses their loadout and clicks READY; both ready starts a three-second countdown. No account is required. Rooms hold two authenticated seats, including disconnected players; a third visitor cannot take one. Reload the original tab to reconnect to the same seat. The match continues during disconnects and cannot be paused. NEW MATCH returns to loadout; host a fresh room for a rematch.

The client uses the isolated `operation-c-online.tianz-88.workers.dev` server. Local development defaults to port 8789; `?server=https://operation-c-online.tianz-88.workers.dev` allows a local client to use the public server. Both invite recipients need access to the client URL: a localhost invite cannot be opened on another person's device. Seat tokens remain in tab session storage and are absent from invite links; closing the tab or clearing storage can lose the seat. Rooms are for small private playtests, with no matchmaking, spectators or saved account progression. See [server setup and lifecycle](server/README.md).

## Play

The loadout catalog has three tier sections and a pinned eight-socket tray. Toggle its portraits between buildings and units. Choose up to eight unique BASE cards (eleven producers plus Bunker and Nuclear Silo), including a T1 ground producer. Bunker and Silo are included in the default eight. Arrow buttons flip eligible cards to upgrade previews without selecting a separate card. T1 starts unlocked; the TOP RESEARCH BAR reserves 20 free territory cells for 30 seconds to T2, then 20 for 60 seconds to T3. Click active research to cancel and lose progress.

Building cards sit in the LEFT HALF of the BOTTOM RTS command panel; contextual commands occupy the right half. Select a card, tap an open owned hex for its hammer, then tap again to build. Occupied/committed/burnt hex selection exits build mode. Construction reserves support and blocks immediately; first production waits for completion and a legal spawn. Replacement cooldown starts only when the supported unit dies, or the first squad member is lost. Later losses join that pending batch without resetting its timer. My HQ and Map recenter; drag and pinch/scroll navigate.

Click a unit/building hex for the contextual panel. Tap your own HQ to expand/defend or an enemy HQ to attack it; the same command is available in its contextual panel. Selection follows the entity ID when it moves. Your buildings expose permanent Upgrade and Sell commands. Armoury costs +2 resources/5 seconds; Bomber Command needs T3 and 8 seconds, with no surcharge. Upgrading recalls current forces and incoming reinforcements immediately. Cancellation loses progress and starts a fresh full base production cooldown. Conversion does not heal the building.

Any friendly building can be a DEFEND / EXPAND anchor through its contextual menu. The ring follows that building; moving units cannot be anchors. Losing the building resets to HQ. This moves expansion priorities and idle defenders, while HQ capture pressure remains at the actual HQ. The HQ has a basic ground-only defence gun against infantry rushes.

## Utility buildings and nukes

The T1 Bunker is a self-contained ground/air gun, without a spawned unit or garrison. The T3 Nuclear Silo costs 32 connected open tiles, builds for 15 seconds, then produces its first payload over 60 seconds. It stores one payload; the next cycle starts only on launch. Select the silo, choose LAUNCH NUKE, tap a map hex to inspect the seven-cell blast preview, then CONFIRM LAUNCH. Cancel preserves the payload. Flight takes eight real game seconds and is hidden from the defender, including network flight/target/readiness data. Impact shows a scripted mushroom cloud and deals 200 centre/80 adjacent damage to air, ground, buildings and every squad member, including friendly forces. Normal destroyed-building burns apply; empty terrain is not burnt by the blast. Launched payloads survive silo loss, but owner elimination removes flights. Numbers are provisional in tune.json.

Resources display committed / capacity, including stranded debt. Dark owner-colour cells support buildings; arrows mark permanent upgrade support and bobbing flasks mark temporary research support. New buildings need connected open support, while upgrade and research allocations may be disconnected. Selling releases only still-assigned support immediately; enemy destruction holds it committed for 10 seconds, showing a clock/countdown on its hexes, then releases surviving assignments; lost assignments leave debt for the match. Sale leaves an open tile and retires its forces; destruction burns its tile and leaves a living orphan. Research releases its full temporary commitment on completion/cancellation, even after territory loss.

## Units and squads

Targets have one damage class: LIGHT, ARMOURED or STRUCTURE. Every building and HQ is Structure, regardless of its produced unit; ground/air targeting is separate. Hits add a flat bonus only against a matching class, without numerical armor reduction. Initial bonuses are Machine-gun Squad +0.5/member vs Light, Missile Squad +2/member and Tank Destroyer +24 vs Armoured, Bomber +15 and Siege Tank +20 vs Structure. Existing base stats are unchanged. Each splash victim uses its own class before falloff; nuclear damage keeps its fixed centre/outer values. Cards and inspectors show classes and bonuses, with editable settings in the debug pane. These numbers are provisional.

Infantry attacks ground/air; tanks and Artillery ground; helicopters ground; fighters air. Aircraft never capture and share the same exclusive hex occupancy as ground units/buildings. Artillery fires at range 2-3 and retreats after actual damage. T3 adds Bombers, Artillery-to-MLRS conversion (range 3-5 splash), Motor Pool-to-Siege Tank and the Assault Carrier. New T1 options are Scout Buggy, Machine-gun Squad and Flak Rover; T2 adds Assault Walker, Tank Destroyer and the Helipad-to-Gunship conversion. Flak cannot capture. Every T3 type has a documented close-range or air vulnerability.

Regular, Missile and Machine-gun Infantry occupy one hex as five-member squads. Members have individual HP/damage and focus one target. Single hits affect one member with no damage spillover; splash can damage multiple members. Producers dispatch only missing members after cooldown, counting members already travelling. Reinforcements are visual/non-interactable until arrival, add full-HP members without healing survivors, and vanish if their target squad dies.

The provisional stats and remaining full-game design are in BRIEF.md and tune.json. The local bot can research/upgrade; online rooms use two humans and no bot.

## Development

From repository root, after `npm ci`:

```sh
node node_modules/vite/bin/vite.js --config prototypes/operation-c/vite.config.ts
node prototypes/operation-c/tests/run.mjs
node prototypes/operation-c/tests/online.mjs
node scripts/generate-versions.js
npx tsc --noEmit -p prototypes/operation-c/tsconfig.json
npx tsc --noEmit -p prototypes/operation-c/server/tsconfig.json
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
- online-protocol.ts / online-client.ts: strict command envelopes, revisioned record deltas, authenticated reconnect and a read-only server-state mirror.
- server/: isolated authoritative Worker/Durable Object room, checkpoints, ready/countdown, deduplication and command validation.

Firestorm main f584c590d52e0f8802c55b90aaa870d4a9c85fdc, particularly arena-sim and firestorm-net, informed separation of commands, pure rules, deterministic timing and authoritative-state presentation. This prototype has different occupancy, construction and capture rules; it does not connect to Firestorm or alter its server.

## Provisional choices

271-hex radius-nine test map; HQ centre supplies no capacity; capacity capped at 200 while additional land stays capturable; sample unit damage/health/movement/ranges and all combat timers are balance placeholders. Infantry prioritizes capture; other capturing ground units capture only in Expand mode while friendly territory is clear of intruders. Flak guards against air instead of capturing. Non-neutral capture takes 1.5x neutral duration. No ranged line-of-sight obstruction yet. Elimination removes remaining structures without a burn cascade. HQ pressure retakes unoccupied nearby enemy land using normal enemy capture duration. Movement reserves both endpoints until arrival, so queues cannot exchange places. These are documented test assumptions, not final design decisions.

Pending: additional utility roles, complete Eurasia map, six-player rooms, three races and full race catalogs, final balance and physical phone performance/orientation testing.
