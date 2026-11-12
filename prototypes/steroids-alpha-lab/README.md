# Steroids-Alpha calibration and balance lab

Permanent public route: `/game-prototypes/prototypes/steroids-alpha-lab/`, directly below the live game on the hub. The lab starts from the canonical game calibration, gameplay tune and client tune. Browser drafts persist under `steroids-alpha:calibration-lab:v1`; importing/exporting JSON is supported. Load live settings reads the server's active version; bundled defaults are a fallback. The ship stage uses the approved reference rig/FFD and production movement step. Weapon rates/DPS are calculated; this is not a network/combat practice arena.

## Private publish path

Fetch and pack production art, then prepare the lab art:

```
node scripts/fetch-assets.js steroids-alpha steroids-alpha_human-nomad-v1_assets.zip
node scripts/pack-assets.js steroids-alpha
node scripts/prepare-steroids-lab.mjs
npm run steroids:lab
```

The public Publish button opens `http://127.0.0.1:5192/` with the draft in a URL fragment (not an HTTP query or a credential). In that private tab, Publish requires the existing GitHub CLI login on this PC. No access token enters the public page. The loopback companion checks Host, Origin, content type, custom header, session, payload size and active-version conflicts, and dispatches only the fixed main-branch publishing workflow. Open drafts elsewhere can still edit/export; publishing currently requires this PC's private companion, not a phone-only administrator login.

The private companion must be running before opening that link. A stopped companion produces a connection-refused page and sends no publish request. On this PC, `outputs/steroids-alpha/Start Private Publisher.cmd` starts it hidden outside the chat's temporary command session. Restart it after rebooting the PC. Keep its checkout current when the game adds tune fields. The companion retains ten observed live records locally; drafts based on an older version can continue only when that known baseline and the current live data are exactly equal after schema migration. Actual changed values and unknown baselines still require review.

GitHub Actions supplies a short-lived OIDC identity. The Worker verifies signature, issuer, audience, repository, main ref, exact workflow, event and expiration, validates data, then compare-and-swaps a content-hashed version in the PlanetConfig Durable Object. Ten previous versions remain in storage. A rejected/stale publish keeps active settings unchanged. Reimport a previous export to publish a rollback. No permanent new publishing token is used.

Connected rooms poll the internal config store every 15 seconds and announce the entire active record before a fresh snapshot. Client prediction and authoritative simulation switch to the same version; old queued inputs are discarded across cutover. Existing hull is capped, not healed. Calibration changes rebuild rendered ships/shadow; client visual data is applied at runtime. World/network/DPR/touch/texture-resolution changes are locked and require code deployment. The initial protocol-v4 deployment requires clients to reload once; subsequent settings changes require no client or Worker rebuild.

## Cheat resistance

Inputs carry intent, never authoritative position, damage, inventory or arbitrary config. The server advances at most one ship step per tick, bounds queues, rejects replay/huge sequence jumps and limits packet size/rate. A forged client cannot publish via the gameplay socket or unauthenticated admin endpoint. These are concrete protections, not a claim of complete anti-cheat: anonymous multi-account abuse, identity/account authentication, aim automation, botting, lag compensation and competitive telemetry still need a later pass.

The legacy reference FFD remains Canvas-based in this tuning stage; the production mesh port is separate unfinished work. Keep the approved calibration intact until a tested draft is deliberately published. Draft/public visitors cannot affect live data just by changing controls.

Implementation references: [GitHub workflow OIDC claims](https://docs.github.com/en/actions/reference/security/oidc) and [transactional Durable Object storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/).
