# CLAUDE.md

House rules for this repository. Read fully before starting any task.

## Purpose

This repo holds small browser-based game prototypes. Individual
prototypes are still fast to stand up and free to abandon, but
this repo is also building durable, reusable infrastructure over
time (networking, UI patterns, and similar systems that prove
useful across more than one prototype).

Actively look for opportunities to extract reusable packages
rather than waiting for a rule-of-three. If something built for
one prototype looks likely to be useful in another, propose
extracting it into a shared package instead of leaving it
duplicated. See STACK.md for what's already available to reuse.

A prototype must always be able to start with zero shared
packages and add any shared package later as a normal opt-in
dependency, without restructuring. A prototype that has not
opted into a given shared package must never break because that
package changed elsewhere in the repo. Shared packages are
versioned; a prototype pins the version it depends on and only
moves to a newer version deliberately, never automatically.

Before starting any task, check CHANGELOG.md at the repo root
for entries newer than the prototype's own last-touched date.
If a relevant base-level change exists that the current task
should account for, apply it as part of the task and note that
you did so.

## Roles

- The user writes design briefs and produces all artwork.
- Claude Code writes all code, config, and CI.
- Each prototype is specified by its own `BRIEF.md`. The brief is the
  source of truth. If the brief does not ask for it, do not build it.

## Stack

For Punchies artwork, asset preparation or compression, read
`prototypes/punchies/art/PRODUCTION_STANDARD.md` before making changes.
It defines the standard and compact delivery contracts and their required checks.

Fixed. Do not add, swap, or upgrade any of these without asking first.

- Engine: Phaser 3
- Language: TypeScript (strict mode)
- Build: Vite
- Atlas packing: free-tex-packer-cli
- Debug UI: Tweakpane
- Visual verification: Playwright
- Hosting: chosen per prototype, not uniform. The hub/index page still
  deploys to GitHub Pages. Game prototypes usually deploy their client to
  itch.io via Butler (GitHub Pages has a known deploy-pages@v4
  polling/timeout reliability issue), but this is a starting point, not a
  rule: Cloudflare (Workers or Pages) or GitHub Pages are acceptable when a
  prototype benefits, after the owner picks it for that prototype.
  Multiplayer servers deploy to Cloudflare Workers.
  Steroids-Alpha follows the Firestorm split: client on its own itch.io
  project via Butler, server on Cloudflare Workers.
  Firestorm Arena uses two separate deployment targets: its browser
  client deploys to the itch.io project via Butler, while its multiplayer
  server deploys to Cloudflare Workers. Neither replaces the other.
  The itch.io project formerly used by mp-console now hosts
  punchies-playable. Its dedicated workflow builds that prototype only.
  The itch.io project formerly used for suits is now the "Current WIP"
  slot: `.github/workflows/deploy-wip-itch.yml` deploys whichever
  prototype is named in `.github/wip-prototype`, and the hub links to it
  as "Current WIP (<Name>)". Retarget it only when the user asks, updating
  both that file and the hub label.
- Art storage: Cloudflare R2

The React + Tailwind DOM-overlay approach is retired for new prototype
work; do not add it to a stack, scaffold, workflow, lint rule, review, or
generated file without a new explicit user decision. Existing code is not
force-migrated. Phaser canvas is the default for game UI. Firestorm Arena
is strictly canvas-only: no React, Tailwind, @vitejs/plugin-react, or DOM
UI overlay. Phaser owns its entire play surface.

Do not add dependencies to solve problems the stack already solves.
If a new dependency seems necessary, ask before installing it.

## Repository layout

prototypes/<name>/     One self-contained prototype
  BRIEF.md             Spec for this prototype
  src/                 Game source
  tune.json            Tuned constants (see Tuning)
scripts/               Build, pack, fetch, screenshot
.github/workflows/     CI

Shared, reusable code lives in packages/<name>/, imported by any
prototype that opts in. Prototype-specific code stays local to
that prototype's own folder and is not shared by default. See
STACK.md for the current list of shared packages and what each
one provides.

## Art pipeline

Artwork lives in Cloudflare R2, never in this repository.

- Bucket public URL: https://pub-415572b047994ab8807f76b8462eda45.r2.dev
- Object per prototype: <proto-name>_assets.zip (underscore, not
  hyphen — confirmed against scripts/fetch-assets.js, which hardcodes
  this convention with an override mechanism for named exceptions).
- Fetched over plain HTTPS. No credentials required. Never add R2 API
  tokens or secrets to this repo.
- Never commit PNG, zip, or atlas files. Enforce via .gitignore.

Zip structure:

