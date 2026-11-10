# Persistent local tuning draft

Draft file: `../punchies-rig-tuning-draft.json` (outside this app folder).

The app loads that file before creating its controls/rig. Offset sliders autosave after a brief pause and on release; Save tuning draft writes immediately. Zoom and head construction are also saved. Down, side and up remain independent. Browser restarts and server/code updates do not clear the file. Future app replacements must preserve this sibling file.

The local-only server reads/writes through `/api/tuning`. Writes accept only validated numeric offsets and known display settings, with a 16 KiB request cap and atomic file replacement. No external service or account is used.

Side-only horizontal calibration is also persisted as `sideX` for abdomen, torso, head and hair. Values are relative to the preceding layer; their cumulative shift is multiplied by facing X. This mirrors the corrections at left-facing and fades them to zero at up/down. Original version-1 drafts load with zero horizontal correction; older clients missing these fields preserve an existing saved correction.

Current extension: left now has an independent `offsets.left` and `leftX`, while `offsets.side` and `sideX` represent right. Old drafts migrate by copying right vertical gaps and negating right X shifts for the initial left preset. Thereafter both sides save independently. Horizontal controls are signed screen-X offsets, relative to the previous layer. Each side fades to zero at up/down; four-direction vertical interpolation passes through the appropriate left or right preset.

Verified end to end: changed a slider from 4 to 4.1, read 4.1 on disk, stopped the server, started one replacement, reloaded the app and saw 4.1 restored. Returned the test value to 4 and saved it.
