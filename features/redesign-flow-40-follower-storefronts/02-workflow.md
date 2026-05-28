# Flow 40 (F1) — Workflow

**Actor**: Follower (public).

## A · BrandStoreScreen (brand shop)
- `getBrandStore(brandId, viaInfluencerId)` → brand + offers + products.
- For restaurant-category brands, renders `RestaurantDetailScreen` INLINE
  (component import, not navigation) — preserved verbatim.
- Renders: banner (accent.pale tint) + logo (accent.accent, white initial) +
  name + verified badge + open/closed pill + trust chips + creator-trust
  cluster/chip + "brought to you by [creator]" creator bar (accent.accent bg,
  white text) + offer banner (accent.pale) + tabs + creator-picks strip +
  product grid (light ProductCard) + influencer card + sticky CTA
  (accent.accent bg, white text).
- Restyle: darkColors → brandPalette chrome (white cards, ink text, light bg);
  getBusinessAccent → getBusinessAccentLight; accent.dim → accent.pale; #fff
  text retained on saturated accent surfaces.
- Tracking: Path-B propagation on all CTAs preserved verbatim.

## B · InfluencerStoreScreen (creator's curated store)
- `getStore(handle)` + `getStoreProducts(handle, {offerId, ciId})`.
- Renders: creator hero (Outfit-Black name + mono handle) + follow button +
  creator picks (accent.pale icon tiles) + offer/product cards + per-offer
  creator notes.
- Restyle: lightColors → brandPalette migration (yellow #EAB308 → #FFC107,
  paper → white, yellow100 → yellowPale, etc.); getBusinessAccent →
  getBusinessAccentLight.
- follow/unfollow + saveOffer/unsaveOffer + tracking preserved verbatim.

## Success state
Both storefronts present a unified light creator-vibe shop; creator
attribution prominent; all routing/tracking/follow flows unchanged.
