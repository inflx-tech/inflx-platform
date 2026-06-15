# Workflow prediction — Results page + universal View-all

Mockup: `04-preview/mockups/results-view-all.html`.

Asserting for sign-off:
- Every list-bearing shelf (products / offers / brands / creators) gains a **"See all →"**
  (the title is also tappable). nav-tiles / controls / collection-header don't.
- Tapping it opens ONE shared **Results screen**: products → **2-column grid** of the full set
  (≤100 in v1); offers/brands/creators → vertical list (existing cards). Header = shelf title.
- **Context carries**: the Results screen re-runs the shelf's rule with the SAME surface context
  (creator/category/brand/city) → a creator-store "See all" shows only that creator's matches.
- This same screen is the Phase-6 banner-gateway + hero-tile target (build once, reuse).
- v1 = capped list (no infinite scroll yet); palette indicative (gold/cream = Phase 5).

Backend: a generic `GET /follower/section-results` re-runs `runRule(rule, ctx)` with a bigger
limit; ctx built from the shelf's rule+config + the host context. No new ranking, no migration.
