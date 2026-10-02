# Drift — slice G (board G · shoot plan: choosing the date and the time)

Frames G1–G10 · research `C09-shoot-time-picker.md` (FIX FINAL 1–11) · decisions U7, U10, U12 ·
checks 27, 28, 29.

## A recorded founder decision that this slice supersedes

- **Item 10, answer Q8 — "The JS chip picker, restyled, 15-minute steps"**
  (`features/item10-store-visit/PROMPT.md:65`, `lock.json` notes "Q8 the JS chip picker, keep the
  Stage-4 guard").
  - **Superseded: the "chip" half.** The day strip, the fourteen hour chips, the four minute chips
    and the bold summary line are gone. In their place are the two boxes the locked item 10 board
    always drew (V2, V6, V12): "Date *" opening the app's calendar and "Time *" opening one list of
    15-minute times. Founder, 1 Oct 2026 walk, point 9; spec U7; board G locked 2 Oct 2026 (D6).
  - **Kept: the "no Android clock" half.** The picker is still built in JavaScript and ships over
    the air; `@react-native-community/datetimepicker` stays unused. Kept too: 15-minute steps,
    7:00 am – 8:45 pm, max = the posting date, min = now (Q8's "min = now" was written down but
    never built — past hours were offered; it is enforced now).
  - **The "Stage-4 guard test" Q8 asked to keep did not exist.** Three item 10 documents and the
    header of `bits10.js` said it did. It is now written: `shoot10.test.js` › "no file in the app
    imports the Android date or time picker". The four stale sentences are corrected with a dated
    note (see "Files outside the slice" below).

## Assertions rewritten (none skipped, deleted or weakened)

Format: test file · test name · what it asserted · what it asserts now · frame / decision.

- `src/components/shoot/__tests__/shoot10.test.js` · "the time picker offers no day after the posting date (check 6) › lists today..posting day only, 15-minute steps, and emits an IST instant" · three `day-N` pills (today, tomorrow, the posting day), four `minute-N` pills, and that ONE tap on `hour-16` with nothing else chosen sends an instant at 4 pm today (the phantom default day) · replaced by six tests that pin each of those rules on the two boxes: "G2 — the calendar is open from today in India to the posting day, and no day after it" (calendar cells `day-YYYY-MM-DD`: today and the posting day open, every later day `disabled: true` and untappable); "G3 — on today's date the times already gone are grey and cannot be tapped" (56 rows, 7:00 am … 8:45 pm, 15-minute steps); "G1 — … nothing is sent before a tap"; "a date alone sends nothing, and a time alone sends nothing"; "G4 — date + time sends the moment as it reads on an Indian clock, in either order" (the exact instant, `2026-10-18T05:30:00.000Z` for 18 Oct 11:00 am); "tapping either box again changes it…". **The one behaviour that reverses:** a single tap on a time no longer sends anything — it used to, because a day and a time were silently assumed · G1, G3, G4 · FIX FINAL 5 · check 27, 28.
- `src/components/shoot/__tests__/shoot10.test.js` · "the time picker offers no day after the posting date (check 6) › a posting date already passed offers no day at all" · zero `day-N` pills · "G10 — a posting date already passed offers nothing: one red line in place of the boxes": the sentence "No day works — the posting date has passed." is shown in red, neither box is drawn and no calendar cell exists · G10 · FIX FINAL 7 · check 28.

## testIDs that went with the pills (BUILD_RULES rule 3)

Removed because the things they named no longer exist (G1: "The pills and the bold line are gone"):
`day-N` (day pill), `hour-N`, `minute-N`, `picked-time`. No Maestro flow and no `qa/` script used
them (searched). Kept: `time-picker` / `plan-picker` / `counter-picker` / `move-picker` (the
picker's container), `move-time-sheet`, `move-change`, `move-note`, `move-send`, `move-cancel`,
`dates-hint`, `change-time`, `send-to`, `send-counter`.
New: `pick-date`, `pick-time`, `time-sheet`, `time-list`, `time-H-MM` (e.g. `time-16-00`),
`time-tick`, `no-day-works`; the calendar's own `date-sheet`, `date-prev`, `date-next`,
`day-YYYY-MM-DD` now appear on these three surfaces; the move sheet gained
`move-time-sheet-body` / `move-time-sheet-footer`.

## Behaviour that moved (for the walk)

- **Nothing is pre-chosen.** Plan the visit, Ask for / Suggest another time and Move the visit all
  open with grey "Choose a date" / "Choose a time" (the move sheet: see below). The bold summary
  line is gone.
- **What the picker tells its screen.** Nothing while one box is filled; the moment once both are;
  and `null` in one case — a whole choice stops being one because the date was changed to today
  and the time kept beside it has already gone (the Time box goes back to "Choose a time", G4).
  Without that `null` the screen would go on holding, and could send, a time it no longer shows.
  This is the only time `onChange` is called without both boxes filled; the three callers already
  accept `null`.
- **Past times cannot be chosen.** On today's date every time up to now is grey and untappable;
  the refusal "Choose a time in the future." remains at Send for a time that passes while the
  screen is open.
- **Today drops out of the calendar** once 8:45 pm has gone in India; the first day is tomorrow.
- **The refusal moved under the boxes** on Plan the visit (was under the hint line) and on
  Ask for / Suggest another time (was under the "They asked for … →" line), with the red outline on
  the empty box(es), or on both when both are filled and the pair is refused (G5).
- **Plan the visit: Send is off** when no day can be chosen (G10). It used to be tappable and
  answer "Choose a date and time."
- **Move the visit sheet** (both apps): starts again on every opening (choice, reason, refusal);
  opens showing the agreed time only while that time is still ahead (G7), empty once it has passed
  (G8 — the "Send a new time" and "She didn't come — send a new time" doors); the line reads
  "Agreed … → —" until the time actually differs (it used to show any picked time, the agreed one
  included); "Choose a time in the future." is now said on the phone, before the server is asked;
  the first box is labelled "New date"; the body scrolls and the two buttons are pinned at the
  bottom of the sheet (G9), with the refusal — the phone's or the server's — directly above them.
- **Tapping the Time box puts the keypad away**, so the list has the room.

## Built differently from the frame, or decided where the frame is silent

- **G6 / item 10 V6 — "Ask for another time" stays a full screen**, not the bottom sheet the item 10
  board draws. This is the one deliberate departure, stated on frame G6 itself.
- **Posting day is today and 8:45 pm has gone.** No frame draws it. The picker shows the same red
  line as G10 ("No day works — the posting date has passed.") and Plan the visit's Send is off,
  although strictly the posting date is today, not past. The alternative was two boxes that open a
  calendar with every day grey and no explanation. The sentence is unchanged (U10).
- **Ask for another time and the move sheet keep their Send button on** when no day works; only
  Plan the visit's is drawn off (G10). Pressing it answers "Choose a date and time." as before.
- **The move sheet's refusal sits with the buttons**, not under the boxes as G5 draws for the
  plan. In a sheet whose body scrolls and whose keypad may be up, a line under the boxes at the top
  can be out of view when Send is pressed; the boxes are still outlined red.
- **The list opens with two rows showing above the row it opens at** (U12 says "opens at the
  chosen time, else at the first time still open"; G3 draws the chosen row part-way down).
- **Greyed times use the app's disabled-text colour** (`settingsTokens.disabledText`), not the
  board's `#C9C8C1`: colours come from the tokens (rule 6). The calendar's grey days are unchanged.
- **No grab handle on the time list sheet** (G3 draws one): it is the shared `Sheet`, which has
  none anywhere in the app; the calendar keeps its own.

## Shared pieces — additive only

- `components/DateField.js`: four opt-in props — `icon`, `hideCaret`, `display`, `invalid`. A
  caller that passes none gets the same tree as before (pinned by a new test). The six other
  callers and the eight existing `dateField.test.js` tests are untouched; five tests added (three
  more in the review round, below — eight added in all, none changed).
- `components/shoot/bits10.js`: `TimePicker10` keeps its name, its five props and its ISO-instant
  output; `dateLabel` and `error` are new and optional. Every other export is untouched,
  `g.chip` / `g.chipText` included. The picker-only style keys that nothing imports were removed
  with the pills (`pickHd`, `strip`, `dayChip`, `dayWd`, `dayNum`, `dayMon`, `wrap`, `tChip`,
  `tText`, `chipOn`, `chipOnText`, `pickSummary`); searched — no file reads them.
- `components/settings/sheets.js` `Sheet`: not edited. The move sheet and the time list use its
  wave 1 opt-in shape (`fit` + `footer`, and `fit="list"`).

## Files outside the slice's list (smallest edit, deploy-inert)

Research FIX FINAL 11 asks for these corrections. Each is a dated note added under the stale
sentence; nothing was deleted or reworded.
- `features/item10-store-visit/06-diff/notes.md` — the "Stage-4 guard test … is kept" sentence, and
  the V2 / V6 / V12 "departures" rows.
- `features/item10-store-visit/02-workflow.md` — "The Stage-4 guard test … **stays**".
- `features/item10-store-visit/04-preview/workflow-prediction.md` — "Deliberate departures: none
  from the mockups … which the mockups do not show either way" (the mockups do show two boxes).
- Not edited: `features/item10-store-visit/lock.json` and `PROMPT.md` (Q8's own words) — the
  supersession is recorded here and in `ui-walk-fixes/01-spec.md` "Supersedes".

## Review round (2 Oct 2026) — two test gaps closed, no app code changed

Both findings were checked against the code and the board and were real: the behaviour was right,
nothing proved it. Tests added and one strengthened; no assertion rewritten, skipped or weakened;
no source file under `Packages/Mobile/src` other than the two test files was touched.

- **The doors to the move sheet were never pressed (frame G8's caption, check 29).** The sheet's
  tests handed it the agreed time directly; nothing pinned what the two screens hand it.
  `shoot10.test.js` › new block "the doors to the move sheet (board G, frames G7, G8 · check 29)",
  five tests on the real `BrandShootScreen` and `ShootScreen`, fed a shoot in the shape the
  server's `shootPlan.service` `read` answers with (it carries two times — the 18 Oct, 11:00 am
  first asked for and the agreed one — so a sheet wired to the wrong one fails):
  - "G7 — brand · "Move the visit" …" — opens on the plan's agreed time; the calendar ends on the
    set's posting date; the agreed time sent back unchanged is refused; a changed time goes to
    `moveShoot` with the right ids and the sheet closes.
  - "G8 — brand · "Send a new time" …" — both boxes empty once the agreed time has passed; a
    half-made choice and a half-typed reason, then "Not yet", then the same door: nothing is left.
  - "G8 — brand · "She didn't come — send a new time" …" — empty once the agreed time has gone;
    showing it when she marked the visit before the agreed time (the rule is the time, not the
    door — she may mark the visit any time once agreed, founder 1 Oct).
  - "brand · a refusal the server sends back is said in the sheet, and is gone on the next
    opening" — the one part of "starts again" that belongs to the screen, not the sheet.
  - "creator · "Ask to move this" …" — her title and hint, the agreed time while it is ahead, empty
    once it has passed, and it sends through `moveMyShoot`.
  To draw those two screens the file now stands in for the navigator's focus hook
  (`jest.mock('@react-navigation/native', …)`, the same stand-in every screen suite uses). It
  changes nothing for the tests already in the file.
- **The calendar's arrows were never pressed (frame G2's caption, check 28).**
  - `shoot10.test.js` › "G2 — the calendar is open from today in India to the posting day, and no
    day after it" — strengthened, nothing removed: it now counts every day on offer (exactly the
    1st to the 24th, as the old pill test counted its pills), and presses both arrows — each is
    grey and the month does not turn.
  - `shoot10.test.js` › new "G2 — an arrow is live only towards a month that holds a day she can
    shoot, and stops there" — posting day 5 Nov: forward to November (the 1st to the 5th open and
    no more), no further forward, back to October and no further back; the posting day itself can
    be chosen and is what is sent.
  - `dateField.test.js` › new block "the month arrows under a first and a last day", three tests on
    the shared field itself: both grey and still within one month; live only towards a month with
    a day on offer; and, for the six callers that pass no last day, the forward arrow always live.

## Final review (2 Oct 2026) — one more test gap closed, no app code changed

- **Plan the visit's confirm button was never pressed (check 27 · frames G4, G5).** The picker's
  own tests prove the moment it hands its screen, and the screen test went as far as the confirm
  sheet; the last hop — `BrandShootPlanScreen.send` → `brandApi.sendShootPlan` →
  `navigation.replace` — was unguarded, unlike Ask for another time and the move sheet. The code
  was read and is right, and this build did not touch `send()`; nothing would have noticed a
  wrong or missing `visitAt`. `shoot10.test.js` › "the screens that hold the picker", two tests
  added (the `planScreen` helper now takes the navigation to watch; nothing else changed):
  - "G4 / G5 — Plan the visit: the date and time chosen is what is sent, once, and the screen
    moves on to the visit" — nothing is sent while choosing or when the confirm sheet opens; the
    confirm press sends `('c1', 's1', 'ci1', { contactName: 'Ravi Menon', contactPhone:
    '+919849011223', visitAt: '2026-10-18T05:30:00.000Z', durationText: undefined, notes:
    undefined })` exactly once (the name trimmed, the number as the server pre-filled it, the two
    empty optional boxes sent as nothing), and the screen is replaced by `BrandShoot` with the
    three ids and the "sent" message, once.
  - "Plan the visit: a changed choice is the one sent, with what she typed in the two optional
    boxes; a refusal stays in the sheet and the screen does not move" — 18 Oct 11:00 am changed
    to 19 Oct 4:00 pm sends `2026-10-19T10:30:00.000Z`, with the duration and the note trimmed;
    the server's refusal is read inside the confirm sheet and `replace` is never called.
  The file goes from 57 to 59 tests. No assertion rewritten, skipped or weakened.

## A test in this slice's file that belongs to board F (not rewritten here)

`shoot10.test.js` › "the brand's set row before the plan is sent › says the plan is his move and the
chip opens the visit" expects the set row's tag to read "Your move". Board F (check 19) turns that
tag into the button "Plan the visit" in `components/invitations/bits5.js`, and `03-expected-outputs.md`
lists this assertion as board F's drift (`shoot10` … "Your move"). It was green until board F's
change to `bits5.js` landed at 11:03 on 2 Oct, mid-way through this review round, and red after
it. Slice G does not own `bits5.js` and did not touch the test: its rewrite and its drift line
belong in `drift/F.md`.
