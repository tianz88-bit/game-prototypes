## Current milestone

Rich-asteroid crystal hit/split VFX are LIVE in171126r0089. PR533 merged23cf3aecddbeaee827a7732cb3c9243884c4afa5. Itch44014921428 and Pages44014921281 succeeded; existing Worker protocol24 healthy. Game: https://daily-daily-games.itch.io/steroids-alpha . Existing crystal art retained, no new bitmap/R2 upload.

## What was implemented

Rich asteroid hits eject2–3 small painted gold chips plus12 short rectangular sparks. Destruction/split scatters6/9/12 painted crystal pieces for small/medium/large rocks, with32/38/44 gold sparks, wider outward trajectories, spin and a height arc. Pieces inherit asteroid drift, then fade within0.7/1.3seconds. Existing stone fracture effects and real collectible minerals remain separate. Reuses approved mineral-shard/cluster textures; no extra asset download.

## Key technical decisions

NetClient observes rich HP decreases and existing GONE records, emitting local NetFx crystal hit/split events. Initial spawns, duplicate/same HP, healing and ordinary rocks do not trigger gold VFX; duplicate GONE is ignored after map deletion. Child spawns are not extra hits. Server wire/protocol24, sim, collision/HP/rewards/mineral collection unchanged. Flight renders once from the existing FX drain and retains generic rock break effects.

CrystalChips caps at16 bursts and128 pooled images, prioritizes split showers over old hit bursts and uses one spark Graphics batch. No physics/pickup objects, emitters, timers or permanent particle sources. Scene rebuild/shutdown destroys resources. Pure chip trajectory supplies rotation, inherited drift, projected ground position, fake height and fade. Effects use existing planet projection, keeping wrapped positions consistent.

Typecheck/build/rig regressions and chip trigger/count/expiry/velocity tests pass.8 local and8 public Brave desktop/mobile DPR2 runtime cases exercise all3 sizes plus stress, canonical NetClient handle→FX drain→Flight renderer, hit/split once only, child spawn suppression, ordinary-rock exclusion, expiry and16/128 budget. Zero page/console errors. Real beta sockets close before local packet fixtures; no test stats sent. Evidence outputs/steroids-alpha/crystal-chip-vfx/{runtime-check,public-runtime-check,live-game}.json. Public client verifies version89 and existing crystal body registration. No screenshots/recording.

## Open questions

None; continuing direct-publication preference.

## Known issues

Physical-phone/Safari visuals not checked; Brave mobile emulation only. Existing unrelated build warnings remain.

## Next proposed step

Collect live feedback. Claude receives PR/run/seam/public-check proof in Agent Comms threade31061e9-e8e1-4105-858a-2f847541014a. Temporary Vite4187 stopped after release; no resident publisher or capture service.
