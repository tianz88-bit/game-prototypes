# STACK.md

Human-readable overview of the shared infrastructure available to
prototypes in this repo. For house rules and enforcement, see
CLAUDE.md. This file describes what exists and what it's for, not
how to follow the rules around it.

## Core engine stack

Every prototype is built on Phaser 3 + TypeScript + Vite. This is
fixed and not optional, with one owner-approved exception: chimera-reels
is a 3D prototype built on Three.js instead of Phaser. Shared packages
that depend on Phaser (dig-kit, for example) are not usable there. See CLAUDE.md's Stack section for the
full locked list (atlas packing, debug UI, verification, hosting,
art storage).

## UI chrome

Phaser canvas is the default for game UI. The React + Tailwind DOM-overlay
approach is retired for new prototype work unless the user explicitly
chooses it again; existing code is not force-migrated. The repository may
still contain legacy tooling, but new prototypes should not depend on it.
See CLAUDE.md's "UI implementation" section.

**Firestorm Arena:** the entire interface is drawn in Phaser canvas. Do
not add React, Tailwind, @vitejs/plugin-react, or a DOM UI overlay to
Firestorm, including through workflows, scaffolds, lint rules, review
comments, or generated files. Phone play is not required. Its browser
client deploys to itch.io via Butler; its multiplayer server deploys
separately to Cloudflare Workers.

## Multiplayer networking

Two networking foundations exist, both built on Trystero
(WebRTC via Nostr signaling relays, pinned to a known-reliable
relay set, see CLAUDE.md's Networking section):

- mp-console: local/couch multiplayer. One stationary host device
  (landscape), other players join by scanning a QR code shown on
  the host's screen. No internet NAT traversal concerns, all
  players are physically nearby.
- mp-net: remote/internet multiplayer. Any device can host
  (portrait for everyone, including host), players join via a
  typed room code or invite link. Adds TURN relay fallback (a
  dedicated Cloudflare Worker) for the ~15-20% of connections
  where STUN-based peer-to-peer connection fails on its own
  (mainly symmetric NAT / mobile carrier CGNAT).

Both build on the same shared package, packages/mp-core: client-ID
generation, identity/hostUI channel creation, generic input/
analogInput/inputDelta channel creators, and an identity-matched
reconnect handshake. Not every consumer uses every piece - e.g.
mp-console has no inputDelta channel, and its reconnect handling
differs from mp-net's in shape (see packages/mp-core/README.md and
each prototype's own BUILD_STATUS.md for the specifics).

Status: mp-net, suits-mp, and mp-console are all wired onto
packages/mp-core now - no prototype carries its own duplicated copy
of this logic anymore.

mp-core is now at 0.2.0, which adds an opt-in player display-name
capability: `createIdentityActionWithName` (a second identity-channel
creator, alongside the original `createIdentityAction`, which is
unchanged) and an optional `displayName` field on `BaseRosterEntry`.
suits-mp has adopted 0.2.0 and uses this for real player names
end-to-end (Lobby entry, in-game labels, redistribution log). mp-net
and mp-console don't use the new capability and needed no source
changes, but **their own `package.json` pins had to move to `^0.2.0`
too** - see the known limitation immediately below for why that turned
out not to be optional.

**Known limitations, worth knowing before scoping any future mp-core
change:** this repo's shared packages are not actually version-isolated
per consumer - it's a single local workspace package, not a real
registry. A consumer's declared semver pin (e.g. `^0.1.0`) is a
statement of intent, not an enforced boundary, in two distinct ways:

1. **Typechecking isn't isolated.** A genuinely *breaking* change to
   mp-core fails typecheck repo-wide regardless of what any other
   consumer's package.json claims to pin. Discovered when first adding
   the display-name field - the first draft made `createIdentityAction`'s
   existing payload change type and `displayName` a required field,
   which broke mp-net/mp-console's build immediately even though only
   suits-mp's pin was meant to move.
2. **A stale pin can silently swap in an unrelated package from the real
   npm registry**, which is worse than a build failure because it fails
   silently. `npm`'s workspace linking only prefers the local
   `packages/mp-core` folder for a consumer's `mp-core` dependency when
   the local package's actual version *satisfies that consumer's
   declared semver range*. Once mp-core's own version moved to `0.2.0`,
   mp-net/mp-console's still-`^0.1.0` pins no longer matched it - so
   `npm install` fell back to fetching an unrelated, deprecated package
   that happens to squat the name "mp-core" on the public npm registry
   into each of their `node_modules`, instead of linking the local
   workspace folder. This was caught only because it also broke `npm
   ci`'s stricter lockfile-sync check (surfacing as itch.io/Butler
   deploy-workflow failures) - had the lockfile been regenerated with a
   looser `npm install` without noticing the diff, mp-net and mp-console
   would have silently started running on fake, unrelated code with no
   error at all.

The fix, and the pattern to repeat for any future mp-core version bump:
(a) always ship additively - new exports/optional fields alongside old
ones unchanged, never a changed signature or a newly-required field on
an existing type - and (b) bump *every* consumer's declared `mp-core`
pin to match mp-core's new version at the same time you bump mp-core
itself, even a consumer that doesn't use the new capability and needs
no source changes - otherwise its dependency resolution silently breaks
the moment mp-core's version moves past that consumer's declared range,
whether or not anyone notices. Real per-consumer version isolation
(so a stale pin fails loudly instead of resolving to the wrong thing)
remains unbuilt infrastructure work.

## Dig prototypes kit: dig-kit

