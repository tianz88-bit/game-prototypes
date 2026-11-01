## Current milestone

Migrate the published multiplayer invite URL to daily-daily-games after the manual itch project copy.

## What was implemented

- Update lobby invite links to https://daily-daily-games.itch.io/suits-mp.
- Preserve the existing three-character codes and join-query format.
- Existing tutorial lesson-panel placement and game behavior are unchanged.

## Key technical decisions

- Keep invites pointed at the canonical itch page even from local or GitHub Pages previews.
- The copied page preserves published, unlisted and disable-new-downloads settings.

## Open questions

None for this URL-only change.

## Known issues

- Merge and upload are pending; the copied older package retains its old invite URL until the new build deploys.
- Post-migration multiplayer gameplay remains for the user's testing.

## Next proposed step

Merge the reviewed migration change, select its Butler browser channel, and test one invitation between players.
