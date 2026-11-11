# Planet surface and thruster lab — v09

Run `node server.mjs` here and open **http://127.0.0.1:5342/**. It is a local review draft, not a gameplay deployment. The approved ship release remains unchanged.

## Selected C view and rim visibility

C is the default flight-lab view (18% ship scale). The hard shadow is now close to the ship: default sun 238° / elevation 60° produces approximately +17px X, +27px Y in ground coordinates (56px projection reach). Sun direction changes the shadow to the opposite side. The inner rim uses a Soft Light colour blend across a broader band, with a gentle 72px outer atmospheric halo. Sun direction modulates both bands and the terrain illumination; no new image textures upload per frame.

Lighting now comes from a fixed world-space sun transformed into the player's rolling-sphere frame by **planet rotation plus accumulated surface travel**. There is no independent sun angle/timer. Axial rotation advances the terrain sample/prop camera by radius × angle, and that same combined position determines local sunlight. Shader lighting, atmospheric rim, ship/prop brightness and ship shadow all use that result. Shadow direction opposes the local sun; length grows near the horizon (bounded to 2.5× projection reach) and opacity fades to zero at night. Source art's painted highlights and prop shadows remain baked; the dynamic sprite pass adjusts their overall brightness.

Controls: **Rotate planet** toggles physical surface rotation, **Planet rotation** scrubs its phase, **Rotation speed** sets 0–12°/s (default 4). Pause flight isolates rotation; stop rotation and resume flight to isolate travel. Stop both to freeze lighting. Heading alone never enters the sun calculation. Reset restores travel and rotation phase. The three-view comparison uses the same shared frame, with rotation/travel active together during synchronized Play.

This remains a repeating local-map / rolling-sphere art lab (reference physical radius 608.25 units), not a globally continuous globe atlas or latitude/longitude navigation system. A 360° turn repeats lighting, while terrain continues through the repeating asset field. The day cycle is deliberately fast for inspection; changing visual projection does not change the reference lighting radius.

Large prop popping came from centre-only culling followed by rejecting the whole quad when any corner crossed the horizon. Circular views now cull using the full footprint, subdivide each ground sprite into terrain-following triangles, clip only the hidden portions against the horizon, and interpolate UVs through the cuts. A narrow 12px fade blends the final visible strip into the limb. Preloaded textures and the existing neighbouring world cells remain in use. This fixes terrain decals/landmarks; future tall buildings will need separate geometry for their vertical silhouettes and horizon occlusion.

## Three-view comparison

Open **http://127.0.0.1:5342/environment-lab/comparison.html** for matched side-by-side native renders:

