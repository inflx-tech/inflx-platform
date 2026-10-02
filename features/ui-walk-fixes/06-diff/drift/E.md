# Drift — slice E (board E · level buttons, frames E1–E12)

Format: test file · test name · what it asserted · what it asserts now · frame / decision.

## Assertions rewritten

None. No existing test pinned the position, size or colour of these buttons (research C05 / C07:
"tests pin testIDs, not layout"), and every testID, label and press is unchanged, so no existing
assertion had to change. Nothing was skipped, deleted or weakened.

New behaviour is covered by one new file, `src/screens/__tests__/levelButtons.test.js` (47 tests):
the level pair on all five answer bars and all seven confirm / page pairs, Counter absent when not
allowed, the measured bar height, "Sending", the visible Withdraw spinner, the after-both-signed bar
and its six labels, and the Remote door (U14).

## Behaviour that moved with it (for the walk)

- `src/screens/influencer/InvitationScreen.js` · "Nothing is final until you both sign the
  agreement." was the last line of the scrolling page · it is now the first line of the pinned bar,
  above Accept (and above the "aren't taking counters" line when that shows) · frame E1 / E2.
  `item5Creator.test.js` ("two blocks in order…") still finds the sentence exactly once.
- `InvitationScreen`, `ThreadScreen`, `BrandThreadScreen`, `PitchThreadScreen` · the page kept a
  fixed 140 (150 on the brand's conversation) under its last line · it keeps the pinned bar's
  measured height plus the page's 18; the fixed number is used only until the bar has been measured
  and when there is no bar · brief + research C05 "measure the bar's real height". The brief names
  the first two screens; the same three lines were applied to the other two because a two-line
  Accept label (E4) makes their bar taller than the fixed number as well.
- `src/screens/brand/BrandAgreementScreen.js` · after both have signed, "Download" and the shoot
  button sat side by side at the end of the scrolling page · they are in the bar at the foot of the
  screen (testID `signed-actions`), the shoot button full width and Download full width under it ·
  frames E11 / E12. The six 20 Sep labels (`C10.openLabel`) are untouched.
- `BrandAgreementScreen` · on a Remote agreement "Shoot plan" showed the message "The Remote shoot —
  shipping the products — arrives with item 11." · it opens the Remote shoot
  (`navigate('BrandRemote', { campaignId, setId, ciId })`, the same call `BrandSetDetailScreen`
  makes) · spec U14. `C10.remoteNext` is no longer read by any screen; the copy key was left in
  `copy10.js` (not this slice's file).
- `src/components/agreement/sheets7.js` · Send read "Saving" while busy · it reads "Sending"
  (`C7.brand.sending`, a new phone-only key in `copy7.js`; the server's `agreementCopy.js` carries
  no button labels, so nothing to mirror) · frame E9, check 18.
- `sheets7.js` · the Send sheet's "What happens" card was a grey block and its warning plain small
  text; the Withdraw sheet's first line was plain text · the card is outlined, the warning and the
  Withdraw first line sit in a grey box; the wording is unchanged · frames E9 / E10.
- `src/screens/brand/BrandPitchScreen.js` · "Open her full profile" was a full-size outline button ·
  it is an underlined text link at the left, under the three answers (same testID
  `pitch-full-profile`, same destination) · frame E7.
- `BrandPitchScreen` · with neither Counter nor Reject allowed an empty row was still drawn (a 12
  gap with nothing in it) · nothing is drawn at all · brief / research C05 FIX RISKS.
- Every pair in this slice · Decline / Reject / Withdraw / Delete was a solid red block and the
  quiet half a pale hairline · red outline and clear dark outline (the boards' `.b-dan` / `.b-sec`)
  · frames E1–E10. Three pairs take the same look without a board-E frame of their own: the pitch
  sheets (item 8's own T7 / T8 draw them so; the Withdraw-pitch sheet follows E10, same words), the
  Wallet tab's Withdraw (item 17 BW1 draws the dark outline) and the collection's Rename | Delete
  (shoppable-posts P20 draws both). If the founder wants those three left in their old colours, it
  is one prop each (`strong` / `outline`); the level row stays either way.

## A shared piece whose default changed for existing callers (recorded in the final review, 2 Oct 2026)

BUILD_RULES rule 2 says a shared piece never changes what an existing caller gets by default.
One did, on purpose, and until now only WAVE1_API.md and a code comment said so:

- `components/settings/primitives.js` `SecondaryButton` · `disabled` was accepted and dropped ·
  it is now honoured (no tap goes through; the button is drawn at 0.6) · this changes what
  **eight existing callers, on no board of this contract,** get — every outline button that was
  already passing `disabled={busy}`, all from item 11 (Remote shoot):
  - `components/remote/sheets11.js` — "Finished shooting?" (`shoot-done-cancel`, "Not yet") ·
    the pickup day (`pickup-cancel`, "Not yet") · "I've sent it back" (`self-sent-cancel`,
    "Not yet") · cancel a booking (`cancel-booking-cancel`, "Keep it booked") · let her keep an
    item (`gift-cancel`, "Not yet") · report to INFLX (`report-cancel`, "Not now") · "What came
    back?" (`confirm-return-cancel`, "Not yet");
  - `screens/influencer/RemoteAddressScreen.js` — the delivery-address confirm (`sheet-cancel`,
    "Not yet").
- **Before:** the quiet button stayed tappable while the request ran, so the pop-up could be
  closed under a request that was still out. **Now:** it greys and takes no tap until the request
  ends. On the seven sheets the pop-up can still be closed by tapping outside it or with the
  phone's Back key. On the delivery-address pop-up (drawn on the screen itself, not as a sheet)
  nothing else closes it until the send ends; a refused send closes it and gives the form back.
- Why it was kept and not narrowed to an opt-in: it is what those eight callers asked for when
  they wrote `disabled={busy}`, and honouring it only behind a new prop would re-open the
  close-while-saving gap they meant to shut. No other outline button in the app passes
  `disabled`, so nothing else changed.
- **For the walk:** those eight pop-ups, each with a slow connection — the quiet button greys
  while the main one spins.
- Pinned by the new `src/components/remote/__tests__/cancelWhileBusy.test.js` (20 tests): a scan
  of the app's source that the outline buttons passing `disabled` are exactly these eight, each
  as `disabled={busy}` (a ninth fails the test until it is added to this record); each of the
  seven sheets at rest and while busy; the tap-outside and Back way out of each while busy; and
  the delivery-address pop-up on the real screen — at rest, mid-send (no way out, one send only),
  and after a refusal. The mechanism itself was already covered by `buttonRow.test.js`
  ("`disabled` now works…").

## Closing items (2 Oct 2026) — spec U23, U24, and the gap under an opened list

Format as above: test file · test name · what it asserted · what it asserts now · decision.
Nothing was skipped, deleted or weakened; each changed assertion is at least as strict as the one
it replaces.

### U23 — the invitation when the brand has switched countering off

What the server sends in that state (`backend/src/services/invitationRows.service.js`
`creatorState`): `canCounter: false`, `counterHiddenReason: 'switch_off'`, and
`canMoveRequest: true` until she has asked once. The screen drew a button labelled "Counter"; it
opened the chooser with "The money and the work" chosen, and the counter she filled in was refused
on Send. Two tests used fixtures that hid this.

- `src/screens/influencer/__tests__/item6Creator.test.js` · "N19 — with countering off there is no
  Counter and one plain line says why" · the real server shape (`canMoveRequest: true`), but it
  only looked for the grey line and for Decline — it never checked that "Counter" was absent, and
  it was not · renamed "N19 — with countering off there is no "Counter": one plain line says why,
  and the second button reads "Ask for another date" and opens the request directly"; same
  fixture; it now asserts the word "Counter" is nowhere, the button `counter` reads "Ask for
  another date" with no undo arrow, and one tap calls `navigate('MoveRequest', { ciId })` with no
  chooser and no money choice · spec U23.
- `src/screens/__tests__/levelButtons.test.js` · "E2 — the brand is not taking counters: Counter is
  ABSENT, not disabled; a grey line says why; Decline fills the width as a red outline" · its
  fixture was a shape the server never sends — countering off, `canMoveRequest: false`, and no
  move request on the invitation (`canMoveRequest` is false only once she HAS asked) · renamed
  "E2 — the brand is not taking counters and she has already asked for another date: no second
  button at all…"; the fixture now carries the request she made (`moveRequest`, answered "kept");
  every assertion is kept, plus "Ask for another date" is absent · frame E2, spec U23.

New tests (nothing replaced): `item6Creator.test.js` — "N19 — once she has asked for another date
too (canMoveRequest false) there is no second button at all"; "U23 — the same holds whatever
switched the counter off" (an open-group invitation); and three for the chooser itself
(`canCounter: false` offers no money choice and no counters-left line and starts on the date;
`canCounter` missing means true, exactly as before; neither allowed, Continue only closes).
`levelButtons.test.js` — "U23 — the brand is not taking counters but she may still ask for another
date…": the bar's four lines in order, the pair level, the dark outline, no arrow, one tap to
`MoveRequest`.

Behaviour that moved with it (for the walk):

- `src/screens/influencer/InvitationScreen.js` · with countering off and no date asked yet, the
  second button read "Counter" and opened the chooser · it reads "Ask for another date" and opens
  "Ask for a change" directly. The rule is the server's two flags, not the reason: `canCounter` →
  "Counter" (unchanged); no counter but `canMoveRequest` → "Ask for another date"; neither → no
  second button (frame E2). So an open-group invitation, where a counter is never allowed, gets
  "Ask for another date" too — it used to get the same misleading "Counter".
- `src/components/negotiation/sheets6.js` `CounterChoiceSheet6` · new optional prop `canCounter`
  (missing = true). `false` → no "The money and the work", no counters-left line, starts on the
  date choice. The invitation is the only screen that opens this chooser, and it now opens it only
  when a counter is allowed; `ThreadScreen` never used it ("Counter back" goes straight to the
  counter, and only when the server's `can.counter` says so).
- New word: `C6.invitation.askDate` = "Ask for another date" (`copy6.js`, phone-only — a button
  label; `negotiationCopy.js` carries no button labels).
- A shared piece, changed additively (BUILD_RULES rule 2; outside this slice's file list, the
  smallest edit): `components/settings/primitives.js` `SecondaryButton` gains the opt-in prop
  `shrink` — in a row, a label too long for its half is drawn a little smaller (never below 0.8 of
  its size) instead of being cut short with "…". Only this one button passes it. Why: measured
  from the app's own font file, "Ask for another date" is 146 wide at the button's size, and a
  half holds 147 on a 360-wide phone — with nothing to spare, and less than nothing once the
  phone's text size is turned up. No existing caller gets anything different: the E1 test asserts
  "Counter" carries neither of the two text props. **For the walk:** on a narrow phone, or with
  large text switched on, the label is whole and may be slightly smaller than "Decline" beside it.

### U24 — E12 faked a refusal the server never gives

- `src/screens/__tests__/levelButtons.test.js` · "E12 — Remote: "Shoot plan" full width over
  Download, and it opens the Remote shoot (U14) instead of a message" · `getShoot` answered
  `{ success: false, 'no visit on a Remote collaboration' }` — the endpoint does not refuse a
  Remote (`shootPlan.service.js` `read` answers with the open gate, four steps and the countdown,
  every `can` false) — and the test then asserted the "Next" card that only a failed read draws ·
  `getShoot` answers what `read` really returns for a Remote signed by both (stage `not_sent`,
  `mode: 'shipment'`, `isVisit: false`); the bar and the door are asserted exactly as before
  (state button first, Download alone under it, one `navigate('BrandRemote', …)`, no old message),
  and the page is asserted as it truly is: the three gate ticks with their amounts, the four-step
  line word for word, the countdown, and NO "Next" card · spec U24.
- **E12 draws the Next card; the live Remote page keeps its ticks and step line (U24).** The frame
  was drawn from the older board; its caption is about the buttons (U10).
- New test: "E12 — when the shoot cannot be read at all (no connection), the Remote page falls back
  to the "Next" card; the bar and its door are unchanged" — the one state in which the card the
  frame draws is really shown.
- For the walk, not changed here: on that live Remote page the step line's second step reads
  "Shoot plan · Send her a time" — the server's store-visit wording on a Remote collaboration
  (`shootPlan.service.js` `read`, `steps`). It has read so since item 10; U24 keeps the page as it
  is.

### The gap kept clear under an opened deliverables list: 96 → 16

`components/invitations/bits5.js` `LIST_ROOM_BELOW` was 96 "for the screen's floating button
strip". Since board C no home of the chooser has a floating strip (three screens keep their button
in a strip under the page, the pitch form's buttons are in the page, the brand's counter pop-up
pins its button under the scrolling body), so the list was pushed 80 further up the page than it
needed. It is an ordinary gap of 16.

- `src/components/invitations/__tests__/deliverablesEditor5.test.js` · "scrollForList5 — moves the
  page just far enough, and never pushes the tapped box off the top" · overlap case `716`, default
  room case `86` · `636` and `6`; added: the exact edge (a list ending one gap above the bottom is
  in view, one point more is not) and the old 96 still reachable through the `room` argument.
- same file · "once the list is laid out the page is scrolled to show all of it — once for each
  opening" and "the list under "+ Add another" is moved into view the same way" ·
  `scrollTo({ y: 716 })` · `scrollTo({ y: 636 })`.
- `src/screens/__tests__/deliverablesHomes.test.js` · `expectPageMovedForOpenedList` (used by her
  counter, her pitch form and the pitch counter on both sides) · `scrollTo({ y: 716 })` ·
  `scrollTo({ y: 636 })`; the comment's arithmetic follows.
- `src/screens/brand/__tests__/boardCBrandSetup.test.js` · "Terms for a creator › the ref the
  deliverables chooser scrolls with is still the page's own ScrollView (board D, frame D2)" ·
  `scrollTo({ y: 716 })` · `scrollTo({ y: 636 })`.

The last three files are not in this slice's list; each edit is the one number and its comment.

### U23, review pass — two more invitation tests that fed the screen an answer the server cannot give

`backend/src/services/invitationRows.service.js` `creatorState`: while an invitation is still hers
to answer, `canCounter` is false only FOR a reason (`agreement` / `open_group` / `switch_off` /
`rounds`), and `canMoveRequest` is false only once she has asked (so `moveRequest` is present).

- `src/screens/__tests__/levelButtons.test.js` · "Counter not allowed for any other reason is
  absent too, with no line to explain a switch that is not off" · fixture `canCounter: false`,
  `counterHiddenReason: null`, `canMoveRequest: false`, no move request (impossible on both
  counts); asserted no `counter` button, no `counter-off` line, Decline alone · replaced by four
  cases, two real reasons (an open-group invitation; her counters used up — `rounds`, status
  `negotiating`, her move, roundLimit 2 / countersUsed 2) each in its two real states:
  "…and she may still ask for another date" (`canMoveRequest: true`, no move request) asserts the
  E1 bar of three (grey line, Accept, the pair), NO `counter-off` line, the `counter` button
  reading "Ask for another date" with the dark outline and no undo arrow, level with Decline,
  "Counter" nowhere, and one tap to `MoveRequest`; "…and she has already asked for another date"
  (`canMoveRequest: false` with the answered request) keeps the old assertions — no second button,
  no `counter-off` line, Decline alone as a red outline · spec U23. The old title said "absent"
  for a state in which the screen draws a button.
- same file · "the answers are a strip in the column under the page — never floating over it — and
  the page ends with its ordinary 18, however tall the strip" · fixture `switch_off` with
  `canMoveRequest: false` and no move request (the shape E2 was corrected away from) · the real
  fresh switch-off shape (`canMoveRequest: true`, `switchOn: false`): two grey lines, Accept, the
  pair — the tallest bar the server can ask for, now asserted to be that bar (four parts,
  `counter-off` second, the pair last) before the strip assertions, which are unchanged · spec U23.
- same file, fixtures only (no assertion changed) · "with no bar at all (answered, no agreement
  yet)…" and "the agreement bar (item 7) is the same strip in the column" · an invitation no longer
  hers to answer carried `canCounter: true` or `canMoveRequest: true` · it carries what the server
  sends together: `canAnswer: false`, `canCounter: false`, `counterHiddenReason: 'closed'`,
  `canMoveRequest: false`.

Checked by breaking the screen on purpose (the button drawn for `switch_off` only): the two "may
still ask" cases fail, everything else in the file passes; restored, 52 of 52.

- `src/screens/influencer/__tests__/item5Creator.test.js` (not in this slice's list; the smallest
  edit — one fixture and one assertion) · "Accept confirms then calls the API; Counter is hidden
  when negotiation is off (checks 28, 37)" · fixture `{ …, canCounter: false }` with no reason and
  no `canMoveRequest` at all (an item 5 fixture older than those two fields); asserted no button
  with the testID `counter` · the real switch-off shape (`counterHiddenReason: 'switch_off'`,
  `switchOn: false`, `canMoveRequest: true`); asserts the word "Counter" is not drawn and "Ask for
  another date" is; the accepted answer carries the four flags the server sends together. The
  Accept half of the test is untouched · spec U23.
