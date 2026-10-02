# Drift — slice C1c (board C · the creator's screens and the screens both apps share)

Files: `screens/influencer/{InvitationScreen, ThreadScreen, CounterScreen, MoveRequestScreen,
ShootScreen, RemoteShootScreen, RemoteAddressScreen, ContentScreen, SaleLiveScreen,
PitchFormScreen, PayoutDetailScreen, AgreementScreen}.js` ·
`screens/shared/{PitchCounterScreen, PitchThreadScreen, ShootCounterScreen, ShootThreadScreen,
ChangeNumberScreen}.js` · `screens/create/{CollectionScreen, NewCollectionScreen,
PostReviewScreen}.js` · `screens/wallet/WithdrawScreen.js` · `components/content/bits12.js` (the
link box and the screen's line of saves only).

## Assertions rewritten

One line each: test file · test · asserted · asserts now · which frame / decision.

Older tests (written before this build):

- `src/screens/__tests__/contentScreens.test.js` · "34 · J2 → J3 · a paste is sent at once,
  without leaving the box…" · once the link was saved and she was not in the box, the box's own
  `value` was the cut-down form `instagram.com/reel/C8xK2` · the cut-down form is read from the
  text drawn over the box (`link-reel:1-short`) and the box's `value` is the whole link · wave-2
  review of board J (frame J3): the short form is shown, never made the box's text.
- same file · "D5 · a link without "https://" in front gets it before it is sent; an emptied box
  clears the link" · same change (`link-reel:1-short` is the short form, `value` is
  `https://instagram.com/reel/C8xK2`) · same reason.
- same file · "36 · two boxes pasted one after the other…" · same change, on both boxes · same
  reason.
- `src/screens/__tests__/saleLiveScreens.test.js` · "34 · J6 · one link saved, one saving, the
  Story without its screenshot…" · same change (`link-s1-short` / `value`) · same reason.
- same file · "35 · J7 · a link outside the package saves by itself and shows the tick…" · same
  change (`link-o1-short` / `value`) · same reason.

This build's own new tests (boards E and J, written earlier today) that this slice changed:

- `src/screens/__tests__/levelButtons.test.js` · her invitation, the test now named "the answers
  are a strip in the column under the page — never floating over it — and the page ends with its
  ordinary 18, however tall the strip" · the page kept the floating bar's measured height + 18
  under its last line (140 until the bar had been measured) · `answer-actions` is not
  `position: 'absolute'`, has no `bottom`, carries no `onLayout`, sits directly after the box
  that holds the page, and the page's padding is exactly `{ padding: 18 }` · board C rule 1
  (frames C1 / C8).
- same file · "with no bar at all (answered, no agreement yet) nothing is drawn under the page,
  and the page still ends with its 18" · the page's bottom room with no bar · the page's padding
  is `{ padding: 18 }` and neither strip is drawn · same.
- same file · the same pair for her conversation (`thread-actions` / `thread-scroll`): "her
  answers are a strip in the column under the page — never floating over it" and "waiting on the
  brand: no bar, and the page ends with its 18 (no room kept for a bar that is not there)" · the
  measured room · the strip in the column and the plain 18 · same.
- same file · "the brand: Accept, then Counter back and Reject, level" (the pitch conversation) ·
  its last lines checked "140 until measured, then the bar's height + 18" · they check the strip
  in the column and the plain 18 (`pitch-thread-actions` / `pitch-thread-scroll`) · same. Every
  button assertion of that test is untouched.
- `src/components/content/__tests__/linkBox12.test.js` · "J3 · a link INFLX has: the tick beside
  it and the short form on show; inside the box, the whole link" · the box's `value` WAS the short
  form while she was not in it · what she sees is the short form (the text laid over the box),
  what the box holds is the whole link, and an empty box has nothing laid over it · wave-2 review
  of board J: that old behaviour was the fault.

