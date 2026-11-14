# Changelog

Base-level (repo-wide) changes that individual prototypes should
account for the next time they're touched. Newest entries first.

## 2026-11-14 - Never block the player

**What changed:** CLAUDE.md gains an owner rule: no screen, overlay or state may stop play until
the player changes their device or browser (no rotate prompts, no screen-size or browser walls).
Prototypes adapt instead; Steroids-Alpha and Punchies draw a landscape game turned a quarter on an
upright phone with touch remapped.

**Applies to:** every prototype. Known blocking guards still in place: mp-console and mp-net
(`src/orientation/orientation.ts`, overlay on wrong orientation) and suits-mp (portrait guard).
Remove them when that prototype is next touched.

## 2026-10-22 - arena-sim and firestorm-net 0.15.0: 2x2 nodes, speed boosters, protocol 9

**What changed:** arena-sim 0.15.0: nodes are 2x2 cells (`MapNode.cell` is the top-left cell, `pos` the shared
middle corner, new `nodeCenter`), `RING_OFFSETS` lists the 12 surrounding cells as half-cell offsets, maps must have
even width and height, safe zones sit in the bottom left and top right corners, and the four Portal Nexus are placed
at fixed compass points (`map.portals.fromEdge`) instead of from the rings. New `booster` tune block and `boost`
command; `NodeKindTune.marchEdgeSecondsCut` is replaced by `boostRechargeRate`, and the team view's HQs carry
`boostCharges` and `nextBoostAtMs`. firestorm-net 0.15.0 depends on arena-sim ^0.15.0, accepts the `boost` command,
counts boosts in the game log, lets bots use boosters, and bumps the protocol to 9.

**Applies to:** firestorm-arena only (the only user of these packages).

## 2026-10-14 - Dice Dig replaces digger; shared package dig-kit 0.1.0; manual itch deploy

**What changed:** the previous digger game moved unchanged to `prototypes/digger-legacy`. Dice Dig (a luck-based dice dig
game) lives in `prototypes/dice-dig`; there is no `prototypes/digger` folder any more. A new shared package
`packages/dig-kit` (0.1.0) holds the pillow-block art helpers, tapered crack drawing, synthesised sounds, button, intent
bus, tune panel and RNG that dice-dig uses and the next prototype (dig-match) will reuse. `deploy-digger-itch.yml` is
replaced by `deploy-dig-itch.yml`, which only runs by hand: it asks which prototype to deploy and which itch
project:channel to push to (default `polsia/digger:html5`), and bumps that prototype's `version.json`. Nothing deploys to itch on merge. The Pages
workflow fetches the old digger art under the `digger-legacy` name. The hub lists Dice Dig and digger-legacy.

**Applies to:** dice-dig, digger-legacy and any prototype that opts into dig-kit. Pin dig-kit to an exact version.

## 2026-10-08 - punchies-playable replaces the mp-console itch slot

**What changed:** the dedicated punchies-playable workflow now builds its
own relative-path-safe Vite output, prepares the existing Punchies art when
available, and pushes that output to `zitian-ff/mp-console:web`. The old
mp-console deploy workflow is retired, while its source remains in the repo.
The hub now links that itch project as Punchies Playable.

**Applies to:** punchies-playable deployment and the prototype hub only.

## 2026-10-05 — firestorm shared packages: firestorm-net 0.14.0 (log v2, usage meter)

**What changed:** the game log record is version 2: it adds `squads` (the dealt squads with percentile and reveal tier),
`connections`, `connectedSeconds` and `drops`. The Worker's usage meter is saved on every report (it used to save at most
once a minute, so an eviction could lose counts) and a room reports straight away when its last socket leaves, so a
match dropped half way is still counted. No protocol change. Folded into the unreleased 0.14.0.

**Applies to:** firestorm-arena only.

## 2026-10-05 — firestorm shared packages: firestorm-net 0.14.0 (intro delay)

