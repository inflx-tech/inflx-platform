# Diff notes — offer-delete

Against `04-preview/mockups/offer-delete-mockups-v1.html` (X0–X7, with the X2/X3 review fix). The "after"
shots are the real website on a local preview, 3 Oct 2026: the brand website (a private copy under
`next dev`, port 3012) talking to the real server (port 3011) on a private scratch database. Never
production. The seeded brand has the founder's seven offers. Three are Drafts (kk, gh, flip it up).
"wish" was ended early with End offer now, and no creator had it. "Kg sale" ended by its date. Two are
Live: "Salary day off", which no creator has, and "Year end sale", which a creator has signed for and
which has one approved post.

| Shot | What it shows | Board |
|---|---|---|
| `after-X1-list.jpg` | Listings › Offers. Each Draft row has Continue + Delete, both Ended rows have Open + Delete, the Live rows have only Open. Counts: Live 2 · Draft 3 · Ended 2 | X1 |
| `after-old-products-offers.jpg` | The older Products page, Offers sub-tab: the same list and the same buttons | X1 note |
| `after-X2-draft-confirm.jpg` | Delete on "kk": "Delete this draft?" with the O8 wording, and the buttons Keep it / Delete draft | X2 |
| `after-X4-draft-deleted.jpg` | "kk" is gone, Draft 3 → 2, toast "Draft deleted." | X4 |
| `after-X3-ended-confirm.jpg` | Delete on "Kg sale" (ended by its date): "Delete "Kg sale"?" with the kept-records sentence, and Keep it / Delete offer | X3 |
| `after-list-after-ended-delete.jpg` | "Kg sale" is gone, Ended 2 → 1, toast "Offer deleted." | X4 note |
| `after-X5-ended-page.jpg` | The page of "wish" (ended early): Delete at the top right, Ended pill | X5 |
| `after-X5-delete-confirm.jpg` | Delete on that page: the same box as on the list | X5 note |
| `after-X5-back-on-list.jpg` | After Delete offer: back on Listings with the **Offers** tab open, "wish" gone, Ended 1 → 0, "Offer deleted.", `&deleted=1` removed from the address | X5 note |
| `after-hidden-url.jpg` | The deleted offer's old address opened directly: "Offer not found" with Try again and ← Offers. No crash | X5 note |
| `after-X6-end-box.jpg` | "Salary day off" (Live, no creator): Add products / Remove products / End offer now, and no Delete. The End box reads "…stays in your list as Ended until you delete it, with its dates (1 Oct – 6 Oct)." Not confirmed | X6 |
| `after-X6-end-box-given.jpg` | "Year end sale" (Live, the creator has signed): Add and Remove are greyed out, there is no Delete, and the End box has the same new sentence. Not confirmed | X6 |
| `after-refused-delete.jpg` | A list left open while "gh" is published somewhere else. Delete on its stale Draft row is refused, and the box shows the server's words: "This offer is still running. End it first, then you can delete it." | X7 row 3 |

## What was implemented
- **Server.** `DELETE /v1/brands/me/offers/:id` now does one of three things. A Draft is erased
  (`{deleted:true, mode:'erased'}`). An Ended offer, whether ended early or by its date, is hidden from
  the brand only (`{deleted:true, mode:'hidden'}`): `brand_offers.deleted_at` is set, the status stays
  as it was, and the days its products were held are cleared. A Scheduled or Live offer is refused with
  409 `OFFER_LOCKED` "This offer is still running. End it first, then you can delete it.". Repeat
  deletes, another brand's offer and unknown ids get 404. Hidden offers are left out of the brand's
  own reads: the Offers list and its counts, every brand offer route (404), creator terms' "not
  shown, ended" note and Products without offers' "last in offer". No creator, shopper, order, wallet
  or admin read changed. Migration `201_offer_deleted_at.sql` adds the column, and
  `scripts/run-201.js` applies it.
