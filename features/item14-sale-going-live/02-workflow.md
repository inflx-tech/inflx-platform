# item14-sale-going-live — workflow

The item loop: **rules → mockups → lock → gap check → build and test.** No governed code until
`lock.json` has `approved` and the three `mockup_locked*` fields set.

## Step 1 — rules (done 30 Sep 2026)
Founder decisions D1–D5 in `01-spec.md`. The rules are written into the master business rules as
**v1.30 (items 14 and 15 only)** after the mockup lock, not before.

## Step 2 — mockups (next)
One board, `04-preview/mockups/item14-sale-going-live-mockups-v1.html`, in item 12's style and
palette, every screen marked NEW or CHANGES:
- **Creator:** the door after the shoot; posts against the minimum; choosing what to share and
  where; filling the package; sent; changes asked; approved — post it and add links; posted —
  waiting (with the date it confirms itself); Completed and selling; every other state (Delayed,
  reported, old terms, "not shared yet").
- **Brand:** waiting on her (posts progress, late, not shared yet); reviewing the package; asking
  for changes; the last round; confirming live; live · waiting on posts; Completed and selling;
  every other state (rounds used, reported, Delayed).
- **Where it lives:** the shoot-done screens (both apps), the set screen's creator row, the
  creator's Create tab card.
- **Admin:** the one new number on Platform settings.
Plus `workflow-prediction.md`. The founder locks the board → `mockup_locked`.

## Step 3 — lock
Buttons, data, loading, empty, error and end states fixed on the board. Then v1.30 is written.

## Step 4 — gap check
Against the locked board: the database, the backend and both apps, file by file. Baseline test run
(`backend/baseline_item14.json`). Answers the spec's open points. Gap report
`Docs/ITEM14_SALE_GOING_LIVE_GAP_REPORT.md`; founder approval before Phase 2.

## Step 5 — build and test (phases fixed by the gap report)
Expected shape: 2a migration + gate widening + the corrected shoot-done notice → 2b the flow
(package, rounds, links, live confirmation, self-confirmation job, completion, Delayed stages,
reminders, notifications) → 3 the screens → 4 the checks in `03-expected-outputs.md`, the
full-suite compare, governance check, `06-diff/notes.md`.
**Production-impacting — explicit go before migrate / push / OTA.**
