# 04 — Workflow prediction · 3C-1 Discovery

Predicted runtime behaviour the mockup represents (to compare against the
real build in 06-diff):

1. **Food home loads** → `getDishGroups()` resolves → rail shows N tiles
   under "What are you craving?". If `groups` empty, rail + header absent;
   nearby list unaffected. While the promise is pending, tiles are skeletons.
2. **Tap tile "Biryani"** → navigate `DishGroupResult` →
   `getDishGroupRestaurants(id, {lat,lng})` → header "Biryani · N places near
   you serving it" + cards.
3. **Card content** maps 1:1 to payload: `avg_rating`→green ★ pill (hidden if
   null), `review_count`→"(212)", `distance_km`→"1.2 km" (hidden if null),
   `delivery_eta_min/max_mins`→"20–25 min" (hidden if both null),
   `free_delivery`→"FREE DELIVERY" badge, `varieties[1:4]`→chips with +N
   overflow, `from_price`→"from ₹X".
4. **"View menu →"** → `BrandStore` route with `brandId = brand_id`; restaurant
   storefront renders as it does today (unstyled-for-3C-2).
5. **Zero restaurants** → empty state card; **no location** → cards omit
   distance, order falls back to popularity.

Expected zero functional disturbance to existing food home: the rail is
additive; restaurant cards, section engine, sub-cat bar, tracking and nav are
untouched.
