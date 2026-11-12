## Current milestone
Hosted owner-only publishing; exact owner calibration already live.

## What was implemented
The owner's supplied calibration is active as ffc177fd2833, with exact readback and unchanged game/render stats. Public Publish opens a hosted /manage/ page, passes the draft through a fragment and checked-origin handshake, and requires explicit sign-in, review and Publish. Imports preserve calibrated poses and current game stats.

## Key technical decisions
Cloudflare Access email sign-in plus independent server signature, issuer, audience, expiry and exact-owner checks. Same-origin writes, bounded shared validation and existing CAS. GitHub workflow OIDC remains unchanged. No resident PC process. Dashboard auth variables remain outside the public repo and survive deploys via keep_vars.

## Open questions
Owner approval is required to create the scoped Access application and set its trusted team, audience and owner identity. Automatic approval review blocked entering that creation flow until concrete scope is confirmed.

## Known issues
The hosted admin remains closed until Access is configured; real signed-in browser publishing cannot yet be verified. The private publisher is stopped. No CPU/memory leak cause has been established. The temporary launcher alternative was dropped in favor of the owner's hosted-admin choice.

## Next proposed step
Enable Access only on /manage/ for the owner's approved email, configure Worker identity variables, and verify real sign-in and publish readback. Continue using COLLAB.md and HANDOFF.md for every push.
