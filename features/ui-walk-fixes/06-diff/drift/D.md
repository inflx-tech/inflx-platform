# Drift — slice D (board D · Pay for Content: choosing what she delivers)

Frames D1–D8 · research `C04-content-deliverables-picker.md` (FIX FINAL 1–8) · decisions U10, U12,
U15 · checks 12, 13, 14.

## Assertions rewritten (none skipped, deleted or weakened)

Format: test file · test name · what it asserted · what it asserts now · frame / decision.

- `src/screens/brand/__tests__/item5Brand.test.js` · "Pay for Content: fee, deliverables (empty / duplicate / count), usage rights need a place; "Use these terms for everyone" copies (checks 7, 9, 11)" — renamed "Pay for Content: fee, deliverables (empty, one line each from the list that opens in place, minus / plus), usage rights need a place; … (checks 7, 9, 11 · board D)" · that "+ Add another" silently added the next unused type (two presses → two new lines), that tapping the `deliverables-row-1-reel` pill made a second "Instagram reel" and Next answered **"You've already added that. Change the count instead."**, and that typing `21` into `deliverables-row-1-count` made Next answer **"Choose between 1 and 20."** · that the same two faults can no longer be made from the screen: "+ Add another" opens the list and adds nothing until a type is chosen; "Instagram reel" in that list reads "Added", is disabled and a tap on it adds no line; line 2's own type box shows reel as "Added" and a tap leaves it "Instagram story"; a second tap on the box closes the list (U12); the count is not a typing box and one press of plus takes it from 1 to 2. Also newly asserted on the way: the first line is "Instagram reel, 1" with the hint (D1), the empty state keeps the hint and does not move on (D5), and the red line goes when a line is added (D5). Everything from the usage switch onward, and the final saved shape `[{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]` copied to the second creator, is unchanged · D1, D2, D3, D5 · U12 · check 12.
- **The two sentences were moved, not deleted** (check 13). `MSG5.DELIVERABLE_DUP` and `MSG5.DELIVERABLE_COUNT` are asserted directly on the rule in the new `src/components/invitations/__tests__/draft5.test.js` › "the same type twice is refused: …" and › "a count outside 1 to 20 is refused: …" (`draft5.validateLocal`, with the literal sentences pinned), plus the edges the screen walk never reached: 0, −1, 21, 2.5, empty, missing, text; 1 and 20 allowed; all five types allowed; an unknown type; which fault is said first; Pay for Sale and Hybrid never judged on deliverables.

## testIDs (BUILD_RULES rule 3)

Kept, same meaning: `<id>` (the block; `deliverables` when none is given), `<id>-row-N`,
`<id>-row-N-remove`, `<id>-add`.
Kept, same meaning, different control:
- `<id>-row-N-<type>` ("make line N this type") — was one of five always-visible pills; is now a
  line of the list that opens under line N, so it exists only while that list is open.
- `<id>-row-N-count` — was the typing box; is now the minus / number / plus control, with
  `-count-minus`, `-count-value`, `-count-plus` inside it. `fireEvent.changeText` on it no longer
  does anything (there is nothing to type into); only item5Brand did that, rewritten above.
New: `<id>-row-N-type` (the type box), `<id>-list` (the open list — one at a time), `<id>-add-<type>`
(a line of the list opened from "+ Add another"), `brand-delivers-label` (the counter pop-up's label).
No Maestro flow and no `qa/` script uses any of these (searched).

## Behaviour that moved (for the walk)

- **"+ Add another" no longer adds a line by itself.** It opens the five types under the button;
  the line is added when one is chosen, with 1. On all five homes.
- **A type can be on one line only.** In either list a type that has a line is grey, reads "Added"
  and takes no tap. Before, a second line of the same type could be made and was refused at Next.
- **"+ Add another" is gone at five types** and back when a line is removed. Before, it stayed and
  added a second "Instagram reel" that could never pass.
- **The count is 1–20 by minus / plus; no keypad opens.** A count can no longer be left empty.
- **Counts that arrive wrong are put right on arrival** (rows from the server's thread or the
  pool): text becomes a number, anything under 1 becomes 1, over 20 becomes 20, a fraction is
  rounded. The corrected rows are handed to the screen once, straight away — so a counter screen's
  "They asked for … → …" line shows the correction as a change. The server only ever stores 1–20,
  so in practice this is text → number and changes nothing anyone sees.
- **Brand's counter pop-up (D7):** the block is labelled "What she delivers" (was "What you'll
  deliver", U15); a repeated type or a count outside 1–20 is refused in the pop-up, on the
  deliverables line, before anything is sent (it checked only "not empty").
- **Pitch form (D8):** the same repeat / 1–20 check after "Say what you'd deliver."; the red line
  now goes as soon as the lines change (it used to stay until Next was pressed again).
- **Pitch counter:** a refusal from the server is put under the box it is about — `formats_json` →
  the deliverables line, `agreed_fee` → the fee, `commission_pct` → the commission — and a refusal
  the screen has no line for is said on the form line above the button. Before, every refusal that
  carried a field name was filed under that name, which the screen never draws, so Send appeared
  to do nothing.
- **The opened list is scrolled into view** (D2, D7): each of the five homes hands the chooser the
  ScrollView it sits in. Needs the walk — Jest proves the arithmetic and the wiring, not the phone.
  Where the wiring is proved, home by home (each test takes the screen's own page, opens the list
  and expects that page scrolled to 716): brand Terms — `screens/brand/__tests__/boardCBrandSetup.test.js`
  › "the ref the deliverables chooser scrolls with is still the page's own ScrollView"; brand counter
  pop-up — `components/__tests__/popupsAboveKeypad.test.js`; creator's counter, pitch form, pitch
  counter (both sides) — `screens/__tests__/deliverablesHomes.test.js` › "a list that opens under
  the bottom edge moves … own page" (added by the final fixer, finding D-1; before that these three
  were proved only by reading). The arithmetic itself: `deliverablesEditor5.test.js`.

