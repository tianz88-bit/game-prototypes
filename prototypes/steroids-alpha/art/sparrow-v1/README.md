# Sparrow review kit

New Human Nomad starter, 16 November 2026. Preview only; no live asset upload or account migration yet.

Eight original top-down component PNGs are stored outside Git at outputs/steroids-alpha/sparrow-review/assets. The source sheet and ZIP are beside them. ship-assets.json records SHA-256 for every extracted cell and the ZIP; the local .cache contains the matching ZIP so pack-assets/build can be reviewed before R2 upload. Do not merge the R2 manifest until that exact ZIP is uploaded and re-fetched/verified. No PNG/ZIP belongs in Git.

The eleven-module profile uses the existing pose/depth/FFD/exhaust/recoil pipeline. Centre gun has side0, supported by the signed shot-side wire field; protocol22 additionally accepts chassis3. Eight files retain their fixed 384x512 source registration. Runtime alpha-bounds preprocessing is shared with existing ships. No hand-painted source pixels were programmatically changed.

Ship IDs stay stable: Falcon=ship.scrappy/chassis0, Bat=ship.interceptor/chassis1, Sparrow=ship.sparrow/chassis3. Missing/forged/locked saved choices resolve to Sparrow. Existing-account Falcon grants are undecided; no grant SQL is in active server migrations.

Weapon: 6 ticks at30Hz (5 shots/s); Falcon is4 ticks alternating (7.5 combined,3.75 each). Same base movement/defence/damage. Base cold burst12 versus15. Whole-shot ammo rounds to nearest80% including cooling, at each upgrade tier. A1e-10 heat threshold removes exact-cap floating-point bonus rounds; no tuned values changed. +/-3degree deterministic launch drift is applied after assist; centre bore stays aligned.

## Image generation

Built-in imagegen, reference: existing fixed-stack-v11 Falcon lab screenshot, used only for established style. Final image was a cleanup edit of the generated original sheet.

Initial prompt: Use case stylized-concept. Production game sprite PARTS SHEET for a new Human Nomad starter fighter named Sparrow. Match existing simple vibrant cobalt-blue/orange/ivory plating, turquoise glass, thick dark navy outlines, chunky clean cartoon hard-surface shapes and restrained detail. Original parts/silhouette, not copied Falcon parts. Strict orthographic TOP DOWN, facing UP, small visible bevel edges like top-down Zelda props, no isometric/perspective. Compact broad shoulder dart fighter, short swept wings, prominent rounded cockpit, twin rear pods and ONE centre cannon. Eight separate full components on transparency in a4x2grid: chassis, armour, left wing, centre gun; engine core, cowling, cockpit base, canopy. Lots of padding, no labels, no assembled ship, no shadows, no exhaust, no bloom or tiny greebles.

Cleanup prompt: Preserve all eight designs, positions, dimensions, colours and strict top-down view. Remove diffuse coloured glow/haze/shadows around components and in empty cockpit frame. Clean crisp navy edges, fully transparent background, opaque painted interiors. Do not redesign or rearrange, no text or added objects.

## Review evidence

outputs/steroids-alpha/sparrow-review: desktop/mobile hangar and flight captures, fighter-comparison.png, sparrow-rotation.png and result.json. Capture scenes use the actual ShipView class; gameplay shots use a real local Worker. Physical mobile/Safari not tested.