`packages/dig-kit` (0.1.0) holds what the dig prototypes share: the pastel pillow-block art (baked
rounded blocks drawn as sprites, a saturated layer palette), tapered volumetric cracks, placeholder sounds
synthesised with WebAudio, a canvas button, a small intent bus with keyboard binding, the `?debug=1` tune
panel and a seeded RNG. Phaser 3 is a peer dependency. dice-dig uses it and dig-match will. Consumers pin an
exact version (`"dig-kit": "0.1.0"`); ship changes additively and bump every consumer's pin together, as with
mp-core. See `packages/dig-kit/README.md`.

## Game rules engine: arena-sim

`packages/arena-sim` (0.14.0) is the pure TypeScript rules engine for
firestorm-arena: squads, combat, nodes, HQs, teleport, scouts, fog-of-war
views and an event queue, with no Phaser, DOM or Cloudflare code in it. It is
built to run inside a Cloudflare Durable Object (authoritative server), in
Node for bot tests, and in the client. It is the first shared package that is
not networking, and the first built on a server-authoritative model instead of
Trystero. Only firestorm-arena uses it so far. See its README for the API and
`prototypes/firestorm-arena/BRIEF.md` for the rules.

## Match server: firestorm-net

`packages/firestorm-net` (0.14.0) is the server side of firestorm-arena that is
not Cloudflare glue: wire protocol with validation, the match room (lobby,
countdown, running match, per-team fog-filtered patches), replay-log persistence
and the bots. It is the repo's first server-authoritative networking, an
alternative to the Trystero peer-to-peer foundations above: players talk to one
Durable Object over WebSockets, and nothing hidden is ever sent to a client. It
depends on `arena-sim`, runs in a Durable Object and in plain Node, and only
firestorm-arena uses it so far. See its README. The Phaser client that talks to it
lives in `prototypes/firestorm-arena/src` (all UI drawn in the canvas, no DOM overlay).

## Art asset pipeline: automatic downscale/recompress

`scripts/pack-assets.js` (the second half of every prototype's
`fetch:assets` / `pack:assets` flow, see CLAUDE.md's Art pipeline
section) can automatically downscale and recompress `loose/` images as
part of packing them into `public/prototypes/<name>/assets/` - opt-in
per prototype via `IMAGE_OPTIMIZATION_RULES` at the top of that script,
keyed by prototype name. A prototype with no entry there gets exact
byte-for-byte passthrough, exactly as before this existed - adding
another prototype's rules can't affect one that hasn't opted in, same
principle as every other shared capability in this file.

Each rule can:

- **Downscale** (`maxDimension`): fit the image inside an NxN box,
  aspect ratio always preserved, never enlarging an already-smaller
  image. Size this to the asset's real largest on-screen footprint -
  check every actual call site (canvas *and* DOM, if both consume the
  same file), not just the most obvious one, and account for the
  runtime's device-pixel-ratio ceiling (see CLAUDE.md's DPR section) -
  never to the authoring canvas's own resolution. Master art from an
  image-generation pipeline is routinely produced at 2-4x the resolution
  any mobile-portrait canvas will ever display it at.
- **Recompress** (`format`/`quality`): re-encode into a smaller-footprint
  format. Currently only WebP (lossy, high quality) is implemented -
  it typically cuts 30-60% off file size versus PNG at equivalent visual
  quality for painterly/photographic art, and still supports an alpha
  channel. Needs no Phaser-side loader changes: Phaser's image loader and
  the browser's own `<img>`/CSS `url()` both decode WebP exactly like
  PNG/JPEG, and this repo's manifest-driven loose-asset loader
  (`preloadCardArt`'s `queueLooseImages()` pattern, see suits-mp's
  `ui/cardArt.ts`) already derives its texture keys by stripping
  whatever extension a file has - only code that constructs an asset's
  URL *directly* (bypassing the manifest, as some DOM-layer `<img>` URLs
  do) needs its hardcoded extension updated to match.
- **Do nothing on purpose**: a rule with neither field is a valid,
  intentional no-op - useful to record that an asset's resolution was
  checked and found already appropriate (or, per suits-mp's tabletop
  background, that its real on-screen footprint via some placement
  formula can legitimately exceed its native resolution, so downscaling
  it further would visibly hurt quality) rather than just never
  considered.

Manifest hashing (`scripts/pack-assets.js`'s content-hash cache-key
mechanism, see CLAUDE.md's Art pipeline section) is computed on the
*final, processed* output bytes, so a resize/format change is picked up
by the existing cache-busting exactly like any other art change - no
changes needed there.

**suits-mp is the first (and so far only) adopter**: every loose card
asset (backdrops, frames, symbols, faces, nameplates) is capped at 512px
on its long edge and converted to WebP; the tabletop background is
recompressed to WebP only, at its native resolution, for the reason
noted above. Real measured result on this asset set: 27.2MB -> 1.1MB
(96% smaller) - see `prototypes/suits-mp/BUILD_STATUS.md` for the full
before/after and how the 512px figure was derived.

## What "available to a prototype" means in practice

A new prototype starts with just the core engine stack above and
adds shared packages only as needed:

- Need couch/local multiplayer? Depend on mp-console (or
  packages/mp-core directly).
- Need internet multiplayer? Depend on mp-net (or packages/mp-core
  directly).
- Need UI? Build it in the Phaser canvas by default. Do not add the
  retired React + Tailwind DOM-overlay approach without an explicit new
  user decision.
- Need none of the above? Build with just Phaser/TS/Vite, same as
  digger does today.

Adding a shared package to a prototype must never be able to break
a prototype that hasn't opted in. See CLAUDE.md's Purpose section
for the versioning/isolation rule this depends on.
