# Flow 46 — Workflow prediction (pre-implementation)

## DiningHome
1. Open the "eat" super-category → DiningHome: location pill + "What's on tonight?"
   greeting, yellow avatar, bg2 search bar.
2. Tap a **vibe tile** (date-night accented yellow50) → DiningBrowse pre-filtered to
   that vibe (`initialVibe`).
3. "Creators eating now" strip + "Nearby" converged RestaurantCards; tapping a card
   → BrandStore with 4-ID tracking from `offers[0]`.

## DiningBrowse
1. App bar (← Browse ⇅). Type in the bg2 search to filter client-side.
2. Tap **Filters** (ink button + yellow count badge) → FilterSheet; quick chips
   (Veg/Open/Offers) toggle inline; vibe chips show ✕ to remove.
3. Sort dropdown reveals inline; mono "N RESULTS · locality" + yellowText Map view.
4. Converged RestaurantCard list; tap → BrandStore (tracking preserved).

## DiningSearch
1. Autofocus search box, rotating "Search for 'Biryani'…" placeholder.
2. Type ≥2 chars → 300ms debounce → `followerApi.search` → RESTAURANTS + DISHES
   sections. Veg-only toggle (successPale) re-queries.
3. Tap a brand/dish row → BrandStore.

## No behavioural change
Every tap target, data call, tracking field, filter/sort path, debounce, and render
branch is identical to today — only colors/fonts/spacing shift to brandPalette.
