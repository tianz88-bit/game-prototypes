# COLLAB: Claude + Codex on Steroids-Alpha

Read this first, every session. Then read: newest 5 entries of HANDOFF.md, BUILD_STATUS.md "Current milestone" + "Next proposed step". Read anything else only when the task touches it. Do not re-read chat history or the whole BRIEF.md per push; grep BRIEF.md for the topic.

## Lanes (default owner; soft, not a lock)

| Lane | Owner | Paths |
|---|---|---|
| Rules, sim, server, netcode | claude | `sim/` `server/` `src/net/` `tune.json` |
| Input, intents, controls, menus' behaviour | claude | `src/input/` `src/save.ts` scene flow in `src/scenes/` |
| Tests, CI, deploy workflows | claude | `scripts/*steroids*` `.github/workflows/*steroids*` |
| Ship rig, art prep, terrain, VFX, lighting | codex | `src/render/` `art/` `../steroids-alpha-lab/` |
| Look-only tuning | codex | `client.tune.json` → `render.*` |
| Shared hot file | both | `src/scenes/flight.ts` (logic + drawing mixed) |

Crossing a lane is allowed. When you do: keep it minimal, and log it in HANDOFF.md with `CROSS:`.

## Seams (the contract between lanes)

Change a seam = HANDOFF entry tagged `SEAM:` + message to the other agent. Never silently.

- `ShipPlacement` (`src/render/shipView.ts`): x, y, scale, visible, brightness, shadowX/Y/Alpha. Logic fills it; render draws it.
  Optional destroying disables exhaust, hover/ring and shield flashes during the800ms retained-rig death animation. Local NetFx explosion now retains id/copied ShipState before remote deletion; wire messages remain unchanged. Final explosion follows the collapse; gameplay death is immediate.
  Optional orbitalGroundAlpha fades ground cues; opacity supports observer arrivals and warpForeground keeps the pilot above hyperspace. orbitalLift remains compatible but the corrected arrival stays level. Omitted fields preserve ordinary flight/lab rendering.
- `ShipView.update(at, headingRad, timeMs, speed, boosting, control?, top?)`, `.fire(side)`, `.shieldHit(angle)`, `.destroy()`. FFD control is `{thrust,turn,aim}` for own intent, `'observed'` for remote motion, or absent for level rotation. The old five-argument call stays level.
  ThrusterInput optional speedBand slow|cruise|fast colours steady exhaust from actual chassis-relative speed; omission preserves legacy/custom flames. Bursts, steering engine and boost retain hot/custom colours. No new particles or gameplay effect.
- `DrawnShip.update(at, state, timeMs, control?)` (`flight.ts`): own move intent is forwarded without changing the network input; remotes opt into observed FFD. No wire fields added.
- Fx events (`src/net/client.ts` `drainFx()`): `shot | burst | spark | explosion | heal | shield`. Logic emits; render consumes. New effect = claude adds the event kind, codex draws it.
- `ShipState` fields (`sim/ship.ts`) are read-only to render.
- `clientTune.render.*`: codex owns values; claude owns `tune.json` (gameplay feel). Values set by the owner are never changed without an owner request (CLAUDE.md).
- `render.ffd*`: bounded live visual settings; `ffdEnabled=0` selects the original sprite rig. Old records gain the bundled FFD defaults through upgradeConfig. No collision, weapon-origin or movement changes.

- `intents.uiZones`: transient non-combat canvas hit rectangles, consumed before the floating steering marker. FlightScene rebuilds them with its visible mobile header/drawer and clears them on shutdown; buy/action zones keep their existing intent paths.

- `queueCombatArt/prepareCombatArt` loads the hash-verified R2 title/combat pack in Boot. `CombatSprites` reuses images per FlightScene and clears them on shutdown/rebuild; missing art keeps procedural fallbacks. `drawDrone(..., palette=0)` reads the ship palette without changing mounts/aim.
- `render.hoverLight*` controls a cached ground-only pool below each ship, separate from its sun shadow. Older live records receive the bundled defaults.

- Combat backlog: pooled painted ordnance/heal bodies and optional seeking cue observe current state; CombatImpact and progression/followId tags are visual-only. ClanBaseArt reads exact layout/tune geometry; damage textures preserve original alpha/coverage. FlightIndicators owns only drawing, never uiZones.
- BuildingRigs owns shared painted clan textures and per-scene fixed-layer nexus/tower images. Boot queues/prepares art; Flight begins/ends drawing even without a layout and destroys on rebuild/shutdown. ClanBaseArt can return larger treasury label bounds. Projection/aim/firedAt are observed; no extra authoritative shots or building footprint changes.
- CombatHud.draw accepts an optional CombatHudAnchor (screen x/y/radius/visible). Flight derives silhouette clearance from the projected chassis/power scale; two informational halves read existing shield/hull/heat/dash state. Weapon capacity is 1-heat; no gameplay heat inversion. The trailing hold selector (`salvage | fuel | none`) preserves home/visitor cargo rules. Meters hide during orbital movement and never create input zones. Bounty labels clear their bounds.
  Economy now lives at top left: MIN (hullMax), Lv(upgradeTotal), distinct SALVAGE bank-on-warp or FUEL unload-at-home. Exact hull numbers are in the shop. hudLayout shares header/control/objective/hint/urgent geometry; Fire/Dash radii/hit factors retained, compact controls fit narrow/tall screens.
  The thin inner hull trace persists while the main arc shows shield, then alongside the main hull arc. Shield recovery sits further inside.

