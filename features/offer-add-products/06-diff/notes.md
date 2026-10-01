# Diff notes — offer-add-products

Against `04-preview/mockups/offer-add-products-mockups-v1.html` (A1–A3). "After" shots are the real
page on a local preview (private scratch database, never production), 1 Oct 2026:
`after-A1-no-creator.jpg`, `after-A2-add-panel.jpg`, `after-A2-added.jpg`,
`after-A3-given-to-creators.jpg`, `after-A4-remove-dialog.jpg`.

## What was implemented
- Server: `offerLife.addProducts` (`POST /v1/brands/me/offers/:id/add-products`) — only a Scheduled
  or Live offer no creator has; held from today (or the start date) to the end date; the lock and
  the publish checks re-run on the pool as it would be; refusals in plain words. `assertNotGiven`
  now also guards remove-preview and remove-products. The offer view carries `pool_open`.
  `offerPool.candidates` checks locks from the first day a product would be held.
- Page: **Add products** beside Remove products; a panel to browse a category or search, tick and
  add; both buttons disabled plus a notice once a creator has the offer; the Pool tile and the foot
  note say which state the offer is in; the remove dialog no longer talks about creators.

## What matches the mockup
A1 three buttons, "can change until a creator has it", the new foot note · A2 the panel, "In pool"
and 🔒 "In "Denim Days" until 18 Oct" rows that can't be ticked, the count on the button, the toast ·
A3 both buttons greyed out, the notice, "frozen", End offer now still active.

## Where it differs
- A product added after the offer's start date shows "· added 3 Oct 2026" in the pool list (not drawn).
- The remove dialog (A4, not drawn) reads "No creator has this offer yet, so nothing else changes."
- Adjacent wording fix in that dialog: "The 1 product becomes free" (was "become").

## Order of work (stated plainly)
The founder's message gave the screen (a screenshot) and the rule in words; the page was built from
that and the board was drawn alongside as the record, not locked on a separate turn first. Lock
decision taken under standing autonomy; the founder sees the real page before any deploy.

## Test record
- `tests/offer-add-products.test.js` 12 / 12.
- Offer, terms and post suites together (offers-v2-rules / -flow / -listings, creator-terms-v2,
  shoppable-posts-v2, offer-add-products): 141 / 141. Two checks rewritten for the rule change
  (03-expected-outputs.md, "Drift recorded").
- Full backend run against `backend/baseline_item17.json` (`backend-compare.txt`): before 135 suites /
  1786 tests / 1577 passed / 181 failed → after 138 / 1831 / 1625 / 178. **0 tests that passed before
  fail now; 0 new tests fail.** The tree also carries item 17's uncommitted tests, which account for
  the rest of the movement.
- Walked on the local preview: add 2 products (pool 2 → 4), remove 1 (4 → 3), the given offer
  shows both buttons disabled with the notice.
