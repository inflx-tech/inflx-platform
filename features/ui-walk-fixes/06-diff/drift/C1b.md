# Drift — slice C1b (board C · brand: agreement, conversations, shoot, remote, content, going live)

Files: `screens/brand/{BrandAgreementScreen, BrandThreadScreen, BrandShootPlanScreen,
BrandShootScreen, BrandRemoteScreen, BrandRemoteBookScreen, BrandRemoteProductsScreen,
BrandContentScreen, BrandSaleLiveScreen}.js` · `components/invitations/sellSheets.js`
(ChooseProductsModal). Looked at and left: `BrandPitchScreen.js` (its answers are drawn in the
page, frame E7 — nothing floats and nobody types there).

## Assertions rewritten

One line each: test file · test · asserted · asserts now · which frame / decision.

- `src/screens/__tests__/levelButtons.test.js` · "E6 — she asked for another date: three answers
  in the same shape, "Keep {date}" the dark outline with no arrow" · the page's bottom room was 150
  until the floating bar had been measured, then the bar's height + 18 (a layout event of 137 on
  `move-actions` gave 155) · the strip `move-actions` is not `position: 'absolute'`, has no
  `bottom`, carries no `onLayout`, and the page's content padding is exactly `{ padding: 18 }` ·
  board C rule 1 (frames C1 / C8): the bar is a strip in the column, so nothing is measured and no
  room is kept for it. Every other assertion of that test is untouched.

Nothing was skipped, deleted or weakened. No other existing test pinned a floating bar, the dead
padding or a toast's position on these screens; `item5Brand`, `item6Brand`, `item7Brand`,
`item8Brand`, `actionsStatuses`, `contentScreens` (brand part), `saleLiveScreens` (brand part),
`remoteScreens`, `shoot10` pass unchanged.

## Behaviour that moved (for the walk) — what a test did NOT pin before

- **The button strip is in the column on nine screens and one full-screen pop-up.** It was
  `position: 'absolute', bottom: 0` over the page on Plan the visit, the store visit, the Remote
  shoot, Book the parcel, Pick products, the content step, going live, the counter conversation
  and "Choose products". It is the shared `BottomBar` under the page now. (Board C rule 1.)
