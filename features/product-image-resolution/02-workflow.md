# Workflow — product image resolution

## W1 — listing browse shows an image that only edit showed before
1. A product has images in variants_json.colors[].images but image_url is null.
2. GET the brand's listing browse (getNodeProducts) → each product's image_url
   is resolved from the variant images → thumbnail renders (was blank).
3. No re-save required.

## W2 — follower shows the product image
1. Same product, pushed to store.
2. Follower feed (sectionRules productsInCategory / library_products) →
   mapListedProductItem resolves image_url from variant/facet images →
   the product card shows the photo (was blank).

## W3 — create derives the cover
1. POST /brands/me/products with variants but no image_url.
2. image_url is derived from the first variant image at insert → all surfaces
   show it immediately, no edit round-trip.

## W4 — no regression when image_url already set
Products with image_url set resolve to exactly that value (explicit wins);
image-less products resolve to null (honest blank / placeholder as today).

## W5 — backfill
Dry-run reports fixable vs image-less counts; --commit sets image_url from
variant/facet images only for null rows, never overwrites, idempotent.