## Built differently from the frame, or decided where the frame is silent

- **"+ Add another" is the shared outlined button at its normal height (about 48), not the board's
  32-high small button.** The brief names the shared `SecondaryButton` (strong outline, plus icon)
  and U4 / rule 2 say tap size wins and shared buttons are not restyled. It is kept to the left at
  the width of its words, as drawn.
- **List rows are at least 44 tall** (the board's are about 38) — tap size, U4.
- **The open type box has the ink outline but not the board's soft yellow ring** around it.
- **D8's title bar reads the brand's name ("Urban Threads") with "Pitch Urban Threads" as the
  page's heading under it**, as wave 1 built it and the brief says to leave; the frame draws
  "Pitch Urban Threads" in the bar. The pitch form also keeps its steps (U10): the date and mode
  the frame shows under the rows are on the next step.
- **A second tap on "+ Add another" closes its list** (U12 says so for a type box; the button is
  treated the same).
- **Only one list is open at a time**; opening another box, or the button, moves it.
- **Removing a line closes any open list.**
- **A type the app does not know** (none exists today) is shown as the server sent it, can be
  changed or removed, and is still refused by the rule.
- **Greyed "Added" uses the app's disabled-text colour** (`settingsTokens.disabledText`, the same
  `#A3A29B` the board draws).
- **Room kept under an opened list when scrolling: 96 points**, because four of the five homes
  still have a floating button strip over the bottom of the page. When the later wave moves those
  strips into the in-flow bar this only means the page scrolls a little further than it must.

## Shared pieces — additive only

- `components/remote/bits11.js` `QtyStepper11`: one opt-in prop, `tall` (field height 42, the
  board's outline), used with the existing `max`. Without it the stepper is exactly item 11's;
  `remote11.test.js` is untouched and green. No third stepper was written.
- `components/invitations/bits5.js`: `DeliverablesEditor5` keeps `rows / onChange / error / testID`
  and gains the optional `scrollRef`. New exports beside it: `deliverableCount5`,
  `deliverableRowsError5`, `scrollForList5`, `DELIVERABLE_MIN`, `DELIVERABLE_MAX`. Nothing else in
  the file was touched except the import lines and the style keys only the old chooser used
  (`delRow`, `typeWrap`, `typeChip`, `typeChipOn`, `typeChipText`, `typeChipTextOn`, `x`, `xText`,
  `add` — searched, nothing reads them). The file no longer imports `NumberField`.
- `components/settings/primitives.js`, `components/settings/sheets.js`: not edited.

## Files outside the slice's list (smallest edit)

- `components/invitations/copy5.js` — one key, `C5.terms.added: 'Added'` (the board's one new
  word; copy lives in the copy files, rule 8).
- `components/remote/bits11.js` — the `tall` prop above.
- `screens/brand/BrandCreatorTermsScreen.js` and `screens/influencer/CounterScreen.js` — three
  lines each: a `useRef` (above every early return), `ref={scrollRef}` on the screen's ScrollView,
  `scrollRef={scrollRef}` on the chooser. Needed for D2's "the screen moves so the whole list is in
  view"; a component cannot scroll a ScrollView it is not handed. Their floating button strips and
  everything else are as they were.

## New test files

- `src/components/invitations/__tests__/draft5.test.js` — 12 tests (check 13, check 14).
- `src/components/invitations/__tests__/deliverablesEditor5.test.js` — 36 tests (check 12): the
  one-line row, the in-place list from the button and from a line's box (order on the page, no
  `position`, no Modal), "Added", the tick, the hidden button at five, clamping, rows that arrive
  wrong, the scroll arithmetic and its wiring. It fails on any React warning (console.error guard).
- `src/screens/__tests__/deliverablesHomes.test.js` — 15 tests (check 14): the creator's counter
  (D6), the brand's counter pop-up (D7, U15, the new refusal), the pitch form (D8), the pitch
  counter on both sides (the `formats_json` mapping), and the exact body each one sends.