Nothing was skipped, deleted or weakened. No other existing test pinned a floating bar, the dead
padding, a toast's position or the link box's text: `item5Creator`, `item6Creator`,
`item7Creator`, `item8Creator`, `creatorTerms12`, `remoteScreens`, `wallet17`, `create13`,
`links14`, `changeNumber`, `shoot10`, `content12`, `remote11` pass unchanged.

## Behaviour that moved (for the walk) — what no test pinned before

- **The button strip is in the column, under the page, on twelve screens.** Her invitation, her
  counter conversation, her counter ("Send counter"), "Ask for a change", the pitch counter and
  the pitch conversation (both apps), the store visit, the time conversation and "ask for another
  time" (both apps), the Remote shoot, her content step, going live, and Withdraw (both apps).
  Each was `position: 'absolute', bottom: 0` over the page; each is the shared `BottomBar` now.
  (Board C rule 1, frames C1–C4, C8.)
- **The empty space at the end of those pages is gone.** `paddingBottom` 120 (the counters, "Ask
  for a change", "ask for another time", Withdraw), 140 (the invitation and the two
  conversations' un-measured default), 160 (the time conversation), 170 (the store visit) and 190
  (the Remote shoot, content, going live) existed only to scroll clear of the floating bar. The
  pages end with their ordinary 18.
- **Nothing measures a bar any more.** Board E had her invitation, her conversation and the pitch
  conversation keep "the bar's measured height + 18" under the last line. The `onLayout`, its
  state and the 140 fallback are removed.
- **The strip's own measure is the shared one.** 14 all round plus the phone's bottom inset. The
  old bars had 22 under the last button (18 on Withdraw), so on a phone with no bottom inset the
  buttons sit 8 lower (4 on Withdraw).
- **An outline button stacked in a strip is 8 under the one above it, not 18.** The outline
  button's own 10 top gap goes inside a strip (wave 1's rule). Seen on: the store visit ("Ask for
  another time"), the time conversation ("Ask for another time" / "Suggest another time"). Where
  the outline button is the strip's first or only button it starts 14 under the hairline, was 24:
  the Remote shoot ("Go to your content" / "Go live" above the return button), "Ask INFLX to look
  at it" on the content step and "Ask INFLX to look" on going live.
- **No empty strip.** The store visit, the Remote shoot, her content step and going live drew
  their bar even when the stage had nothing to press: an empty white strip with a hairline
  floating at the foot of the page. `BottomBar` draws nothing when it holds nothing, so in those
  states the testIDs `shoot-actions`, `remote-actions`, `content-actions` and `sale-actions` are
  absent — as `thread-actions`, `pitch-thread-actions` and `shoot-thread-actions` always were
  while waiting.
- **The toast sits 16 above the strip.** On the twelve screens it is drawn inside the box that
  holds the page (`useToast({ inFlow: true })`). It was 110 above the screen's bottom edge, which
  a tall strip (three answers, two grey lines) reaches. On the invitation and the three
  conversations, while there is no strip, it stays where it was (110). On the store visit, the
  Remote shoot, content and going live, in a stage with no strip, it is 16 above the bottom edge.
- **The lines under the box being typed in come into view** (the page is a `FormScroll`, 64 kept
  under the box) on: her counter, the pitch counter, "Ask for a change", "ask for another time",
  the Remote shoot (the note about a missing or damaged item), her content step (captions and
  links), going live (captions and links), Withdraw — and on the forms where nothing floated: the
  pitch form, her delivery address, a payout detail, one collection (the rename box), Change
  number, a new collection (the name and the product search) and reviewing a post (the caption).
  On Change number 88 are kept under the box, because the red "this number already has an
  account" note is taller than an error line. (Board C rule 2, frames C1–C4.)
- **With the keypad open, the first tap on a row or a link works** on a new collection (picking a
  post or product), on reviewing a post ("Edit") and on one collection ("Save" of the rename).
  Those three pages were plain scrollers, which spend the first tap closing the keypad.
- **Frame C4 / J2 on a phone.** With the strip in the column and the page a `FormScroll`, the
  link box she has just pasted into stays above "I've posted everything" and its line while the
  strip changes height.
- **A saved link's short form is drawn over the box; it is no longer the box's text.** The box
  always holds the whole link (unseen while she is not in it — the text is transparent and
  `instagram.com/reel/C8xK2ab…` is laid over it, touches pass through). Before, the short form
  was the editable text until the focus event had been handled, so a keystroke that landed first
  was saved — dots and all — as the link. New testID `{box}-short`. A screen reader reads the box
  (the whole link), not the drawing.
- **One leaving of a link box sends its link once.** After a save that got no answer, Android's
  end-editing + blur (and Done + both) for one leaving used to queue the same link twice; when
  the first retry also got no answer the second went out too. The retry a leaving starts is now
  the only one until it is answered. A later leaving is a new try.
- **The brand's pitch counter says "What she delivers"** (spec U15). The creator's keeps "What
  you'll deliver". Both strings already existed (`C5.terms.delivers`, `C6.counter.delivers`).
- **A refusal about the deliverables lands on the deliverables line on her counter** — the server
  names it `formats_json`, which the screen filed under a key nothing draws, so it fell to the
  line at the very end of the form. Same for `agreed_fee` → the fee, `commission_pct` → the
  commission, `usage_rights_json` → the reuse line (only while the switch is on). Anything the
  screen has no line for is still said on the form line. (As the pitch counter since board D.)
- **Her counter and the pitch counter use the one shared rule for the deliverable lines**
  (`deliverableRowsError5`: no type twice, each count 1 to 20) instead of their own copies. Same
  sentences, same order ("Add at least one thing…" first).
- **Her agreement's title row starts at the phone's top inset + 4** (D4 / frame B9), like the
  shared header and the brand's agreement. It was a fixed 10 above the title with no inset. The
  back control's box is 40 high (it was as tall as its arrow), so the row is 4 + 40 + 10 = 54,
  the shared header's height. Nothing else on that screen changed: its Sign / Decline footer was
  already part of the column and keeps its own measure (16 all round).

## Left as it was, on purpose (U10)

- **Strips that never floated keep their own measure.** Her agreement's Sign / Decline footer
  (16 all round), Change number's footer (14, 22 under the button) and the Create tab's shared
  `Footer` (16 all round; `components/create/bitsCreate.js`, eleven screens) were already in the
  column. They are not swapped for `BottomBar`: with the keypad closed that would move the button
  a few points for no reason a frame gives.
- **The page padding of forms without a strip** (the pitch form 16 / 40, her address 18 / 40, a
  payout detail 18 / 40, one collection 16 / 40) — the 40 never cleared a bar.
- **Her address's "review" pop-up** is drawn by the screen itself (not the shared Sheet) and holds
  no text box; untouched.
- The toast on screens without a strip (the pitch form, her address, a payout detail, one
  collection, her agreement) stays 110 above the bottom edge.

## New testIDs (none removed)

`invitation-scroll`, `thread-scroll`, `pitch-thread-scroll`, `shoot-thread-scroll`,
`shoot-scroll` (the plain pages) · `counter-scroll`, `counter-actions` · `pitch-counter-scroll`,
`pitch-counter-actions`, `pitch-counter-delivers-label` · `move-scroll`, `move-actions` ·
`shoot-counter-scroll`, `shoot-counter-actions` · `remote-scroll` · `content-scroll` ·
`sale-scroll` · `withdraw-scroll`, `withdraw-actions` · `pitch-form-scroll` ·
`remote-address-scroll` · `payout-scroll` · `collection-scroll` · `change-number-scroll`,
`change-number-actions` · `new-collection-scroll` · `post-review-scroll` · `agreement-bar` ·
`{link box}-short`.

## New tests

`src/screens/__tests__/creatorStrips.test.js` — 155 tests (144, then 11 added after the slice's
review — see "Added after the review" below):
- every converted screen, in each state that has a strip: title row → the box that holds the page
  → the strip as the very next child of the screen; the strip is exactly the shared one and never
  absolute; it holds every button and line it had, in order; the page ends with its ordinary
  padding and no spacer; every control the form had is still in the form (U10);
- the states with nothing to press (store visit marked, Remote address sent, content with the
  brand, going live while making posts, the three conversations while waiting): no strip, no
  empty hairline;
- the reveal: a box taking focus, and the page getting shorter (the keypad opening; the strip
  gaining "Saving your link…"), move the form so the lines under the box are above the strip —
  on every form listed above;
- the toast inside the box above the strip (16), and at 110 where there is no strip;
- the plain forms (pitch form, address, payout detail, one collection) and the three with their
  own strip (Change number through steps 1–3, a new collection in both kinds, reviewing a post):
  a `FormScroll` with the padding it had, the same strip, the same controls;
- U15 on both sides of the pitch counter; the four server field names on her counter; the shared
  deliverables rule on both counters;
- her agreement's title row at inset 0 and at inset 24, in the loaded and the failed state;
- source guards over all 61 files of the four folders: no bar pinned to the bottom, no 1xx bottom
  padding or spacer, nothing measuring a bar; the twelve converted files draw page → toast →
  `</FormArea>` → `<BottomBar`; every file that draws a text box uses `FormScroll` and has no
  plain upright `ScrollView` (Withdraw's "can't be asked for right now" page excepted).

`src/components/content/__tests__/linkBox12.test.js` — added: the short form is drawn over the
box and never put in it; an edit that lands before the swap edits the real link; after a save
that got no answer one leaving sends the link once (end-editing + blur, and Done + both); leaving
while a paste is still on its way; text changed while a leaving's save was on its way.

### Added after the review (no source file changed, no existing assertion rewritten)

The reviewer found three states of two converted strips that no test in the suite held in place
(nothing referred to `accept-counter` or `go-live` at all). The screens drew them correctly; the
gap was coverage. Eleven tests added to `creatorStrips.test.js`:

- her store visit, the brand asked for another time (her move): the strip's own three children are
  `accept-counter`, `ask-another` and the sentence "There is no declining a time…", in that order;
  the sentence is said once and is not on the page; the yellow button names the brand's time (20
  Oct), not the first one; "This time works" is not offered beside it; "Ask for another time" still
  opens the counter screen; Accept calls the counter's accept (never the first plan's) and the
  strip then holds the agreed stage's buttons with "Time agreed." just above it;