packed/<animation-key>/0001.png, 0002.png, ...
loose/<filename>.png

Rules:

- Folder names under packed/ are the animation keys. Derive Phaser
  animation configs from folder names and frame counts automatically.
  Never hand-maintain an animation list.
- Files under loose/ are loaded individually and must not be packed.
  Backgrounds, tiling textures, and tilemap tilesets belong here.
- Source frames are exported at full canvas size with fixed
  registration. Do not crop, offset, or re-align them.
- Trimming is done by the packer only, which records offsets in the
  atlas JSON. Never trim source frames.
- Keep individual atlases at or below 2048x2048. Spill to additional
  sheets rather than exceeding this.
- Art objects in R2 are overwritten in place and are not versioned.
  The CI asset cache must key on object ETag or content hash, never on
  filename. Keying on filename will silently serve stale art.
- Every build writes a manifest of art files with hashes and fetch
  timestamp into the build output.

## Input

Game logic must never read a key, pointer, or touch event directly.

All input goes through an intent layer: move, jump, primary,
secondary, pause. Devices bind to intents. Logic reads intents.

Every prototype must be playable on a phone, even when the brief
targets desktop. Remote playtesting happens on mobile. Crude touch
bindings are acceptable; absent ones are not.

Exception: Firestorm Arena does not require phone play.

Never block the player (owner rule, 14 November 2026). No screen,
overlay or state may stop play until the player changes something about
their device or browser: no "rotate your phone" prompts, no "use a
bigger screen" or "use another browser" walls. Adapt instead (for
example, draw a landscape game turned a quarter on an upright phone, or
lay out for the size given). Hints are fine only if play continues
underneath and they never swallow input. This applies to every prototype.

## Networking

Prototypes using Trystero's Nostr strategy for WebRTC signaling
(mp-console, mp-net) must pin `relayConfig.urls` to a small set of
well-established, widely-used public relays (e.g. `relay.damus.io`,
`nos.lol`, `relay.mostr.pub`, `purplerelay.com`, `nostr.data.haus`)
rather than relying on Trystero's default relay selection. That
default derives relays deterministically from a hash of `appId`,
which can land on small hobbyist relays with no uptime guarantee -
if none of the derived relays are reachable, peers can never
discover each other, surfacing as a "no host found" style error
regardless of network conditions on either end. See mp-net's fix in
PR #14.

## Persistence

Prototypes that need to remember state across page loads (idle/save
mechanics, progress, settings) use `localStorage` directly. No backend,
no accounts, no cross-device sync — single-browser only, matching the
scope of a prototype.

- One versioned key per prototype (e.g. `<proto-name>:save:v1`), holding
  a single JSON blob rather than many scattered keys. Bump the version
  suffix on any breaking save-shape change rather than trying to
  migrate old saves.
- Save on every state-changing action, not just on unload/beforeunload.
  Mobile tabs can be discarded by the OS without a clean unload event,
  so unload-only saving silently loses progress.
- If a prototype tracks something that accrues over real time while the
  tab is closed (energy, resources, timers), store a timestamp
  alongside the value and compute elapsed progress from
  `Date.now() - savedTimestamp` on load, rather than relying on any
  timer that only runs while the tab is open.

## Placeholder-first

Build all mechanics with coloured rectangles first. Do not wait on
artwork, and do not treat missing art as a blocker. Art is swapped in
only after the loop is confirmed working.

## UI implementation

Gameplay, rendering, and UI chrome are implemented in the Phaser canvas
by default. Design mockups can guide the canvas implementation, but the
React + Tailwind DOM-overlay approach is retired for new work unless the
user explicitly chooses it again. Existing code is not force-migrated.

**Firestorm Arena:** all interface elements are drawn in the Phaser canvas.
Do not use React, Tailwind, @vitejs/plugin-react, or any DOM UI overlay in
this prototype, or reintroduce them through workflows, scaffolds, lint
rules, review comments, or generated files. Phone play is not required.
Hosting is split between its itch.io/Butler client and Cloudflare Worker
server.

## Tuning

All values affecting game feel (speeds, gravity, friction, durations,
easing, cooldowns) live in tune.json. Never hardcode them.

Every prototype ships a Tweakpane panel exposing these values,
available in production builds via ?debug=1, with a button that
copies current values to the clipboard as JSON.

Do not change tuned values unless explicitly asked. Those numbers were
set by a human playing the game and are not yours to optimise.

## Version stamping

Every prototype displays a version stamp in the top-left corner of the
canvas: tiny font, low-contrast, unobtrusive.

- Format: `DDMMYYrXXXX` (e.g. `070826r0001`). `XXXX` is a zero-padded
  4-digit running count.
