## Current milestone
Local cab and livery review after public Kaiten Express release 12.

## What was implemented
Multi-car trains use the standard middle section for every trailing carriage. Heads have continuous paint across the deck. Single cars have dedicated one-windshield artwork in all directions. The orange signal is registered to the head lamp. Ten liveries use TrainDef.color. The original full-colour sushi is served one variety per train on compact plates. The HUD counts remaining trains and the first tutorial explains the goal.

## Key technical decisions
The two five-colour sheets are precomputed from the shaded family. Window glass, the teal head stripe and the existing warm-plum outline keep their original treatment. Runtime derives socket frames from the base sheet and uses the existing batched shine. Art files are supplied through the loose asset pipeline. This is a presentation update.

## Open questions
Owner review of the new liveries and cargo balance on a phone.

## Known issues
Physical device performance has not been measured for this revision.

## Next proposed step
Review the Kyoto Crossing capture before authorizing a new public release.