- **The dead space at the end of those pages is gone.** `paddingBottom` 120 (Plan the visit,
  Choose products), 150 (store visit, Pick products, the conversation's un-measured default) and
  190 (Remote shoot, Book the parcel, content, going live) existed only to scroll clear of the
  floating bar. The pages end with their ordinary 18 (16 in Choose products). The agreement's
  page keeps its 16 / 40 — its bars never floated.
- **The conversation no longer measures its bar.** Board E had the page keep "the bar's measured
  height + 18" under its last line. In the column there is nothing to clear; the `onLayout`, the
  state and the 150 fallback are removed.
- **The strip's own measure is the shared one.** 14 all round plus the phone's bottom inset. The
  old bars had 22 under the last button (the agreement's Send / Sign / Withdraw footers had 16 all
  round), so the buttons sit 8 lower (2 lower on the agreement) on a phone with no bottom inset.
- **An outline button stacked in a strip is 8 under the one above it, not 18.** The outline
  button carries a built-in 10 top gap that the old bars added to their own 8. In `BottomBar` it
  drops it (wave 1's rule). Seen on: the store visit ("Move the visit" alone now starts 14 under
  the hairline, was 24), the Remote shoot ("Book the parcel", "Download label", "Open the
  content"), Book the parcel ("Back to products"), the content step ("Ask for changes", "Report
  to INFLX"), going live ("Ask for changes").
- **No empty strip.** The store visit, the Remote shoot, the content step and going live drew
  their bar even when the stage offered no button: an empty white strip with a hairline, 36 high,
  floating at the foot of the page. `BottomBar` draws nothing when it has nothing to hold, so in
  those states (`brand-shoot-actions`, `brand-remote-actions`, `brand-content-actions`,
  `brand-sale-actions`) the testID is absent, as `brand-thread-actions` always was while waiting.
- **The agreement has one kind of strip.** Send for signature, Sign, Withdraw and the
  after-both-signed pair (wave 2) are all `BottomBar`; the old `s.footer` is gone.
- **The agreement's title bar starts at the phone's top inset + 4**, like the shared header
  (D4 / frame B9). It was a fixed 10 above the title with no inset at all, so on a phone that
  draws edge to edge it started under the status bar. The 4 is the gap kept above a 40-high back
  control, so the back control's box is 40 high now (it was as tall as its arrow, about 31) —
  the same as the shared header and as the creator's agreement, which another slice changed the
  same way. The bar is therefore 4 + 40 + 10 = 54 tall, the shared header's height (it was about
  51), and the title sits on the same line as every other pushed screen's. The arrow, the centred
  title, the bottom padding and the hairline are unchanged.
- **The toast sits 16 above the strip.** On the agreement, the conversation, the store visit, the
  Remote shoot, Book the parcel, Pick products, the content step and going live it is drawn inside
  the box that holds the page (`useToast({ inFlow: true })`). It was 110 above the screen's bottom
  edge, which a tall strip (the conversation's three answers, the Remote shoot's stack) reaches.
  In a state with no strip, and on the agreement's loading / couldn't-load / empty states, it is
  16 above the screen's bottom edge.
- **Pick products: the refusal line lost its own 8 bottom margin.** The strip already keeps its
  children 8 apart, so the line is still 8 above "Continue" (it would have been 16). Book the
  parcel is unchanged at 16 — its old bar already had the 8 gap as well as the line's 8.
- **A refused counter is said inside the counter pop-up.** `BrandThreadScreen` used to raise the
  server's sentence as a toast, which is drawn behind the open pop-up. It now hands it to
  `BrandCounterSheet6` as `serverError` (the sheet prints it above "Send counter"), raises no
  toast, and keeps the pop-up open with what was typed. Closing the pop-up, opening it again or
  sending again clears it. A refused Decline or a refused answer to a move request is unchanged
  (still a toast): those two sheets take no `serverError` — see the report's follow-ups.
- **After a refused counter the conversation is read again when the pop-up is CLOSED, not behind
  it** (review round). It used to be read again the moment the refusal arrived. With no signal
  that second read failed too, "Couldn't load" replaced the whole page, and the pop-up went with
  it — everything typed, and the refusal nobody had yet seen. Now nothing is read while the
  counter pop-up is open; closing a pop-up that showed a refusal reads the conversation (the same
  rule the agreement's Send / Withdraw sheets follow). Closing one that showed no refusal reads
  nothing, as before.
- **A pop-up never comes back by itself after "Try again"** (review round). If the conversation
  cannot be read while a pop-up is marked open (counter, decline or move), the screen forgets the
  pop-up and any refusal it held. Before, "Try again" reopened it unasked — the counter one with
  the old refusal still in it.
- **A counter refused after the brand has already closed the pop-up** (a slow send) is a toast
  and the conversation is read again — the pop-up is not there to say it, and nothing covers the
  toast. This is what every refusal did before this slice.
- **The lines under the box being typed in come into view** on Plan the visit, Book the parcel,
  Pick products and Choose products: the page is a `FormScroll` (default 64 under the box).
  (Board C rule 3, frames C1–C3.)

## New testIDs (none removed)

`plan-actions`, `plan-form` (Plan the visit) · `book-actions`, `book-form` (Book the parcel) ·
`products-actions`, `products-form` (Pick products) · `choose-actions`, `choose-list` (Choose
products) · `brand-shoot-scroll`, `brand-remote-scroll`, `brand-content-scroll`,
`brand-sale-scroll` (the plain pages) · `agreement-bar` (the agreement's title bar).

## New tests

`src/screens/__tests__/brandWorkStrips.test.js` — 71 tests:
- twelve screen states with a strip (store visit ×2, Remote ×2, content, going live, the
  conversation ×2, the agreement ×4): title row → the box that holds the page → the strip as the
  very next child of the screen; the strip is exactly the shared one and never absolute; it holds
  every button it had, in order; the page ends with its ordinary padding and no spacer;
- six states with nothing to press: no strip at all, no empty hairline;
- what the strips carry besides buttons (the grey "Opens when her address arrives." line, the
  call link after "Send a new time", an outline button at the strip's 8);
- Plan the visit (C8 at rest with every box, counter and hint still there; C1 typing in "Anything
  she should bring or know" scrolls the lines under it into view; Send still raises the form's
  refusals), Book the parcel, Pick products, Choose products — each: the column, the FormScroll,
  the controls, the refusal line as the strip's first child, the reveal on focus;
- the toast inside the box above the strip on six screens, and on the agreement while loading;
- the agreement: the four strips are one kind; the title bar at inset 0 and at inset 31, equal to
  a screen that uses the shared header; the same bar on the couldn't-load state;
- the refused counter: `serverError` on the pop-up, no toast, the pop-up stays open, cleared on
  close / reopen / resend, a refusal with no sentence, and a counter that then goes through;
- the refused counter, review round (4 new tests, and one of this slice's own rewritten — it had
  asserted the re-read behind the open pop-up, which was the fault): nothing is read behind the
  open pop-up and closing it reads once; with no signal the page never turns into "Couldn't
  load", the typed commission and note are still in the boxes, the refusal is printed in the
  pop-up, a second Send sends the same counter, and after close → "Couldn't load" → "Try again"
  no pop-up and no old refusal come back; the same "does not come back by itself" for a read
  that fails under an open counter pop-up and under the decline pop-up; a refusal that arrives
  after the pop-up was closed is a toast and a re-read;
- source guards on the ten files: no `position: 'absolute'`, no 1xx bottom padding or spacer, no
  `onLayout=`, `BottomBar` imported and used; the toast in-flow and inside `</FormArea>`; the
  three typing screens use `FormScroll` and no plain `ScrollView`.

## Not provable without a phone

That each strip sits directly above the keypad and the page really shrinks (jest has no keypad);
FormScroll's scroll on a real keypad (the phone's answers are supplied by hand in the tests);
"Choose products" — a full-screen pop-up has its own window: that the strip rides above the
keypad there too, that FormScroll's three measurements agree inside it, and that the shared
header / strip insets are right in that window on a phone that draws edge to edge; the agreement
title bar's height against the shared header's by eye; the toast's look above a tall strip.
