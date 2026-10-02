# Drift — slice B (board B · Add creators)

Assertions rewritten because board B (frames B1–B6, B8, B10; founder decisions D1 and D2 of
2 Oct 2026) changed what they pinned. None was skipped, deleted or weakened: each asserts the new
behaviour for the same situation, and what is now asserted ABSENT is exactly what the founder asked
to be removed.
Format: test file · test name · what it asserted · what it asserts now · frame / decision.

- `src/screens/brand/__tests__/item5Brand.test.js` · "shows the same card as the Creators tab — followers, engagement and the Aim/mode tags" → renamed "shows the compact pick row — her name, niche · city · distance · languages and all three numbers; no tag line, no hint sentence (board B1, D1, D2)" · six separate text nodes ("193.2K" / "Instagram", "52.0K" / "YouTube", "5.1%" / "Engagement") and the five tags (Pay for Sale, Pay for Content, Hybrid, 📍 Store Visit, Remote) · her name; one place line "Fashion · Hyderabad · 32 km · Telugu, English"; one numbers line "193.2K IG · 52.0K YT · 5.1% eng" (all three numbers still asserted); each of the three is a single line; none of the five tags, none of the full card's labelled numbers and no hint sentence is on the screen. The tick and the toggle assertions are unchanged · B1, D1 (supersedes the 16 Sep "same card" note), D2.
- `src/screens/brand/__tests__/item5Brand.test.js` · "rows carry Invited / Can't invite and cannot be picked; Next counts the picked and opens the terms (checks 1–3)" · the grey sentence "Creators whose own settings rule this set out can't be picked, and the reason is never shown to them." was on the screen · that sentence is NOT on the screen (two patterns) · B1, D2.
- same test · the row of a creator who can't be invited read "Not open to this set" · it reads the server's short reason ("Not taking Pay for Sale" — the fixture now carries the D2 fields `reason / detail / label / message / inSet`), and "Not open to this set" is not on the screen · B1, B10, D2.
- same test · `select-k`.accessibilityState.disabled was `true` (the row was switched off) · the row is no longer switched off, because it has to take the tap that says why (React Native 0.73 disables a touchable whose accessibilityState.disabled is true). "Cannot be picked" is now proved by doing it: `{ checked: false, disabled: false }`, a tap leaves her unticked, the basket empty and "Next: terms for 0 creators"; and the already-invited row is still `{ checked: true, disabled: true }` and a tap on it changes nothing · B2, D2.
- `src/components/discovery/__tests__/distance.test.js` · "choosing "Within 50 km" and applying sends within=50; the quick chip names it" → renamed "…; the button reads "Filters · 1" and "Clear all" on the count line undoes it" · the summary chip text "Within 50 km  ✕" · no chip with ✕ and no `quick-open` chip; the button reads "Filters · 1"; "Clear all" is absent before a filter is set, present after, and pressing it sends `within: 'any'` again and returns the button to "Filters". The `quickChip()` unit check in the next test is untouched (the creator app's Find brands still uses it) · B3.

## Not drift — fixtures and assertions deliberately left as they were

- `item5Brand.test.js` · describe "I2 — the group check adds to the basket": its fixture row `label: 'Not open to this set'` and the assertion that prints it are unchanged. That is still a line the server sends (its fallback when the cause is none of her five rules), so the test still describes a real response.
- `item5Brand.test.js` · "a failed batch names the creators…" (check 38): unchanged. A refusal with no `label` still prints its message on the row.
- `distance.test.js` · "the default request asks for sort=distance…": unchanged — "Nearest first ▾" and `sort-toggle` are still on the count line (pressing it now opens the Filters sheet, covered by a new test).
- `03-expected-outputs.md` lists "the chip-driven duplicate/count walk" under `item5Brand`. No phone test walked the chips (`quick-open` / `quick-chip` were never pressed by a test), so there was nothing to rewrite.

## testIDs

- Kept: `discover-search`, `open-filters`, `sort-toggle`, `select-{id}`, `tick-{id}`, `pick-subline` (now on the title bar's second line), `pick-tabs`, `pick-footer`, `pick-basket`, `pick-count`, `pick-next`, `capacity-line`, `add-selected`, `add-tabs`, `filters-*`, `filter-*`.
- `quick-chip` is kept, on "Clear all" (it replaces the summary chip and does what tapping that chip did).
- Gone with the controls the board removes: `quick-open` (the chip; the switch is `filter-openonly` in the sheet) and `sort-distance` / `sort-followers` / `sort-engagement` / `sort-newest` (the drop-down under the search box; the sheet's `filter-sort-*` are the one home, spec U12). No test and no Maestro flow pressed any of them.
- New: `discover-controls`, `pick-name-{id}`, `pick-line-{id}`, `pick-numbers-{id}`, `group-add-subline`, `group-add-footer`.

## Tests added

`item5Brand.test.js`
- describe "ui-walk-fixes board B — Add creators for a set" (9 tests): the title bar's second line and the one control row, with "Open to invitations only" still on in the sheet · "Filters · N", the ink outline, "Clear all" and what it resets · "Nearest first ▾" opens the sheet, no second menu · a greyed row dims only the face and the name, the reason stays readable, no numbers line · the tapped sentence in the toast, nobody picked · each of the five reasons printed and said exactly as the server sent it · the older-server fallbacks (no sentence → the label; neither → "Not open to this set") with `pickStateOf` checked directly · the footer hides with the keypad and returns with the selection intact · the Worked with and Pool tabs print the reason and say the sentence.
- describe "ui-walk-fixes board B — the same reason on "Invite a group" and after Review and send (D2)" (3 tests): the group check's tap · the group check on an older server · the refusal list after Review and send (short reason on the row, sentence on tap, any other refusal still opens her terms).

`item3Brand.test.js`
- describe "ui-walk-fixes board B — Discover and the group picker" (5 tests): B8 — Discover has the one control row and the FULL card unchanged (labelled numbers, tags, add-to-group) · B6 — the title bar's second line, one control row, "Open to invitations only" off by default, counted when switched on, and "Clear all" puts it back OFF · the compact row, a member ticked and greyed, "Not taking invitations" under her numbers and still addable, the capacity countdown, what is sent · a full group · the footer hides with the keypad.

`distance.test.js` (2 tests)
- "Nearest first ▾" opens the Filters sheet instead of a menu of its own · "Clear all" inside the sheet keeps "Open to invitations only" off on a list that starts with it off.

Every new describe spies on `console.error` and asserts it stayed silent.

## Behaviour that moved with it (for the walk)

- A creator who can't be invited can now be tapped (All creators, Worked with, Pool, the "Invite a group" check, and the refusal list after Review and send). Tapping picks nobody; it only shows the sentence.
- On the refusal list after Review and send, tapping a creator refused by one of her own rules used to open her terms; it now shows the sentence (changing her terms cannot fix her rule). Every other refused row still opens her terms.
- "Open to invitations" can no longer be switched with one tap: it is the first switch inside Filters. In the set picker switching it off shows "Filters · 1"; in the group picker switching it ON shows "Filters · 1".
- In the group picker, "Clear all" inside the Filters sheet used to switch "Open to invitations only" ON (it reset to the Discover defaults). It now returns to that screen's own start (off). Found while moving the switch into the sheet; fixed with an opt-in `defaults` prop on `FiltersSheet`.
- The sort can no longer be changed from a drop-down under the search box; "Nearest first ▾" opens Filters, where Sort is the first group.
