# Feature Spec — Stock asked once

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.
> Raised by the founder on 11 Oct 2026 from two screenshots: the shopper app said "Out of stock" for
> two sunglasses whose Listings rows showed 20 and 8 in stock.

## Problem / goal

A product holds stock in two places, and nothing keeps them equal:

| | Where it lives | Who reads it |
|---|---|---|
| The product's own number | `brand_products.stock` — the "Stock" box in Step 1 of Add a product, the "Stock" column of the Excel sheet | the Listings page (number, Low / Out tiles, filters), and the shop feed's "does this post still have something to sell" |
| The sizes' numbers | `brand_products.variants_json` → colours → sizes → stock — the per-size boxes in Step 2, the "Variant stock" column | the shopper app (tile, size sheet, product page, deal page), the bag, checkout, orders, returns |

A one-size product (sunglasses, a watch, a bag, a saree) has no real size, so the form files each
colour's stock under a stand-in size called "Free Size". The brand is therefore asked the same
question twice — "Stock" in Step 1 and "Free Size" in Step 2 — and the shopper app listens to the
second. Ten sunglasses listed on 9 Oct 2026 held 4–20 in the first and 0 in the second: "Live, 20 in
stock" for the brand, "Out of stock" and unbuyable for every shopper.

**Goal.** Stock is typed in one place only. The product's own number is never typed for a product
that has sizes: it is the total of its sizes, kept by the server. A one-size product is listed, and
bought, by colour alone.

**The rule (one sentence).** A product with sizes has one stock — its sizes; its own number is their
total when every size is counted, and empty when any size is not counted.

## What the founder agreed (chat, 11 Oct 2026)

1. A product with several sizes is "Out of stock" only when every size is out; one size running out
   crosses out that size only. (Already how the app works — restated, kept.)
2. Clothing is three levels — product, colour, size. Sunglasses are two — product, colour.
3. For a one-size product the listing form asks stock once per colour: no "Free Size" box and no
   separate "Stock" box. The shopper picks only a colour.
4. Clothing stays as it is, except the product's total is added up from the sizes instead of typed.
5. "Yes now understood....fix these issues."

Done already on that go: the ten sunglasses were repaired on live (each product's own number copied
into its one size) by `backend/scripts/repair-one-size-stock.js`, and the live server was read back
sending all ten as in stock. That script is in this contract's commit; it is not part of the deploy.

## Survey — what exists today (looked at, not remembered)

Verdicts: **Works · Server only · Screen only · Broken · Missing · Unknown**.

| # | Capability | Verdict | Evidence |
|---|---|---|---|
| 1 | Brand types a product-level stock | Works | `Packages/brand-web/app/dashboard/products/listing/page.js:764` (Step 1 "Stock"); saved by `listing.controller.js` `insertProducts` :135 and `updateListingProduct` :780 |
| 2 | Brand types stock per colour and size | Works | same page :842–851; saved by `buildVariants` :65–85 |
| 3 | The two are kept equal when a product is listed or edited | **Missing** | `insertProducts` and `updateListingProduct` write both exactly as sent; no line compares them |
| 4 | The two are kept equal when an order takes or returns stock | Works (since 5 Oct 2026) | `stock.service.js:112–116` resets the own number to `sizesTotal` — only when every size is counted |
| 5 | Shopper app decides "Out of stock" from the sizes | Works | `stock.service.js` `available` :63; `shopperPosts.service.js` `card` :275; `shopperOrders.service.js` `dealPage` :69–72; phone `bitsShop.js:505`, `orderBits.js` `isSoldOut` :174 |
| 6 | One size out crosses out that size only | Works | `orderBits.js` `ChoicePicker` :258–261 |
| 7 | Listings shows stock, Low / Out tiles and filters from the own number | Works, but on the wrong number whenever #3 bites | `components/InventoryBrowser.js:222–235, 398–403` |
| 8 | The shop feed keeps a post while a product has stock | Works, on the own number | `shopperPosts.service.js:131–132` `(bp.stock IS NULL OR bp.stock > 0)` — why the sunglasses post stayed in the feed while every tile in it said "Out of stock" |
| 9 | A one-size product listed without choosing "Free Size" | Works, a different shape | the colour is saved with no sizes; the own number is then its only stock (live: AVEE-0011, a handbag) |
| 10 | Excel import asks stock twice | Works, same fault | `listingBulk.service.js:65` "Stock" and :75 "Variant stock"; both land through `insertProducts` |
| 11 | Shopper buying a one-size product | Works, with a needless tap | `orderBits.js:520` `ready = !needs || !!sel.size` — she must tap the lone "Free Size" chip; the button reads "Choose a size" until she does |
| 12 | Live data on 11 Oct 2026, after the repair | Looked | 72 products, 49 with sizes; 26 whose own number is not the total of their sizes (`scripts/sync-own-stock.js --dry`). Aveen's six are each short by the units already sold before 5 Oct (#4 did not exist yet); Balaji's sixteen were typed that way; three have sizes that are not counted |