- **Website.** On the Offers list (both places it is drawn), Delete sits beside Continue on Draft rows
  and beside Open on Ended rows. Each has a confirm box with the O8 words, then a toast, and the
  counts reload. An ended offer's page has Delete at its top right. The End offer now box carries
  the new sentence. Both "← Offers" links on the offer page now open Listings on the Offers tab
  (they were opening Inventory).
- **Rules.** `Docs/OFFER_TERMS_POSTS_RULES.md` v1.17 §1.9 and §1.12.

## What matches the board
- **X1:** the three kinds of row and their buttons. Each pair sits on one line in every row (measured
  on both list pages).
- **X2:** the draft box: title, sentence and buttons, word for word.
- **X3:** the ended-offer box, word for word, with the offer's name in the title.
- **X4:** the row leaves the list, the right pill drops by one, and the toast sits bottom right.
- **X5:** Delete at the top right of an ended offer's page. The same box. Back on the list with
  "Offer deleted.". The old address says the offer can't be found.
- **X6:** the End box sentence matches the board's "After" line exactly, and there is no Delete on
  Live pages.
- **X7:** what each kind of offer does. After the walk the database showed "wish" with
  `status='ended'` and "Kg sale" with `status='published'`, both hidden and with every hold cleared.
  kk and flip it up were erased. The Live offers were untouched: still held, and the creator's link
  to "Year end sale" is still there.

## Where it differs
- **The page around the list.** The board draws a left sidebar. The real site has the top bar. The
  preview brand's store setup isn't finished, so a yellow "Your store setup isn't finished" banner and
  tab counts ("Products without offers 10", "Gift items 0") show that the board leaves out.
- **The seeded data.** It follows the founder's screenshot, with these differences:
  - "Kg sale" is Ended by its date here, not Live, so that both kinds of Ended get walked.
  - "Year end sale" is the shared test fixture's 20% deal, dated 28 Sep – 12 Nov, instead of 10%,
    1 – 9 Oct.
  - "kk" has its numbers filled in, so its line reads "Spend ₹2,000 · 1 gift of 1" where the board
    says "Not published yet".
  - The product names differ.
- **The X3 box was shot on "Kg sale"** (deleted from the list). "wish" was deleted from its own page
  (X5) instead. The words are the same.
- **The red "1 error" badge** in the bottom-left of the Listings shots was already there before this
  change. It is Next's development-mode badge for a hydration error on the Listings page itself.
  `app/dashboard/products/listing/page.js` (lines 589 and 593) renders its CSS as
  `<style>{CSS}</style>`. The server escapes the CSS quotes to `&#x27;`, a `<style>` tag doesn't decode
  them, and so the text the browser receives differs from what React expects (seen in the server
  HTML: `font-family:&#x27;Plus Jakarta Sans&#x27;`). That file was last changed on 28 Sep (76cd7610)
  and is not part of this change. On the live site nothing shows on screen; React redraws the page.
  It is worth a separate small fix: `dangerouslySetInnerHTML`, as `OffersLibrary` already does.
- **Not drawn: a refused delete** (`after-refused-delete.jpg`). The box keeps the stale row's title
  ("Delete this draft?") above the server's sentence. The row stays on screen as Draft until the list
  reloads, and after a reload it shows Scheduled with Open only. This only happens when the offer is
  published in another tab.
- **The ended page's foot note** still ends "To change the deal, end it and build a new one." That
  sentence was already there, and the board (X5) draws it the same way.

## Order of work (stated plainly)
The founder's message gave the two places, with a screenshot of Listings › Offers. Decisions O1–O10
and the lock were taken under standing autonomy. The board was drawn alongside the build as the
record, not locked on a separate turn first, and a review fix to X2/X3 followed. The founder sees
the board and this real page (these shots) before anything is deployed.

## Test record
- **Board:** `check-board-lists.mjs` (a scratch script, headless) checks every list frame's rows
  against its pills, the toolbars, the boxes inside their frames, and that each pair sits on one line.
  The old X2/X3 failed it with 10 failures, for example "X3: All pill on, pills sum to 7, but 5 rows
  drawn". The fixed board passes at 1200 px and 390 px: 5 list frames, X2 and X3 at 7 rows each, and
  15 action cells each on one line.
