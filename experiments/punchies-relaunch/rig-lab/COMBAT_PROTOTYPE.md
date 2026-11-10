# Free-facing combat training prototype

Open http://127.0.0.1:5338/?combat=1 . The root rig lab links here and retains its original Tune/View modes. This is a local playable prototype; no production game files or saved calibrations are overwritten.

## Controls

- Movement stick, WASD/arrows or Xbox left stick: move and face the input direction. Neutral retains facing and guards the front 136.8-degree arc, reducing damage by 65%.
- Deliberate movement followed by neutral opens a 100 ms Perfect Guard window. A frontal hit in this window deals zero damage and staggers the attacker for 500 ms. Guard rearming requires movement; flicks and dodge recovery do not refresh it.
- Neutral → direction → neutral in 160 ms triggers a directional dodge on returning to neutral. Dodge travels for 180 ms, is invulnerable for its first 110 ms, and has a 620 ms penalty from initiation. Movement is 40% speed during the remaining penalty, and another dodge is disabled.
- Tap Attack / J / Xbox A: jab with limited assistance (within 30 degrees in front, within 180 scene pixels). No automatic target lock or turning toward enemies behind the player.
- Hold 180 ms: lower guard and enter cross aiming. Drag the attack button, point the mouse over the arena, or use Xbox right stick. Release to cross. Moving while aiming is allowed at 65% speed. Facing commits during a strike.
- A jab blocked by normal guard opens a 750 ms hook opportunity. The next tap becomes a hook that bypasses normal guard; it can be queued during jab recovery. Perfect Guard can still stop hooks.
- Separate Super / Space / Xbox B: three confirmed unblocked hits charge Rising Upper. Activation spends three stars; the upper bypasses normal guard. This is the first placeholder super, not the production roster's character-specific supers.

## Test setup

Casual Marco moves freely. The wooden dummy stays fixed and can track the player or face a chosen cardinal direction. Modes: passive, normal frontal guard, telegraphed jab, cross or mixed attacks. Orange windup marks incoming attacks. Blue guard arc, gold Perfect Guard cue, impact sparks and damage counters show results. Both health meters stop at zero; Reset restores the practice setup. Repeated punches fatigue (up to four stacks, ×0.88 damage per repeat); no stamina system is active.

The collision model uses the same fist path, pixel offsets and facing as the visible rig. All logic steps at 60 Hz. Rig transforms, per-actor guard poses and calibration are independent; the dummy has no translation or legs. Assets and cached oval arm textures are reused. No extra server was started.

## Validation

`node combatModel.test.mjs` covers tap/hold selection, cross direction, flick invulnerability/penalty, guard rearming, Perfect Guard stagger, blocked-jab hook opportunity, rear guard bypass and immortal stationary dummy.

Live browser checks confirmed an 8-damage jab, held cross, flick dodge, Perfect Guard with zero received damage, blocked jab followed by an unblocked hook, and three-star Super activation. Xbox bindings are implemented but were not verified on physical controller hardware. Touch pointer controls are implemented; final phone feel is for hands-on testing.

## Walking and post-punch stance recovery

Combat Marco now uses a normal walking gait: narrower parallel foot placement with little toe-out and no boxing lead/rear stagger while travelling. Alternating planted steps use a 230 ms swing and 45 ms landing gap. After movement stops, feet take 170 ms settling steps back into the calibrated staggered fighting stance. The rig lab and frozen boxer reference keep their original stepping settings.

After the final punch's own recovery completes, guard remains unavailable for another 250 ms. Movement and new punches remain available. Another punch extends this downtime. Waiting for guard to return does not grant Perfect Guard; deliberate movement-to-neutral timing is still required, and cannot bypass the post-punch guard delay. Verified through model tests and the live Recovering stance → Guard transition.

## Faster forward steps and dash presentation

Normal walking foot plants now bias forward with a longer movement prediction, reducing the trailing-leg look. Step exchange timing is doubled: 115 ms swing / 22.5 ms landing gap, with 85 ms stance settling. The frozen rig lab remains unchanged.

Flick dodges now use a tucked-arm pose, forward torso/head offset and braced lifted feet, rather than playing the walking cycle. Five short direction-aligned speed lines replace the dodge ellipse. Four pooled afterimages copy the already-loaded sprite/arm transforms every 40 ms and fade within 200 ms. No texture snapshots, new art downloads, emitter allocations or per-dash sprite creation. Dash duration, invulnerability, distance and guard recovery rules are unchanged.

## Mobile offence and charge revisions

Movement continues during jab, cross, hook and Super execution. Each punch stores its release/start angle and keeps that angle for its lifetime; movement input does not steer the committed attack. Touch dragging beyond 12 pixels marks an aimed attack, so a short flick/release throws a base-power cross without waiting for the hold threshold. Mouse/right-stick aim can also explicitly select a quick cross.

Holding Attack for 180 ms starts cross charging. Power rises linearly for one further second, capped at +50% damage (base 14 → 21 before fatigue). Release locks in direction and power. Any incoming connected attack cancels the held charge; releasing the old press afterward does not fire. A movement flick can cancel held charge directly into the normal directional dash. Releasing movement after a longer walk while holding a charge does not automatically cancel it; stop, then flick to dash. Super activation also clears a held charge.

Verified with model tests for moving committed punches, short aimed crosses, capped/partial charge power, hit cancellation and dash cancellation. Browser checks confirmed 21 damage from a full charge, and a connected dummy attack cancelling charge with no late cross on release.