- The counter is per-prototype: it lives inside that prototype's own
  folder (e.g. `prototypes/<name>/version.json`), not shared across the
  repo, and starts at `0000`.
- It increments automatically on every deploy of that prototype. No
  manual step, and never hand-edit the counter. The date portion is
  recomputed fresh on every deploy rather than stored.
- Implementation is up to the prototype: typically a small counter file
  read and incremented by the deploy workflow, injected into the boot
  scene as a version string.
- This rule applies to this prototype and all future ones going
  forward. Do not retrofit prototypes that predate this rule.

## Device pixel ratio / canvas sharpness

Every prototype's canvas rendering resolution must account for
`window.devicePixelRatio`, not just the CSS/logical display size.
Without this, text and thin graphics render soft/blurry on
high-density mobile screens (effectively all modern phones), even
when layout and scaling (e.g. `Phaser.Scale.FIT`) are otherwise
correct.

- The game's actual pixel buffer must be sized at logical size ×
  devicePixelRatio, then scaled back down via CSS/Scale Manager to
  the intended display size. Phaser 3 dropped the old global
  `resolution` game-config option, so there is no single knob for
  this: size the game config's `width`/`height` at
  logical-size × devicePixelRatio (capped, since many phones report
  3x+ and uncapped ratios add real fill-rate cost for sharpness
  that's barely visible), keep all gameplay/layout code working in
  the unchanged logical coordinate space, and compensate with camera
  zoom (`camera.setZoom(devicePixelRatio)` plus `camera.centerOn(...)`
  on the logical center, for every camera the scene uses) so existing
  pixel-coordinate math still lines up exactly.
- Phaser Text objects need `resolution` set individually in their
  style/config; the game-level pixel buffer size does not by itself
  sharpen text. Verify visually, per prototype and per Phaser version
  in use.
- This is a rendering-quality fix only: it must not change layout,
  logical coordinates, or game logic. Positioning math written in
  logical/CSS pixel space (e.g. `x = width / 2`) stays unaffected.
- This rule applies to this prototype and all future ones going
  forward, and unlike most rules in this file, it has been
  retroactively applied to prototypes that predate it (digger, suits,
  mp-console, mp-net) since the visual quality gap on high-DPI phones was
  considered a bug rather than a missed feature.

## Verification before reporting done

Run all of these. Do not report a task complete if any fail.

1. npm run typecheck passes with no errors
2. npm run build succeeds
3. Playwright screenshot script runs, and the screenshot is inspected
4. Browser console shows no errors on boot

Report what you actually verified. Do not describe untested behaviour
as working.

## Session status file

Every prototype folder (`prototypes/<name>/`) has its own
`BUILD_STATUS.md`, read by a separate design-discussion chat the user
works in, not by you. At the end of any session that touches a given
prototype, overwrite that prototype's `BUILD_STATUS.md` (create it if it
doesn't exist yet) using this exact structure:

    ## Current milestone
    ## What was implemented
    ## Key technical decisions
    ## Open questions
    ## Known issues
    ## Next proposed step

Always overwrite the whole file, never append - it reflects only the
latest state of that prototype, not a running log.

If you had to ask the user something mid-session because `BRIEF.md` was
ambiguous or silent on it, add a line under "Open questions" flagging
that `BRIEF.md` itself may need updating to cover it - don't just resolve
it silently and move on.

This is a universal rule: it applies to every prototype folder,
including ones with no `BUILD_STATUS.md` yet.

## Git

- One branch per task, named proto/<name>/<short-description>.
- Small, single-purpose PRs. Do not bundle unrelated changes.
- Never force-push to main.
- Commit messages: imperative mood, one line, no trailing period.
- Auto-merge is enabled on every PR in this repo. The repo-level
  "Allow auto-merge" setting only permits this - it does not enable
  it per PR. When opening a PR, immediately run `gh pr merge --auto
  --squash <PR>` (or the equivalent API call) as part of that same
  task, every time, for every prototype. This is the default going
  forward for all prototypes, not just mp-console and mp-net.
- There is currently no `pull_request`-triggered CI check in this
  repo (see the per-PR preview-deploy-to-itch workflow, still
  pending). Until that exists, enabling auto-merge means a PR merges
  immediately on open, with no automated gate and no manual review
  step. This is accepted as the current tradeoff, not an oversight -
  revisit once the real CI check lands.

## Scope discipline

The Out of Scope section of a brief is binding. Do not implement
items listed there, and do not add polish, systems, menus, settings,
or content the brief did not request.

If something in a brief is ambiguous, ask rather than guessing.
