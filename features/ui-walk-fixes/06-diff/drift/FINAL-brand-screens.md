# Final fixer — brand screens

One line per finding: what was wrong · what changed · which test. All four findings were re-read
against the code as it stood and all four are real; none was rejected.

- **A-1** (board mismatch · frame A3, "a refusal must appear where the person is looking") ·
  **What was wrong:** on New set, a refused "Save set" drew the red outline and the red line under
  the right box and did nothing else. The form is taller than a phone (about 840 points for a Store
  Visit set against about 600 of room), so a brand who left the name empty — which until this build
  she never had to type — and was scrolled down to the date saw no change at all: the name box was
  above the top of the screen · **What changed:** `screens/brand/BrandSetEditScreen.js` only. Save
  now also scrolls the form to the first box it refused, in the order the form draws them (name,
  Aim, mode, branch, date), and does the same when the server puts its refusal under one of those
  boxes. The red line stays under its own box, said once (frame A3, U10); no box is given the
  cursor, so the keypad stays closed; a box already on show is not moved; a refusal that is spoken
  (the plan limit, in the toast above the strip) moves nothing. Built with the helper the pop-ups
  already use (`useSheetReveal`), not with a hand-made offset, so a box is moved as little as
  possible · **Which test:** `screens/brand/__tests__/item4Brand.test.js` › "a refused Save is
  shown: the form scrolls to the first box it refused (frame A3)" — 8 tests (the name from the
  bottom of the form · the pool door, frame A4 · the date only, from the name with the keypad open
  · the uppermost of several · already on show: nothing moves · a good set: nothing moves · the
  server's refusal, and a spoken one · the boxes are where they were).

- **C-3** (wrong behaviour · board C rule 1 + the same lesson) · **What was wrong:** with every main
  button now in a strip directly above the keypad, it is pressed while only 270–420 points of the
  form are on show. On a screen (not a pop-up) a failed check drew its red line under its own box
  and left the form where it was, so the press could seem to do nothing. The pop-ups were given a
  scroll to the refused box in the review round (drift C2, finding 1); the screens were not ·
  **What changed:** the same scroll, on every screen the finding names. Nothing new is drawn,
  nothing is said twice, nothing moves at rest or when the box is already on show.
  - `screens/brand/BrandShootPlanScreen.js` — who to ask for, their number, Date / Time, what to bring.
  - `screens/brand/BrandCreatorTermsScreen.js` — fee, commission, what she sells (the red box under
    the two rows), deliverables, note, re-use places. The form's scroller is one node held by both
    users: the deliverables chooser and this scroll.
  - Outside this area, the smallest edit, because the creator-and-shared fixer was not given this
    finding and had already finished: `screens/influencer/CounterScreen.js`,
    `screens/shared/PitchCounterScreen.js` (both apps), `screens/influencer/MoveRequestScreen.js` —
    each box, and the form line at the very end ("Nothing changed", "Choose what to change", a
    refusal from the server).
  - Not Withdraw (one box, the line directly under it), as the finding says.
  · **Which test:** `screens/brand/__tests__/refusedBoxShown.test.js` (new, 17 tests: Plan the
  visit 7, Terms for a creator 10) and `screens/__tests__/refusedLineShown.test.js` (new, 15 tests:
  her counter 7, the pitch counter on both sides 4, Ask for a change 4). Each supplies the phone's
  measurements by hand, as `popupsAboveKeypad.test.js` does for the pop-ups.

- **F-4** (wrong behaviour · frame F4, the waiting sentence) · **What was wrong:** an agreement put
  out through the website's "Approve & Send" is out for her signature with no sent date. The brand
  tapped its "Waiting to sign" row and read "Sent to Sneha on . Waiting for her to sign by 17 Oct."
  — a sentence with a hole where the date belongs. Confirmed against the server
  (`agreement.service.js` sends `sentAt: null` for it) · **What changed:**
  `screens/brand/BrandAgreementScreen.js`, one condition: the blue box is drawn only when there is
  a sent date. The two "Not signed yet" boxes and "You sign after her…" still show, so the screen
  still says whose turn it is. No new wording · **Which test:**
  `screens/brand/__tests__/item7Brand.test.js` › "F4 — the waiting sentence is drawn only when
  there is a sent date to put in it" — 2 tests (the website shape: no box, no "Sent to", the
  signature boxes and the line present, no Withdraw · the phone shape: the dated sentence as F4
  draws it).

- **U10-04** (board mismatch · D2 / D6) · **What was wrong:** no code. On Review and send the
  banner over a refused batch can read one of two sentences the founder has not seen —
  "Nothing was sent. Changing their terms won't help — remove them and send the rest." and
  "Nothing was sent. Fix the ones you can, or remove them all and send the rest." — and they were
  written down only in `drift/C1a.md` · **What changed:** decision **U21** added to `01-spec.md`
  (standing autonomy, a consequence of D2): the row of a creator refused by her own rule says why
  when tapped instead of opening her terms, and the banner says "Fix them" only when something can
  be fixed; both new sentences quoted in full and marked "to be shown at the walk". The tap
  behaviour and the copy are unchanged · **Which test:**
  `screens/brand/__tests__/boardCBrandSetup.test.js` › Review and send › "the two sentences that
  are on no board are recorded in the contract (decision U21), word for word" — it reads the
  contract and fails if either sentence in `copy5.js` and the contract ever part ways.

