# offer-builder-v2 — expected outputs: the checks

Each check names the test that proves it. Status comes from the test run, never by hand.
Backend suites: `offers-v2-rules` (R, pure), `offers-v2-flow` (F, API + database),
`offers-v2-listings` (L, API + database). Web: `node --check`-level build + the brand-web build.

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | Migration 193 applies twice cleanly; every old offer is archived and off the store | F "the clean break" + scratch double apply | |
| 2 | A draft is created by choosing a type; name "Untitled offer"; BOGO's sub-type is set for it | F "a draft from a type" | |
| 3 | Dates: both required to publish; end after start refused on save | F "dates"; R "dates" | |
| 4 | Category → all adds every published product under the node, minus locked, counted | F "pool lines" | |
| 5 | Filters combine with AND across kinds, OR within a kind; price uses the one price | F "filters AND / OR" | |
| 6 | Lines add together; a product in two lines is counted once and the duplicate is reported | F "pool lines" | |
| 7 | A locked product shows the other offer's name and end date and can't be added | F "locked shown and skipped" | |
| 8 | A draft locks nothing: two drafts can hold the same product | F "drafts lock nothing" | |
| 9 | Publishing locks: a second offer with overlapping dates can't publish the product, and names it | F "the lock at publish" | |
| 10 | Non-overlapping dates: the same product can be in two published offers | F "the lock at publish" | |
| 11 | The database refuses an overlapping pair even when the app check is skipped | F "the database backstop" | |
| 12 | Publish is blocked when a product the brand reviewed was taken meanwhile (named) | F "final lock check" | |
| 13 | Pick-any refuses a second category with the board's wording | F "pick-any stays in one category" | |
| 14 | Discount %: 0 < % < 100; optional max ₹; example line from the pool | R "discount %" | |
| 15 | Flat: ₹ off must be below the cheapest item in the pool (named) | R "flat"; F "checks come back with the offer" | |
| 16 | Volume: 1–4 tiers, thresholds and rewards increase, ₹ reward below its threshold | R "volume" | |
| 17 | Pick-any / Mix & match: band ≤ 1.5×, cheapest combination saves ≥ 10%, pool ≥ pick; safe price | R "bundle pick" | |
| 18 | Fixed bundle: price below total; the total shown | R "bundle fixed" | |
| 19 | Free gift: costliest gift combination below the minimum purchase (both sub-types); number of gifts ≤ gift pool | R "free gift" | |
| 20 | Free gift: a store-product gift needs a limit; a gift item needs stock; pools can't share a product | R "free gift"; F "gift pool" | |
| 21 | BOGO: no price checks; optional max free | R "bogo" | |
| 22 | End date already passed → publish blocked | R "dates" | |
| 23 | Status: Scheduled before the start, Live on start and end days, Ended after, Ended early | R "status"; F "end now" | |
| 24 | After publishing, name / dates / numbers / pool can't be changed (409) | F "published is frozen" | |
| 25 | A draft can be deleted; a published offer can't | F "delete" | |
| 26 | Remove products: freed at once (another offer can take them the same day); creators told | F "remove products" | |
| 27 | Remove refused when it would break the deal (all buy products, fixed bundle, below pick count, empty gift pool) | F "remove guards" | |
| 28 | End now: ended today, products free today, a Scheduled offer frees them entirely; creators told | F "end now" | |
| 29 | Auto-add: a new product matching a category line joins from today; locked / excluded / off → not | F "auto-add" | |
| 30 | Products without offers on a date: excludes locked-on-that-day, includes an offer that ended before; next / last offer shown | L "products without offers" | |
| 31 | Gift items never appear in products without offers, in buy pools, or anywhere but gift pools | L "gift items stay gift-only" | |
| 32 | The Offer column: now / next / none per product; the panel adds creators and "free from" | L "offer per product" | |
| 33 | Gift items: create (4 fields), restock, validation (value > 0, stock ≥ 0, name) | L "gift items" | |
| 34 | A gift item follows the one-offer rule | F "gift pool" | |
| 35 | Price-impact: the offer, creators, what the shopper pays, rules the new price breaks; none when not in an offer | L "price impact" | |
| 36 | Saving a new price tells each creator given the offer, old → new; no offer → nobody told | L "price change tells creators" | |
| 37 | Offers list: v2 only, status counts (Live, Scheduled, Draft, Ended), type, search, valid-on-date filter, product and creator counts | L "the offers list" | |
| 38 | Another brand's offer, pool, gift item, product → 404 everywhere | F "another brand" | |
| 39 | The old list (no engine) returns no new offers; the old attach paths refuse a new offer | F "the old doors" | |
| 40 | The bulk "Attach offer" endpoint is gone (404) | F "the old doors" | |
| 41 | No money moves; checkout doesn't read the new tables | code read + F "the old doors" (no follower_transactions writes) | |
| 42 | No new failures against the baseline | `node scripts/compare-tests.js` | |
