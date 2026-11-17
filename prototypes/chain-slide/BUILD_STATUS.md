## Current milestone

BRIEF.md drafted and waiting for approval. No code yet.

## What was implemented

- `prototypes/chain-slide/BRIEF.md` (draft): concept, move rules, solver-verified
  generated levels, fair adaptive difficulty ("flow director"), opt-in rewarded ads
  behind a mock provider, retention features, scope order.

## Key technical decisions

- Stack: Phaser 3, TypeScript, Vite, with `dig-kit` pinned to an exact version for
  the pillow-block look, sounds, buttons, intents and tune panel.
- Levels come from a generator plus a solver, not from an LLM. An LLM is only for
  flavor and tuning suggestions.
- Ads are rewarded and opt-in only in v1, behind one provider interface, with a
  mock for the prototype. A real SDK or mobile wrapper needs approval first.
- Worked on branch `ccr-1e26354f-01jcy9`, restarted from `main` after PR #388.

## Open questions

- Name, win condition (clear all blocks proposed), number of colors, and the real
  ad SDK or wrapper. All listed in BRIEF.md.
- BRIEF.md was drafted from a discussion, not written by the user, so it needs a
  review before building.

## Known issues

None yet.

## Next proposed step

Approve or change BRIEF.md, then build scope step 1 (core rules, about 10
hand-made levels and the feel pass).
