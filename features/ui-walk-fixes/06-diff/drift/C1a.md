# Drift — slice C1a (board C · the brand's "setting up" screens)

New campaign · New set · Add creators (to a set, to a group) · Invite a group · Terms for a
creator · Review and send · the pool · Branches · Creators › Groups · one collaboration's
payments · Add money · GST number / Bank account.

## Assertions rewritten

None. No existing test pinned a floating bar, a page's bottom padding or the toast's position on
these screens (research C03 FIX RISKS: "Jest proves nothing here"), so nothing had to be
rewritten. `item3Brand`, `item4Brand`, `item5Brand`, `item6Brand`, `item8Brand`, `brandWallet`,
`wallet17`, `deliverablesHomes`, `saveBarScreens` and the navigation suites pass unchanged.
Nothing was skipped, deleted or weakened.

## New wording (not on the board — for the founder's eye)

Wave-2 review leftover, decision D2. On Review and send, when the server refuses a batch, the
banner above the list read "Nothing was sent. Fix them, or remove them and send the rest." for
every refusal. A creator refused by one of her OWN invitation rules (the server sends her short
reason in `failures[].label`) cannot be fixed by changing her terms — tapping her row only says
why — so "Fix them" was untrue for her. Two new sentences in `C5.review` (`copy5.js`), today's
sentence kept for refusals that can be fixed:

- `C5.review.failedBodyRemove` — every refused creator was refused by her own rule:
  **"Nothing was sent. Changing their terms won't help — remove them and send the rest."**
- `C5.review.failedBodySome` — some by her own rule, some by something that can be fixed:
  **"Nothing was sent. Fix the ones you can, or remove them all and send the rest."**
- `C5.review.failedBody` — nobody was refused by her own rule: unchanged,
  "Nothing was sent. Fix them, or remove them and send the rest."

The title ("N creators can't be invited"), the rows and the "Remove N and send the rest" button
are unchanged. Phone-only sentences; the server has no copy of them.

## Behaviour that moved (for the walk) — what no test pinned before

- **The main button's strip is in the column, under the page** on eleven screens: New campaign
  ("Next: add a set"), New set / Edit set ("Save set"), Add creators to a set, Add creators to a
  group, Invite a group, Terms for a creator ("Next creator" / "Review and send"), Review and send,
  the pool ("Create a set for N creators"), Branches ("+ Add a branch"), Creators › Groups ("New
  group"), and one collaboration's payments ("Open the collaboration"). Each was `position: 'absolute', bottom: 0`
  over the page. (Board C rule 1, frames C1–C3, C8.)
- **The strip is 8 shorter at the bottom.** The old bars had 14 padding and 22 under the button;
  the shared strip has 14 all round plus the phone's bottom inset — the same strip as the Save
  screens (slice C0). On one collaboration's payments the old bar had 18 under the button.
- **An outline button in a strip has no top gap of its own.** "Remove N and send the rest" (Review
  and send, after a refusal) and "Open the collaboration" sat 10 lower inside their bar because
  the outline button carries a built-in 10 above it; in the strip that gap goes (WAVE1_API §3), so
  those two strips are 10 shorter again. The 8 between "Remove N…" and "Send" is unchanged.
- **The line above the button keeps its distance.** "N already selected · M new from this group" /
  the grey line (Invite a group), "{Group} can take N more creators." (Add creators to a group) and the
  basket row (Add creators to a set) are the strip's first child; their own bottom margin was
  reduced by the strip's 8, so the distance to the button is what it was (8, 8 and 10).
- **The empty space at the end of each page is gone.** `paddingBottom` 110 / 120 / 140 existed
  only to scroll the last row clear of the floating bar. Forms now end with their ordinary 18;
  lists with 24. (Research C03 FIX RISKS, last point.)
- **The lines under the box being typed in come into view.** New campaign, New set and Terms for
  a creator are `FormScroll`s: when a box takes focus or the keypad opens, the form scrolls so the
  counter, hint and error line under the box are above the strip (64 under the box; 80 on Terms,
  whose fee box has a two-line hint). Add money and GST / Bank account are `FormScroll`s too (the
  red line under the box) — nothing floated there and their button stays part of the page.
- **The toast sits just above the strip.** On the nine screens with a toast it is drawn inside
  the box above the strip, 16 above it. Before: 110 above the screen's bottom edge (about 26 above
  the old bar). While the keypad is open on the two Add creators screens the strip is away (B5)
  and the toast is 16 above the keypad. On the pool's loading / couldn't-load states (no strip) it
  is 16 above the bottom edge.
