# Final fixer — creator and shared screens

One line per finding: what was wrong · what changed · which test.

- **D-1** (test gap · frames D2 / D7 caption "the screen moves so the whole list is in view") ·
  **What was wrong:** nothing on the phone today — the creator's counter (`CounterScreen`), the pitch
  form (`PitchFormScreen`) and the pitch counter (`PitchCounterScreen`) each do hand the deliverables
  chooser the page they scroll in (re-read: `ref={scrollRef}` on the page and `scrollRef={scrollRef}`
  on the chooser, all three). But no test would have noticed if a later edit dropped either half on
  any of those three; the list would then open under the visible area and "+ Add another" would look
  as if it did nothing. Only the brand Terms screen and the brand counter pop-up were guarded ·
  **What changed:** tests only, no app code. `Packages/Mobile/src/screens/__tests__/deliverablesHomes.test.js`
  gains a shared check, `expectPageMovedForOpenedList`, and four tests that use it. Each takes the
  screen's own page (the one ScrollView carrying `counter-scroll` / `pitch-form-scroll` /
  `pitch-counter-scroll`), tells the phone's measurements that the opened list runs under the
  bottom edge, opens the list from "+ Add another", and expects that page — not a stand-in —
  scrolled once, to exactly 716. `drift/D.md` now names which test proves the wiring for each of the
  five homes · **Which test:** `deliverablesHomes.test.js` › D6 "a list that opens under the bottom
  edge moves her counter's own page …" · D8 "… moves the pitch form's own page …" · the pitch counter
  "… moves the pitch counter's own page … — creator side" and "…and on the brand side of the same
  screen" (the file goes from 15 to 19 tests).
  **Proof the tests bite** (run once from a throw-away file outside the suite, since removed; the
  app files were never edited): with the chooser no longer handed the page, all four fail
  ("Expected number of calls: 1 · Received: 0"); with the page no longer taking the screen's ref,
  all four fail the same way; with neither change, all four pass.

## Files changed

- `Packages/Mobile/src/screens/__tests__/deliverablesHomes.test.js` — the helper and four tests; `act` added to the import.
- `features/ui-walk-fixes/06-diff/drift/D.md` — the "scrolled into view" line now lists the test behind each home.
- This file.

No app code, no shared piece, no testID, no copy, no file in another area was touched. No test was
skipped, deleted or weakened.

## Still needs the walk

Jest proves the page is asked to scroll, and to where. Whether the list really ends up fully on
show on a phone — on all five homes — is for the founder's walk, as `drift/D.md` already says.