## Proof the tests bite

Run once against a throw-away copy of the phone source outside the repo (the app files in the repo
were never edited for this; the copy has since had its link to `node_modules` removed):
- with the scroll taken out of the three brand screens, the date condition taken out of the
  agreement and the U21 row taken out of the contract: **17 tests fail** across the four brand
  files (item4Brand 5, refusedBoxShown 10, item7Brand 1, boardCBrandSetup 1); the ones that still
  pass are the "nothing moves" and "the boxes are where they were" tests, as they should;
- with the scroll taken out of the three creator / shared screens: **11 of 15 fail** in
  `refusedLineShown.test.js`.

## Assertions rewritten

None. No existing test was skipped, deleted, weakened or changed. 43 tests were added
(item4Brand +8, refusedBoxShown +17, item7Brand +2, boardCBrandSetup +1, refusedLineShown +15).

## testIDs

None removed or renamed. New, on the plain boxes the form is scrolled to:
- New set: `set-name-field`, `set-aim-field`, `set-mode-field`, `set-date-field` (`branch-row` kept).
- Plan the visit: `contact-name-field`, `contact-phone-field`, `plan-picker-field`, `notes-field`.
- Terms for a creator: `fee-field`, `commission-field`, `sell-field`, `deliverables-field`,
  `note-field`, `usage-field`.
- Her counter: `counter-commission-field`, `counter-fee-field`, `counter-deliverables-field`,
  `counter-usage-field`, `counter-note-field`, `counter-form-line`.
- The pitch counter: `pitch-counter-commission-field`, `pitch-counter-fee-field`,
  `pitch-counter-deliverables-field`, `pitch-counter-note-field`, `pitch-counter-form-line`.
- Ask for a change: `move-date-field`, `move-note-field`, `move-form-line`.

## Files changed

- `Packages/Mobile/src/screens/brand/BrandSetEditScreen.js` — A-1.
- `Packages/Mobile/src/screens/brand/BrandShootPlanScreen.js`, `BrandCreatorTermsScreen.js` — C-3.
- `Packages/Mobile/src/screens/brand/BrandAgreementScreen.js` — F-4 (one condition).
- `Packages/Mobile/src/screens/influencer/CounterScreen.js`, `screens/shared/PitchCounterScreen.js`,
  `screens/influencer/MoveRequestScreen.js` — C-3, **outside this area** (see above).
- `Packages/Mobile/src/screens/brand/__tests__/item4Brand.test.js`, `item7Brand.test.js`,
  `boardCBrandSetup.test.js` — tests added.
- `Packages/Mobile/src/screens/brand/__tests__/refusedBoxShown.test.js`,
  `Packages/Mobile/src/screens/__tests__/refusedLineShown.test.js` — new.
- `features/ui-walk-fixes/01-spec.md` — decision U21.
- This file.

No shared piece was edited: `useSheetReveal` is imported from `components/settings/sheets.js` as it
is (it works on any ScrollView; its name still says "Sheet"). No copy file, no navigator, no server
file was touched.

## For `06-diff/notes.md`, when it is written

New wording for the founder's walk, next to the tap behaviour in `drift/B.md` ("Behaviour that moved
with it"): the two Review-and-send sentences of decision U21. If the founder rejects them, only
`copy5.js` `C5.review.failedBodyRemove` / `failedBodySome` change (and the three pinned strings in
`boardCBrandSetup.test.js`, and the U21 row); the tap stays.

## Behaviour that moved (for the walk)

- A refused main button on New set, Plan the visit, Terms for a creator, her counter, the pitch
  counter and Ask for a change now scrolls the form to the first thing it refused. With the keypad
  closed and the box on show, nothing moves.
- A website-approved agreement that is waiting for her signature opens on the brand's phone with no
  blue box (it used to show the sentence with the hole).

## Not provable without a phone

Where the scroll lands on a real phone (jest is handed the measurements), and that it reads well
with the keypad open on a small phone. The arithmetic is the pop-ups' own
(`sheetScrollFor`, tested in `sheetFit.test.js`): a box that fits is shown whole and moved as
little as possible; one taller than the room is shown from its bottom edge, where the red line is.

## Noticed, left alone

- The same website-approved agreement has no reference number either, so the brand's phone heads it
  "DRAFT" while it is in fact out for her signature. No approved wording exists for that state and
  the finding did not cover it; a founder decision (or stamping a reference at the website's
  Approve & Send, a server change).
- `useSheetReveal` could be given a neutral name and lifted beside `FormScroll` now that screens use
  it too. It lives in the components area; importing it needed no edit there.
- On Terms for a creator, Review and send still sends the brand back to a creator whose terms fail
  the phone's own check without drawing the red line on arrival (the form opens clean; "Next"
  draws it). As before this build.
