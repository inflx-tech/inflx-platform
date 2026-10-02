# Drift — slice A (board A · the set name box)

Assertions rewritten because board A (frames A1–A4) changed what they pinned: a new set's name box
opens empty with the grey example "e.g. Festive sarees" instead of the typed "Set A" / "Set B".
None was skipped, deleted or weakened; each asserts the new behaviour for the same situation, and
the two navigation assertions became stricter (exact params instead of "contains").
Format: test file · test name · what it asserted · what it asserts now · frame / decision.

- `src/screens/brand/__tests__/item4Brand.test.js` · "name required with the exact message; the group banner; Next saves a draft and opens the first set (check 2, 15)" · after Next, `replace('BrandSetEdit', objectContaining({ campaignId: 'c9', suggestedName: 'Set A', dateRules }))` · `replace('BrandSetEdit', { campaignId: 'c9', campaignName: 'Diwali Edit 2026', dateRules })` exactly — no name and no `first` flag travel with it · A1, expected-outputs check 1.
- `src/screens/brand/__tests__/item4Brand.test.js` · "every field error under its field; the branch row only for Store Visit; the picker greys out early days and shows the cutoff (checks 3, 4)" · the screen was opened with `suggestedName: 'Set A'`, the box's value was `'Set A'`, and the test wiped the box before pressing Save to see "Enter a set name." · the screen is opened with no name, the box's value is `''` and its placeholder is `'e.g. Festive sarees'`; Save on the untouched screen shows "Enter a set name." with the other three field errors and nothing is sent to the server · A1 + A3, checks 1 and 2.
- `src/screens/brand/__tests__/item4Brand.test.js` · "sets newest first with meta, dates and counts; past sets behind a toggle; the ⋯ menu; delete hidden while invitations exist (check 12)" · "Add another set" called `navigate('BrandSetEdit', objectContaining({ campaignId: 'c1', suggestedName: 'Set C' }))` · `navigate('BrandSetEdit', { campaignId: 'c1', campaignName: 'Diwali Edit 2026', dateRules })` exactly — no name, no letter worked out from the number of sets · A1, check 1.

## Dead setup tidied (no assertion changed)

- `item4Brand.test.js` · "says the plan limit out loud when a set is refused, and does not navigate" and "still puts a real field error under its own field" · both passed `suggestedName: 'Set B'` into the screen and then typed their own name over it; the param no longer exists, so it is no longer passed. What they assert is untouched.
- `item4Brand.test.js` · the `brandApi` mock gained `poolSetDefaults` and `removeFromPool` (the new pool-door test walks the pool screen), and the file now also loads `BrandPoolScreen` and `C4`.

## Tests added (new behaviour, and the pool door that had no coverage)

All in `item4Brand.test.js`, describe "ui-walk-fixes board A — the set name box" (7 tests):
the copy string · door 1 (new campaign) · door 2 (Add another set, on a campaign that already has
sets) · A2/A3 (Save with the name empty, spaces only, then a typed name saved as typed) · door 3
(the creator pool: banner, Aim, mode and date as today, branch not pre-filled, name box empty) ·
editing keeps the stored name · renaming keeps the stored name. Each door is walked from the screen
that opens it, and New set is then drawn with exactly the params that screen sent.

## Review fix, 2 Oct 2026 — a test that leaned on another test's data (no assertion weakened)

- `item4Brand.test.js` · "editing a set still opens with its stored name, and an emptied name is refused there too (check 3)" · it opened a live Store Visit set, which makes the screen ask for the branch list, but never gave that list an answer — it was green only because an earlier test's answer was still lying around, and red when run on its own · it now sets its own branch list, and additionally asserts the list was asked for exactly once and that the live set shows its stored branch ("Banjara Hills, Hyderabad") next to its stored name · check 3 / BUILD_RULES rule 4.
- `item4Brand.test.js` · describe "ui-walk-fixes board A — the set name box" · before each of its tests every `brandApi` answer is now wiped (only the file-wide "no pool" default is put back), so a test in this block can no longer pass on data another test left behind — in the whole-file run as well as alone. Proved both ways: with the wipe in and the branch list still missing, the whole file went red on exactly that one test; with the list added, the file is 22 of 22 and each of the seven board A tests passes when run by itself.

## Behaviour that moved with it (for the walk)

- A brand can no longer save a set without typing a name. Today "Set A" is accepted untouched; after
  this she is stopped with "Enter a set name." (stated on board A's header and frame A3).
- The pool door used to open with a blank box and no example; it now shows the same grey example.
  Nothing else on that door changed (U16).
- Sets already called "Set A" / "Set B" in production are untouched; Edit, Rename and Duplicate
  still open with the stored name.
