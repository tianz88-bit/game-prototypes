## Current milestone

Production ship/building selector is live. Open https://tianz88-bit.github.io/game-prototypes/prototypes/steroids-alpha-lab/?review=sparrow . PR519 merged82868368; Pages43892666498 succeeded.

## What was implemented

Ship / building dropdown above the preview offers Sparrow, Bat, Battlecruiser, Nexus, tower turrets and Falcon live rigs. Embedded production renderer has rotation, firing, headings, palettes/clans, control tilt and gun-origin markers. The original Falcon draft calibration editor remains available as the first choice. Existing hosted owner publishing is unchanged.

## Key technical decisions

Production review reads live settings once and never connects a game room, grants equipment or publishes. Calibration loop sleeps and its editor is hidden during review. One frame is reused across subjects, then unmounted on return; draft values are preserved. Checked same-origin parent messages choose only allowlisted subjects or exit. Direct ?review=<subject> links open the selected model.

## Open questions

Owner visual review. Screen capture and recording were explicitly stopped by the owner; none were used for this task.

## Known issues

Other ship/building selections are production reviews, not editable per-profile calibration drafts. Public desktop/mobile checks are browser emulation, not physical-phone evidence. Hosted sign-in/publish was not exercised in this task.

## Next proposed step

Use the selector to inspect production rigs and mount origins, then return to Falcon draft calibration for existing tuning/publishing. Collect owner feedback before further rig changes. No resident local publisher or temporary QA service runs.
