# offer-delete — expected outputs: the checks

Status comes from the test runs and the walk, never by hand. "Server" = backend jest; "Walk" = the
website on a local preview (a private scratch database) and then the founder on production.

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | A Draft row shows Continue and Delete; a Scheduled, Live row shows only Open; an Ended row shows Open and Delete (both kinds of Ended) | Walk (local preview) | pass (walk, local preview; both list pages) |
| 2 | Deleting a draft erases it; the list and the Draft count update; toast "Draft deleted." | Server + Walk | pass (test + walk) |
| 3 | Deleting an ended offer (ended early) hides it: gone from the list and the Ended count; its page answers not found | Server + Walk | pass (test + walk) |
| 4 | The same for an offer that ended by its date (status still published, end date passed) | Server | pass (test + walk) |
| 5 | A Scheduled or Live offer is refused: 409 "This offer is still running. End it first, then you can delete it." | Server | pass (test) |
| 6 | A second delete of the same offer, or another brand's offer, answers not found | Server | pass (test) |
| 7 | After hiding: a creator who had it still sees it in her terms and on her posts; order lines, the wallet's sales and admin still name it | Server | pass (test) |
| 8 | After hiding: it is not in the brand's creator-terms "not shown, ended" note nor the "last in offer …" hint on Products without offers | Server | pass (test) |
| 9 | After hiding: its products' past-day holds are freed; a new offer back-dated over those days on the same product publishes | Server | pass (test) |
| 10 | Delete from the ended offer's page: the confirm, then back on the Offers list with "Offer deleted." | Walk | pass (walk + website test) |
| 11 | End offer now's box says the offer stays in the list as Ended until you delete it | Walk | pass (walk + website test) |
| 12 | Migration 201 is additive and repeatable; run-201 --dry shows the column absent, --apply adds it, a second --apply changes nothing | Server (scratch DB) + prod run | pass — scratch database, then production 3 Oct 11:08 IST (APPLIED, 4/4 OK, nothing moved; a second --dry confirms) |
| 13 | Nothing else moved: the offer, terms, post, order and wallet suites, and a full backend run against the last stored full run | Server | pass — 0 that passed before fail now (06-diff/backend-compare.txt) |
| 14 | `next build` of brand-web is clean | Build | pass (clean next build on an isolated copy) |

## Drift recorded
Existing tests whose pinned rule changed with v1.17 §1.9. Rewritten to the new rule, never skipped,
deleted or weakened.

| Test | What it asserted | What it asserts now |
|---|---|---|
| `backend/tests/offers-v2-flow.test.js` · check 25 "a draft can be deleted; a published offer can't" (now "…a scheduled offer can't — it must be ended first") | A draft deletes (200); a Scheduled offer is refused 409 with "A published offer can't be deleted. End it instead." | A draft deletes with `{ deleted: true, mode: 'erased' }`; the same Scheduled offer is refused 409 `OFFER_LOCKED` with "This offer is still running. End it first, then you can delete it." and is still Scheduled. (Ended offers are now deletable: `tests/offer-delete.test.js`.) |
| `backend/tests/brand-offer.test.js` · test 4/5 "…a draft is deleted outright (a published one is only ended)" (now "(a running one is only ended)") | A draft delete answers `deleted: true` and the row is gone. | Unchanged, plus the answer carries `mode: 'erased'`. Only the title's parenthesis changed: an ended offer is no longer "only ended". |

`offers-v2-listings.test.js` (the list counts `{all:4, live:1, scheduled:1, draft:1, ended:1}`) needs
no change: it deletes nothing, and the new filter only drops offers the brand deleted.
