# Impact — pass 2

**One-line verdict: no shopper sees a difference; one kept feature starts working again.**

| Who | What they notice |
|---|---|
| Shoppers | Nothing on any reachable surface. The removed controls only ever appeared in a food world. |
| Shoppers who review | The "places you haven't reviewed yet" list can now return something. Before, being restaurant-only, it could not. |
| Brands | Nothing. |
| Creators | Nothing. |
| Admin | Nothing. |

## Deploy classification

**PRODUCTION-IMPACTING.** `backend/src` changed, so Render redeploys; mobile changed, so
an OTA is needed.

- Two backend edits: one field dropped from a SELECT, one filter dropped from a WHERE.
- No migration. No schema change. No data touched.

## What could break, honestly

1. **A client still expecting `veg_flag` on a product.** Searched: only the food
   components read it, and their screens were removed in pass 1. Nothing in the fashion
   path reads it.
2. **The category browser.** 267 lines came out of one file. It parses, all 722 tests
   pass, and the one shared value the food code produced (`foodFilteredSections`) was
   repointed at the unfiltered list rather than left dangling.
3. **The widened review list returning unexpected rows.** It now returns any completed
   purchase with no review — which is the intended behaviour of the feature, and was only
   ever narrowed because restaurants were the only vertical when it was written.

## What is NOT affected

`restaurant_reviews` — the reviews feature — is untouched and still joined on every
product card. It is named after a retired era but serves every shop type. Renaming it is
a data change and belongs to pass 4 at the earliest.