- **Server:** these ran on a private scratch Postgres 18 on port 5546; the shared 5544 instance was
  down and was not touched. Setup applied migrations 199/199, 201 included.
  - `tests/offer-delete.test.js` passed **17 / 17**. It covers checks 2–9 and 12, a delete racing a
    publish, the 404 on every brand offer route, and a code read proving the hidden-offer filter
    lives only in the brand's reads.
  - One in-band run of 17 offer, terms, post, order and wallet suites: 341 passed, 9 failed, 350 in
    total. The 9 are offer-attach (5) and offer-store-direct (4), old-builder suites. The same 9
    tests fail on a copy of the code without this change, so they failed before it.
  - These all passed: offers-v2-flow 29/29, offers-v2-listings 13/13, offers-v2-rules 32/32,
    brand-offer 11/11, offer-add-products 12/12, creator-terms-v2 18/18, shoppable-posts-v2 37/37,
    shopper-app-v2 37/37, shopper-ordering 36/36, item17-wallet 31/31, post-links-codes 18/18,
    offer-store-publish 2/2, offers-parity-backend 12/12, brandOffers.adapter 27/27.
  - Two tests were rewritten to the new rule, recorded under "Drift recorded" in
    `03-expected-outputs.md`.
- **Check 13, the full backend run** (3 Oct 08:30–08:50 IST, the same private scratch Postgres):
  140 suites · 1888 tests · 1683 passed · 177 failed · 28 skipped, against the last full run (2 Oct,
  139 / 1871 / 1666 / 177 / 28). **0 tests that passed before fail now; 0 new tests fail**; the 177
  reds are the same 177, name for name (`backend-compare.txt`).
- **Two small fixes after the review** (both tested): the old builder's
  `GET /brands/me/offers/:id/attachments` now also answers "not found" for a deleted offer (added to
  the every-brand-route check in `offer-delete.test.js`; offer-delete + offers-v2-flow + brand-offer
  57 / 57); and when a delete is refused, the list reloads behind the box, so the row shows what the
  server sees once the box is closed (the refused-delete test in `offer-delete.spec.ts` now asserts
  the reload and the row's new buttons; the spec is 9 / 9 on a fresh `next build`).
- **run-201.js** (scratch database `inflx_offerdel_run201`, never `.env.prod-backup`):
  - `--dry`: the column is absent and nothing is written.
  - `--apply`: 4/4 OK, "Nothing moved".
  - A second `--apply`: "offers hidden: 0", "Nothing moved", "(The column was already there: this
    run changed nothing.)".
- **Website:**
  - `qa/web/brand/offer-delete.spec.ts` (9 tests, stubbed API, deploy-inert). Before the "← Offers"
    fix it went 7 passed / 2 failed: the review finding, reproduced. After the fix it passed 9/9
    under `next start`, 9/9 under `next dev`, and 27/27 with `--repeat-each=3`.
  - A clean `next build` exited 0: "Compiled successfully", 91/91 static pages.
- **Walk (this file)** on the real server and database, done twice: once by hand in the browser pane,
  then recorded with Playwright on a fresh seed. The results were the same both times.
  - Check 1: shown on both list pages.
  - Check 2: kk erased, Draft 3 → 2, "Draft deleted.". Keep it sent nothing.
  - Check 3: shown for both kinds of Ended. Each leaves the list and the Ended count, and its address
    says "Offer not found".
  - Check 10: shown. The page's Delete leads back to Listings › Offers with "Offer deleted.".
  - Check 11: shown on both Live offers.
  - The server log had no 5xx errors. The website server log had no errors.
  - The browser console had only the pre-existing Listings hydration error above, plus the expected
    404s on the deleted offers' addresses.
  - The walk hit the server's sign-in limit of 20 per 15 minutes per address, because every full page
    load renews the session. This happened only because of the walk's volume, and a restart of the
    preview server cleared it.

