# Before / after

**This contract has no runtime "after" to capture.** It ships no code, no
migration and no screen. Playwright and Maestro have nothing to point at, and
capturing a screenshot of a design document to satisfy a gate would be exactly
the fabricated attestation the governance forbids.

This file exists so that the `ui_governed: false` opt-out has an honest fallback:
if a future push ever carries this contract *and* UI code with no implementation
contract alongside it, gov-check refuses the opt-out and enforces Rule 4 — and it
finds a real answer here rather than an empty file.

## What was implemented

Nothing. Documents only.

## What changed, in the only sense that applies

| | Before | After |
|---|---|---|
| Organised by | tab — how the app is built | **action** — how it is used |
| A screen appears | in several files, described differently each time | **once**, at one address |
| Screens | 145 panels, overlapping | **109 screens**, no overlap, no gaps |
| Actions | not enumerated anywhere | **47**, each with steps, forks and both phones |
| Drift between documents | undetectable | **fails a check** |

## What diverged from the seven superseded files

Three things, all found by checking rather than by reading:

1. **Her Performance screen was dropped.** Restored as `SC-42`.
2. **`SA-04` drifted from its source** — the minimum shop posts is a number field
   (the source shows 5), not a 0–3 selector, and the final-payment wait applies to
   pay-for-content only. Both corrected to match.
3. **`SC-18` pointed at `BR-41`**, which does not exist. It meant the screen
   `SB-41`.

Nothing else was lost. All 45 source panel titles were extracted and matched one
by one against the two atlases; the four that did not match were each opened and
resolved (a brand screen, a backend rule, an admin panel, and the genuine gap
above).

## What to check

```
node features/screen-atlas/04-preview/build-index.js
node features/screen-atlas/04-preview/check-books.js
```

Both must exit 0. Run them after editing the Action Map or either atlas — they
will name what stopped lining up.
