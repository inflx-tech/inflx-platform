# offer-builder-categories-products — comprehensive categories + image product picker

## Founder (2026-07-08, live screenshot)
1. The offer-builder Category picker showed only ~5 categories (the ones the
   brand currently has products in) — not the full fashion category list. The
   fashion taxonomy has 19 categories; the picker must show ALL of them.
2. The product picker (for Products scope / bundle / free-gift / BOGO) should be
   seamless with a clear popup showing name + IMAGE + price.

## Root cause
- Categories came from `sections` = distinct `product.section` of existing
  products (sparse). Offers match `bp.section` which = the node's `category`.
- getProducts returned `brand_products.image_url` (usually NULL for fashion —
  images live in variants_json/facets), so the finder had no thumbnail.

## Fix
### Backend
- New `GET /brands/me/offer-categories` → distinct `category` of the brand's
  vertical taxonomy (all 19 for fashion), ordered. Comprehensive + matches
  bp.section.
- `listProducts` resolves a display image per product via `resolveProductImage`
  (image_url OR variant/facet images) so pickers get a real thumbnail.

### brand-web
- OffersLibrary fetches offer-categories and passes them as the category options
  (falls back to product-derived sections if the endpoint is absent).
- ProductFinder rows show a thumbnail + name + price; selected chips show
  name · price.

## Non-goals
- No change to offer matching (still bp.section), engine, or payload.

## Acceptance
Fashion brand: Category scope lists all 19 taxonomy categories (searchable).
Product pickers show image + name + price per row. `pnpm qa` GREEN; brand-web
builds.