**What changed:** firestorm-net's room starts the match clock `match.introSeconds` (tune, default 0, 7 in Firestorm
Arena) real seconds after the start countdown ends, so a client can show an opening reveal without the sim running.
`RoomOptions.introSeconds` overrides it (the Worker reads `INTRO_SECONDS` for tests) and orders sent before the clock
starts are refused. Folded into the unreleased 0.14.0.

**Applies to:** firestorm-arena only.

## 2026-10-05 — firestorm shared packages: arena-sim 0.14.0

**What changed:** arena-sim's squad rank bands are now squad 1 ranks 1 to 12, squad 2 ranks 8 to 20, squad 3 ranks 15 to
20 and squad 4 ranks 18 to 20 (1 is strongest), so the first two squads are the fighters and the 3rd and 4th are
utility. New helpers `slotPowerRange`, `slotPercentile` and `cardTier`, and `roster.cardTiers` (0.1, 0.2 and 0.3) and
`roster.cardTierSlots` (2) tune blocks, let a client grade the first two squads' rolls against their own slot's
range for the opening reveal cards; squads 3 and 4 are never graded. Only firestorm-arena
uses it.

**Applies to:** firestorm-arena only.

## 2026-10-05 — firestorm shared packages: firestorm-net 0.14.0

**What changed:** firestorm-net's room keeps small behaviour counters per human player while a match runs and hands one
record per human to the host when it ends (new `RoomEnv.gameLog`, `GameLogRecord`, and an optional `device` on the
hello message; no protocol bump). The room persists the counters at most once a minute so an eviction loses little.
The Firestorm server stores the records in a new `GameLogs` Durable Object (migration v3). arena-sim is unchanged.
Only firestorm-arena uses it.

**Applies to:** firestorm-arena only.

## 2026-10-05 — firestorm shared packages: arena-sim 0.13.0, firestorm-net 0.13.0

**What changed:** arena-sim's march speed is now defined by `march.edgeToEdgeSeconds` (the map's longer side) instead
of the cross-map diagonal, with `march.minEdgeToEdgeSeconds` as a floor. The Accelerator no longer adds a percentage:
`nodes.speedBoost.marchEdgeSecondsCut` takes that many seconds (times tier) off the squads' edge-to-edge time, so 150 s
becomes 120 s with one and 90 s with two. Scouts and turret missiles stay at a fixed multiple (`scout.speedFactor`,
`missileSpeedFactor`, both 5) of the unboosted base speed. Tune keys removed: `march.crossMapSeconds`,
`nodes.speedBoost.speedPct`. firestorm-net is unchanged apart from the dependency. Only firestorm-arena uses either.

**Applies to:** firestorm-arena only.

## 2026-10-04 — firestorm shared packages: arena-sim 0.12.0, firestorm-net 0.12.0

**What changed:** arena-sim's Tech Centre now makes the teleport cooldown run faster instead of cutting it by a
flat amount: each one held (times tier) drains an extra second per second, so one doubles the speed and two triple
it, and a running cooldown is retimed when a Tech Centre changes hands. The tune keys
`hq.teleportCooldownMinSeconds` and `nodes.teleportCooldown.teleportCooldownReductionSeconds` are gone, replaced by
`nodes.teleportCooldown.teleportCooldownRate`. HQ refills now move whole troops only (replay stability).
firestorm-net's bots no longer scout a node or HQ that has a live report or a scout already flying to it.
Only firestorm-arena uses either.

**Applies to:** firestorm-arena only.

## 2026-10-04 — firestorm shared packages: arena-sim 0.11.0, firestorm-net 0.11.0

**What changed:** arena-sim reworks score pools and caches: a node's pool opens 60 s after any capture and counts
toward its team; only when the node swaps sides is the pool emptied and dropped as 4 to 8 equal, permanent caches
that any scout can bank for its own team. Commanders earn +1 personal score per team point banked from a cache.
firestorm-net moves to protocol 8 and bots no longer swarm a cache a closer friendly scout is already flying to.
Only firestorm-arena uses either.

