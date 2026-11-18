## Current milestone

Evolution & siege lab implemented locally on codex/steroids-evolution-lab. Owner requested lab preview first. Public delivery awaits new art ZIP upload to R2; its URL returns404. No push/merge/deploy. Live game remains171126r0100/protocol26.

## What was implemented

?evolution=1 opens graphical build criteria/selection, new18-module Missile Cruiser, rear-launch eight-missile combat, shared7-shot CIWS and heavy two-shot towers. LOAD REQUIREMENTS then EVOLVE & TRY; TEST SPARROW compares fighter vulnerability. Ordinary calibration/duel entries retained. New cruiser art stays outside Git with SHA256 manifest.

## Key technical decisions

Separate local model, cloned tune, dedicated preview selection key and shared movement/rig/renderers. No game sockets/account/save/hosted setting writes. Control-only per-part FFD, Canvas fallback; fixed depth/3% shading and cardinal offsets. Type/build/model/rig tests and7 headless Brave DPR2 PC/touch/portrait/Canvas cases pass: selection, evolve,8 missiles/no main gun, gun cruiser, mines, tilt, bounds/persistence/reset stability; zero page errors/capture. Evidence outputs/steroids-alpha/missile-cruiser-lab/.

## Open questions

Owner manual art upload is pending in the orange Brave task tab. Human silhouette/targeting/feel review remains. No live approval.

## Known issues

Sandbox combat is not shared authority. Missile Cruiser temporarily uses cloned Battlecruiser state only in the isolated page. Server/chassis/save/protocol, prediction/replay and production targeting/burst implementation required before live. See evolution/README.md. Do not merge mandatory asset fetch while R2 URL404.

## Next proposed step

Verify uploaded R2 ZIP and each part hash, publish Pages lab only, run public no-capture checks and let owner playtest. Keep Claude backlog deferred. Do not release itch/Worker/config.
