## Current milestone

Drift/floatiness headless research complete, discussion only. Existing public easier duel lab remains unchanged (PR551, Pages44064727969). Live combat stays171126r0098 / Worker25; no drift or live balance release approved.

## What was implemented

No handling code was changed. Compared travel-heading lag0/.10/.22/.45s and a capped15° light profile with stronger brake/dash grip, using the actual duel simulation and real lab renderer in isolated memory-only builds. Portable aggregates are in drift-findings.json; Claude's deferred backlog records the conclusions.

## Key technical decisions

Kept scalar speed, aiming/nose response, damage and turn band fixed, with symmetric profiles for both pilots. Varied reaction0/.3s, firing on/off and manoeuvre timings. Zero drift matches canonical ship states.320 scripted duel runs, all4 chassis slip checks, exact delayed path replay and10 headless Brave DPR2 PC/mobile runtime cases pass with no page errors/game sockets/writes/captures. Full artifacts outputs/steroids-alpha/drift-experiment/.

Findings are mixed: light drift sometimes disrupts instant pursuit; with current delayed sparring it does not consistently improve outcomes. Heavy drift smooths the evader's weave too and substantially delays course alignment. Identical trajectories/circles can remain matched. Capped light grip limits slip without demonstrating a reliable combat improvement.

## Open questions

Owner discussion: whether to investigate speed-dependent grip/turn commitment instead of blanket floatiness. This is a proposed hypothesis, not approved implementation. The current lab still needs human playtest feedback.

## Known issues

Deterministic scripted/continuous-aim controllers do not establish human control ease, fairness or fun. Combat comparisons use Falcon; all4 ships were checked for slip. Travel-heading lag only, no full inertia/angular-acceleration model or online prediction/latency tests. No physical-phone/Safari visual inspection.

## Next proposed step

Discuss the findings before selecting another lab candidate. Keep current public lab and live combat unchanged. Claude backlog remains deferred; no immediate execution/review requested. All experiment headless browsers stopped; no local preview/publisher/capture service.
