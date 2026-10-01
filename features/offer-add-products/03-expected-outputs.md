# offer-add-products — expected outputs: the checks

Each check names the test that proves it. Backend `tests/offer-add-products.test.js` (A);
`tests/offers-v2-flow.test.js` (F); `tests/shoppable-posts-v2.test.js` (P). Status comes from the
test run, never by hand.

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | A Scheduled offer no creator has takes new products; they are held from its start date to its end date; another offer can't take them on those days | A "a scheduled offer takes the products…" | pass |
| 2 | A Live offer takes them from today | A "a live offer takes them from today" | pass |
| 3 | A product another offer held earlier in these dates is free from today: unlocked in the picker and accepted | A "a product another offer held earlier…" | pass |
| 4 | A signed creator has the offer: add, remove-preview and remove are refused (409 `OFFER_GIVEN`, the founder's sentence); the pool is untouched; nobody is notified; `pool_open` is false; ending still works | A "signed: add and remove are both refused…" | pass |
| 5 | An unsigned invitation counts the same | A "an unsigned invitation: add and remove are both refused…" | pass |
| 6 | A declined invitation, or an offer dropped from an invitation, leaves the products open | A "a declined invitation, or an offer dropped…" | pass |
| 7 | A product another offer holds on these days is refused and named | A "a product another offer holds…" | pass |
| 8 | Already in the offer / not a published product / another brand's / nothing ticked → refused with the reason | A "already in the offer, not a published product…" | pass |
| 9 | A draft, an ended offer and a fixed bundle take no products this way | A "a draft, an ended offer and a fixed bundle…" | pass |
| 10 | Products that would break the deal (bundle band, pick-any category, flat ₹ off) are refused in plain words; a product that fits is accepted | A "products that would break the deal…" | pass |
| 11 | With no creator, removed products are free the same day and can come straight back | A "with no creator, removed products are free the same day"; F check 26 (rewritten) | pass |
| 12 | Another brand's offer answers 404 | A "another brand's offer answers 404" | pass |
| 13 | Her posts keep every product when the brand tries to remove from an offer she has; the engine that takes products out of posts still works when called (the backstop, A10) | P "an offer a creator has can't lose products…", "products that leave an offer leave its posts… (the engine)" | pass |
| 14 | Nothing else in the offer, terms and post suites moved | offers-v2-rules / -flow / -listings, creator-terms-v2, shoppable-posts-v2: 141 / 141 | pass |
| 15 | No regression anywhere: no test that passed in the last recorded full run fails now | full run vs `backend/baseline_item17.json` — `06-diff/backend-compare.txt` | pass |

## Drift recorded (business-rule drift, founder's rule change of 1 Oct 2026)
- **F check 26** used to give the offer to a creator, remove two products and expect her to be told.
  Rewritten: removal with no creator (free at once), then given → refused, no notice.
- **P "products removed from the offer leave the post…"** used to remove through the brand's route.
  Split in two: the route is refused and her posts stay whole; the engine is proved by calling it.
No assertion was weakened: each old expectation is either kept or replaced by the opposite the new
rule requires.
