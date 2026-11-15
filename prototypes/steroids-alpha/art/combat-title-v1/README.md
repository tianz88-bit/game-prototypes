# Combat sprites and portal title

Owner requested full runtime integration and live publication on 15 November 2026. Uses the existing approved portal logo and combat-sprites-v01 originals; no new image generation. Source PNGs are stored in the public R2 ZIP linked by assets.json, never in Git.

- Three energy shots: standard, heavy pulse (look 1), compact drone. White/cyan cores and baked blue glow. Existing shot scale, trajectories and server hit radii remain unchanged.
- Three mineral silhouettes, stable by pickup ID. Two salvage coin views animate with a constant height. Health pickups retain their existing symbol.
- Portal title uses the actual transparent logo, with alpha at the end; menu spacing includes both portals.
- prepare-assets.mjs verifies the ZIP and every original PNG SHA-256, then makes source-frame-preserving runtime copies (192px maximum combat, 1024px title). Original registration/alpha metadata remains in assets.json; runtime body frames restore readable scale.
- Nine runtime PNGs total 479941 bytes and 2220800 decoded RGBA bytes (about 469 KiB / 2.12 MiB). Shared normal-blend Images reuse a high-water-mark pool and are destroyed on scene shutdown/rebuild; no postFX or per-shot tweens. Missing textures use existing procedural fallbacks.
- Original sources: outputs/steroids-alpha/logo-v01 and combat-sprites-v01 in the art workspace.
