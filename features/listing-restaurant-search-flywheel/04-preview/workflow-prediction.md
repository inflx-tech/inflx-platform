# Workflow prediction — Restaurant dish search + custom-name flywheel

## Trigger
- Seller (approved restaurant) on brand-web listing wizard, "Add your menu" → Add individually, types a dish name.
- Admin opening `/admin/dish-queue`.
- Background evaluation of accumulated custom names (job or on-resolve).

## Steps
1. Seller types a dish name → `GET /brands/me/dishes/search?q=` returns fuzzy `matches[]` (trigram + unaccent, ranked by similarity then `popularity_rank`) plus `allow_custom:true`.
2. Seller either (a) picks a suggestion → listing links `master_dish_id` (canonical), or (b) picks "Add '<typed>' as your own" → listing keeps the **verbatim display name**, `master_dish_id:null`.
3. On custom add, `POST /brands/me/products` creates a live `brand_products` row AND inserts a `pending_dishes` row (status `pending`). The dish is **never blocked** from going live.
4. Admin reviews `/admin/dish-queue`: each pending name shows a suggested canonical match + how many restaurants used it. Admin resolves: **alias** (write `dish_aliases`, link listings), **promote** (new `master_dishes` row), or **reject** (stays a one-off).
5. Flywheel: when ≥ `PROMOTE_THRESHOLD` (default 5) independent restaurants share a normalized custom name with no confident match, it's flagged top-of-queue as an auto-promote candidate.

## End state
- Seller's exact wording preserved on every listing; search resolves typos/regional names to canonical where confident.
- `pending_dishes` captures every unmatched custom name; admin actions grow `dish_aliases` / `master_dishes`; the dictionary improves from real usage.

## Edge cases
- Unauthenticated / unapproved seller → `POST /products` 403; no listing, no queue row.
- No fuzzy match → only custom-add offered; still goes live.
- `pg_trgm`/`unaccent` missing → search degrades to `ILIKE` (no crash); migration installs both in prod.
- Duplicate custom name by same brand → dedupe (no second `pending_dishes` row for the same brand_product).
- Admin rejects → listings keep custom names; name never auto-promoted.

## What changes vs current behaviour
- **Today:** `RestaurantDishPicker` is **browse-only** (cuisine→section grid via `GET /brands/me/master-catalogue`); matching at bulk-upload is exact `LOWER()=LOWER()` (`excel.service.js findMasterMatch`); custom dishes are stored unlinked and never feed back; no admin dish queue; no fuzzy search; `pg_trgm` not installed in prod.
- **After:** a typeahead search box augments the browse; fuzzy match + verbatim custom capture; `pending_dishes` queue + admin resolve; `dish_aliases`; `master_dishes.popularity_rank`; the flywheel.
- **Files touched (preview):** backend — new migration (`087_dish_search_flywheel.sql`: enable `pg_trgm`+`unaccent`, `pending_dishes`, `dish_aliases`, `master_dishes.popularity_rank`), `brand.controller.js` (new `searchDishes`, custom-dish branch in `createProduct`), `brand.routes.js` (new `GET /me/dishes/search` above the admin `/:id` catch-all), `adminMasterDish.controller.js` + new `dishQueue.controller.js` + admin route, a promotion helper. brand-web — `RestaurantDishPicker.js` (search box + custom option), a small "pending review" chip. admin-web — new `/admin/dish-queue` page.

## Blast radius
- **Production-impacting:** YES — Render backend + a DB migration (additive: new tables/columns/extensions, no drops) + Vercel admin/brand web. Surfaced for explicit go.
- **Rollback:** additive migration; feature reachable only via the new search box + admin page — revert web + leave tables in place (inert) if needed.
- **Affected users:** restaurant brands (34 live) + admins. Other verticals untouched. Existing browse path preserved.

## Open questions (clear before lock)
1. `PROMOTE_THRESHOLD` value (default 5) and whether v1 auto-promotes or only flags for admin (recommended: **flag only** in v1).
2. Where the search box lives — replace the browse grid, or sit above it (recommended: **above it**, browse stays).
3. Admin queue home: standalone `/admin/dish-queue` vs a tab inside the existing master-dish admin (recommended: **tab** to reuse `adminMasterDish` nav).
4. Confidence cutoff for showing a suggestion vs custom-only (e.g. similarity ≥ 0.3).
