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
- `ShipView.update(at, headingRad, timeMs, speed)`, `.fire(side)`, `.shieldHit(angle)`, `.destroy()`.
- `DrawnShip` interface (`flight.ts`): what the scene calls per ship.
- Fx events (`src/net/client.ts` `drainFx()`): `shot | burst | spark | explosion | heal | shield`. Logic emits; render consumes. New effect = claude adds the event kind, codex draws it.
- `ShipState` fields (`sim/ship.ts`) are read-only to render.
- `clientTune.render.*`: codex owns values; claude owns `tune.json` (gameplay feel). Values set by the owner are never changed without an owner request (CLAUDE.md).

## Workflow per push

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
