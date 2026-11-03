## Current milestone

Stronger offline bot for balance playtesting, 2026-11-03. Published preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version 031126r0016; Worker deployment 735edb33-af53-48be-9afa-b2e45e8135b7. Reload and start VS BOT for the updated opponent. Protocol/checkpoints remain v4; PR #414 remains the review branch. GitHub Pages and unrelated deployments are unchanged.

## What was implemented

Replaced blind build cycling and permanent attack after 22 seconds with a deterministic heuristic opponent. It opens on the first 100 ms simulation step with a normal capture producer, builds affordable frontline/support units, responds with legal available counters, keeps capturing forces, places producers away from hostile firing envelopes, and builds useful defensive Bunkers. It attacks only with a healthy mixed force of sufficient strength, returns to defense under pressure or army losses, and holds a 15-second regrouping window before another attack. Defensive commands use the same HQ/building-anchor APIs as the human player.

Research requires its normal 20-tile commitment plus 8 free reserve. When its healthy army and active capturers can support it, the bot deliberately banks that budget instead of spending every 6 or 8 tiles on another building. Contact, depleted forces or blocked capture resume construction/defense; home pressure cancels research and releases its temporary support. Upgrades require spare support and another living capturing force, avoiding blind retirement of its only capturer. Bot construction excludes unused Silo commitments; autonomous nuclear targeting is deferred.

All existing combat/economy/movement/build/production/capture/sight/HQ/artillery values are unchanged from r15. No free units, bonus territory, accelerated production or stat advantages. Bot thresholds live in tune.bot.heuristic and the debug pane. Legacy bot.attackAtMs/cardCycle remain for tuning/checkpoint compatibility but are unused by the new policy. New botOrderUntilMs checkpoint state is optional and defaults to 0 when absent. Two-human rooms still use bot:false.

## Key technical decisions

The strategy uses existing place/research/cancel/upgrade/target/anchor operations and normal loadout/resource checks. The player map is fully visible, so strategic composition observation does not change individual unit sight or add hidden information. Bot decisions run every 5 seconds; the first build has no artificial 5-second delay. Its strength estimate uses current unit health and commitment value, with separate attack/retreat thresholds to reduce command flipping. No new dependencies or paid services.

Verification: 107 core + 22 online = 129 tests pass; both scoped TypeScript and full repository TypeScript pass. Full repository and standalone builds pass. Existing hub warnings remain; the standalone main chunk is now about 1,602 KB raw and slightly exceeds its 1,600 KB warning threshold. Tests cover legal 14-resource mixed opening/normal construction, available counterchoices, protected placements, defensive anchor/research cancellation, saving with an 8-tile reserve and resumption of army spending, safe conversions, attack/depletion/regroup/re-attack, deterministic checkpoint/tick partition recovery and old v4 defaults. A new online regression confirms both human seats never receive bot construction/research/orders before or after recovery.

Repeatable normal-map scenarios exercise idle, two-infantry defense/rush, and mixed Infantry/Tank openings. The bot wins these scripted checks and switches back to defense after losses. In the long two-infantry rush scenario it legitimately banks research, starts T2 around 210.1s, completes at 240.1s and wins at 274.2s; no territory grants or altered combat tuning. These checks are not competitive-balance proof.

A new actual-command Brave test plays a mixed human opening, advances only the simulation clock, issues a real HQ attack at 90s, records both sides every 15 seconds, and verifies mixed bot construction/exclusive occupancy without browser errors on desktop and portrait touch. Screenshots inspected. Existing two-human local-Worker smoke passes placement/production, anchors, reconnect and enemy-command restrictions. CI includes this bot-enabled browser test and retains its report/screenshots. Published desktop/touch bot-enabled checks and published two-human smoke also pass without browser errors. Evidence outside Git: outputs/operation-c-bot-regression-final, outputs/operation-c-bot-online, outputs/operation-c-bot-hosted and outputs/operation-c-bot-hosted-online.

## Open questions

Use the stronger opponent to judge the existing r15 snowball balance before further numerical changes. Scripted wins do not establish fair matchup balance. The bot is a modest heuristic, not an optimized competitive agent; late-game nuclear targeting remains unimplemented. Existing unapproved HQ Mobilize/repair/economic proposals and minimum capturing-card validation are unchanged.

## Known issues

Exclusive occupancy can still cause congestion. Physical-device/cellular and high-concurrency performance remain unverified. Bot decision thresholds are provisional; unusually long artificial high-HP/no-progress scenarios can still stall technology. No difficulty levels or bot accounts are added.

## Next proposed step

Reload, choose VS BOT and compare an infantry-heavy opening with a mixed frontline/support opening. Watch whether a successful defense gives enough time to recapture and rebuild.