## Release
Production-impacting, and nothing moves without the founder's explicit go. Run the steps in this
order:
1. `node backend/scripts/run-201.js --dry`, then `--apply`, against production. This must come first,
   because the new server code reads the column.
2. Commit, staging files by path. This tree is shared with another window.
3. Push. That deploys the server on Render and the website on Vercel.

No phone change, no OTA. Afterwards the founder clicks through on production: delete a draft, then
delete an ended offer from the list and from its page.

### On the day (from the final check, 3 Oct)
- **The migration.** On both the `--dry` and the `--apply` run, read the `Target:` line: it must be the
  production pooler (`…pooler.supabase.com:6543/postgres`), never localhost. `--apply` should print
  APPLIED within a few seconds and four OK lines. The SQL gives up after five seconds if another
  session is holding the offers table (`lock_timeout`); that changes nothing — run it again.
  If it ends with "SOMETHING MOVED" while the four lines are OK, the column is in and someone simply
  used the app during the run: run `--dry` again and go on only when it prints
  `already applied? {"brand_offers.deleted_at":true}`. Keep clear of the wallet job times (on the
  hour, :20, 00:00–00:10 IST).
- **Migrate first, then push.** With the new server code and no column, every brand offer screen
  fails (creators, shoppers, orders and the wallet keep working); running the migration cures it at
  once.
- **The website lands before the server.** Vercel is usually live minutes before Render. In that gap,
  Delete on an ENDED offer is refused in the old server's words — "A published offer can't be
  deleted. End it instead." Nothing is changed by that click. Render cannot be proved from outside
  for this release (no new route; everything under `/v1/brands/me` answers 401 without a session), so
  **the proving click is the founder's Delete on an ended offer**: the old sentence means the old
  server answered — wait a few minutes and try again. Deleting a draft works on both servers.
- **Rollback, said in full:** reverting the code makes every offer a brand deleted visible in its
  list again (the rows were never erased); deleted drafts stay gone. The column can stay.

### After the final check (3 Oct)
- The migration sets `lock_timeout = '5s'` (the one release-blocking finding).
- A delete that finds the offer already gone (deleted in another tab, or a first try whose answer was
  lost) closes the box and reloads instead of showing an error — on the list and on the offer's page.
- Tests added for behaviours that were true but unpinned (gift and bundle cancellations after a
  delete, the daily sweep, the India-day boundary, old-builder offers, three deletes at once; on the
  website the double-click guard, the refusal and already-gone paths).
- Known and left: a deleted offer's name still appears to the brand inside a creator's own record
  (her terms, the wallet's sales list) — those are records, kept by rule 2; a stale terms sheet that
  still carries a deleted offer is refused with a sentence naming it; the builder's "← Offers",
  "Cancel" and "Save as draft" still open Listings on Inventory (separate small fix).

### Final numbers at release (3 Oct, after the added tests)
- `backend/tests/offer-delete.test.js`: **27 / 27** (17 + 10 ported from the final check's probes: a free
  gift order and a bundle order cancelled after their offer was deleted, the daily sweep on an offer
  deleted before it ran, the India-day boundary by injected day and by the process clock, old-builder
  offers, three deletes at once, End and Delete sent together, an unsigned invitation). With
  offers-v2-flow, brand-offer, shopper-ordering and item17-wallet: 107 / 107.
- `qa/web/brand/offer-delete.spec.ts`: **17 / 17** (9 + 8: one delete on a double-click, already gone
  on the list and on the page, a refusal on the page, backing out), 51 / 51 with `--repeat-each=3`,
  on a clean `next build` of an isolated copy. Escape does not close the box today (no key handler);
  recorded, not changed.
- **Migration 201 on production**, 3 Oct 11:07–11:08 IST: `--dry` (target the production pooler; 3
  drafts, 1 ended, 3 running; column absent) → `--apply` (APPLIED; 4 / 4 OK; "Nothing moved") →
  `--dry` (`already applied? {"brand_offers.deleted_at":true}`, offers hidden 0).