Rows from the wider sweep (every other reader and writer of either number) are in `05-impact.md`.

## Scope

**In scope**
- S1 · Server rule: on create, edit and import, a product with sizes gets its own number from its
  sizes; a product-level stock sent for it is ignored. A product with no sizes keeps the number sent.
- S2 · Server: a stock that is not a number is saved as empty; a negative number as 0.
- S3 · Website, Add / Edit product: the Step 1 "Stock" box is shown only for a product type with
  nothing to count per colour or size. Step 2 for a one-size product: no "Size" row, one stock box
  per colour. Step 2 everywhere: "Total stock", the empty-box sentence, "—" instead of a grey "0".
  Review: "Total stock".
- S4 · Website, Edit: an existing one-size product with one colour and no size loads its own number
  into that colour's box.
- S5 · Excel: one "Stock" column; no "Size" column on a one-size leaf; an old-template sheet refused.
- S6 · Shopper app: for a one-size product the server says so (`one_size`), and the picker shows
  colours only — on the bag-icon sheet, the product page and the deal page's product pop-up.
- S7 · Live data, at release: the 26 products' own numbers brought into line (`sync-own-stock.js`).

**Explicitly out of scope**
- The stored shape. A one-size colour is still saved as colour → "Free Size" → stock, so orders,
  returns, the bag and every past order line ("White · Free Size") are untouched.
- The words "Free Size" on bag, checkout and order lines.
- Furniture leaves whose stock is counted along another choice (seater, doors): unchanged.
- The Listings page layout. It reads the same field, which is now always right.
- Low-stock alerts, stock history, stock per store branch.
- The brand phone app and the creator app.

## Surfaces touched
- App(s): backend · brand-web (Add / Edit product, bulk add) · mobile (follower)
- Roles involved: brand, shopper

## Data / contracts
- New or changed tables / columns / migrations: **none**. No schema change.
- Live data: `brand_products.stock` of 26 products, once, at release (S7). No size's stock is written.
- Changed API behaviour:
  - `POST /brands/me/products/batch`, `PATCH /brands/me/listing-products/:id`, `POST /listing/nodes/:id/import`: `stock`
    in the body is ignored when the saved product has sizes.
  - `GET /follower/posts/:id/deal`: each product gains `one_size: boolean`. Additive; an app that does
    not know the field behaves as today.
  - `GET /listing/nodes/:id/template.xlsx` for a leaf with a size axis: "Stock" now means the row's stock; "Variant stock"
    and (on a one-size leaf) "Size" are gone.
- Money/units, attribution IDs, status machines affected: none.

## Non-functional
- Auth/role gates: unchanged (brand-scoped create and edit; the shopper reads are public).
- Failure modes the feature must handle:
  - an old copy of the website still sending a Step 1 stock → ignored, never a mismatch;
  - an old-template Excel sheet → refused whole with a sentence that names the fix;
  - a shopper app that has not taken the update → the "Free Size" chip still shows and still works;
  - any size left empty → the product's own number is empty ("—"), and it never blocks a sale.
