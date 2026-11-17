## Current milestone

Warzone art is ready for LOCAL owner review on codex/steroids-warzone-art-review. Nothing pushed, uploaded, merged or deployed. Existing live release remains PR524 / 161126r0084.

## What was implemented

Four painted damage parts from the approved overhead building kit: tower head, low destroyed tower wreck, Nexus reactor and crown. Existing clan-colour rigs now read optional normalized health, preserve foundations/supports/root shadows and restore intact parts after repair. Zero-health towers hide raised parts and firing flashes. Small durability strips and bounded square embers show damage. Shield strength changes projected panel coverage; broken removes the field. Flight observes current SiegeView without changing rules or values and replaces old ground crosses/ring. Nexus label reads existing health during siege.

Warzone has distinct periodic charcoal basalt, ochre ash channels, sparse cooling fissures and warm atmospheric rim in the same production terrain shader, Canvas fallback and Stellar Map globe. Lab selector adds Warzone siege-art preview: mixed tower states, 100/55/20/0% controls, clan colours, camera travel/rotation-linked light and rooted shadows. Standalone tower/Nexus previews also offer health controls.

## Key technical decisions

Optional BuildingRigPose.health / ClanBaseArtOptions.siege are visual-only normalized state; no network, tune, collision or simulation changes. New damage textures use existing registration and runtime clan remapping. One bounded Graphics pass supplies status/embers; no permanent emitter or publisher. PlanetGround fourth argument selects warzone material. Review remains isolated from multiplayer and preserves the Falcon draft on return.

Four PNG masters/ZIP remain local outside Git; manifest/source hashes are in art/warzone-v1. Local ZIP cache hash1b3de05ac10cdd5c882eda299dbf3c89ea0f99d641114c6ec36279f808ca10c5. Public R2 URL intentionally absent pending owner approval. Asset staging verifies all four sources. Typecheck/build and 396-pose/14400-FFD-point/18-building-case regression suite pass, with new durability/coverage tests. Headless Brave desktop/mobile DPR2 lab state/collapse/repair/clan/return checks pass with zero browser errors/game sockets. Evidence: outputs/steroids-alpha/warzone-art-review/lab-check.json. No screenshots or recording.

## Open questions

Owner visual review of damage density, shield coverage and Warzone palette before live release.

## Known issues

Preview is local to this PC; not on the public lab. New art needs approved R2 upload/readback before any deploy from a fresh machine. Headless checks verify state/geometry/lifecycle, not visual appearance; no physical-phone/Safari check. Existing unrelated bundle warnings remain.

## Next proposed step

Owner checks http://127.0.0.1:4187/game-prototypes/prototypes/steroids-alpha-lab/?review=warzone and standalone Nexus/Tower tabs. Keep Vite preview running for that review. After approval only: verified R2 upload, manifest URL/status update, release PR/checks and public verification. No resident private publisher or capture session runs.