**Applies to:** firestorm-arena only.

## 2026-10-04 — firestorm shared packages: arena-sim 0.10.0, firestorm-net 0.10.0

**What changed:** arena-sim adds the neutral Portal Nexus node (never capturable, any HQ may teleport onto it,
it lights the 8 cells around it for both teams) and a square 41 x 41 map; firestorm-net moves to protocol 7 and
its bots creep the front forward (leap and bound), raid a distant node one decision in ten, and only scout
enemy-held nodes. Only firestorm-arena uses either.

**Applies to:** firestorm-arena only.

## 2026-10-04 — firestorm shared packages: arena-sim 0.9.0, firestorm-net 0.9.0

**What changed:** arena-sim's map generator places each ring's nodes with best-candidate spacing so they end
up evenly spread; the real map now has 19 nodes (four hospitals). firestorm-net's bots assault enemy HQs when
confident, rush to garrison an ally HQ under attack, and move their HQ onto a node as soon as they hold one.
Only firestorm-arena uses either.

**Applies to:** firestorm-arena only.

## 2026-10-04 — firestorm shared packages: arena-sim 0.8.0, firestorm-net 0.8.0

**What changed:** arena-sim team views list enemy scouts inside vision (`enemyScouts`); firestorm-net moves to
protocol 6, and its bots have individual cache-stealing appetites and cap scouts per cache. Only firestorm-arena
uses either.

**Applies to:** firestorm-arena only.

## 2026-10-04 — firestorm shared packages: arena-sim 0.7.0, firestorm-net 0.7.0

**What changed:** arena-sim's map generator gains per-ring spawn bands and scores radar towers on tier 3 and 4
coverage; score caches now have a fixed value from the moment they spawn. firestorm-net's bots steal the closest
visible enemy cache. Only firestorm-arena uses either.

**Applies to:** firestorm-arena only.

## 2026-10-04 — firestorm shared packages: arena-sim 0.6.0, firestorm-net 0.6.0

**What changed:** arena-sim adds score pools and score caches (a node's tier points go into a
temporary pool after it has been held for a minute; scouts collect caches to bank or steal it).
firestorm-net moves to protocol 5. Only firestorm-arena uses either.

**Applies to:** firestorm-arena only.

## 2026-10-04 — firestorm shared packages: arena-sim 0.5.0, firestorm-net 0.5.0

**What changed:** arena-sim adds escalation (tier 3 and tier 4 nodes are locked until the
clock reaches a set fraction), public commander names on enemy marches and HQs, and a
more compact map. firestorm-net moves to protocol 4 and adds a daily-limit estimate (`quota`). Only firestorm-arena uses either.

**Applies to:** firestorm-arena only.

## 2026-10-03 — firestorm shared packages: arena-sim 0.4.0, firestorm-net 0.3.0

**What changed:** arena-sim adds HQ garrisons, individual (vanity) scoring with a
leaderboard in the match result, 2 to 4 squads per commander with overlapping rank
bands, global node ownership and public enemy marches. firestorm-net moves to
protocol 3. Only firestorm-arena uses either package.

**Why:** firestorm-arena playtest revisions.

**Applies to:** firestorm-arena only. Prototypes that never opted into these
packages are unaffected.

## 2026-09-29 — suits itch.io slot becomes the "Current WIP" slot

**What changed:** `deploy-suits-itch.yml` is replaced by
`deploy-wip-itch.yml`, which deploys the prototype named in
`.github/wip-prototype` (currently `punchies`) to the same itch.io project
(`zitian-ff/suits:html5`). The hub link that pointed at suits' Pages build
is now "Current WIP (Punchies)" and points to that itch.io page.

**Why:** The user needs to playtest new prototypes on a phone without
setting up a new itch.io project each time.

**Applies to:** suits no longer auto-deploys to itch.io (it still builds
into the Pages hub output). The WIP target's `version.json` counter bumps
on each WIP deploy.

