# Diff notes — ui-walk-fixes

Against the locked board `04-preview/mockups/ui-walk-fixes-mockups-v1.html` (boards A–J, locked by
the founder on 2 Oct 2026; decisions U1–U26 and D1–D6 in `01-spec.md`). The detail behind every
line here is in `06-diff/drift/*.md` — one file per slice, plus `FINAL-*.md` for the last review.

## Where this stands — read this first

- **Nothing in this contract has been seen on a phone.** Every line below is from the code and
  from the test runs. There is no device walk yet and **there are no after-shots in this folder**:
  the board has no capture descriptors beside it, so the shots have to come from a phone (the
  way `offer-add-products/06-diff/after-*.jpg` did), on a normal and a small (360×760) phone,
  keypad closed and keypad open.
- **Check 11 ("keypad closed, each screen matches its locked board") is NOT RUN**, and so is every
  check in `03-expected-outputs.md` marked "Walk". Jest cannot see a layout, a keypad, the tab bar
  or a video; what Jest proves is the structure that makes them work and every behaviour around
  them.
- This file existing is what the release gate (Rule 4) looks for. **It is not the diff sign-off.**
  The walk and the shots are still owed, and the push and each OTA still need the founder's go.
- The Status column of `03-expected-outputs.md` is filled from the final review (which test proves
  which check) and the two full runs. Every row that needs a phone reads "walk owed".

## What was implemented

- **A · the set name.** A new set's name box opens empty with the grey example "e.g. Festive
  sarees" from all three doors (new campaign, add another set, the pool). The name is required.
- **B · Add creators.** One control row (search + a Filters button reading "Filters · N"), the
  campaign / set line in the title bar, the compact three-line creator row with no tag line (D1),
  a creator who can't be invited says why — short line on her row, the sentence when tapped (D2);
  the footer steps away while typing. Server: which rule failed, worded once
  (`collabEligibility`), and the "Worked with" tab that had answered an error since item 5 (U6d).
- **All screens.** Bottom tabs only on the five main pages of both apps (D3); no blank strip above
  any title — the title bar starts at the phone's real status-bar inset (D4).
- **C · the keypad.** The main button is a strip in the column under the page on every screen of
  both apps that had a floating bar (about forty), built on one shared strip. The page is a
  `FormScroll`: the box being typed in, with its counter, hint and error line, is brought above
  the strip. Pop-ups with a text box or a long list stop below the status bar, scroll, and keep
  their buttons pinned above the keypad.
- **D · deliverables.** One line per deliverable — type box, minus / number / plus, remove; the
  type list opens in place; "+ Add another" is a button and goes at five. Same control in all five
  homes; what is sent is unchanged.
- **E · level buttons.** One main button, then two level choices at least 44 tall; decline is a
  red outline. After both sign: the state button full width, Download under it.
- **F · actions and statuses.** The next step on a creator's row is a labelled button; a status is
  a tag with an icon; the row does what its button does. After Send the brand stays on the sent
  agreement and reads who is waited for; a refusal is said inside the sheet; a sent or signed
  agreement can be reopened; a withdrawn one can be sent again (server, U6a). The server now says
  whose turn a store visit is (U6c) and three counts / flags / sentences tell the truth (U6e).
- **G · date and time.** Two boxes, nothing pre-chosen; a calendar and a list of 15-minute times,
  7:00 am – 8:45 pm; past times greyed; on Plan the visit, Ask for another time and the move sheet.
- **H · the file viewer.** One tap opens a photo or video inside the app on all four content
  screens; the private link is renewed quietly; app builds without the player say so and offer
  the browser.
- **J · live links.** A link saves itself (paste, 0.7 s after typing, Done, leaving the box) and
  shows saving / saved / refused; "I've posted everything" turns on when every box has text and
  finishes the saving itself; "https://" is added when missing (D5).

## What matches the locked board

As built and as pinned by tests — **not as seen**: the AFTER / NEW frames of every board (A1–A4,
B1–B10, C1–C8, D1–D8, E1–E12, F1–F8, G1–G10, H1–H8, J1–J7), except where the next section says
otherwise. For board C that means the structure (the strip in the column, the focused box
revealed, pop-ups pinned), since Jest has no keypad. Wording is the board's wherever the board
gives wording; sentences the server composes are the same on both sides. Which test proves which
frame is in each slice's drift file.

## Where it differs from the board, or adds to it