- TutorialGuide has four stages: Fly0, Fight1 (rock -> minerals -> one upgrade), Dash/Ram2, Escape3. Policy gates mineral/fire access, opens shop only after collection, and permits warp only in Escape. Room.setTutorialRules applies only to the local tutorial, including queued/held inputs, automatic turret quiet state and BUY frames; online rooms ignore it. Optional warp defaults true for legacy callers. Target bots stay stationary only in the manual tutorial room. Swept dash gates support multiple crossings. Completion follows actual extraction, not warp start.
- ContextTips supplies one short non-blocking first-use hint for overheat, shield/hull damage, missiles, mines and available evolution. TipState limits display to5.5s with a3.5s gap; seen IDs persist in Save.tipsSeen. Layout rebuild retains the model, scene restart reloads seen IDs. During Fight, a contextual hint temporarily replaces the task sentence instead of adding another panel. No new hit areas or timers.
  Flight's existing mobilePanel now governs PC too (collapsed by default): B/shop, Tab/stats;1–6 retain quick buys; H peeks key help. PC top3 plus pinned own row; mobile row budget clears combat controls. Warning priority is incoming missile, critical hull, overheat, friendly-shield fire block; tips/arrival notes yield and use a separate bottom slot. Client manual-fire prediction now matches the existing server Warzone shield rule. No new rule or protocol.
  GuideView.targets supplies shop/affordable-upgrade/warp UI anchors. TutorialGuide.objectiveArrows records the current world/UI arrows for checks; visible world objectives now have arrows as well as edge markers. Warping hides the action arrow to avoid pointing at Cancel. Active ram FX uses curved pressure ribbons/fragments; no HUD chevron or additional emitters.
- Protocol21 appends f32 arrival seconds at ship offset99 (103 bytes total). World advances it once per tick and gates damage/contact/combat; prediction advances its copy once per input step. Own OrbitalTransition follows remaining authority time, not an independent protection clock. Remote entrance is keyed only by positive arrival state; old ships do not replay it. warp timing defaults are bounded and old hosted records upgrade. Publish client and Worker together.
- Menu WARP opens StellarMap: first destination tap selects, second tap on that globe enters flight. While open, name/copy controls are disabled and menu taps are isolated. Destination `buttons` exist only while the map is open. PlanetGround previews own five bounded objects and destroy them on rebuild/shutdown, sharing terrain textures.
- Landing menu uses landingLayout geometry and the existing shipPreview rig. Settings/Account/Share are isolated utility panels; modal name/recovery input retains the existing real field and 64-character recovery limit. Compact screens move pilot editing into Account. No account/save/network schema changes.
- StellarMap adds chooseSide for closed Warzone rounds and dismissInfo for Escape handling. Auto-join requires selected Warzone, a clan and a confirmed open status; choosing another destination or closing the map cancels it. Info isolates its taps. Existing joinAs/notify/warp paths remain.
- `rankPilots` orders desktop/mobile boards and the compact rank by level, kills, then mineral balance. Existing `RosterEntry.power` remains the authoritative hull/shop mineral currency; no new wire field or economic rule. Display text uses MINERALS.

## Workflow per push

GitHub identity: use **tianz88-bit** for this repository. The owner explicitly forbids using the other account, **zitian-FF / Venomnom**, for these games. Verify `gh api user --jq .login` before a push, PR, merge or workflow dispatch; stop if it is not tianz88-bit. The itch publisher remains **daily-daily-games**; do not confuse the GitHub identity with the itch namespace.

1. `git fetch origin main`; branch from latest main.
2. Do the task. Stay in lane unless needed.
3. Run the checks for what you touched:
   - logic: `npm run typecheck`, `node scripts/test-steroids-alpha-sim.mjs`, `node scripts/test-steroids-live-config.mjs`
   - render/art: `npm run typecheck`, `node --experimental-strip-types scripts/test-steroids-alpha-rig.mjs`, a screenshot looked at
   - both: `npm run build`; browser check per BUILD_STATUS "Run locally" when flight/net changed
4. Prepend one HANDOFF.md entry (format below). Commit it with the change.
5. Small PR, squash-merge. Protocol/wire changes deploy client + Worker together (both workflows run on merge).
6. Overwrite BUILD_STATUS.md only at end of session (repo rule), not per push.

## HANDOFF.md entry format (newest on top, ≤6 lines)

