# Resource pickups v1

Built-in imagegen, 19 November 2026. Two reference-guided transparent painted sprites: purple salvage case (double chevron) and cyan fuel cartridge (lightning). Existing gold mineral crystals and green repair pod retained. Shape and glyph distinguish resources independently of colour.

Original PNGs are stored without edits in the public R2 ZIP linked by assets.json. ZIP and individual source hashes were downloaded and verified. Do not commit binaries. prepare-assets verifies originals, then makes bounded 192px runtime copies; body frame metadata preserves source registration. Two shared textures, pooled pickup images and two persistent HUD images; no new emitters or per-frame texture generation.

Generation prompts, originals, readability board, R2 hash proof and headless evidence: outputs/steroids-alpha/resource-pickups-v01 (outside the checkout). Source prompts use the approved mineral cluster and Human Nomad cowling as style references.

MIN buys match upgrades; SALVAGE banks credits when warping out; FUEL is carried by members on their home planet and unloaded at its Nexus. Separate mineral/cargo objects replace hidden bonuses. Source reward totals and shop prices are unchanged; collection/extraction totals now depend on which separate objects the player actually gathers. Tutorial keeps mineral-only learning drops; Warzone has no mined cargo.

Server-authoritative attraction: existing collection radius plus 64 world pixels, speed 420 px/s, nearest eligible collector, original spill locks and ownership/capacity checks. Partial cargo preserves its remainder. Movement coalesces at snapshot cadence and interpolates across wrapped seams. Cap 400 (old 200 doubled for separate objects); eviction remains bounded even for death salvage. Protocol 33 requires paired client/Worker release; no D1 migration.
