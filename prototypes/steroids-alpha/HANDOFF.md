# HANDOFF (newest first, max 15; format in COLLAB.md)

## 2026-11-28 claude perk balance, levels, cruisers, disconnects, Warzone allies (protocol 36)
DID: Owner 21 Nov.
- Levels: steeper curve (10 + 8 per level). All collected minerals count as XP, even past a full hold. Hold is 50 + 65 per level.
- Shield is passive: +4 per level for the first 16 levels. The shield card is gone.
- Weapon tiers each add about +3 DPS: guns +6.5% damage per tier, drone 1.2 damage per shot, missiles reload in refillSeconds 12 / tier, mines in 14 / tier. Live mines are capped at the mine tier, oldest removed.
- Missile Cruiser: 45 degree alternating side launch for 0.2 s, missileDamageFactor 1.7, rangeFactor 1.7, reload 4.5 s per missile.
- Evolutions tuned to about +50% power on evolving: Battlecruiser and Missile Cruiser shieldFactor 1.8, Battlecruiser damage 0.8, Missile Cruiser gun 1.25, CIWS 2.5.
- Disconnects: 60 s window. A clean drop is safe at once (arrival protection); a drop with a hit in the 5 s before it stays exposed for 10 s. If the window expires after the warp lock, 50% of the cargo banks.
- Warzone: no friendly fire (World.allies). Ally names are green with "ALLY ·", enemy names red, and allies wear a green ring.
FILES: sim/ship.ts (levelsFromXp, passive shield, refill helpers), sim/levels.ts, sim/world.ts (allies, mine cap, side launch, xp), sim/pickups.ts, sim/liveConfig.ts (epoch 6), server/src/room.ts (disconnect rules, bot clan in roster), src/scenes/flight.ts (ally ring/names), src/render/hangarStats.ts, tune.json, scripts/measure-steroids-power-curve.mjs, tests.
SEAM: Protocol 36 (no layout change; forces refresh). shop.balanceVersion 6 migrates live records. missileCruiser.missileDamageFactor is new and separate from the gun damageFactor.
CROSS: All gates pass; a phone browser check of cards and HUD passed with no errors. The Warzone ally ring and names are untested in a browser (needs a live war); friendly fire and disconnects are covered by tests.
FOR codex: the ally ring is a plain green circle. Restyle freely, but keep green = ally and red = enemy.

## 2026-11-20 codex graphite menu preview
DID: Main menu, Hangar and planet chart share graphite surfaces and steel edges. Ship and Warp lead the landing screen. Hangar holds gold for evolutions and enlarges fighter previews in short cards.
FILES: Menu, Hangar, StellarMap, shared UI and ship preview rendering.
CROSS: Added a Warp In hit region that sends the same action as selecting the same globe again. Warzone join and auto-join rules are preserved.
FOR claude: Local preview for owner approval.

## 2026-11-20 codex neutral upgrade UI and foldable layout
DID: Graphite upgrade cards use faction-neutral equipment symbols, four tier pips and gold evolution faces. Flight buttons use the same palette, and the hold has one mineral total plus haul bonus and banking context. Open foldables can reflow upright during a run.
FILES: viewport/base/input resize, landing/HUD/card art, Flight and landing layout regression.
SEAM: LevelCardArt only draws. Existing card IDs, text effects, on-offer tap zones, multiplayer state and sim contracts stay intact.
CROSS: Flight UI/input reset and resize only. Full sim/config/rig and desktop/touch headless accept card picks; fold/open in one room at 344x848, 514x882, 673x881 and 740x670.
FOR claude: Owner approved release. Integrated PR604 before release so the new header and warp styling preserve the haul bonus and countdown.

