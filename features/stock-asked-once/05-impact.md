# Impact Analysis — Stock asked once

> Step 6. Written BEFORE implementation code, from a sweep of every reader and writer of either
> stock number (11 Oct 2026). "Own" = `brand_products.stock`. "Sizes" = `variants_json` → colours →
> sizes → stock.

## In one line
The server starts keeping the own number equal to the total of the sizes; the website and the Excel
sheet stop asking for it; the shopper app stops asking a one-size product for a size. No schema
change, no money path, no order path edited.

## Affected files

**backend — changed**
| File | Change |
|---|---|
| `src/services/stock.service.js` | new `cleanStock`, `ownStock`, `oneSizeProduct`; `moveProducts` also resets an EMPTY own number when the sizes' total reaches 0 (found in the sweep: `Number(null) !== 0` was false, so it stayed empty and every own-number reader went on saying "in stock") |
| `src/controllers/listing.controller.js` | `buildVariants` cleans each size's stock; `insertProducts` and `updateListingProduct` take the own number from `ownStock` |
| `src/controllers/brand.controller.js` | the older `POST /brands/me/products` and `PATCH /brands/me/products/:pid` hold the same rule when the product ends up with sizes (no live screen sends a stock through them for a fashion product today; the rule must not depend on that) |
| `src/services/listingBulk.service.js` | template: one "Stock" column per row on a leaf with a size axis, no "Size" column on a one-size leaf; import: fills the one size, reads the row's stock, refuses an old-template sheet |
| `src/services/shopperOrders.service.js` | deal data: `one_size` per product and per product-gift; a product whose colours hold no sizes now answers "sold out" from its own number (found in the sweep: it could never say sold out) |

**backend — read by this change, not edited**
`orderPricing.service.js` (`choicesOf`, `variantOf`), `shopperPosts.service.js` (feed SQL, `card`),
`shoppablePosts.service.js` and `creatorTerms.service.js` (`afterProductChange`), `taxonomy.service.js`.

**web — changed**
`Packages/brand-web/app/dashboard/products/listing/page.js` (Add / Edit product, bulk add).

**web — not edited**
`components/InventoryBrowser.js` (Listings): reads the own number, which is now always the total.

**mobile (follower) — changed**
`src/components/shop/orderBits.js` (`ChoicePicker`, `SizeSheet`, `ProductPopup`, helpers),
`src/screens/shop/ProductScreen.js`, `src/components/shop/copyOrder.js` (no new sentence expected).

**scripts — new, not deployed code**
`backend/scripts/repair-one-size-stock.js` (already run, 11 Oct), `backend/scripts/sync-own-stock.js`.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | `/brands/me/products/batch` | `stock` in the body ignored when the product has sizes; sizes' stock cleaned | website Add product |
| PATCH | `/brands/me/listing-products/:id` | same | website Edit product |
| POST | `/listing/nodes/:id/import` | reads the new sheet; refuses an old-template sheet | website bulk add |
| GET | `/listing/nodes/:id/template.xlsx` | new columns on a leaf with a size axis | website bulk add |
| POST / PATCH | `/brands/me/products`, `/brands/me/products/:pid` | own number recomputed when the saved product has sizes; otherwise as today | older flat product page, Listings toggles (send no stock) |
| GET | `/follower/posts/:id/deal` | `+ one_size` on each product and product-gift; `sold_out` right for a product with colours and no sizes | shopper app |

## Everything else that reads the own number (it becomes right, with no edit)
| Reader | What it decides |
|---|---|
| `shopperPosts.livePool` SQL (17 callers: feed, play, stores, search, saved, the bag's "is this post live") | whether a post is in the shop |
| `shopperStores.collection`, `shopperEngagement` saved products | whether a product shows in a collection / as available |
| `shoppablePosts.afterProductChange`, `creatorTerms.afterProductChange` | on a brand save: a product at 0 removes posts left with nothing to sell, and tells its creators "out of stock" |
| `brandProducts.outOfStock` (brand app and creator app product cards) | the "Out of stock" badge |
| `collabOwedItems` (brand "Needs you") | "nothing left to buy" |
| Listings page | the number, the Low / Out tiles and filters |

**A behaviour that starts happening, correctly.** When a brand saves a product with every size at 0,
its own number is now 0 — so rules 2.8 / 4.9 fire as written: posts left with nothing in stock leave
the shop and the creators holding the product are told. Until now a typed own number hid that.

## Found in the sweep, NOT changed here
- Saving cover photos rewrites the whole `variants_json` from an unlocked read
  (`listing.controller.js` `setProductCoverPhotos`): a sale landing in between could have its size
  decrement written over. Rare; its own fix.
- The older Excel upload (`POST /brands/me/products/bulk-upload`) files per-size stock in
  `product_variants`, a table nothing sells from. Not used by the fashion listing.
- A product that sells out through orders removes no post and tells no creator
  (`afterProductChange` is called only on brand saves). The post still leaves the shop feed,
  because the feed asks the own number.
- `brandProducts.outOfStock` lets the own number win over the sizes; harmless once they agree.

## Affected workflows (regression surface)
- Listing create / edit / import — `backend/tests/` listing suites (batch, edit, excel, per-colour sizes).
- Ordering, cancel, returns, replacement (they move stock) — the shopper-ordering, shopper-app-fixes,
  shopper-deal-orders and returns suites.
- Shopper size sheet, product page, deal page, bag "change size" — `Packages/Mobile` shop suites.
- Brand saves that notify creators — creator-terms and shoppable-posts suites.

## Live data, at release
`node scripts/sync-own-stock.js --dry` on 11 Oct 2026: 72 products, 49 with sizes, **26** whose own
number is not the total of their sizes.
- 22 + 1: every size counted → own becomes the total (Aveen's six are short by units already sold
  before 5 Oct; Balaji's sixteen were typed that way; Kanchi's one goes 10 → 12).
- 3: some or no size counted (two of Label Fern, one of Balaji) → own becomes empty ("—").
- 0 products change what a shopper can buy; 0 change whether a post is in the shop.
Only the own number is written. No size's stock, price, order line or wallet is read for writing.

## Migration / deploy / OTA impact
- Migration: **none**.
- Order of release: (1) push — Render and Vercel; (2) `sync-own-stock.js --apply` on live;
  (3) shopper app OTA. The server change is safe before the OTA (an older app ignores `one_size`),
  and the sync is safe before or after the push.
- Brand and creator apps: no OTA. No native change; no new app build.

## Rollback
Revert the commit and re-publish the previous shopper bundle. The data needs no rollback: after the
sync every own number equals what the sizes already said, which the old code reads the same way.

## Risk notes
- A brand used to typing a total in Step 1 will not find the box. The board's Step 2 total and
  sentence are the answer; the website's page is the one screen to look at after release.
- An Excel sheet prepared from the old template stops importing until re-downloaded. Deliberate:
  the old sheet is how ten sunglasses went out of stock.
- No money moves. No order, wallet, commission or payout code is edited.
