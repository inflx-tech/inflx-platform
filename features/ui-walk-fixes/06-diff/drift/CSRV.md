# Drift — slice CSRV (server leftovers from wave 2, and the full server comparison)

**No existing assertion was rewritten, skipped, deleted or weakened.** Every server test that was
green before this slice is green unchanged (see `06-diff/backend-compare.txt`). Format where a line
applies: test file · test name · what it asserted · what it asserts now · frame / decision.

## Assertions that stayed exactly as they were (named because this slice changed what they read)

- `backend/tests/item10-flow.test.js` · "the brand's set-detail row says where the visit is, and
  chips Your move when he owes the confirmation" · at stage `sent` the line matches
  `/^Plan sent for .* waiting for Tanvi to answer$/` · the same, untouched — in that test she has
  not asked for another time, so it is still her answer the brand is waiting for · frame F2, U11.
- `backend/tests/ui-walk-fixes-shoot-turn.test.js` · "the flag is additive: the stage, the sentence
  and the visit time on both lists are what they were" · the same line at stage `sent`, and the
  block's four keys · the same, untouched · frame F2.
- `backend/tests/item10-flow.test.js` · "47 · one nudge at 48 hours…" · untouched and green. The
  reminder's words did not change: its first sentence now comes from one function that the set
  row shares, and a new test pins the whole reminder body word for word.
- `backend/tests/item7-agreement.test.js` · "sending again works the way the phone sends it…" ·
  after a phone Send the read's `can` is exactly `{ send: false, sign: false, withdraw: true,
  download: false }` and the row carries `withdrawAgreement: true` · the same, untouched — a
  phone-sent agreement can still be taken back · frame F3 / F6.

## New tests (behaviour that had no test)

`backend/tests/ui-walk-fixes-server-leftovers.test.js` (NEW, 7 tests, through the real endpoints):

1. Needs You (`GET /brands/me/inbox-summary` → `needs_you.creators_tab`) counts an agreement to
   send while it is a draft, stops while it is out, counts it AGAIN once the brand has withdrawn
   it, stops when it is sent again, and counts the brand's signature once she has signed; at every
   step the number equals the number of set rows carrying "Send agreement". Proved red first: with
   the old condition the count after Withdraw was 0 while the row said "Send agreement".
2. Three creators whose contracts all read `withdrawn`: only the one the brand took back is
   counted; the one removed from the set and the one moved to the pool are not (the same three
   the SF slice used for the rows).
3. The Withdraw flag for an agreement sent from the phone: false before it is sent (endpoint 404),
   true while it is out (endpoint 200), false once withdrawn, false once she has signed (endpoint
   422 with the "already signed" sentence).
4. The Withdraw flag for a contract put out through the website's "Approve & Send"
   (`POST /contracts/:id/approve` — `pending_influencer`, no `sent_at`): the phone's withdraw
   endpoint answers 404 and writes nothing, and the set row, the one-invitation read and the
   agreement read (`can.withdraw`) all say false. Proved red first on the row.
5. The store-visit sentence on the brand's set row through a whole conversation: plan out → the
   old sentence; she asks for another time → "Tanvi is waiting for your answer on the store visit
   time."; he answers → the old sentence; she accepts → the agreed line; she asks to move the
   agreed time → the new sentence again; he accepts → the agreed line. Her card's sentence is
   unchanged throughout. Proved red first.
6. The row's sentence is the reminder's own: the 48-hour nudge the brand gets at that moment reads
   exactly `{row line} Nothing happens until you reply.`
7. `shootPlan.brandLineFor` on its own: without a turn, with `null` and with `'influencer'` it
   returns what it always did; only stage `sent` + turn `'brand'` returns the new sentence; the
   turn changes no other stage's line.

## Behaviour that moved with it (for the walk)

- **Needs You number (brand).** Before: after the brand withdrew a sent agreement the set row said
  "Your move · Send agreement" (wave 2) and the brand's Needs You number did not count it. Now the
  number counts it, by the same condition the row uses (`draft`, or `withdrawn` with nothing out,
  on an invitation she has accepted). A contract marked withdrawn because she was removed, moved
  to the pool or refused another date is still not counted.
- **"Withdraw agreement" on a set row (⋯ menu).** Before: offered for any agreement out for her
  signature. Now: offered only for one the phone's own Send put out — the only kind the phone's
  withdraw endpoint accepts. A contract approved on the website still sits under "Waiting for the
  creator" with "Waiting to sign"; it just carries no Withdraw. Nothing a phone-only brand sees
  changes.
- **The same on the agreement screen.** The brand's agreement read (`can.withdraw`) follows the
  same rule, so opening that row no longer shows a Withdraw button that fails. One condition in
  `backend/src/services/agreement.service.js` (`canOf`), outside this slice's file list — the
  smallest edit that closes the door the task named; fixing only the row would have left the
  button one tap further in.
- **Store-visit row sentence (brand).** Before: once she had asked for another time (or asked to
  move an agreed one) the row showed a "Reply" button under "Plan sent for … — waiting for {name}
  to answer". Now, in that state only, the sentence is "{Name} is waiting for your answer on the
  store visit time." — the first sentence of the reminder he already gets for that moment. Every
  other store-visit line is unchanged; her card is unchanged. An app bundle from before this
  change prints the server's line as it is, so it shows the new sentence without an app update.

## The full server comparison (contract check 38) — `06-diff/backend-compare.txt`

- Whole backend suite, serially, 2 Oct 14:17–14:39 IST: **139 suites · 1870 tests · 1665 passed ·
  177 failed · 28 skipped**. Last stored full run (posting-date-last-day, 1 Oct): 137 · 1834 ·
  1629 · 177 · 28.
- Passed before and failing now: **none**. New tests failing: **none**. The 177 reds are the same
  177 tests name for name; the 28 skipped are the same 28. No old red was touched.
- 37 new test names, all passing: 36 are this contract's (SB 19, SF 6, F 4, CSRV 7); 1 is the
  shopper feed test renamed by shop-for-preference (commit 02e11a5a, after the stored run) — the
  one old name that is "gone".
- The same whole run taken at 13:22 the same day gave the identical result, test for test.
- Red-first re-checked on the retry: with the three old conditions put back, six of the seven
  tests in `ui-walk-fixes-server-leftovers.test.js` fail (both count tests, the website-door
  Withdraw test, all three sentence tests); "sent from the phone: offered until she signs" passes
  either way, as it should — it pins behaviour that did not change. Conditions restored; 7 of 7.
- Phone suite afterwards: 89 suites, 1990 of 1990 green. This slice touched no phone file.
