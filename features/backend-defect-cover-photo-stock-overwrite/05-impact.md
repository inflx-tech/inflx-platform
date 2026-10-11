# Impact Analysis — A photo save must never put sold stock back

**Verdict: server only, two functions, no database change, no screen, no app update.
PRODUCTION-IMPACTING (Render redeploys the backend) — explicit go required before the push.**

## Survey — every place that writes a product's "colours and sizes" record or its own number

Read in the code on 11 Oct 2026 (`grep "UPDATE brand_products"` and every `variants_json` write in
`backend/src`):

| Where | Holds the row? | Verdict |
|---|---|---|
| `listing.controller.js` `setProductCoverPhotos` — the photo tray | **No.** Reads, then writes the whole record | **THE DEFECT. Fixed here.** |
| `brand.controller.js` `updateProduct` — `PATCH /brands/me/products/:pid` | **No.** When a `stock` is sent for a product with sizes, the own number is worked out from sizes read earlier | **Same habit, smaller. Fixed here** (only on the path where a stock or sizes are sent) |
| same function, when a whole `variants_json` is sent | n/a | The client's own typed copy replaces the record — the old Edit-page fault. Only the legacy flat product page sends it, and fashion brands are redirected away from that page. **Left, named.** |
| `listing.controller.js` `updateListingProduct` — the Edit page | Yes, since `listing-shop-safety` (row held, each box merged with the live number) | OK |
| `stock.service.js` `moveProducts` — orders, cancels, returns, holds | Yes (`FOR UPDATE` inside the order's transaction) | OK |
| `listing.controller.js` `insertProducts`, `importProducts`; `brand.controller.js` `createProduct`, the menu import | new rows only | OK — nothing to overwrite |
| `listing.controller.js` tags, move to another category; `brand.controller.js` `deleteProduct`; `creatorImagery`; `adminDishQueue` | write other columns only | OK — not the stock |

## Affected files
- `backend/src/controllers/listing.controller.js` — `setProductCoverPhotos`
- `backend/src/controllers/brand.controller.js` — `updateProduct` (the stock path only)
- `backend/tests/cover-photo-keeps-stock.test.js` — new

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | `/v1/listing/products/:id/cover-photos` | same request, same answer; the write is now only the photos, made while holding the row | website photo tray after an Excel import |
| PATCH | `/v1/brands/me/products/:pid` | when `stock` or `variants_json` is sent: the read and the write are one held step. Otherwise unchanged | website Hide / Show / price (unchanged path); the legacy flat page |

## Affected workflows (regression surface)
- Excel import → photo tray → photos saved — covered by the new test (behaviour kept: order, cap of 6, the cover).
- Hide / Show / price — `listing-shop-safety.test.js`, `shoppable-posts-v2.test.js`, `creator-terms-v2.test.js`.
- The own number on the older endpoints — `stock-asked-once.test.js`.
- Orders moving stock — `shopper-ordering` suites.

## Migration / deploy / OTA
- No migration. No website change. No phone change, no OTA.
- Backend only → one push.

## Risk notes
- **Waiting, not failing:** a photo save and an order for the same product at the same instant now
  take turns (milliseconds). Neither can fail because of the other.
- No lock is held across anything slow: the photo upload happens before this request; inside the
  hold there are two short statements.
- No data is rewritten at release. Products already left with a disagreement (none known: live was
  brought into line on 11 Oct and re-read clean) are not touched by this.