- **A — Current oversized circle:** existing radius/curvature, ship scale 48%, boundary offscreen.
- **B — No distortion:** flat projection, ship scale 48%, continuously repeating terrain.
- **C — Visible circular sides:** radius approximately 608px in a logical 1440×810 view, ship scale 18% (37.5% of A's linear ship size). The planet's left/right rims are visible against space; it extends beyond the top and bottom. The polar ground mesh includes its rim without invalid outside-circle samples.

All panels use the same original textures, approved calibration, world layout, heading and camera coordinates. Play synchronizes camera travel, input-driven tilt and scaled thruster VFX; default is paused for a fair still comparison. Enlarge A/B/C inspects a panel; Show all three restores the layout. Each panel links to a working full-flight preset (`/?view=current`, `/?view=flat`, `/?view=edge`). Repeating art supplies a seamless visual wrapping test; this lab is not a server/gameplay torus simulation. Save comparison still exports `planet-comparison-v09.png` with labels. It renders only on changes while paused, avoiding continuous three-panel GPU work.

## Turning performance

v03 rebaked 32 clipped Canvas triangles for every changing ship part, rebuilt the shadow on every heading change, and repainted/uploaded a 2304×1296 ground canvas each frame. It also capped rendering at 30Hz and quantized heading through an integer slider.

v04 uses persistent GPU textures and a 25-vertex / 32-triangle mesh per part (300 ship vertices total), fed by the **same approved `projectPanelPoint` FFD math**. Core vibration, fixed Z, calibrated four-facing offsets, 3% layer shading and the approved inverted control bank are retained. Heading remains floating point. The shadow is rendered once at load, then projected/rotated as a cached texture. Two ground textures upload at load, with zero ground uploads per frame. The old CPU adapter remains only as a reference.

The on-page timing readout reports observed FPS, focus state and CPU submission p95; the latter is not GPU completion time. Background/unfocused/occluded browser windows can throttle animation, so final frame rate should be checked with the lab visible in front. No claim of a cross-device frame-rate guarantee.

## Flight and exhaust

Flight cruises automatically at **180 px/s**, adjustable from 80–320. Holding W / Up smoothly approaches **4.5× cruise** (810 px/s at default); release decelerates back to cruise, never below it. Pause flight explicitly freezes the environment for inspection; Resume cruise restarts it. Reset restores heading/camera and resumes cruise. A/D or Left/Right yaw. Click the scene after editing a slider to use keyboard controls.

`thrusters.mjs` exports `ThrusterVFX`. Call `update(dt,{throttle,left,right},origins)` where origins are craft-left and craft-right nozzle positions `{x,y,width,angle}` after ship FFD. Angle 0 is nose up. Optional `draw(ctx)` renders only square/rectangular particles.

- Steady idle: 40 rectangles/sec per engine.
- Throttle: both engines burst once on press, then emit strongly while held.
- Left turn: right/outside engine bursts and strengthens; right turn uses left engine.
- Strong output: 155 rectangles/sec per demanded engine.
- Burst: **86 particles per engine**, up from 22, with larger rectangles and a 180ms block flash.
- Mostly blue/cyan and white, approximately 12% orange. Release returns demand to idle; existing particles die naturally. Maximum 900 particles. Held inputs never retrigger a burst.

Hold screen buttons or tap for a short pulse. Cycle thrusters demonstrates idle, left, right and throttle states. Defaults remain steady emission. Simulation is substepped during slower frames so turn/speed/VFX do not inherit the old 50ms-per-render slowdown.

## Circular surface — current review default

The owner's v05 direction replaces the foreground horizon with an oversized circular surface centred on the player's local patch. The radius is larger than the screen's half diagonal at every slider value, so the planet boundary stays offscreen. Central scale is exactly 1; compression and bending gradually increase toward the edges, with the wide landscape view making them most apparent at the sides. The ship, controls and exhaust stay unwarped. Ground props and the detached shadow project their corners through the same mapping as the surface.

Projection: a local radial distance `r` maps to `R * sin(r/R)`. The inverse is `R * asin(screenRadius/R)`. A 64×36 cached ground mesh samples that mapping; textures are uploaded once and only world-coordinate uniforms change while flying. It requires no per-pixel trigonometry, CPU image baking or per-frame ground texture uploads. Use Projection grid to inspect the nearly flat centre and curved outer field. Curvature adjusts the oversized radius. Circular surface is selected by default; Flat ground and Horizon comparison are retained.

## Horizon comparison from Claude's written brief

Current `prototypes/steroids-alpha/BRIEF.md` on GitHub describes a wrapping 2D gameplay map rendered as a pseudo-3D sphere: surface curves toward a horizon; objects rise over it; sprite positions/scales are projected individually. Current gameplay `flight.ts` still lists this as a later milestone. A clarification request was also sent to Claude; this test follows the written brief, not an unreceived reply.

**Horizon comparison** demonstrates that earlier idea. A cached sphere mesh carries the tiled surface. Separate prop sprites project onto that same cap, shrink toward the horizon, vanish on its hidden hemisphere and grow as they approach. Forward prop projection and surface mesh share the same radius/latitude/metric. This is retained for comparison with the newer owner-directed circular projection.

This is a visual simulation over local wrapping-map coordinates, not true-sphere movement or collision. It replaces the old radial lens distortion. No clouds are added during play.

## Art and exports

Six editable, game-loadable SVG assets live in `assets/`: seamless base tile, repeating sand channel, crater, rock cluster, wreck and landing pad. `build-assets.mjs` preserves their native definitions. Eight original ship PNGs and the approved calibration are loaded read-only from the sibling `releases/human-nomad-rig-v1-20261110/` snapshot.

Save still exports the actual scene to `planet-circular-v06.png`, `planet-edge-v06.png`, `planet-horizon-v06.png` or `planet-flat-v06.png`. Earlier stills and source references are retained for comparison. No image-generated background is used in the lab. Thruster origins may supply `particleScale` (default 1); the 18% ship uses 0.375 to keep particle geometry and speed in proportion.

## Validation

`node lab.test.mjs`: circular rim offscreen at all settings, centre scale/position, forward/inverse agreement, finite cached mesh, side compression, horizon emergence and hidden-hemisphere culling, cruise/throttle bounds and return, enlarged bursts and held-input edges, and GPU mesh parity with approved FFD projection/mirrored UVs. Approved baseline checksum verification also passes. Foreground frame-rate verification remains incomplete; the optimizations are not a verified 60FPS claim.