- the same state with no counter left: Accept and the sentence, without the second button;
- she asked and the brand has not answered: no strip, no sentence, "Waiting for …" on the page;
- the visit done for Pay for Sale and for Hybrid: `go-live` alone in the strip, yellow, opens going
  live, and the Pay for Content door is not offered (and the reverse on the Pay for Content test);
- her Remote shoot, checked and not shot: `mark-done` alone in the strip and it still opens its
  pop-up, which is drawn beside the column;
- the Remote shoot done, nothing to send back: the content door alone and yellow (Pay for
  Content); `go-live` alone and yellow (Pay for Sale, Hybrid);
- the Remote shoot done with a return: `go-live` as the outline button (no top gap of its own)
  above the yellow return button — `self-sent` when she posts it back herself, `book-return` when a
  pickup can be booked.

Each was checked against a changed copy of the screen kept outside the repo (the button removed,
the sentence removed, the sentence moved onto the page, "Go live" left yellow beside the return
button): every change turned at least one of these tests red. `column()` now says "expected
<strip>, received null" when a strip is not drawn, instead of a TypeError.

## Not provable without a phone

That each strip sits directly above the keypad and the page really shrinks (jest has no keypad);
FormScroll's scroll on a real keypad (the phone's answers are supplied by hand in the tests);
frame C4 by eye — the pasted link box with "Saving…" above the strip; that a tap on a saved link
box puts the cursor in the whole link with no flash of the short form, and that the transparent
text shows no selection handles or highlight while she is not in the box; Android's real order of
Done / end-editing / blur; Change number's six code boxes as focus hops from one to the next; her
agreement's title row against the shared header by eye; the toast above a tall strip.
