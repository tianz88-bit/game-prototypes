## Current milestone

Progression playtest build, 2026-11-02. Live build 021126r0008: https://tianz88-bit.github.io/game-prototypes/prototypes/operation-c/?v=021126r0008 . Local production preview remains http://127.0.0.1:5188/ . Start at the loadout screen, then play the two-HQ human-versus-bot game. This milestone replaces the long design-question sequence with a concrete build using documented provisional defaults. Owner explicitly approved merge. PR #410 was squash-merged as e8afa8d69eaec08feedca710c1f46133d9619620. Pages run 41370320985 published successfully; Current WIP deployment was skipped by the scope guard.

## What was implemented

Base-only loadout selection (six available, up to eight unique, at least one T1 ground producer), base/upgrade stat previews, tier restrictions and T1/T2/T3 research. The top research control reserves 20 open cells for 30s to T2 or 60s to T3; clicking cancels. Research holds full temporary commitment through loss and releases it on completion/cancel.

Timed, vulnerable full-HP construction; first spawn on completion/legal cell; production cooldown on actual spawn. Sell restores the open tile and retires forces. Enemy destruction burns the tile and leaves living orphans. Both release only surviving assignments, with lost support retained as stranded debt. Upgrade support can be disconnected and shows arrows; research shows bobbing flasks; ordinary committed cells are dark owner colour without locks.

Permanent Armoury (+2, 5s) and Bomber Airfield (T3, no surcharge, 8s) conversions retire current forces/incoming reinforcements, pause production, preserve HP and spawn the new type on completion. Cancel releases only surviving upgrade assignments, loses progress and starts a fresh full base cooldown. Six base producers/eight unit forms include Missile Infantry, Bombers and splash MLRS.

Five-member infantry squads use individual HP/damage, one shared target, single-hit damage without spillover and multi-member splash. Visual-only reinforcements count living/in-flight members toward five, add full-HP members without healing survivors and vanish if the target squad dies. The right-side BUILD/DETAILS panel keeps inspection attached to the selected entity as it moves. Phone and desktop layouts preserve two-tap hammer confirmation, upright/mirrored units, actual-shot traces and capture flips.

## Key technical decisions

Pure fixed-step rules and validated commands remain independent of Phaser. Research, construction, conversion, stranded debt and reinforcement state are simulation data. Cosmetic retirement events are bounded and rendered as a 650ms retreat/fade. No per-member GameObjects, new dependencies or runtime art downloads. The bot researches, upgrades and skips locked cards.

Provisional defaults are listed in BRIEF.md and tune.json: infantry 5×8HP/2damage; missile 5×7HP/4damage; Bomber 100HP/45damage; MLRS cost16, 80HP, damage30, range3-5, radius-one enemy-only splash with half adjacent damage; synchronized member attack clocks; fixed squad capture strength; reinforcement travel 250ms/hex (minimum500ms). Selling is immediate. Producer destruction permits already dispatched members to reach a living orphan. Retiring a capturer triggers rollback. These are playtest choices, not final balance decisions.

Verification: 46 deterministic behavior tests pass, including lifecycle tick-partition invariance, discounted debt versus full research release, construction/upgrade interruption, no-heal members, target-squad wipe and T3 bot progression. Scoped/full TypeScript and hub/standalone production builds pass. Standalone production progression checks pass Brave desktop 1440x900, portrait 390x844 and landscape 844x390/667x375 with no console errors. Screenshots inspected for loadout stats, persistent inspector, construction, arrows/flasks and conversions. A normal-clock Brave portrait recording (no virtual advance/freeze) confirms loadout to timed construction to a five-member squad, with no page errors. Post-publication checks against the actual live URL pass all four Brave profiles through the full progression flow with no console/page errors.

## Open questions

Playtest the implementation before more rules discussion. Remaining full-game work is multiplayer, six-player geography and three race catalogs. Provisional numeric balance, splash and reinforcement defaults are deliberately available for adjustment. All confirmed rules and design history are in BRIEF.md; do not re-ask settled lifecycle questions.

## Known issues

Local two-HQ sandbox only. Physical phones and long-session performance are not yet verified. One shared air/ground slot intentionally permits congestion. Reduced-motion preference suppresses capture flips. Existing hub build warnings concern legacy chunk sizes/Punchies imports; builds pass. The free-slot limit is eight but the present catalog has only six base cards; Armoury/Bomber are building options, not selectable cards. Hosted Pages serves the progression milestone as 021126r0008, verified from the actual game stamp.

## Next proposed step

Playtest the published progression milestone and adjust documented provisional balance from feedback. PR #410 is merged and published with explicit approval. Unrelated work remains outside scope.
