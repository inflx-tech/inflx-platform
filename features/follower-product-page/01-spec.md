# 01 — Spec: follower-product-page (Highlights + View details)

From the founder's walkthrough (2026-06-27), with two reference screenshots. The shared
shopping product page (`ProductDetailScreen` — fashion/furniture/beauty/…) should show
**main details** up front + a **"View details"** popup for the full spec set.

## Scope (presentation only — data already loads)
The page already fetches the full product (facets + description + variants) via
`/follower/products/:id`. Today it renders the facets as a long inline spec list +
description. Restructure that into:
- **Highlights** — the product's attributes (from `facets` + section + returns) shown as a
  compact **grid of spec tiles** (label + value cards, 3 per row), capped at ~9.
- **"View details ›"** — opens a bottom-sheet **popup** with **All details** (every
  attribute as tiles) + **About this product** (the description).

No backend/data change; `FACET_HIDE` keys still excluded.

## Out of scope
- The rest of the product page (image carousel, variant matrix, price, Add to cart) — unchanged.
- Full product-page toing reskin — later.

## Acceptance
- Main page shows a Highlights tile grid + "View details ›".
- "View details" opens a popup with all attributes + the description.
- Products with few attributes show fewer tiles (no "View details" if nothing extra).
- Mobile compiles; jest unchanged-green.
