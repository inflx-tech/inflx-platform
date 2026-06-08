# Workflow — follower-category-rebuild

> Step 3. The follower flow Category must execute to its expected end state.

## Follower flow (Category screen, e.g. Eat)
1. From Home, tap **Eat** → CategoryList(superCategory:'dining').
2. **Header:** back · "🍽️ Eat" + "📍 Vijayawada · N places" · search icon.
3. **Sticky sub-category bar:** "All" (active) + the real sub-types present in the
   payload (e.g. Restaurants, Bakery for dining — derived from the brand shelves'
   distinct `brand.category`). Tap a chip → the brand shelves + All list filter to
   that sub-type (client-side); "All" clears the filter.
4. **Shelves** (section engine via the vibe kit):
   - Top {Cat} Creators → gradient-ring creator circles (now with follower counts).
   - Popular Businesses → brand-card rail.
   - Trending Items → product-card rail.
   - Best {Cat} Deals → deal-card rail (empty until Phase 3 → renders nothing).
   - Filter / Sort bar → display chips (Offers · Nearest · Top Rated).
   - **All Businesses → full-width list** of brand list-rows (thumb + name +
     cuisine/category + city); tap → BrandStore.
5. Engine error/empty → legacy stores layout (unchanged), with the new header.

## Build workflow
1. Add `vibe/ShelfBrandListRow`; export it; render `brands`+`main_list` as a list
   in `SectionRenderer`; add the optional follower line to `StoryCircle`.
2. Rebuild `CategoryListScreen`: header + sticky sub-bar (real sub-types) +
   client-side sub-cat filtering + suppress the empty `subcat_chips` shelf + pass
   the (filtered) sections to `SectionRenderer`.
3. Babel-transform touched files.
4. `pnpm qa` GREEN.
5. `06-diff/notes.md` vs `category-comprehensive.html`; honest divergences.
6. Surface the production-impacting OTA for explicit founder go.

## End state
Category renders as the mockup (compact header, sticky real sub-cat chips,
vibe-card shelves, full-width All-Businesses list), sub-cat chips functional,
4-ID intact. `pnpm qa` GREEN.
