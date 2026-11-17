# Warzone damage kit — local review only

Owner request, 17 November 2026: damaged/destroyed towers, shield strength, Nexus health and a distinct planet look, in the lab before any live release.

The four new raster parts were edited with built-in imagegen from a 2×2 sheet of the approved buildings-v1 tower head/foundation and Nexus reactor/crown. They preserve the overhead painted projection, blue/cream/amber material IDs, navy outlines and existing rig frames. The tower wreck is a low collapsed silhouette; no smoke, shadows or muzzle flashes are baked into the image. Runtime remapping supplies independent clan colours. Never copy pilot palette values into buildings.

Masters and generated sheet: `outputs/steroids-alpha/warzone-art-review/`. `parts/` holds full 1254-square registered PNGs; `steroids-alpha_warzone-v1_assets.zip` has the four manifest delivery paths. The ZIP is cached under its content hash in the checkout's `.cache/`. PNG/ZIP files stay outside Git. The preview pack has no public URL and has not been uploaded. A fresh machine needs the local ZIP until approval permits verified R2 delivery.

Newly authored variants were registered once to their corresponding original trim rectangles; no approved source PNG was changed. Runtime resampling retains the full registered canvas (256 for tower, 384 for Nexus). `prepare-assets.mjs` verifies ZIP and individual source hashes before staging.

Runtime health: healthy at 65%+, damaged at 30–65%, critical below 30%, destroyed at zero. Damage skins, bounded rectangular embers, a small foundation health strip and reduced power provide the state cues. Repair restores intact skins and tower columns/barrels. Wreck contact/cast shadows share the original foundation; no destroyed-tower fire visuals are emitted. Shield strength controls the coverage of 24 world-projected panels; broken suppresses all panels. No simulation values, collision geometry or network authority changed.

Warzone terrain uses the existing tile/channel sources with a new periodic charcoal basalt/ochre ash/ember material, shared between flight and the spinning map globe. Canvas retains the distinct dark/ochre palette. Planet-fixed ground and sun-driven shadows remain as released in PR524.

Review: run Vite on port4187 and open `/game-prototypes/prototypes/steroids-alpha-lab/?review=warzone`. Mixed towers show intact, damaged, critical and wreck together. Health buttons cycle100/55/20/0%; tower additionally offers MIXED. Clan and orbit controls inspect grounding and lighting. Standalone tower/Nexus tabs allow larger inspection. The review reads live settings once and never joins a room or publishes.

Checks: typecheck, build, hash-verified asset staging, rig/building regressions, and headless Brave desktop/mobile lab state/lifecycle checks. No screenshots or recording; owner performs visual review. Evidence: `outputs/steroids-alpha/warzone-art-review/lab-check.json`. Live deployment is explicitly gated on owner approval.

## Generation prompt

Edit the exact 2 by 2 game sprite reference sheet into damage variants. Transparent square with four equal cells, no labels. Maintain strict top-down overhead projection showing small painted bevel edges, bold dark navy outlines, simple vibrant cel-painted surfaces, identical registration and size of each original silhouette. Top left: battle-damaged twin-cannon tower head only, two empty round gun sockets, chipped cobalt blue armour and ivory rim, sparse soot impacts and exposed steel cracks; preserve outline. Top right: destroyed tower wreck on the circular foundation footprint, low collapsed blue/ivory metal slabs, two short snapped barrel stubs, charred central socket; no intact head or tall structure. Bottom left: damaged Nexus reactor, same hexagonal outline and cyan core, scar plates and dark branching glass fractures with reduced light. Bottom right: damaged Nexus crown, same four-point outline and cyan centre, chipped ivory blades, scorched blue panels and cracked glass. Match original painted assets with sparse readable damage. No photorealistic grit, perspective/isometric, smoke, background, external shadows or orange fire.
