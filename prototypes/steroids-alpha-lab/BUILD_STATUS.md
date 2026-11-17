## Current milestone

Easier combat duel lab candidate ready locally after owner found both manoeuvres too hard. Pages update/public verification pending. Live combat remains171126r0098 / Worker25 and still requires explicit approval.

## What was implemented

Fixed stale Start/Resume-pointer steering during fire/keyboard takeover. Candidate releases to cruise, mobile drag steers without throttle feathering, held Brake targets a useful turning speed and a65–115% cruise band shares one turn radius. Sparring has delayed observations and short trigger bursts. Existing impacts and weapon damage are retained; baseline still slows on release.

## Key technical decisions

Lab-only combatThrottle/combatTurnFactor and DuelBrakeInput. A cloned per-chassis gyro rate is adjusted for one shared World movement step then restored in finally, symmetrically for both pilots. These are preview helpers, not publishable live-config settings. No live runtime/tune/server/workflow changes, sockets or publishing.

Type/build and expanded physics/control regressions pass.3 built-preview Brave desktop/mobile/portrait input cases verify neutral pointer, cruise convergence, held Brake/no accidental firing, mobile steer/speed separation and original baseline slowdown.6 general duel layouts pass.12 synthetic continuous-aim counter sequences show1.03–1.87s firing opportunities across varied Dash timing, with losses still possible; no human execution/fun claim. Zero page errors/sockets/writes/captures. Evidence outputs/steroids-alpha/combat-duel-lab/easier-*.

## Open questions

Owner to retry both lab duels and judge control ease/counterplay. Live release is not approved.

## Known issues

Synthetic continuous aim is more precise than human aiming; these checks do not prove manual ease, fairness or online feel. Sparring is scripted, not another human. Physical-phone/Safari visuals not inspected. Existing unrelated build warnings remain.

## Next proposed step

Publish only the lab update, verify public controls, then owner playtests again. Keep Claude's backlog deferred and the live release gate. Stop temporary preview4187 when checks end.
