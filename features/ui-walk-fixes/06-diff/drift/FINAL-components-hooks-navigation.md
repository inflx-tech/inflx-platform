# Drift — final fixer, area "components · hooks · navigation" (2 Oct 2026)

Six findings from the final review. Each was re-read against the code as it stands before
anything was changed. Five are real; one of those (F1) had already been fixed by the server
fixer when this fixer reached it, so it was verified, not edited twice. One part of one finding
(C-7's device walk) cannot be done here and is stated plainly below.
**No test was skipped, deleted or weakened.** Two assertions were rewritten because a locked
board changes what they pinned (C-2); they are listed in `drift/C2.md` in the BUILD_RULES format.

## One line per finding: what was wrong · what changed · which test

- **C-1 · frame C2's caption ("…back in place when the keypad closes") · checks 9, 11** —
  *What was wrong:* on a form longer than the screen (Plan the visit, Terms, the creator's content
  page) closing the keypad leaves the form where typing put it; the top returns with one swipe,
  not by itself. Forms that fit do return. The live app behaved the same before this build, but
  the departure from a binding caption was recorded nowhere. *What changed:* no behaviour. It is
  now a decision — **U20** in `01-spec.md` — recorded in `drift/C0.md` ("Not built exactly as the
  frame says") and in `06-diff/notes.md` for the walk, with the build that would make the top
  return by itself described (only if the founder asks for it at the walk; it cannot be proved
  under jest). One comment added to `components/shell/FormScroll.js` pointing at U20.
  *Which test:* `components/shell/__tests__/FormScroll.test.js` › NEW "U20 — a long form moved up
  by typing stays where typing put it when the keypad closes: FormScroll moves it once, up, and
  never back" (62 → 63). The three older tests that pin the same rule are untouched.

- **C-2 · board C check 10 · item 11's locked frame R13** — *What was wrong:* on the brand's
  "What came back?" pop-up, marking an item Missing or Damaged opened a note box that kept
  nothing — every letter typed vanished (no value, a do-nothing handler), and the server's confirm
  step takes `{ lineId, status }` and has nowhere to store a note. Live since item 11; this
  build's keypad work had brought the dead box squarely into view. *What changed:* the box is no
  longer drawn in the brand's pop-up. `components/remote/bits11.js` `ThreeWayCheck11` gained an
  opt-out prop `withNote` (default `true`, additive); `components/remote/sheets11.js` passes
  `withNote={false}` and drops the do-nothing `onNote`. The creator's own check (R9) passes
  nothing and is unchanged — her note is kept and sent. No server change. R13 draws three buttons
  per item and no note, so this restores a locked frame. **A visible change, for the walk.**
  Saving the brand's note would be new behaviour and a server change: not built, a founder
  decision. *Which tests:* `components/__tests__/popupsAboveKeypad.test.js` — two assertions
  rewritten, one test added ("marking an item Missing or Damaged opens NO note box…");
  `components/remote/__tests__/remote11.test.js` — one added (the prop, both ways);
  `screens/__tests__/remoteScreens.test.js` — two added on the real screens (brand: no box, the
  answer alone is sent; creator: her note shows what she types and is sent). Detail and the
  rewritten lines: `drift/C2.md`.

- **C-7 · check 11 ("Walk + before/after shots") · the before/after-diff gate** — *What was
  wrong:* `06-diff/` had no `notes.md` and no after-shots; the release gate (gov-check Rule 4)
  refuses a push that touches the phone source without a non-empty `06-diff/notes.md`.
  (Re-verified: the `lock.json` part of the original claim is not real — `qa_all_green: false`
  and `maestro_green: false` are the normal values before release, block nothing while `released`
  is false, and were left alone.) *What changed:* `06-diff/notes.md` is written in the house
  shape (what was implemented / what matches the board / where it differs / what to check),
  folding in every departure the drift files record. **What could NOT be done here, and is said
  at the top of that file:** the device walk on a normal and a small (360×760) phone, and the
  after-shots — there is no phone in this session, and there are no capture descriptors beside
  the mockup for `pnpm diff:after`. Check 11 stays "not run". The Status column of
  `03-expected-outputs.md` was NOT filled in by hand (its own first line forbids that). *Which
  test:* none — a record, not behaviour. **Note for whoever releases:** `notes.md` existing means
  Rule 4 no longer stops the push by itself; that is not the diff sign-off. The walk is still
  owed, and the push still needs the founder's go.

- **E-6 · BUILD_RULES rule 2 (shared pieces change additively)** — *What was wrong:* the shared
  outline button (`SecondaryButton`) now obeys `disabled`, which it used to accept and drop. That
  changed what eight existing callers get — the "Not yet" / "Keep it booked" / "Not now" of seven
  Remote-shoot sheets (`components/remote/sheets11.js`) and of the delivery-address confirm
  (`screens/influencer/RemoteAddressScreen.js`), all on no board of this contract — and no drift
  file named them. *What changed:* no app code (narrowing it to an opt-in would re-open the
  close-while-saving gap those callers meant to shut). The eight are named, with before / now and
  the way out that is left, in `drift/E.md` and in `06-diff/notes.md`, and added to the walk list.
  *Which test:* NEW `components/remote/__tests__/cancelWhileBusy.test.js` (20 tests) — a scan of
  the app's source that the outline buttons passing `disabled` are exactly these eight, each as
  `disabled={busy}` (a ninth fails until it is added to the record); each of the seven sheets at
  rest and while busy; that each still closes on a tap outside and on Back while busy; and the
  delivery-address pop-up on the real screen at rest, mid-send (nothing closes it; one send only)
  and after a refusal.

- **G-1 · check 27 · frames G4, G5** — *What was wrong:* nothing in the app (the code was read
  and is right, and `send()` was not touched by this build) — but no test pressed the confirm
  button on Plan the visit, so nothing proved the chosen date and time is what goes to the server
  or that the screen moves on. *What changed:* tests only. *Which test:*
  `components/shoot/__tests__/shoot10.test.js` › NEW "G4 / G5 — Plan the visit: the date and time
  chosen is what is sent, once, and the screen moves on to the visit" and NEW "Plan the visit: a
  changed choice is the one sent, with what she typed in the two optional boxes; a refusal stays
  in the sheet and the screen does not move" (57 → 59; the `planScreen` helper now takes the
  navigation to watch). Recorded in `drift/G.md`.

- **F1 · board B check 5 (frame B4 "Show 14 creators")** — *What was wrong:* in Add creators ›
  All creators the Filters button always read "Show 0 creators": the server answered the picker's
  count-only question with an error and the phone prints a failed count as 0. Live since item 5.
  *What changed:* **already fixed by the server fixer** (their finding B-1, `drift/FINAL-server.md`):
  one guard in `backend/src/controllers/invitations.controller.js` `pickable`, and a server test.
  This fixer re-read the guard, ran that one server test against the local test database (1 of 1
  passed; no other jest process was running), and did not edit the server. The count answer is
  `{ tab, total }` without the `set` block the original finding suggested — the phone reads only
  `total`, so nothing is missing. *Which test (added here, phone side):*
  `screens/brand/__tests__/item5Brand.test.js` › NEW "B4: the Filters button asks the set's own
  list for a count and prints the number it is given, for each choice" — until now every phone
  test answered the count with a whole list, so the phone had never been shown the server's real
  count answer. Not done, as the server fixer also decided: turning a failed count into something
  other than 0 on the phone (`DiscoverList.js` / `BrandList.js`) — no frame asks for it.

## Files changed

App code (two files, both in this area):
- `Packages/Mobile/src/components/remote/bits11.js` — `ThreeWayCheck11`: opt-out prop `withNote`
  (default `true`); the note box is drawn only when it is true. Additive; no other export touched.
- `Packages/Mobile/src/components/remote/sheets11.js` — `ConfirmReturnSheet11` passes
  `withNote={false}`, no longer passes `onNote`; its comment says why.
- `Packages/Mobile/src/components/shell/FormScroll.js` — a comment only (U20).

Tests:
- `Packages/Mobile/src/components/__tests__/popupsAboveKeypad.test.js` — 2 assertions rewritten, 1 test added.
- `Packages/Mobile/src/components/remote/__tests__/remote11.test.js` — 1 added.
- `Packages/Mobile/src/components/remote/__tests__/cancelWhileBusy.test.js` — NEW, 20 tests.
- `Packages/Mobile/src/components/shell/__tests__/FormScroll.test.js` — 1 added.
- `Packages/Mobile/src/components/shoot/__tests__/shoot10.test.js` — 2 added; one helper takes a second argument.
- OUTSIDE this area, additive only (tests added, nothing existing changed):
  `Packages/Mobile/src/screens/__tests__/remoteScreens.test.js` (2) and
  `Packages/Mobile/src/screens/brand/__tests__/item5Brand.test.js` (1).

Records:
- `features/ui-walk-fixes/01-spec.md` — decision U20.
- `features/ui-walk-fixes/06-diff/drift/C0.md`, `C2.md`, `E.md`, `G.md` — the entries above.
- `features/ui-walk-fixes/06-diff/notes.md` — NEW.
- This file.

No testID was removed from a screen that still draws the thing it named (`confirm-check-{id}-note`
went with the box it named, on the brand's pop-up only; no Maestro flow or `qa/` script used it).
No copy changed. No file under `backend/` was edited by this fixer. Git was not touched.

## Tests run

- Phone, whole suite, `cd Packages/Mobile && npx jest --silent --maxWorkers=2`, 2 Oct 2026 after
  every change above: **91 suites · 2103 of 2103 passed · 0 failed · 0 skipped** (46.7 s). The
  build started this round at 2043; 28 of the added tests are this fixer's (FormScroll 1,
  popupsAboveKeypad 1, remote11 1, cancelWhileBusy 20, shoot10 2, remoteScreens 2, item5Brand 1),
  the rest were added by the other fixers working at the same time.
- The seven suites this fixer touched, on their own: 294 of 294.
- Server: `backend/tests/item5-invitations.test.js -t "Filters pop-up"` — 1 of 1 passed (the
  server fixer's test for F1, run once to verify their guard). No other server test was run by
  this fixer; no database was started, stopped or re-initialised.

## Still needs the walk (nothing here was seen on a phone)

- "What came back?" — mark an item Damaged: three buttons, no note box; Confirm sends.
- Plan the visit, Terms, the creator's content page — type in a lower box, close the keypad with
  Back: the form stays where it is and one swipe brings the top back (U20). Say at the walk
  whether the top should return by itself.
- The eight Remote-shoot pop-ups on a slow connection: the quiet button greys while the main one
  spins; on the delivery-address pop-up nothing else closes it until the send ends.
- Plan the visit → confirm → the visit screen opens with "sent" and the time chosen.
- Add creators › Filters: the yellow button shows a real number (needs the server deployed).
