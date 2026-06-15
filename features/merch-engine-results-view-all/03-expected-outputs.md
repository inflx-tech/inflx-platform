# Expected outputs — Results page + universal "View all"

## Automated
1. `node --check` backend (controller/routes) + engine require smoke.
2. `pnpm qa` → GREEN gate 0, zero regression.
3. Mobile bundle builds (OTA).
4. Real-prod read-only: `GET /follower/section-results?rule=products_in_category&category_key=fashion`
   returns items (no 500); `rule=library_products&library_section_id=<id>` returns that section's
   full list.

## Behavioural (follower, after deploy)
5. Each product/offer/brand/creator shelf shows a **"See all →"** (and the title is tappable).
6. Tapping it opens the **Results screen**: product shelves → **2-column grid** of the full set
   (≤100); offers/brands/creators → vertical list. Header = the shelf title; back works.
7. **Context preserved**: "View all" from a creator's store shows only that creator's matching
   items; from a category screen, only that category; from Home, platform-wide.
8. Empty rule → friendly empty state (no crash). Cap hit (100) → a subtle "showing first 100" note.

## Non-goals (NOT here)
- Infinite scroll / offset pagination (fast-follow). View-all on nav/controls/collection-header.
- Banner-gateway / hero-tiles (Phase 6 — reuse this screen). Migration.
