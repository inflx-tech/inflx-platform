# 06 — Before / after notes

**Before:** the product page showed the description ("Details") + a long inline spec list
("Product Details", key↔value rows) from `facets`.

**After (`04-preview/mockups/product-highlights.html`):** a **Highlights** grid of spec
tiles (key attributes, 3 per row) + **"View details ›"** → a bottom-sheet popup with **All
details** (every attribute as tiles) + **About this product** (description).

## Delivered vs mock
- Highlights tile grid (facets + Category + Returns, first 9) — matches.
- "View details" popup (all attributes + description), ✕ to close — matches.
- Same `FACET_HIDE` exclusions; no data change. The rest of the PDP unchanged.

## Verification
- `ProductDetailScreen.js` babel-compile clean; jest 20/20 (FollowerWallet baseline excluded).
- Capture after OTA + founder re-test.
