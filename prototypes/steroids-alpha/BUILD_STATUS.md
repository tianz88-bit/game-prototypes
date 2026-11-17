## Current milestone

HUD space/readability, stronger ram VFX and tutorial arrows are LIVE in171126r0097. Main PR544 merged864906e6edcd45d06d270c19f417d41f91847aa6; narrow-header follow-up PR545 mergedea2d987536f0db3b1790038d1277c9cfc2fbabe0. Final itch44041634549 and Pages44041634523 succeeded; existing Worker protocol25 healthy. Public game: https://daily-daily-games.itch.io/steroids-alpha . Owner approved go-live and a deferred Claude backlog.

## What was implemented

PC upgrades are collapsed by default: B/click opens,1–6 still quick-buy. Tab expands compact rankings with your own row pinned; hold H for controls. The shared header exposes MIN and level, separates SALVAGE bank-on-warp from home FUEL, and retains exact hull values inside the shop. Mobile counts sit inside ordnance badges, while Fire/Dash radii and hit factors remain unchanged. Combat controls pack more tightly on narrow screens and stack on tall foldable layouts. Secondary panels clear their hitboxes; mobile stats limit rows to available space.

Warzone keeps ATTACK/DEFEND, timer/tickets and objective health in a dedicated header. Incoming missile, critical hull, overheat and friendly-shield fire-block notices share a priority slot; contextual/arrival hints yield and use a bottom slot. War-locked Warp now says so. Manual-fire prediction respects the existing server shield rule.

Active rams show thick curved orange-white pressure ribbons and swept hot fragments, replacing the UI chevron. Ram impacts have a larger crash burst. Tutorial arrows mark visible and offscreen rings, rocks, minerals, gates and ram targets, plus the shop button, an affordable upgrade card and Warp. Warp action arrow disappears once travel starts.

## Key technical decisions

hudLayout is pure shared geometry. Flight uses the existing mobilePanel on PC too; no new gameplay mode, wire/event schema, movement/combat/economy tuning, asset pack or particle emitter. Existing ship meters, speed VFX, recovery animations and four-step tutorial logic remain. Client shield suppression mirrors existing authority. Warzone text objects reset on rebuild.

Type/build/rig/building/sim/config checks pass. New CI geometry tests enforce control hit targets and separation and verify ram ribbons/fragments have no pointer/chevron. Seven local plus seven public Brave DPR2 PC/compact/mobile/tall/portrait UI cases pass: closed quick buys, B/Tab/H, minerals/cargo/level, pinned own row, embedded counts, shop clearance, role/warp lock, shield suppression and alert priority. All seven objective/urgent slots are separated. Three local plus three public full tutorial routes pass with every objective-arrow kind and actual ram/extraction. Two additional local and two final-public narrow desktop/touch cases verify objective text fits beside expanded panels. Main UI/tutorial checks used96; final label-fit/version checks used97. Zero page errors; no captures/recording/public-room fixture writes. Evidence outputs/steroids-alpha/hud-space-ram-objectives/.

## Open questions

None for release; owner should judge the ram's visual force in play.

## Known issues

Physical-phone/Safari visuals not inspected. Existing unrelated build warnings remain.

## Next proposed step

Collect owner live feedback, especially the ram effect. CLAUDE_BACKLOG.md contains deferred seams and release proof; no immediate Claude execution/review needed. Vite4187 stopped; no resident publisher/capture service.
