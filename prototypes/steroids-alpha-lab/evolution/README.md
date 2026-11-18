# Evolution & siege preview

Owner gate: **lab preview first**, 18 November 2026. Do not release this model into the live game without approval and a shared server/client implementation.

Open the permanent lab with `?evolution=1`. Choose a build, LOAD REQUIREMENTS, then EVOLVE & TRY. Selection survives reload in the separate lab preference key. The tier buttons can remove individual requirements to inspect the evolution gate. NEW RUN resets the test, retaining selection. No game account, inventory, hosted settings or network connection is used.

- Battlecruiser: bought Turrets 2 + Guns 4. Missile Cruiser: Missiles 4 + Mines 2. Both use the existing 300 mineral floor / 120 evolution cost for this comparison; other upgrades remain.
- Missile Cruiser: new elongated modular hull, eight-door central bay, no primary guns, eight missiles. One per press; hold FIRE/Space to repeat. Missiles launch backward for .45 seconds before curving toward the selected forward target. Range and damage are 1.5 times normal, with a larger painted projectile. Mines and burst turrets defend the flanks.
- Both cruisers use the same seven-shot CIWS controller, a pause, then reacquisition. Existing turret ownership uses `max(2, bought)`, not an additive two plus bought count. Four mounting pads remain visible; active heads match ownership.
- Towers fire two high-speed 110-damage shots with a warning and reload. TEST SPARROW demonstrates the danger at fighter scale. Shield-break grace can leave one hull point once; a subsequent volley is lethal. RESTORE repairs the test scene.

PC: W/S speed, A/D or mouse aim, hold Space to fire, Q missile, E mine, Shift dash. Touch: drag to steer, hold MISSILE/FIRE, MINE and DASH. TARGET cycles the Nexus, towers and raiders; aim toward the selected target for lock. RAIDERS/TOWERS toggle their attacks. Upright phones use the existing rotated landscape surface.

Art uses the existing fixed-order cardinal-offset rig, 3% layer shading, engine vibration, and per-part control-driven FFD with a Canvas sprite fallback. Default display rotation does not drive FFD. The new ship has 18 modules; existing faction turret hardware is shared. New parts, hashes and generation provenance are in `assets.json`, `rig.json`, and `ART_PROMPT.md`. Art binaries stay in R2, outside Git.

## Implementation boundary

This is a deterministic local design model, not a network chassis addition. It uses shared movement/aim/grip and existing renderers, but substitutes a cloned Battlecruiser tune for the Missile Cruiser inside this isolated page. Combat targeting, projectiles and building damage are sandbox code. The live Hangar, authority, save schema, protocol and gameplay tune remain unchanged. Before a live port, add the chassis/build choice to authoritative state and persistence, validate evolution purchases server-side, integrate missile capacity/rear launch/building locks and burst cadence into the shared simulation, then verify prediction/replay and remote rendering.

Checks: `npm run typecheck`, `npm run build`, `node scripts/test-steroids-evolution-lab.mjs`, and the existing rig regression. Headless Brave checks seven PC/touch/portrait/Canvas cases at DPR 2, actual build selection/evolution, eight launches/no primary fire, gun cruiser, mines, FFD controls, persistence, bounds and stable resets. No captures, live sockets or remote writes. Human review of silhouette, targeting and feel is still required.

Public delivery is pending the R2 package upload; do not merge the mandatory asset preparation step while its URL returns 404. Local prepared art and all evidence are in `outputs/steroids-alpha/missile-cruiser-lab/`.
