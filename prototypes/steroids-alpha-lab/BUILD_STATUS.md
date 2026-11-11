## Current milestone
Permanent calibration and balance lab with authenticated live settings publication.

## What was implemented
Hub link below the live game; reference layered rig and FFD; shared movement preview; validated browser drafts/import/export; live readback; private Publish button; canonical configuration formats shared with the authoritative server.

## Key technical decisions
Static GitHub Pages preview has no write credentials. Publishing opens the private loopback companion on this PC and dispatches the fixed main-branch GitHub workflow. OIDC verification and a transactional Durable Object protect activation and stale writes. Protocol v4 sends active data to clients; subsequent changes do not rebuild the game. Core game values stay unchanged by default.

## Open questions
A future phone-only publishing login would need a separate authenticated administrator flow. The present lab does not include one.

## Known issues
Reference FFD still uses the original Canvas adapter in this tooling stage; production mesh integration is separate. Weapons are summarized by rate/DPS rather than a combat arena. Painted source highlights remain baked.

## Next proposed step
Use the permanent lab to tune the approved rig and game data, then finish the production per-part mesh port and compare it with the reference.
