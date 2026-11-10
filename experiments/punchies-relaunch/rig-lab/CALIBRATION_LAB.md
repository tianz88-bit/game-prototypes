# Character calibration lab — current reference

Open http://127.0.0.1:5338/ . Local experiment only. This document supersedes CURRENT_RIG.md's older experiment notes.

The approved Marco boxer is frozen in ../rig-calibration/marco-boxer/approved-2026-10-27.json, with renderer, geometry and planted-feet snapshots. The left puppet always uses this calibration. The API exposes the baseline read-only; saving drafts cannot replace it.

View mode shows the comparison and playback controls. Tune adds independent Down, Right, Left and Up offsets, horizontal side shifts, inspection zoom and diagnostics. Angles interpolate smoothly; depth switches at diagonal boundaries. Feet anchor the vertical stack. Torso retains native aspect ratio. Face and hair rotate as separate layers.

Choose Boxer or Casual to change the right puppet. Each has a separate disk-backed draft outside this app folder: ../punchies-rig-tuning-draft.json and ../punchies-rig-tuning-casual-draft.json. Changes autosave; Save tuning draft saves immediately. Preserve these files across app updates. Casual starts from the approved boxer tune. Drafts survive browser reloads and server restarts.

Casual is an art test awaiting user approval: blue sleeveless hoodie over cream tank, navy trousers, cream wraps and blue/cream trainers. Five generated sources and their exact prompts are in assets/casual/. Approved brown hair is reused. One hand and one shoe source are mirrored in code.

Future characters: add a rigProfiles.js entry, preload its textures and add a separate whitelisted draft file in server.mjs. Art contract: true overhead; torso and abdomen face right, hands knuckles-up, shoes toe-right, face/hair face down. Transparent padding is alpha-trimmed. Avoid painted neck stumps and long limbs; the rig supplies connectors. Define limb material in the profile.

Validation: syntax passed; all assets rendered; Tune/View switches work; casual test offset saved independently, restored after outfit switch, reverted and survived reload. Both calibration sets match the approved seed; renderer snapshot hash matches. Previous owned server stopped before replacement; one owned server on port 5338.