- **The footer of the two Add creators screens still steps away while she types** (frame B5) and
  comes back when the keypad closes — now as a strip in the column.
- **The pool with nobody in it** draws no strip, as before (the bar was already conditional).

## Left as it was, on purpose (U10)

- **Creators tab › Discover and › Worked with**: no bar ever floated there. Their lists keep the
  120 of space at the end (Discover's is in the shared `DiscoverList`, browse mode). The Creators
  tab's toast is shared by its four segments and stays at 110.
- **Add creators › Groups tab**: its list's 40 at the end is unchanged.
- **The basket pop-up** on Add creators (no text box in it) and the share pop-up on Shoppable
  posts (no text box) are unchanged.
- **Add money / GST / Bank account**: the button stays inside the page, the toast on GST / Bank
  stays at 110 (no strip to sit above).

## One edit outside the slice's file list

`components/discovery/DiscoverList.js` — one line: the list's end padding is 24 in `mode="select"`
(the two Add creators pickers, both in this slice) and stays 120 in browse mode (the Creators
tab). In select mode the 120 was the clearance for the pickers' floating footer, which is now a
strip under the list. Nothing exported changed; no other caller uses select mode.

## testIDs

- Kept, every one: `campaign-next`, `save-set`, `pick-footer`, `pick-basket`, `pick-count`,
  `pick-next`, `group-add-footer`, `capacity-line`, `add-selected`, `group-running`, `group-next`,
  `terms-next`, `remove-and-send`, `send-invitations`, `failed-banner`, `pool-create-set`,
  `add-branch`, `new-group`, `collab-open`, and everything inside the pages.
- New, on the strips that had none: `campaign-new-bar`, `set-edit-bar`, `terms-bar`,
  `review-send-bar`, `group-check-bar`, `pool-bar`, `branches-bar`, `groups-bar`, `collab-bar`.

## New tests

`src/screens/brand/__tests__/boardCBrandSetup.test.js` — 128 tests:
- each of the eleven screens rendered: the strip is a direct child of the screen, the last thing
  in the column, straight under a flex-1 box, never absolute / pinned, the standard strip; what
  it held is still in it in the same order and the rest of the page is still there; no scroller
  ends with more than 24 and no spacer block is left;
- the page fills the box above the strip (nine screens); Branches while loading and when it could
  not load; the pool with nobody in it has no strip;
- the three forms are `FormScroll`s; a box near the end taking focus, and the keypad opening,
  bring the lines under it into view (64; 80 on Terms); the deliverables chooser on Terms still
  scrolls the page's own ScrollView;
- the toast is inside the box above the strip at 16, on eight screens (and just above the keypad
  while the picker's strip is away);
- the two Add creators strips step away with the keypad and come back as strips, with the line /
  basket row the same distance above the button; their Worked with and Pool lists end with 24;
- Invite a group: the line above the button in its three states;
- Creators tab: Groups strip; Discover and Worked with untouched;
- Add money, GST number, Bank account: a FormScroll with the padding it had, button still in the
  page, the red line under the box brought into view;
- Review and send: the three banner sentences (her own rule / can be fixed / one of each), her row
  says why and opens nothing, a fixable row still opens her terms, "Remove N and send the rest"
  above Send in the strip and still sending the rest;
- a source guard over the thirty brand screens of this slice: nothing pinned to the bottom of the
  screen, no bar clearance left, the toast asked for in-flow and drawn inside the box above the
  strip, forms built on `FormScroll`.

## Not provable without a phone

That the strip, not the keypad, was what hid the box (research C03 FIX FINAL 0); the scroll
FormScroll does on a real keypad (the phone's answers are supplied by hand under jest); how the
list grows and shrinks as the Add creators strip leaves and returns around the keypad; the
toast's look just above each strip; that the strips sit at the very foot of the screen on a phone
with a gesture bar (the bottom inset is 0 under jest).

---

# Review round — Terms for a creator: one form per creator

Not board C, and not caused by this slice: the fault has been live since item 5. It sits in two
files this slice owns and on the very path the banner's "Fix them" points the brand down, so it
was fixed here. **Behaviour change for the walk — no screen looks different.**

## What was wrong

With three creators — say Priya 10%, Kavya 12%, Divya 15% — tapping **Priya's** row on Review and
send (or being sent back to her by Send) did not open Priya's terms. It opened **Divya's** screen
with "Terms · Priya Sharma" in the title and Divya's 15% still in the box. Back or "Next creator"
then saved Divya's terms as Priya's, and Priya's invitation went out on them. Only the last
creator's row worked.

Why: every creator's Terms screen has the same route name. Review asks for
`navigate('BrandCreatorTerms', { index })`, and React Navigation 6 answers by going back to the
LAST Terms screen in the stack and handing it the new index. The form was filled once, when the
screen was first drawn, and never again. Verified on the real `StackRouter` and on a real
native-stack under jest before anything was changed (8 of the new tests were red against the old
screen: "Expected 10, Received 15").

## What changed — `BrandCreatorTermsScreen.js` only

1. **The form belongs to the creator.** The form is keyed by the creator, so a screen that is
   handed another creator starts her form afresh from the draft: her numbers, no red lines of the
   previous creator, "Use these terms for everyone" off, no pop-up left open.
2. **A Terms screen that comes back into view shows what the draft holds for her now**, when
   another screen wrote her terms in the meantime. Two cases, both found while proving 1:
   - after Priya is fixed on the reused screen, Back, Back lands on Priya's FIRST screen, which
     still held her old numbers and saved them over the fix on Next;
   - "Use these terms for everyone" switched on for a later creator, then Back: the earlier
     creator's screen still showed her old numbers and undid the copy for her on Next.
   Typing that was never saved is kept when nobody else touched her terms (the draft puts a new
   object in place on every write; the form compares that, not the values).
3. **A Terms screen that comes back into view looks up again who stands at its place.**
   "Remove N and send the rest" takes creators out of the draft and moves the others up while the
   Terms screens sit underneath. If the second send then fails and she goes Back, the screen that
   was the removed creator's now shows the creator who stands there, with her own numbers — it
   used to show the removed creator and, on the first key press, flip to the next creator's name
   over the removed creator's numbers.

`BrandReviewSendScreen.js` is unchanged by this round: it still asks for
`navigate('BrandCreatorTerms', { campaignId, setId, index })` (pinned by `item5Brand` and
`boardCBrandSetup`).

## Assertions rewritten

None. `item5Brand` (the Terms walks) and `boardCBrandSetup` pass unchanged; one comment was added
to `boardCBrandSetup` › "a refusal that CAN be fixed…" saying that its `navigate` is a stand-in
and where the real proof is.

## New tests

`src/screens/brand/__tests__/termsFormPerCreator.test.js` — 15 tests, the two real screens in a
real native-stack inside a real NavigationContainer, registered the way `BrandNavigator` registers
them (the file checks that), walked with the screens' own buttons:
- walking forward, each creator has her own screen and numbers;
- Review › the first creator's row, and the middle creator's: her name, her numbers; Back saves
  nothing of the last creator's onto her; "Next creator" saves her change as hers and nothing
  else of the last creator's; the last creator's row still opens her own screen;
- nothing is carried over: the last creator's unsaved number, red line and "everyone" switch;
- Send's own check sends her back to her own (empty) box;
- "Fix them": the server refuses the first creator's terms, she is fixed and the batch is sent
  again — each creator goes out on her own terms (the request body is checked);
- back into view: after a fix further up the stack; after "Use these terms for everyone" on a
  later creator; unsaved typing kept; a red line goes with the numbers it was about;
- after "Remove N and send the rest" and a failed second send: nobody at the old last place, the
  moved-up creator's own form at hers.
Every test must leave `console.error` silent (a wrong hook order would show there).

## Behaviour that moved (for the walk)

- Review and send › tap any creator's row → her own terms. Before: the last creator's.
- After fixing a creator from Review, the way back to Review is unchanged: "Next creator" walks
  through the creators after her. (Not shortened — the board says nothing about it.)
- Going Back to an earlier creator after "Use these terms for everyone" on a later one now shows
  the copied terms on the earlier creator's screen.
- After "Remove N and send the rest" + a failed send, Back from Review shows "Nobody picked" once
  (the old last place is empty) before the remaining creators' screens. Before: the last creator's
  form, which turned into "Nobody picked" on the first key press.

## Not provable without a phone

The same walk on a device (three creators with different terms → Review → tap the first row →
her numbers; change them; Back twice; Next). jest runs the real navigator but not the native
screen stack.

## Left for a decision (outside this slice's files)

- The Terms screens are addressed by PLACE in the list (`index`), not by creator. A sturdier
  shape is `getId` on the `BrandCreatorTerms` screen in `navigation/BrandNavigator.js` (so
  `navigate` finds her own screen and no second screen for the same creator is ever stacked) or a
  creator id in the route params. The first is in a file outside this slice; the second changes
  the params `item4Brand` / `item5Brand` pin. Both were left; the screen is now correct without
  them.
