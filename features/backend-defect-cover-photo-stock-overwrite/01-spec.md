# Spec — A photo save must never put sold stock back

> Carved backend defect. Found 11 Oct 2026 while building `features/stock-asked-once`, deliberately
> not fixed there. Approved by the founder in chat, 11 Oct 2026 ("ok pls do it"), after the fault was
> explained to him in plain language.

## The fault, in one example

A red T-shirt has **M = 3** on live. The brand has just imported it from an Excel sheet and adds a
photo in the photo tray. In the same instant a shopper buys one M.

1. The photo save reads the product's whole "colours and sizes" record: M = 3.
2. The order takes one: M = 2, and the product's own number goes down with it.
3. The photo save writes back the whole record it read: **M = 3 again.**

The sold piece is on sale again, and the product's own number (2) no longer agrees with its sizes
(3) — the disagreement `stock-asked-once` removed.

## Where

`POST /v1/listing/products/:id/cover-photos` → `listing.controller.js` `setProductCoverPhotos`.
Called by the website's photo tray after an Excel import (`listingApi.setCoverPhotos`). It reads
`variants_json` with no lock, sets `cover_images`, and writes the **whole** object back. The sizes'
stock lives in that same object and is moved by orders (`stock.service.js` `moveProducts`, which
does hold the row).

## What is wanted

1. **The photo save changes only the photos.** It holds the product's row while it works, and it
   writes only the `cover_images` key (and the cover picture). Sizes and their stock are never
   written by it.
2. **What the brand sees does not change**: the same request, the same answer
   (`{ id, image_url, cover_images }`), up to 6 cover photos, the first one is the cover.
3. **The same habit elsewhere is checked** (verdicts in `05-impact.md`). One more place read the
   sizes without holding the row before writing the product's own number:
   `PATCH /v1/brands/me/products/:pid` when the request carries a stock. It gets the same hold.
   Its ordinary uses (Hide, Show, a new price) send no stock and are left exactly as they are.

## Not in this contract

- No screen changes, no words change, no database change, no app update.
- The legacy flat product page sending a whole stale "colours and sizes" record through
  `PATCH /brands/me/products/:pid` (it is the brand's own typed copy, minutes old; fashion brands
  are sent to the drill-down Listings page and never reach it). Named in `05-impact.md`, left.
- Audit items 5 to 12 of 11 Oct.

## Done means

A test places a real order's stock movement **between** the photo save's read and its write, and
afterwards the size holds the sold number, the own number equals the total of the sizes, and the
photo is saved. The same test fails on the code as it is today.
