## Current milestone

BRIEF.md rewritten for the Japanese-train concept and waiting for approval. No code
yet.

## What was implemented

- `prototypes/chain-slide/BRIEF.md` (draft): station yard with drawn tracks, tap a
  train to run it along its track, chain reactions between trains on the same line,
  send every train off the screen within par taps, solver-verified generated
  levels built backwards from an empty yard, fair adaptive difficulty, opt-in
  rewarded ads behind a mock provider, retention features, scope order.

## Key technical decisions

- Stack: Phaser 3, TypeScript, Vite, with `dig-kit` pinned to an exact version for
  the pillow look, sounds, buttons, intents and tune panel.
- Levels come from a backwards generator plus a solver, not from an LLM.
- Ads are rewarded and opt-in only in v1, behind one provider interface, with a
  mock for the prototype. A real SDK or wrapper needs approval first.
- Worked on branch `ccr-1e26354f-01jcy9`, restarted from `main` after PR #388.

## Open questions

- Chain rule (only same-line head-to-tail chains, proposed), either-way input
  (tap when one way is open, swipe or two arrows otherwise), the name, client
  hosting, and the real ad SDK. All in BRIEF.md.
- BRIEF.md was drafted from a discussion, not written by the user, so it needs a
  review before building. The brief says "Track Jam" while the folder is still
  `chain-slide`.

## Known issues

None yet.

## Next proposed step

Approve or change BRIEF.md, then build scope step 1 (core rules, about 10
hand-made levels and the feel pass).
