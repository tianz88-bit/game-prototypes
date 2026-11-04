# Operation C private-room server

Isolated Cloudflare Worker with one SQLite-backed Durable Object per room. No Firestorm bindings, accounts, matchmaking, paid add-ons or application dependencies are introduced.

From the repository root, with Wrangler available:

```sh
npx vite build --config prototypes/operation-c/vite.config.ts
wrangler dev --local --config prototypes/operation-c/server/wrangler.jsonc --port 8789
node prototypes/operation-c/tests/online.mjs
npx tsc --noEmit -p prototypes/operation-c/server/tsconfig.json
wrangler deploy --dry-run --config prototypes/operation-c/server/wrangler.jsonc
```

The local client defaults to port 8789. For a hosted client, set `VITE_OPERATION_C_SERVER` at build time or the verified endpoint in `src/online-config.ts`. `?server=https://your-worker.workers.dev` overrides it for isolated testing. The Worker also serves the standalone `../dist` assets: build those before local Worker startup or deployment. Only `/health` and `/ws/*` invoke Worker code before asset routing. Deploy only this configuration, using the existing authenticated account; never change the account's plan to deploy it. The verified preview is https://operation-c-online.tianz-88.workers.dev/ .

`GET /health` identifies this service. `/ws/ABCDE?create=1` creates a private room; the second visitor joins without `create`. Each welcome contains a separate random seat token. The client stores that token only in its tab's session storage, scoped to server origin, room and host/guest role. Invite links contain no seat token. Returning in the original tab authenticates the same seat; another client cannot occupy a disconnected seat. Losing session storage loses that seat. Room codes are casual invitations, not confidential access control.

Both players choose a loadout and Ready; a three-second countdown starts the match. The server validates all commands against the authenticated seat, rate-limits messages, deduplicates requests and advances fixed 100 ms steps. It broadcasts record deltas every 200 ms, with full snapshots on reconnect or revision gaps. Clients never advance online rules. There are no bots or pause commands online.

Protocol/checkpoints are v9 for soft-radius worker expansion, HQ-connected research/conversion support and owner-validated dismantling, retaining deterministic symmetric seeded maps, host-only lobby map selection and gap-aware ground/air movement, retaining multiple HQs, HQ-bound research, fixed HQ plus seven selectable cards and explicit building commands. Older rooms return a terminal version-change message; reload both clients and create a new room after this update. The welcome supplies authoritative tuning so client inspectors match server rules. Each seat has its own redacted delta baseline. Opponents receive no enemy nuke-ready timer, flight record, ID, target or arrival time, including after resync/recovery. Impacts are public. Per-owner flight ID counters prevent launch-count leakage through the attacker's later IDs.

Disconnects do not pause a match. When both players are offline, computation is deferred and elapsed simulation is caught up in bounded batches on return. Confirmed commands are checkpointed before acknowledgements; periodic checkpoints preserve ongoing simulation. A restarted object rebinds hibernating sockets. Unused lobbies expire after 30 minutes, finished matches after one hour. A new match uses a new room.

The existing account was verified on Workers Free on 2026-11-03. SQLite Durable Objects are available on that plan; its daily requests, duration and storage-operation quotas are shared with other services. Active games require periodic wakes, so this is intended for small private playtests, not unlimited concurrent rooms. Exhausting Free quotas can interrupt rooms. No plan upgrade or billing change is part of this prototype. See [Cloudflare's current Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Browser verification runs two independent clients, a rejected third client, ready/countdown, owner-specific placement, production, reconnect, and optionally a complete command-driven match:

```sh
OPERATION_C_ONLINE_FULL_MATCH=1 node scripts/screenshot-operation-c-online.mjs http://127.0.0.1:5188/ outputs/online http://127.0.0.1:8789
OPERATION_C_ONLINE_NUKE=1 node scripts/screenshot-operation-c-online.mjs http://127.0.0.1:5188/ outputs/nuclear-online http://127.0.0.1:8789
```

Windows uses isolated Brave; CI uses isolated Chromium. Test rooms contain no personal data. Physical phone performance and real-world latency still need a human playtest.

For an actual preview deployment, use the existing `node scripts/bump-version.js operation-c` before the standalone build, then deploy this Worker config. Persist the resulting version.json only after a successful upload. Never hand-edit the prototype counter or retarget other games' workflows.

Map selection: only the authenticated host may submit {t:"map", requestId, shape, seed} during the lobby. Shapes are open/narrows/forks/ring and seed is uint32. Changes reset both readiness flags. Lobby snapshots and welcomes carry the map configuration; terrain is authoritative state, retained through recovery. No map edits after countdown.
