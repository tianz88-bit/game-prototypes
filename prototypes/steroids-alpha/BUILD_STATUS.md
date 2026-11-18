## Current milestone

Capital evolution release candidate prepared, owner approved18 November2026. NOT DEPLOYED: new Missile Cruiser R2 ZIP URL still404, manual upload pending. Live remains171126r0100/protocol26. Candidate requires paired client/Worker protocol27 release after art verifies.

## What was implemented

Narrow CIWS tracers; Hangar EVOLVE selection/graphical criteria; Missile Cruiser chassis4 with8 rear-launch missiles/no main guns, +50% damage/range and larger painted projectile. Shared prediction/cooldown/capacity and server-validated evolution. Both capitals use7-shot burst CIWS then pause/reacquire. Towers fire high-power doublets with warning/reload. Siege locks shared with HUD; current clan/arrival/docking protections retained. New painted18-part profile supports palettes, fixed cardinal rig, hover/shadow and per-part FFD/fallback.

## Key technical decisions

Protocol27 retains107-byte ships, adds chassis4/ordnance kind2; BUY5 tier0/1 selects BC/MC with authoritative purchase validation. New bounded config groups upgrade old records. Production staging verifies ZIP/parts and shared turret equipment; local verified cache passes134-file pack. No binary art/workflow changes. New release regression is imported by existing sim gate.

Type/build, shared sim/new capital, config, rig and bank checks pass. Seven production Hangar PC/touch/portrait DPR2 layouts pass selection/persistence/criteria/bounds/rebuilds. Two independent Brave clients via actual local Worker protocol27 pass, including120ms RTT, travel snapshots/prediction/remote interpolation. Production WebGL and Canvas fixtures verify18 MC modules, no guns, hover/shadow and CIWS short axis2.61px versus7px main shot. No captures. Evidence outputs/steroids-alpha/missile-cruiser-lab/.

## Open questions

Owner manual upload of steroids-alpha_missile-cruiser-v1_assets.zip is pending in the preserved orange Cloudflare task tab. Live approval is already given; no further release permission needed.

## Known issues

Cannot publish while the new art object returns404. CLI is not authenticated; browser file chooser timed out and owner prefers manual upload over native input. No main merge/client/Worker/config deployment performed. Headless checks do not replace human feel/Safari review.

## Next proposed step

Verify uploaded ZIP SHA256 e190813542aea9f17afc3bcc5743368789f4e6b40143112db1977a9be9d3c3e7 and part hashes, rebase/merge release PR, monitor paired client/Worker and Pages, verify public art/UI/planet connection, then record deployment proof. Claude backlog deferred; temporary local Worker stopped after QA, local preview retained for owner review.
