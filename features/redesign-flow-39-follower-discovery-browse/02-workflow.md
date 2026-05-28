# Flow 39 (F1) — Workflow

**Actor**: Follower (public, may be anonymous).

## A · FindScreen
- Renders 7 super-categories with sub-category chips + live deal counts
  (`getCategories()`).
- Tap super-category or sub → `CategoryList` with `{ superCategory, subCategory?,
  label, icon }`. Search field → (future) search.
- Restyle: light bg · ink-bordered search · Outfit-Black title + category labels ·
  yellowPale deal-count badges (mono) · white category cards.

## B · CategoryListScreen
- `getCategoryStores(superCategory, { sub_category })` → stores list.
- **Mental-model split preserved verbatim**:
  - DINING (restaurant/bakery) → dining cards → BrandStore
  - SHOPPING (fashion/florist/packaged_food) → 2-col ProductCard grid → ProductDetail
  - BOOKING (salon/car_rental/…) → grid → CarDetail / ProductDetail
- Restyle: light bg · white dining/store cards · per-business `.pale` hero tints
  via getBusinessAccentLight · `.accent` saturated badge with white text · sort
  filter chips · ProductCard (light, F0) for grids.
- Tracking (`buildTrackingFromOffer`) forwarded on every tap — preserved.

## C · DealsScreen
- `getDeals(tab, page)` → deal list rendered as ProductCard grid.
- Tab filter (deals categories). Restyle: light bg · ink-border + yellowPale
  active filter tab + ink text · yellow refresh/spinner · ProductCard grid.

## Success state
Follower browses categories + deals on a fully-coherent light creator-vibe
surface; all routing + tracking unchanged.
