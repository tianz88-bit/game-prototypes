## Current milestone
Preserve edited ship positions through calibration export and import.

## What was implemented
Import accepts both calibration-only exports and full settings exports. Calibration imports preserve current game stats and publishing baseline, validate all module poses before applying, and refresh the displayed rig. Invalid files leave the current draft intact. The same file can be selected again after an import.

## Key technical decisions
Calibration-only files are merged into the current draft rather than interpreted as full settings. Authored offsets are preserved exactly; Y sign and parent offsets are unchanged. Full settings retain their existing validation and migration path.

## Open questions
None for the import repair.

## Known issues
The private publisher was stopped at the owner's request. No memory leak or CPU-spike cause has been established, and the publisher will remain off. Publishing requires deliberately starting it again.

## Next proposed step
Import the edited calibration in the permanent public lab and verify the four cockpit poses before any future publish.