Decided in the spec (binding; listed here so they are looked at):
- **U20 · frame C2's caption "…back in place when the keypad closes".** On a form longer than the
  screen (Plan the visit, Terms, the creator's content page) closing the keypad leaves the form
  where typing put it; one swipe brings the top back. Forms that fit return by themselves. Same
  as the live app before; nothing got worse. **To be shown at the walk** — if the top should
  return by itself, that is a further build (`drift/C0.md`).
- **U18 · frame H2's video bar.** It is the player's own: no sound button (the viewer adds one,
  top right), and it carries back / forward 10 s, full screen and greyed previous / next that the
  frame does not draw; it hides after a few seconds. **To be shown at the walk.**
- **U19 · at rest, three small things moved on every screen whose bar became the shared strip:**
  the main button sits about 8 lower; an outline button stacked under another is 8 below it, not
  18; a stage with nothing to press draws no empty white strip.
- **U17 · five pitch screens gained the shared title bar with Back** (they relied on the bottom
  tabs to get out). On no board; a consequence of D3.
- **U21 · Review and send:** a creator refused by one of her own rules says why when tapped and
  does not open her terms; the banner has two new sentences ("…Changing their terms won't help —
  remove them and send the rest." / "…Fix the ones you can, or remove them all and send the
  rest."). Not in the board's approved new-words list. **To be shown at the walk.**
- **U4 · tap size.** Second-row buttons, "+ Add another" and list rows are at least 44 tall where
  the boards draw 32–38.
- **G6 · "Ask for another time" stays a full screen**, not the bottom sheet item 10's board draws.

Decided after the final review (spec U22–U26; closing build of 2 Oct evening):
- **U22 · the creator's Invitation settings** no longer says "Your categories, cities, minimum fee
  and commission stay private." / "…Only you see this." Since D2 a brand she has ruled out is told
  which rule it was. New sentences: "Brands never see your category or city lists. A brand you've
  ruled out is told which rule it was, nothing more." and "None picked means any category. Brands
  never see your list — a brand outside it is told only that you aren't taking its category."
  **To be shown at the walk.** Still open: the minimums hint beside them begins "Only you see
  these.", which has been untrue since item 5 (the brand's terms screen shows her minimums).
- **U23 · countering switched off.** When she may still ask for another date, the invitation's
  second button reads "Ask for another date" and opens that request directly. It read "Counter"
  and led to a counter the server refused. Frame E2 (Accept, Decline alone) is what she sees once
  she cannot ask for a date either. The same button shows on an open-group invitation and when
  her counters are used up (the server allows a date request in both). **To be shown at the walk.**
- **U24 · a Remote agreement signed by both** keeps its ticks and step line above the stacked
  buttons; frame E12's "Next" card is not forced onto it.
- **U25 · creator cards.** An Active card waiting on the brand says "Next · {Brand} plans your
  store visit" or "Next · They ship your products"; a brand-new invitation that is hers to answer
  carries "Your move" and an "Open" button.
- **U26 · photos** opened in the viewer stay in the app's own private picture cache (as the small
  tiles always have); only video is never stored. Native work; next app-build list.
- **"Counter sent."** now shows on the pitch conversation after a counter (it was handed over and
  never read). The Delivery note on her Remote address shows its own grey words again (a copy key
  written twice was showing "What was wrong?").

Changes outside every board of this contract (each is recorded in drift, none is silent):
- **"What came back?" (brand, Remote shoot) — the note box under Missing / Damaged is gone.** It
  never kept what was typed (every letter vanished; the server's confirm step takes no note).
  Item 11's own locked R13 draws three buttons per item and no note, so this restores that frame.
  The creator's own check keeps her note. Saving the brand's note would be new behaviour and a
  server change — not built; a founder decision (`drift/C2.md`).
- **Eight Remote-shoot pop-ups: the quiet button is off while the request runs.** The shared
  outline button now obeys `disabled`, which it used to ignore; the only callers already passing
  it are the "Not yet" / "Keep it booked" / "Not now" of: Finished shooting? · the pickup day ·
  I've sent it back · cancel a booking · let her keep an item · report to INFLX · What came back?
  (`components/remote/sheets11.js`) and the delivery-address confirm (`RemoteAddressScreen`).
  Before: tappable mid-request. Now: greyed, no tap, until the request ends. The seven sheets
  still close on a tap outside or Back; the delivery-address pop-up cannot be closed until the
  send ends (`drift/E.md`).
- **Terms for a creator — one form per creator.** Tapping a creator's row on Review and send used
  to open the LAST creator's numbers under her name (live since item 5). Fixed; no screen looks
  different (`drift/C1a.md`, review round).
- **Add creators › Filters — "Show N creators".** The button always read "Show 0 creators": the
  server answered the picker's count with an error (live since item 5). Fixed on the server; an
  app already on a phone shows the right number once the server is deployed
  (`drift/FINAL-server.md`).
- **Brand set row, agreed store visit** reads "Store visit agreed for Sun 18 Oct, 11:00 am" (the
  frame's words); it read "Store visit Sun 18 Oct, 11:00 am" (`drift/FINAL-server.md`).
- **Remote rows and cards** show where the shoot really is; they showed the first Remote sentence
  for the whole shoot (a server query never sent what it computed — `drift/F.md` 1b).
- **A finished collaboration's row** carries the purple "Completed" tag, not a green "Active".
- **Both agreement screens' title bar** starts at the phone's top inset like every other screen
  (it started under the status bar on an edge-to-edge phone) and is 54 tall (was about 51).
- **Toasts** on screens with a strip sit 16 above the strip (were 110 above the bottom edge).
- **Pop-ups:** a refusal is drawn with the buttons, not above the last hint; "Ask for changes" is
  the level pair; the brand's "Counter back" scrolls as one; a refused counter is said inside the
  pop-up; Decline shows its spinner and "Declining"; five long list pop-ups scroll with their
  button pinned (`drift/C2.md`).
- **Deliverables:** "+ Add another" opens the list and adds nothing until a type is chosen; a type
  can be on one line only; counts that arrive wrong are put right on arrival (`drift/D.md`).
- **Links:** a saved link is shown short over the box while she is not in it; the box always holds
  the whole link; one leaving of a box sends its link once (`drift/C1c.md`, `drift/J.md`).
- **Navigation:** a jump from one tab into an inner screen of another always lands with that
  tab's main page underneath (eight call sites, `drift/S0b.md`).
- **Colour:** a signed invitation's state is green ("active") where it was purple, on the brand's
  row, her Active card's wallet line and her Invitation screen's pill (`drift/F.md`).
- **Brand's counter pop-up and pitch counter** label the block "What she delivers" (U15).

Assertion drift (tests rewritten to the locked board; none skipped, deleted or weakened) is listed
test by test in each `drift/<slice>.md`.

## What to check at the walk

On a normal phone and a small one, both apps. Check numbers are `03-expected-outputs.md`'s.
1. **Check 4, 4a** — bottom tabs on the five main pages only; no blank strip above any title; the
   title under the status bar; both agreement screens' title on the same line as every other.
2. **Check 7, 8** — Add creators on a 360×760 phone: about five creators on arrival; footer gone
   with the keypad; the creator app's Find brands exactly as before.
3. **Check 9** — Plan the visit, Terms, counter screens, Content, Sale, settings and profile
   forms: keypad open, the focused box, its counter and hint visible, the strip above the keypad.
   Then close the keypad with Back on Plan the visit, Terms and the creator's content page: the
   form stays put and one swipe brings the top back (**U20 — say whether it should return by
   itself**).
4. **Check 10** — Send counter, Move the time, Ask for changes, the sign and decline sheets: note
   box visible, buttons above the keypad. "What came back?": mark an item Damaged — three buttons,
   no note box.
5. **Check 11** — keypad closed, each screen against its frame; take the after-shots here.
6. **Check 16, 17** — the level pairs by eye; after both sign, the state button and Download.
7. **Check 32** — a large video and a 10 MB photo on both apps; play past 5 minutes and drag back;
   full screen; the player's own bar (**U18**).
8. **Review and send** — refuse a batch with a paused creator in it: the banner sentence (**U21**),
   her row says why, the others open their own terms.
9. **Remote shoot, slow connection** — the eight pop-ups: the quiet button greys while the main
   one spins; the delivery-address pop-up stays until the send ends.
10. **Add creators › Filters** — the yellow button shows a real number (after the server deploy).
11. Everything each drift file lists under "Not provable without a phone".

## Test record

- **Phone**, whole suite (`cd Packages/Mobile && npx jest --silent`), 2 Oct 2026, on the final
  tree after the closing items: **94 suites · 2153 of 2153 passed.** The suite was 840 of 840
  before this contract. The three crash-class guards (`importsResolve`, `hooksBeforeReturns`,
  `accessibilityStateBooleans`) pass.
- **Server**, whole suite, serially, 2 Oct 14:17–14:39 IST (`backend-compare.txt`): 139 suites ·
  1870 tests · 1665 passed · 177 failed · 28 skipped, against the last stored full run (1 Oct):
  **0 tests that passed before fail now; 0 new tests fail**; the 177 reds are the same 177, name
  for name. A second full run on the final server code, 16:25–16:48 IST: 139 suites · 1871 tests ·
  1666 passed · 177 failed · 28 skipped — the same 177, name for name; the one added test passes.
  No server file changed after it.
- **Maestro** (`pnpm qa:maestro`) and `pnpm qa`: not run for this contract. `release.qa_all_green`
  and `release.maestro_green` in `lock.json` are untouched (false) and are set only by a real run.

## Release (production-impacting — explicit go before each step)

1. Server push first (safe alone; older app bundles read every change). The phone source must not
   go out before it: without `shoot.yourMove` a store-visit row shows no button.
2. OTA brand, then OTA influencer, one at a time, manifests read back.
No migration, no money moves, no new app install. Rollback: publish the previous OTA bundles and
revert the server commit.