## 2026-11-20 claude run economy, level cards and stick throttle (release PR)
DID: Owner approved going live 20 Nov. Minerals are the only run currency: salvage cargo is gone off home planets. Minerals carried out on warp bank at salvage.bankRate (home 0). Collected minerals are XP (never spent); each level offers 3 cards in a non-blocking top-left strip (tap or 1-3). Owned evolutions are guaranteed cards once ready, and evolving is free. Hold 50+40/level, weight slows up to 30%. Death drops the whole wallet; no kill payout; bots prefer loaded ships. Warp lock 90 s. Hangar prices unchanged. Mobile speed is back on the stick: centre brakes, middle cruises, edge accelerates; the +/- buttons are removed.
FILES: sim/levels.ts, world/ship/bots/protocol/liveConfig, server/src/room.ts, src/net/client.ts, src/scenes/flight.ts (card strip, nav, hints, results), src/render/combatHud.ts, src/input/intents.ts, src/tutorial/*, tune.json, client.tune.json, test gates.
SEAM: Protocol 35: ship records add f32 xp and u8 picks. Text frame {type:'cards',cards,picks} goes to the pilot. BUY(card, picks) is a pick (0-4 tracks, 10+build evolution). The room sets World.evolutionsOwned from bank unlocks. Economy epoch 5 migrates live records on parse. The pre-mission equip slot no longer gates evolutions (owned is enough).
CROSS: Typecheck/build; sim (incl. pickups/progression/capital/bot suites), bank, live-config and rig gates pass. Local Worker + preview browser check: DPR1 desktop and 844x390 phone layouts, a real card pick sent, stick speeds edge 350 / centre 140 / middle and release 260. Local console errors only for R2 art not fetched in the container.
FOR codex: Card art and a proper level-up flourish would help (the strip is plain panels now). The menu/hangar evolution equip slot is now redundant; owner to decide whether to remove it.

## 2026-11-20 codex Missile Cruiser cannon LIVE PR597
DID: Centered painted cannon over white nose; Sparrow firing behavior and independent missile trigger. Itch 201126r0110, Worker protocol34 and Pages lab live.
FILES: Shared ship/world/state, Cruiser rig art, HUD/controls, Evolution Lab and release proof.
SEAM: Protocol34 appends missile fire spacing independently of gun heat and ammo reload. Side 0 drives recoil at the center mount.
CROSS: Type/build/sim/config/bank/rig/lab, public Crimson and lab weapon smoke pass. Itch 44662655440, Worker 44662655259, Pages 44662655472.
FOR claude: Deferred. Current release in CLAUDE_BACKLOG and ../steroids-alpha-lab/centre-cannon-release-proof.json.

## 2026-11-20 codex centreline Missile Cruiser cannon
DID: Removed the right bow bay. The custom cannon sits over the white nose plating on the centreline.
FILES: Cruiser modules, calibration, manifest, shared muzzle and lab recoil.
SEAM: Side 0 drives the centre gun. Firing behavior, controls and protocol remain as in the candidate.
CROSS: Centreline muzzle coordinates and recoil check.
FOR claude: Latest candidate supersedes the right-sided and bay placements. It stages the earlier deck cannon asset pack.

## 2026-11-20 codex recessed Missile Cruiser bow bay
DID: Added a blue armored recess to the right bow. Its cheeks frame the gun and the rear plate meets the right hull panel.
FILES: Cruiser module stack, calibration and versioned asset pack, plus the muzzle offset in sim/chassis.ts.
SEAM: Gun recoils separately above the bay. Its muzzle moved with the art by 6.3 world units aft and 1.44 outward. Sparrow-style gun behavior retained.
CROSS: Shared muzzle location only. Art pack published to game-assets and verified by hash.
FOR claude: Candidate awaits release. Use manifest to stage the new bay automatically.

## 2026-11-20 codex Missile Cruiser deck cannon art
DID: Replaced the reused Sparrow sprite with a cruiser-specific deck cannon. Broad ivory muzzle, cobalt casing and orange mounting foot on the same right bow.
FILES: Missile Cruiser rig module, calibration and hash-verified asset manifest.
SEAM: Art only. The widened sprite keeps the existing muzzle position. Sparrow cadence, heat, drift and missile controls are unchanged.
CROSS: None.
FOR claude: Bow-gun candidate remains pending release. Revised source pack stored in game-assets. No gameplay changes in this pass.

## 2026-11-19 codex Missile Cruiser bow gun candidate
DID: One Sparrow-style cannon on the right bow. Gun uses normal Fire, missiles use their own button and retain hold-to-repeat. Evolution lab draws the production rig.
FILES: Cruiser asset manifest, mount and calibration, shared ship/world/protocol, controls/HUD, evolution lab and tests.
SEAM: Protocol34 appends missileFireCd to keep gun cooldown independent of missile spacing and ammo reload. Paired client/Worker release required.
CROSS: Ship input, sim/world, wire, and lab. Sparrow source PNG reused via the existing hash-verified asset staging. No new upload.
FOR claude: Pending release. Gun has Sparrow cadence, heat and drift. Missile payload, refill, and cruiser ram damage preserve their own tuning.

## 2026-11-19 codex combined LIVE release PR588
DID: Itch r0109/Worker protocol33/Pages deployed. Bat now has Falcon primary damage and its existing shields and agility. Also shipped pickups, tutorial, missile fixes, economy and fighter shields.
FILES: Pickup art manifest/render/HUD, local tutorial, room/sim/net, tune/live config and lab. Release proof in ../steroids-alpha-lab/combined-release-proof.json.
SEAM: Protocol33 paired release, authoritative pickup motion and fuel metadata; economy epoch4 migration; Bat parity, independent resource budgets and cruiser refill scoped to each chassis.
CROSS: Local type/build/sim/config/bank/rig/evolution checks, actual Room browser fixtures, and public checks. Itch/Worker/Pages runs 44475904101/44475903983/44475904099 all succeeded.
FOR claude: Deferred backlog summarizes the released values and links the proof. Owner will sync later.

## 2026-11-19 codex simplified mineral prices
DID: All upgrade tracks use 1/2/3/4 minerals, either evolution costs 10, HUD shows fractional minerals, and hull spills scale to the smaller wallet.
FILES: Tune, World, live config, HUD, evolution lab and focused regressions.
SEAM: Economy epoch4 moves older shop prices, asteroid income and hull spill into the smaller denomination. Credits and cargo mining are separate.
CROSS: Test both cruiser paths and rebuild the client/lab. Bat stats left for balance discussion.
FOR claude: Deferred. Candidate branch includes pickup, missile, tutorial and shield changes.

## 2026-11-19 codex economy and starting shield candidate
DID: Asteroid minerals −30%; tier prices 4/8/13/17 and in-run evolution 40. Sparrow/Falcon have 75 shield, Bat 52.5, all fighters 50 hull.
FILES: Tune, shared World/ship/config, evolution lab and balance/pickup/sim regressions.
SEAM: Economy epoch3 migrates epoch2 buy prices and evolution entry; fighter shield bonus uses shared maxShield and current regen cap. Mining factor scales minerals independently of resource cargo.
CROSS: Type/build, sim/config/bank/evolution and 10 matched seeds per goal. Median first purchase 6.25→7.5s, full shop 139→155s, owned cruisers ~70→79s.
FOR claude: Deferred. Perfect-hit max Falcon vs fresh Sparrow 1.07→1.33s. Candidate only; included in paired release branch.

## 2026-11-19 codex missile fixes
DID: Fighters launch from desktop/touch HUD or keyboard even when a late input is discarded. Artillery turns sooner after launch and returns forward with no lock. Cruiser reload is 12s per missile.
FILES: Room, ship/world/live config, intents/Flight, evolution lab and capital regression.
SEAM: Shared chassis-dependent refill for prediction/authority/HUD. New config factor upgrades earlier artillery records once. Wire layout is unchanged.
CROSS: Build/typecheck, full simulation, live config, evolution lab and real browser controls pass.
FOR claude: Deferred. Progression and fighter base stats are discussion only. Candidate includes the prior tutorial and pickup work.

## 2026-11-19 codex tutorial revision
DID: Four short lessons now require braking and accelerating through gates, shooting the marked rock, taking its ore, buying an upgrade, ramming after both gates in one dash, and completing warp out.
FILES: TutorialGuide, Room, World practice rock, Flight guidance, and tutorial simulation regression.
SEAM: Local Room exposes a per-tick tutorial observer with real World events. Tutorial progress no longer depends on render frames.
CROSS: Tutorial-only world and room changes plus regression coverage. No additional wire fields.
FOR claude: Deferred. Tutorial is on the resource pickups candidate branch. See CLAUDE_BACKLOG.md.

## 2026-11-19 codex resource pickup candidate
DID: Separate mineral/cargo drops, painted purple salvage and cyan fuel, matching icons and bounded authoritative magnet. Tested candidate, not live; unchanged mineral prices/generated totals.
FILES: sim/pickups/world/liveConfig/protocol33, room/client, combat render/HUD/Flight, resource manifest/prep, lab draft/proof and pickup gate.
SEAM: fuel PickupKind, mined metadata and optional pickups.move payload; snapshot-coalesced authority, wrapped interpolation. Paired client/Worker release required; no D1 migration.
CROSS: minimal sim/net/server/tune/tests for explicit separate-drop choice. Type/build/sim/config/bank/rig pass;3 DPR2 headless layouts,400 pooled sprites, stable textures. No capture/live writes.
FOR claude: deferred; read CLAUDE_BACKLOG pickup section. Preserve ownership/capacity/spill locks and prices. Prior bundled-cargo pace results are historical.

