## Current milestone

Combined anti-rush balance, 2026-11-03. Published preview: https://operation-c-online.tianz-88.workers.dev/ . Automatic version 031126r0015; Worker deployment 53ca8e81-f5cb-43a9-8100-2c711a7dcb38. Protocol/checkpoints remain v4. Reload both clients and create a NEW room for the new numeric tuning. PR #414 remains the review branch; GitHub Pages and unrelated deployments are unchanged.

## What was implemented

Barracks/Recon Post now commit 6 tiles, Support Barracks 7, and Armoury total 8 (upgrade +2). Flak remains 6; Motor Pool/Artillery/Bunker remain 8. Advanced commitments and construction/production timers are unchanged. First units still spawn on completed construction with a legal tile; no additional initial production delay. Opening 18 productive cells can support three Barracks at most if all support is available, rather than four at the former price.

Full-squad neutral capture takes 4s, enemy-owned capture 6s. Infantry/Missile/Machine-gun capture strength scales with surviving members / configured squad size, not remaining member HP. Five members 100%, three 60%, one 20%. Incoming visual reinforcements contribute only after merging. Vehicle capture strengths and HQ pressure rate remain unchanged. Inspectors show current capture percentage and catalog notes explain scaling.

HQ health increases to 650 with an 8-damage single-target ground gun every second at range 2. Field Artillery direct damage is 4 per squad member and adjacent splash remains 35% (1.4), so two direct hits wipe fresh basic infantry. Artillery retains 38 HP, minimum range 2, slow movement, 1.8s cadence and damage-triggered retreat. Close Recon/Tank remain counters.

Defend/Expand pursues visible valid enemy units but does not chase out-of-range structures. In-range structures may still be fired on. Distant structures no longer interrupt vehicle capture. Attack-HQ commands retain strategic navigation and structure pursuit. Existing individual sight, capture priority, friendly movement, commitment lifecycle, nuclear rules and all prior utility behavior remain.

## Key technical decisions

Existing splash logic supports artillery's two-hit damage; only its tuned damage changes. Capture pressure multiplies base captureRate by positive living members / configured squad size. Passive acquisition filters structures against the actual weapon band; explicit Attack orders retain sight-based acquisition. No new dependencies, protocol or checkpoint format changes. Existing v4 checkpoints retain their old numeric tuning while the member-scaling and command fixes apply; start a new room for consistent current balance.

Verification: 99 core +21 online =120 tests pass. Tests cover real opening support budgets (14 mixed vs12 double Barracks), unchanged first-spawn timing; all three squad types with1..5 healthy/wounded members on neutral/enemy land;4/6s full versus20/30s one-member capture; producer-linked reinforcement merge without healing; passive structure firing versus Attack pursuit across11mobile forms; two-hit direct artillery/outer falloff; live open-map adjacent Recon/Tank defeating artillery without receiving fire; HQ surviving and clearing two/three fresh adjacent squads without support; old v4 numeric tuning recovery and both authoritative client mirrors. Scoped client/server and full repository TypeScript pass. Full repository and standalone builds pass with pre-existing unrelated hub warnings. All four isolated Brave layouts pass the gameplay flow with no console/page errors; desktop catalog, portrait and small-landscape capture inspector screenshots inspected. A real two-client mixed Infantry/Tank/Artillery match completed at97.8s with identical final worlds. Published two-client smoke checks also pass placement/production, building anchors, reconnect and enemy-command restrictions without browser errors. Evidence outside Git: outputs/operation-c-antirush-regression, outputs/operation-c-antirush-online and outputs/operation-c-antirush-hosted.

## Open questions

All requested rules in this pass are implemented. Exact costs, capture pace and artillery damage remain playtest settings. HQ survival in the tested small rush scenarios does not grant immunity to larger supported attacks. Minimum T1 ground-producer capture validation and earlier HQ Mobilize/repair/economic proposals remain unchanged and unapproved.

## Known issues

Automated scenarios establish behavior rather than competitive balance. Exclusive hex occupancy can cause congestion. Physical-device/cellular and high-concurrency performance remain unverified. Existing rooms keep old numbers and should be replaced for this playtest.

## Next proposed step

Play a fresh room comparing double Barracks with mixed openings. Watch expansion after squad casualties, Recon behavior in Defend/Expand, artillery screen requirements and time gained by HQ defense.