## 2026-09-02 — Fix root package-lock.json drift breaking every deploy workflow

**What changed:** `package-lock.json` is regenerated to match the
`mp-core` 0.2.0 bump from the previous entry below, and `prototypes/
mp-net/package.json` and `prototypes/mp-console/package.json`'s own
`"mp-core"` dependency pins are bumped from `^0.1.0` to `^0.2.0` to
match. See STACK.md's mp-core section for the full two-part explanation
of why the stale pins had to move even though neither prototype's
source changed.

**Why:** When `packages/mp-core/package.json` moved to `0.2.0` (previous
entry), `package-lock.json` was never regenerated to match. Every
deploy workflow in this repo runs `npm ci` at the repo root as its
first substantive step, and `npm ci` fails loudly (`EUSAGE`, lockfile
out of sync) rather than reconciling - so every deploy, for every
prototype, on every push to `main`, has been failing at that step since
the bump, regardless of which prototype's files the triggering push
actually touched. Confirmed via GitHub Actions job logs: the "Install
dependencies" step failed identically on the Pages/hub deploy (11
consecutive failing runs) and on digger's itch.io deploy (the one run
that happened to trigger since the bump); suits-mp, mp-net, and
mp-console's own itch.io deploys hadn't been triggered again since the
bump but would have failed identically, since the failure is in a
step that runs before any prototype-specific work begins.

A second, more severe hazard was caught while fixing this: naively
running `npm install` (rather than fixing the pins first) silently
substituted an unrelated, deprecated package from the public npm
registry into mp-net/mp-console's own `node_modules` in place of the
real local `packages/mp-core` workspace folder, with no error at all.
This was caught before being committed. See STACK.md's mp-core section,
point 2, for the full mechanism - it's the more important takeaway of
the two for scoping any future shared-package version bump.

**Applies to:** Repo-wide CI/deploy infrastructure. No prototype's
source or runtime behavior changed - confirmed via byte-identical
mp-net/mp-console build output before and after, plus a clean
`npm run typecheck` / `npm run build` / `npm ci`.

**Action needed per prototype:** None. This is a lockfile/pin
correction only. Worth internalizing the pattern in STACK.md before
bumping any shared package's version again: bump *every* consumer's
declared pin for that package at the same time, even one that needs no
source changes, and regenerate the lockfile as part of the same
change - never as an afterthought.

## 2026-08-27 — mp-base renamed to mp-console, wired onto packages/mp-core

**What changed:** `prototypes/mp-base/` is now `prototypes/mp-console/`
(folder, Trystero `appId`, localStorage client-ID key, on-screen
labels, CI workflow, and every doc reference updated to match). It is
also now wired onto `packages/mp-core` - client-ID generation,
identity/hostUI/input/analogInput channel creation, and the
identity-matched roster match-or-create logic come from the shared
package instead of a locally duplicated copy, the same as mp-net and
suits-mp already were. See STACK.md's "Multiplayer networking"
section and `packages/mp-core/README.md`.

**Why:** The `mp-base` name undersold its actual role (a local/couch
QR-join multiplayer foundation, not a generic "base" every prototype
starts from) now that it sits alongside mp-net as a documented,
named networking choice in STACK.md. Wiring it onto `packages/
mp-core` removes the last of the three prototypes' duplicated
identity/reconnect implementations.

**Applies to:** `prototypes/mp-console/` (the renamed `mp-base`)
directly. mp-net, suits-mp, and digger are unaffected.

**Action needed per prototype:** None automatically for existing
prototypes. Any code, doc, or link elsewhere in the repo (or outside
it, e.g. bookmarks) still referencing `mp-base` by name or path is
stale and should be updated to `mp-console` on next touch. Two
different rename dependencies here, worth keeping distinct: the
GitHub Pages hub link (`index.html`) points at a relative in-repo
path served by the Pages build itself, so it resolves correctly as
soon as this change deploys, no further action needed. The itch.io
Butler deploy target, by contrast, was updated to push to
`zitian-ff.itch.io/mp-console`, but that project doesn't exist under
the new slug yet - the user is renaming it manually on itch.io's
side, on their own timeline, and the CI deploy will not succeed until
that happens.

