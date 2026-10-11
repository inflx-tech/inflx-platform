# Impact Analysis — Listing and shop safety: four fixes

> Step 6. Written BEFORE implementation code.

## In one line
Hide and zero stock stop destroying posts; Edit stops restoring sold stock; Place order happens
once; a set is in the shop only when it can be bought. One additive migration. No money moves.

## Affected files

**backend — changed**
| File | Change |
|---|---|
| `src/services/shoppablePosts.service.js` | `afterProductChange`: off sale → posts keep the product (facets recalculated); only a permanent Remove deletes it from posts; back on sale → facets recalculated; the "every product at 0 → remove the post" branch goes. `refreshFacets` reads products on sale. The creator's single-post read gains `not_in_shop`. |
| `src/services/creatorTerms.service.js` | notices: "not on sale right now" on a pause, "back on sale" on Show; the old "no longer available" only on a permanent Remove |
| `src/services/postsCopy.js` | the two new notices and the two "not in the shop" sentences |
| `src/controllers/brand.controller.js` | `deleteProduct`: refused for a piece of a running or scheduled set; passes "permanent" on |
| `src/controllers/offersV2.controller.js`, `src/services/offerPool.service.js` | the product panel's real post counts |
| `src/controllers/listing.controller.js` | `updateListingProduct`: inside a transaction holding the product's row, merges each size's stock with `stock_was`; answers `stock_notes` |
| `src/services/stock.service.js` | `mergeStock` — the one rule for "what the brand typed against what is live" |
| `src/services/shopperCheckout.service.js` | `place()`: `place_key` — a repeated key answers with the checkout already made |
| `src/services/shopperPosts.service.js` | `livePool`: a set's post is live only while every piece is on sale with stock for its quantity (unless pieces may be bought alone) |
| `migrations/207_checkout_client_key.sql`, `scripts/run-207.js` | `checkouts.client_key`, unique per shopper where set |

**web — changed**
`Packages/brand-web/app/dashboard/products/components/InventoryBrowser.js` (Remove's question, the
refusal), `app/dashboard/products/listing/page.js` (sends `stock_was`, shows `stock_notes`).

**mobile — changed**
- follower: `screens/shop/order/CheckoutScreen.js` (the key), `screens/shop/order/DealScreen.js`
  (a ×2 piece).
- influencer: `screens/create/PostStatusScreen.js` (the blue box), `components/create/copyCreate.js`.

**docs** — `Docs/OFFER_TERMS_POSTS_RULES.md` 2.8 and 4.9 → v1.22.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| PATCH | `/brands/me/products/:pid` (`is_active`, `pushed_to_store`) | off sale is a pause | Listings Hide / Show |
| DELETE | `/brands/me/products/:pid` | 422 `REMOVE_REFUSED` for a set's piece | Listings Remove |
| GET | `/brands/me/offers/product-offers/:productId` | `posts` real, `+ posts_only_this` | Listings panel, Remove's question |
| PATCH | `/brands/me/listing-products/:id` | `sizes[].stock_was`, `stock_was`; answer `+ stock_notes` | Edit product |
| POST | `/follower/checkout/place` | `+ place_key` | shopper app |
| GET | creator's single post | `+ not_in_shop` | creator app |
| — | every reader of `livePool` (feed, play, stores, search, saved, bag, deal page) | a broken set's post is absent | shopper app |

## Affected workflows (regression surface)
- A product going off sale, sold out, removed — creator-terms and shoppable-posts suites. Tests that
  assert a hidden product LEAVES posts, or a zero-stock save REMOVES a post, are pinned to the rule
  this contract changes on the founder's decision.
- Edit product — the listing edit suite and today's stock-asked-once suite.
- Ordering end to end — shopper-ordering, shopper-app-fixes, shopper-deal-orders.
- Sets — the deal suites (fixed bundle).

## Migration / deploy / OTA impact
- **Migration 207, additive** (one nullable column, one partial unique index). Applied to live
  BEFORE the push: the new server writes the column on every Place order.
- Push → Render + Vercel.
- OTA: follower (checkout key, ×2 piece) and influencer (the blue box). Brand app: none.
- Safe orders: the server change works with apps that have not updated (every new field is
  optional), so the OTAs follow the push.

## Rollback
Revert the commit, republish the two previous bundles. The column can stay (nothing else reads it).
Posts paused under the new rule simply follow the old rule again on the next brand save.

## Risk notes
- **A rule changes** (rulebook 2.8, 4.9): a hidden product no longer leaves posts. Any screen that
  lists a post's products without asking "is it on sale" would now show a hidden product. Checked
  readers: the shop card (filters on sale), the deal page (filters on sale), the pricing engine
  (says "No longer available"), the post's title words (filter on sale). The creator's and admin's
  post views list every product of the post — a hidden one is still hers; it is marked.
- A post waiting to be approved that holds a hidden product: INFLX's approval already refuses a
  post whose products are not on sale, with the reason; unchanged.
- Place order: two requests with the same key in the same instant — the database's unique index
  refuses the second, whose stock take is rolled back with it.
- No money path is edited. No order, refund, commission or wallet code changes.
