# Layered Nexus and dual-cannon tower preview

Seven original, transparent, overhead cel-painted parts generated with the built-in image tool on 16 November 2026. Original PNGs, exact prompts and the source ZIP are in `outputs/steroids-alpha/buildings-rig-v01` in the art workspace. No PNG/ZIP is committed. `assets.json` records every original source hash, alpha frame and runtime budget. The proposed R2 URL is not uploaded in this review pass.

The Nexus has a 260-world-unit foundation, 190-unit reactor body lifted 45 units, and a 180-unit crown lifted 100 units. Its foundation fits inside the existing landing-pad inner edge (175 units from the centre). Three independent images supply fixed Z and pronounced parallax rather than a baked whole-building illustration.

The tower uses a 44-unit foot, shaft lifted 20, head lifted 40, and two copies of the same barrel lifted 42, laterally offset by -8/+8. Existing `baseFiredAt` events alternate visual recoil and muzzle flash; there are no additional shots or gameplay changes. Head/barrels follow the projected aim; foundation and shaft remain ground-based. Projected neighbouring world axes control bearing and foreshortening as the camera moves.

Ground shadows are separate shared-gradient Images. The original code-native Nexus/turret art remains the missing-texture fallback. `BuildingRigs.begin/end` culls existing views; `destroy` releases scene-owned images/graphics. Palette textures are prepared once (Crimson uses the existing ship palette remapper, Azure retains cobalt/orange/cyan), and raw source textures are released after preparation.

Boot integration: `queueBuildingArt(scene)`, then `prepareBuildingArt(scene)`. Flight integration: create `BuildingRigs(scene)`; call `begin()` before base drawing and `end()` afterwards, including when there is no layout. Pass it to `drawClanBase` as `rigs`; destroy on rebuild/shutdown. Returned treasury anchors include `labelY` and `top` to clear the larger footprint.
