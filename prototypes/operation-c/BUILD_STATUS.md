## Current milestone

Capture-role playtest, 2026-11-03. Published preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version 031126r0013; Worker deployment 4fd3d83b-a887-4931-b75f-4608d72b23a0. PR #414 remains the review branch. Reload and create a NEW room for current tuning; existing v3 rooms keep their checkpoint values. GitHub Pages and unrelated deployments are unchanged.

## What was implemented

Infantry, Missile and Machine-gun squads retain full capture strength and capture priority. Recon capture strength falls from 50% to 20%; Battle Tank from 50% to 25%; Assault Walker remains 25%. Field Artillery, MLRS, Tank Destroyer and Siege Tank now have zero capture strength, joining Flak and aircraft. Capturing vehicles remain combat-first and only expand while under Expand orders with no hostile unit on owned territory. Specialist ground units still guard home, pursue intruders and advance to fire on the selected enemy HQ.

Catalog and inspector role notes identify full/20%/25% capture or inability to capture. BRIEF.md records the confirmed split and approximate capture times. Prior balance values remain intact: Tank 180 HP, Bunker 280 HP/8 damage per second, Artillery radius-one splash, reduced advanced commitments, Infantry 8s/Recon 7s replacement cooldowns, and friendly movement multiplier 1.25. Every tuning field other than the six approved captureRate changes is unchanged.

## Key technical decisions

Existing capture gating and zero-rate movement fallback support the change; no simulation/model/protocol changes or dependencies. Neutral capture is approximately 2.6s for infantry, 13s for Recon and 10.4s for tanks/walkers, before fixed-step rounding and HQ pressure. Enemy-controlled land still takes 50% longer. HQ capture pressure is unchanged.

Verification: 84 core + 19 online tests pass, including relative neutral/enemy capture progression and completion, infantry priority, combat-first vehicles resuming capture after combat, zero-capture forms holding neutral/enemy land without progress, specialist defense pursuit and attack-to-HQ firing without territorial gains. Scoped client/server and full repository TypeScript checks pass; full repository and standalone builds pass with existing unrelated hub warnings. Four isolated Brave layouts pass the full gameplay flow with no console/page errors; desktop and portrait catalog screenshots inspected. Two independent local-Worker clients pass room capacity, placement/production, building defense anchors, same-seat reconnect and enemy-command restrictions. Published two-client smoke checks pass the same room, placement/production, anchor and reconnect flow without browser errors. Evidence outside Git: outputs/operation-c-capture-regression, outputs/operation-c-capture-online and outputs/operation-c-capture-hosted.

## Open questions

Compare actual expansion value of Infantry and Recon in a fresh playtest. Minimum T1 ground-producer validation still permits a non-capturing ground card; requiring a capturing producer remains unapproved and unchanged. Earlier HQ Mobilize/repair and economic proposals are not implemented.

## Known issues

Behavior tests do not establish competitive balance. Exclusive occupancy can cause congestion. Physical-device/cellular and high-concurrency performance remain unverified. Old rooms keep previous tuning.

## Next proposed step

Play a fresh two-human room with infantry-led capture, Recon exploration and supporting combat specialists; assess expansion and defensive recovery before changing other numbers.
