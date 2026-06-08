# Workflow — follower-home-rebuild

> Step 3. The follower-facing flow Home must execute to its expected end state.

## Follower flow (Home tab)
1. Follower opens Home →
   - **Header:** location block "📍 DISCOVER IN · Vijayawada ▾" (left); bell icon +
     round **profile avatar** showing the user's initial (right). Tap avatar →
     Profile tab. (Bell = icon button, parity with today; no fabricated count.)
   - **Greeting:** serif "Hey, what's good today?" + tagline "Shop · Support · Stay
     Inspired".
   - **Search:** rounded bar "Search creators, products, stores…" + a brown filter
     button; tap → Find.
2. Below the chrome, the section engine renders shelves top-to-bottom via
   `SectionRenderer` + the `components/vibe` kit:
   - **Stories** (creators) → gradient-ring `StoryRail`; tap a story → InfluencerStore;
     "More" → Find.
   - **Browse by Category** (nav_tiles) → round `CategoryRail`; tap **Eat** →
     `CategoryList{superCategory:'dining'}` (NOT DiningHome); other tiles →
     `CategoryList{superCategory:key}`; "all" → Find.
   - **Top Eats** (brands) → `ShelfHeader`(BRANDS) + `ShelfBrandCard` rail; tap →
     BrandStore (tracking passed).
   - **Trending Dishes** (products) → `ShelfHeader`(PRODUCTS) + `ShelfProductCard`
     rail; tap → ProductDetail (product + brand + tracking).
   - **Offer shelves** (What's Hot / Best Deals / Ending Soon / …) → `DealCard` rail
     (What's-Hot shelf → `FeatureCard` rail); currently empty → render nothing.
3. Pull-to-refresh re-fetches. On engine error/empty → the existing hardcoded
   fallback feed (also Eat-re-pointed) — never a blank Home.

## Build workflow
1. Rewrite `SectionRenderer` to the vibe kit (preserve nav targets, `hasEngineContent`,
   controls/hero/grid; re-point Eat).
2. Rebuild the `HomeScreenV2` header/greeting/search; read `inflx_user` for the
   avatar initial; fix the fallback Eat route.
3. Babel-transform the touched files (`module:@react-native/babel-preset`).
4. `pnpm qa` GREEN (web unaffected = zero regression).
5. `06-diff/notes.md` — side-by-side vs `home-comprehensive.html`; honest divergences.
6. Surface the production-impacting OTA (`pnpm publish-ota:follower`) for explicit
   founder go; flip `released:true` only after go (+ Maestro attest or recorded
   override).

## End state
Home renders as the mockup (round stories, round categories, gradient cards, serif
headers, header with avatar + greeting + search-filter), driven by the live engine,
4-ID intact, Eat → agreed Category. `pnpm qa` GREEN.