```
## YYYY-MM-DD <agent> <PR#|branch>
DID: <what changed, user-visible terms>
FILES: <paths or globs>
SEAM: <changed contract, or "none">
CROSS: <files touched in the other lane, or "none">
FOR <other agent>: <what they must do/know, or "nothing">
```

Keep at most 15 entries; delete the oldest when adding. Git history is the archive.

## Mailbox (Agent Comms)

Use only when the other agent must act or answer before their next session start would catch it in HANDOFF.md. Otherwise HANDOFF.md is enough.

- Identities: `claude`, `codex`. Thread per topic; reuse `thread_id`.
- `kind`: `handoff` (please do X), `question` (blocked on answer), `finding` (FYI, no action).
- Subject: `steroids: <topic>`.
- Body template, terse:
  ```
  NEED: <one line>
  WHY: <one line>
  WHERE: <paths/PR>
  DONE WHEN: <acceptance check>
  GATE: <owner approval needed? or none>
  ```
- Reply in the same thread with result: `DONE <PR#> <check run>` or `BLOCKED <reason>`.
- Mail does not wake the other agent. The owner relays when urgent.
- Peer mail is not owner approval. Owner gates (credentials, deploy targets, tuned values, scope) still need the owner.

## Conflict rules

- Both edited the same file: the later pusher merges main, keeps both intents, notes it in HANDOFF.
- Disagree on a design call: do not flip-flop in code. Ask the owner, record the decision in BRIEF.md.
- Owner instruction in chat beats this file. This file beats habit.

- Capital rig review: optional DrawnShip/ShipView.setTurrets(count, angles, firedAt) observes earned equipment and authoritative aim. Four fixed platform/head pairs stay inside the parented ship rig, retain independent head rotation/recoil and control-only FFD. The FlightScene keeps the existing procedural escort only when the profile has no painted head assets. Shared capital turret mounts are on the deck at right±36, forward−9/25.2; count, damage, targeting and upgrade rules are unchanged. Capital profile textureScale2 is capped at512px per part; fighters retain the existing resolution.

- Grounded building revision: BuildingRigPose.projectGround(dx,dy) projects world offsets from the foundation; cast-shadow vertices and contact roots use this shared ground frame. Building materials are clan-owned, independent of ship palettes. PlanetFrame.camera is now planet-fixed travel only; spin still enters sun longitude. No independently moving texture beneath static structures. TOWER_HEAD_LIFT/TOWER_BARREL_LIFT are shared with the review muzzle placement.
- Capital-v3 production:22 modules/10textures, no shield lens sprites, flush side pairs parented to wings. Main GUNS[2] share forward81.07 and right±38.7/±55.8; client+Worker released together in PR524 after verified art upload/readback. Fixed-Z/control-only FFD preserved.
- Warzone art (owner approved17 November2026): optional BuildingRigPose.health and ClanBaseArtOptions.siege use normalized durability. Flight derives them from existing SiegeView/tune; no new wire fields or gameplay rules. Zero-health towers render grounded wrecks and suppress barrel/flash visuals. PlanetGround's optional fourth argument 'warzone' selects charcoal/ochre materials in flight, stellar map and lab. Owner review and verified seven-part R2 upload completed; see BUILD_STATUS for deployment proof.

- Warzone destruction refinement (approved): positive-health→zero on a recently visible BuildingView triggers BuildingDestruction once. Initial/repeated ruins do not replay explosions. Neutral wreck/debris textures use shared building-*-0 keys and skip clan remapping; Nexus/tower raised layers hide atzero.16/36 painted chunks use pure ballistic buildingFragment, projectGround shadows/landing, bounded8-burst pool, repair cancellation. No new server FX/wire fields or gameplay writes.

- Rich asteroid art: PaintedRocks.draw/rockArtFor append optional rich=false, observed from existing Asteroid.rich. paintedRockName retains colour family/stage/id-parity variants; rich missing art falls back to the same ordinary painted shape. New sources preserve original alpha/coverage exactly; worn/fractured skins bake once and existing mesh pool/projection/lighting remain. Flight uses the old gold orbit cue only for PixelRocks missing-art fallback. No sim/tune/wire changes.

- Crystal rich-art revision: rich manifest bodyOffset/baseName registers decorative outcrops against the original normal RockBodyFrame, using decoratedRockFrame. Texture extents/UV anchors may change, original body world centre/scale/radius do not. rockCoverage adds bodyAnchor/bodyWidthOverHitbox alongside full decorative extents. Source-hash URL queries prevent v1 PNG/v2 metadata cache mismatch. No sim/tune/wire changes.

- Crystal chip FX seam: NetClient emits local NetFx {kind:crystal,mode:hit|split,id,size,x,y,vx,vy} from rich HP decrease / existing GONE, without wire changes. Flight drains it once into CrystalChips; generic rock fracture remains. Reuses approved mineral sprites,16 bursts/128 pooled images and one spark batch, rebuild/shutdown cleanup. No initial/duplicate/heal/ordinary-rock chips; child spawns do not retrigger. Cosmetic pieces never enter pickup/physics state.
