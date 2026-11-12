# Steroids-Alpha calibration and balance lab

Permanent public route: `/game-prototypes/prototypes/steroids-alpha-lab/`, directly below the live game on the hub. The lab starts from the canonical game calibration, gameplay tune and client tune. Browser drafts persist under `steroids-alpha:calibration-lab:v1`; importing/exporting JSON is supported. Load live settings reads the server's active version; bundled defaults are a fallback. The ship stage uses the approved reference rig/FFD and production movement step. Weapon rates/DPS are calculated; this is not a network/combat practice arena.

Import settings accepts both Export all settings and Export calibration files. A calibration-only import changes the rig without replacing game stats or the draft's publishing baseline. It preserves authored four-facing offsets and validates the complete rig before applying anything. Invalid imports leave the current draft intact.

## Hosted owner publishing

Publish to live opens the existing game Worker at /manage/. Cloudflare Access signs in the owner using email codes. The Worker independently verifies the Access RS256 signature, fixed team issuer, application audience, expiration and exact owner email. Only /manage/ is protected; /config, /health and gameplay sockets remain public. The GitHub OIDC publish workflow remains available unchanged.

The lab passes its draft through a URL fragment and a checked-origin popup handshake. The admin page requires explicit review and Publish; opening or signing in never writes data. It also imports calibration-only exports while preserving live game stats. Same-origin JSON/custom-header checks, bounded validation and the existing transactional expected-version guard protect writes. No CORS write permission, permanent browser credential, local program or polling service is needed.

Deployment is closed until these dashboard-managed Worker variables are set: ADMIN_ACCESS_TEAM (team subdomain), ADMIN_ACCESS_AUD (application audience), ADMIN_OWNER_EMAIL (one permitted owner). keep_vars preserves these on deployments. Do not commit the owner's email to the public repository. Configure a self-hosted Access application for steroids-alpha-server.tianz-88.workers.dev/manage only, with an Allow policy for that owner and email-code login. Do not protect the entire game Worker. Enabling the Access application requires the owner's confirmation; missing config returns503 and an invalid/missing identity returns401.

Previous loopback launcher files are legacy tooling; the private publisher is stopped at the owner's request. This hosted path does not depend on them. The owner has already authorized and received the exact calibration update ffc177fd2833; gameplay/render stats were preserved.

Connected rooms poll the internal config store every 15 seconds and announce the entire active record before a fresh snapshot. Client prediction and authoritative simulation switch to the same version; old queued inputs are discarded across cutover. Existing hull is capped, not healed. Calibration changes rebuild rendered ships/shadow; client visual data is applied at runtime. World/network/DPR/touch/texture-resolution changes are locked and require code deployment. The initial protocol-v4 deployment requires clients to reload once; subsequent settings changes require no client or Worker rebuild.

## Cheat resistance

Inputs carry intent, never authoritative position, damage, inventory or arbitrary config. The server advances at most one ship step per tick, bounds queues, rejects replay/huge sequence jumps and limits packet size/rate. A forged client cannot publish via the gameplay socket or unauthenticated admin endpoint. These are concrete protections, not a claim of complete anti-cheat: anonymous multi-account abuse, identity/account authentication, aim automation, botting, lag compensation and competitive telemetry still need a later pass.

The legacy reference FFD remains Canvas-based in this tuning stage; the production mesh port is separate unfinished work. Keep the approved calibration intact until a tested draft is deliberately published. Draft/public visitors cannot affect live data just by changing controls.

Implementation references: [GitHub workflow OIDC claims](https://docs.github.com/en/actions/reference/security/oidc) and [transactional Durable Object storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/).
