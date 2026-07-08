# Expected outputs — offer-builder-categories-products

1. `GET /brands/me/offer-categories` returns `{ categories: [...all vertical
   categories...], vertical }`; fashion → 19.
2. `listProducts` products carry a resolved `image_url` (variant/facet fallback).
3. OffersLibrary uses offer-categories for the Category picker (fallback to
   product sections).
4. ProductFinder rows render thumbnail + name + price; chips show name · price.
5. `pnpm qa` GREEN; backend boots; brand-web builds. Offer matching unchanged.