## 2026-08-27 — React + Tailwind added for UI chrome

**What changed:** React and Tailwind CSS are now locked stack
additions (see CLAUDE.md Stack section), used exclusively for UI
chrome layered over the Phaser canvas. See CLAUDE.md's "UI
implementation split" section for the full rule.

**Why:** Claude Design produces React/Tailwind mockups natively.
Wiring those directly (no HTML/CSS translation step) avoids a
lossy port and enables a future shared UI component library
across prototypes.

**Applies to:** All prototypes, retroactively.

**Action needed per prototype:** None automatically. Adopt
React/Tailwind only when that prototype's next UI work begins
(Stage 3+ for suits-mp is the first case). Existing UI code is
not being force-migrated on its own.

## 2026-09-02 — Player display names, suits-mp Lobby consolidation, redistribution log

**What changed:**
- packages/mp-core bumped 0.1.0 → 0.2.0, additive only: new
  `createIdentityActionWithName` export and an optional `displayName`
  on `BaseRosterEntry`, alongside the original unchanged
  `createIdentityAction`. See STACK.md's mp-core section for the
  version-isolation limitation this surfaced and the pattern adopted
  going forward.
- suits-mp adopted 0.2.0. Two previously-parallel Lobby
  implementations - a canvas/Text-based one (`HostLobbyScene`/
  `PlayerLobbyScene`, the one actually wired to real networking) and an
  unwired DOM `LobbyFlow.tsx` (the Claude Design port, placeholder data
  only) - are now consolidated into one: `LobbyFlow.tsx` renders as a
  DOM overlay driven by the scenes' real networking, with a name-entry
  field feeding the new mp-core capability.
- Every in-game `P1`-`P4` display site in suits-mp (trick display,
  turn/waiting text, delegate-selection targets, god-reveal, DOM HUD
  tags) now shows a real player name, or an absolute-numbered
  `Player N` fallback if blank. This introduced a formal split between
  two numbering systems that must not be conflated: `P1`-`P4`
  (`ui/seating.ts`'s `SeatLabel`) is viewer-relative screen position,
  an internal geometry concept only, no longer shown as player-facing
  text anywhere; the `Player N` fallback is absolute seat order
  (`NetPlayerId` `p0`..`p3` → 1..4), consistent across every viewer and
  matching the Lobby's own numbering.
- The redistribution log (suits-mp) is fully implemented: per-trick
  entries from the viewing player's perspective, `'received'` vs.
  `'distributed'`, grouped by recipient, self-gifts excluded,
  distinguishing a direct Single-win redistribution from a Double-win
  delegate redistribution via `wonByDouble` (now persisted per-record
  in the rules engine, not just on the most recent trick). Host-side
  masking holds throughout - no perspective is inferred client-side.
- Repo-wide: auto-merge's actual mechanics were clarified in CLAUDE.md.
  The repo-level "Allow auto-merge" setting only permits auto-merge; it
  does not enable it per PR. Claude Code now runs the enable command
  explicitly on every PR it opens. There is still no
  `pull_request`-triggered CI check, so this currently means a PR
  merges immediately on open with no automated gate - an accepted,
  explicit tradeoff, not an oversight, pending the real CI-gate work.

**Why:** Player identity was previously invisible in suits-mp - every
screen showed viewer-relative `P1`-`P4` labels with no connection to a
real person, which made teammate deduction and general readability
harder than intended by the GDD's design.

**Applies to:** suits-mp directly. mp-console and mp-net gained the
mp-core capability but have not adopted it and are otherwise untouched.

**Action needed per prototype:** None automatically for mp-console/
mp-net - opt into mp-core 0.2.0 and wire display names only if/when a
future task calls for it.
