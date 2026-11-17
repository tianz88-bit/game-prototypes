## Current milestone

Combat handling and Tailed/Circling duel preview published at https://tianz88-bit.github.io/game-prototypes/prototypes/steroids-alpha-lab/?duel=tail (or ?duel=circle). PR549 merge06e756654af1e9a01824d0d2dc48d1813b8a1d5c; Pages44057784026 succeeded. Six local plus6 public headless Brave DPR2 layouts pass, with all4 public ship choices and both direct routes. No page errors/game sockets/writes/captures. Temporary Vite4187 stopped and headless task processes closed. Live combat remains171126r0098 / Worker25. Owner playtest approval is required before any live balance release.

## What was implemented

Candidate opposing mass-weighted ram/bump impulses, ram dash consumption, slower kick decay and cruise-best turning. Permanent lab has two local sparring scenarios with a repeatable opening autopilot, four equal-chassis choices, role/side swap, Candidate/Baseline, pause/reset, PC input and compact mobile controls. Real ship rigs/FFD/exhaust/recoil, painted bullets/impacts, terrain/projection and ship arcs are reused.

## Key technical decisions

All executable changes stay inside steroids-alpha-lab plus a standalone test. Production World handles movement, weapons, damage and grace; a lab-only post-step adapter replaces contact response. duel.tune.json holds preview settings, and candidate clones never mutate production TUNE or drafts. Read-only World.bullets adapter avoids a second projectile simulation. Live config is read once, with labelled bundled fallback; no sockets/accounts/publishing/writes. No live tune, client, Worker or workflow edits.

Pure tests pass for4 chassis cruise radii, identical reset states, opposing/glancing/rear-ram kicks, consumed dash, damage parity/no repeat hit, tangent/swept/wrap/coincident contacts and immutable live tune. Six local plus6 public Brave DPR2 desktop/landscape/portrait/tall cases pass for controls/held fire/Dash, presets/roles/pause/reset and stable ten-reset object counts. Zero page errors, game sockets, writes or captures. Evidence outputs/steroids-alpha/combat-duel-lab/.

## Open questions

Owner to judge whether tail escapes/counters and breaking the circle are fun, and whether pushback is too strong. No live release approval yet.

## Known issues

Single-player sparring policies are deterministic scenario helpers, not human opponents. Headless checks do not establish human combat enjoyment or real network feel. Physical-phone/Safari visuals not inspected; no captures per owner. Existing unrelated build warnings remain.

## Next proposed step

Owner playtests both public presets/roles before approving a live combat port. Claude's deferred backlog documents the gate and future authority/prediction port. Temporary Vite4187 is stopped; no resident preview/publisher/capture or headless task process.
