# Expected Outputs — Listing-driven discovery

- `sectionRules.service.js` exports rules `businesses_in_category`, `products_in_category`,
  `creators_in_category_listing` in the RULES registry; each is offer-independent (no
  `OFFER_FROM`/`liveOfferExists`).
- Migration 088 sets the Category shelves: `top_creators`→`creators_in_category_listing`;
  `popular_businesses`/`all_businesses`→`businesses_in_category`; `trending_items`→
  `products_in_category` + `enabled=true`. `best_deals` unchanged.
- `GET /follower/section/category/dining` returns (with NO offer): Chaitanya Food Court under
  Popular/All Businesses, its dishes under Trending Items, Sagar under Top Eat Creators.
- City is a soft boost — a Vijayawada brand shows to any follower (ranked higher in-city).
- `pnpm qa` GREEN; C1 GREEN.
- Release: production-impacting (Render backend + prod section_config UPDATE via run-088);
  founder go. No schema change.
