# Before/after — offer-builder-categories-products

## Before
- Category picker: only the ~5 categories the brand had products in (derived
  from `product.section`). Founder's fashion brand should see all 19.
- Product finder: name + price only, no image (getProducts image_url was NULL
  for fashion — images live in variants/facets).

## After
- **Backend**: `GET /brands/me/offer-categories` returns the full vertical
  taxonomy's distinct categories (fashion → 19), which equal `bp.section` so
  offers still match. `listProducts` resolves a display image per product
  (image_url OR variant/facet images).
- **brand-web**: OffersLibrary sources the Category picker from the new endpoint
  (fallback to product sections). ProductFinder rows show thumbnail + name +
  price; selected chips show "name · ₹price".

## Verification
- Dev DB: fashion taxonomy has 19 distinct categories (Accessories … Western
  Wear); endpoint returns them.
- brand-web `next build` ✓; `pnpm qa` GREEN (79). Offer matching unchanged.
- After-capture owed on the founder walkthrough of the New-offer modal.

## Deploy
Render (backend) + Vercel (brand-web) on push. No mobile, no OTA.
