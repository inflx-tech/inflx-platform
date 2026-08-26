# Before and after

## Promised
Tapping counter opens the form. That is what `collab-terms-by-aim` item 7 already specified.

## Built
One word: `fromMode` added to the import line in `CollabRequestDetailScreen`.

## Diverged
Nothing on screen. The design was never wrong — the screen simply could not run.

## What was added beyond the fix
`utils/__tests__/importsResolve.test.js` — for every file importing from a util module, take
that module's REAL exports and fail if any is *called* without being imported.

Validated by **reverting the fix and watching the new test fail**, then restoring it and
watching it pass. A regression test that has never seen the bug proves nothing.

## What to check
1. Asha (`7900000110` / `000000`) → **Collabs → Invitations** → open a request → **counter**.
   It opens, pre-filled with the brand's own terms.
2. Send it without changing anything → *"Adjust at least one term to counter."*
3. Change the commission and send → the brand sees **old → new**, that term only.

## The uncomfortable part
Live for two days and nobody hit it. Not a code problem — the practice creators are not
walked often enough for a crash in a secondary action to surface. Worth remembering when
judging how much a green suite is actually worth.
