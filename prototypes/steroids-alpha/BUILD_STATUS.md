## Current milestone

HUD space/readability, stronger ram attack VFX and tutorial objective arrows are implemented for release. Owner approved go-live and a deferred Claude backlog.

## What was implemented

PC upgrades are collapsed by default: B/click opens,1–6 still quick-buy. Tab expands compact rankings with your own row pinned; hold H for controls. The shared header exposes MIN and level, separates SALVAGE bank-on-warp from home FUEL, and retains exact hull values inside the shop. Mobile counts sit inside ordnance badges, while Fire/Dash radii and hit factors remain unchanged. Combat controls pack more tightly on narrow screens and stack on tall foldable layouts. Secondary panels clear their hitboxes; mobile stats limit rows to available space.

Warzone keeps ATTACK/DEFEND, timer/tickets and objective health in a dedicated header. Incoming missile, critical hull, overheat and friendly-shield fire-block notices share a priority slot; contextual/arrival hints yield and use a bottom slot. War-locked Warp now says so. Manual-fire prediction respects the existing server shield rule.

Active rams show thick curved orange-white pressure ribbons and swept hot fragments, replacing the UI chevron. Ram impacts have a larger crash burst. Tutorial arrows mark visible and offscreen rings, rocks, minerals, gates and ram targets, plus the shop button, an affordable upgrade card and Warp. Warp action arrow disappears once travel starts.

## Key technical decisions

hudLayout is pure shared geometry. Flight uses the existing mobilePanel on PC too; no new gameplay mode, wire/event schema, movement/combat/economy tuning, asset pack or particle emitter. Existing ship meters, speed VFX, recovery animations and four-step tutorial logic remain. Client shield suppression mirrors existing authority. Warzone text objects reset on rebuild.

Type/build/rig/building/sim/config checks pass. New CI geometry tests enforce control hit targets and separation and verify ram ribbons/fragments have no pointer/chevron. Seven Brave DPR2 PC/compact/mobile/tall/portrait UI cases pass: closed quick buys, B/Tab/H, minerals/cargo/level, pinned own row, embedded counts, shop clearance, role/warp lock, shield suppression and alert priority. All seven objective/urgent slots are separated. Three full tutorial routes pass with every objective-arrow kind and actual ram/extraction. Zero page errors; no captures/recording/public-room fixture writes. Evidence outputs/steroids-alpha/hud-space-ram-objectives/.

## Open questions

None for release; owner should judge the ram's visual force in play.

## Known issues

Physical-phone/Safari visuals not inspected. Existing unrelated build warnings remain.

## Next proposed step

Publish and verify the public UI/tutorial cases, then stop Vite4187. Keep CLAUDE_BACKLOG.md ready for later sync; no immediate Claude execution/review or resident publisher/capture service.
