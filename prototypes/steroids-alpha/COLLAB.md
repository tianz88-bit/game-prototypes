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
  Optional orbitalGroundAlpha fades ground cues; opacity supports observer arrivals and warpForeground keeps the pilot above hyperspace. orbitalLift remains compatible but the corrected arrival stays level. Omitted fields preserve ordinary flight/lab rendering.
- `ShipView.update(at, headingRad, timeMs, speed, boosting, control?, top?)`, `.fire(side)`, `.shieldHit(angle)`, `.destroy()`. FFD control is `{thrust,turn,aim}` for own intent, `'observed'` for remote motion, or absent for level rotation. The old five-argument call stays level.
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
- Protocol21 appends f32 arrival seconds at ship offset99 (103 bytes total). World advances it once per tick and gates damage/contact/combat; prediction advances its copy once per input step. Own OrbitalTransition follows remaining authority time, not an independent protection clock. Remote entrance is keyed only by positive arrival state; old ships do not replay it. warp timing defaults are bounded and old hosted records upgrade. Publish client and Worker together.
- Menu WARP opens StellarMap: first destination tap selects, second tap on that globe enters flight. While open, name/copy controls are disabled and menu taps are isolated. Destination `buttons` exist only while the map is open. PlanetGround previews own four bounded objects and destroy them on rebuild/shutdown, sharing terrain textures.
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
