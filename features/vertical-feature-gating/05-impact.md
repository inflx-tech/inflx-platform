# Impact — Vertical feature-gating

**Verdict:** Closes a cross-vertical feature leak. Restaurant behaviour
unchanged; other verticals lose access to features they were never meant
to have. Production-impacting (backend route behaviour + brand-web nav +
prod-served schema), non-destructive, no data/schema migration.

## Blast radius
- **Backend:** `requireBrandFeature` adds one indexed `SELECT category FROM
  brands WHERE user_id=$1` per gated request (Meals/Bookings only). Negligible.
- **brand.controller refactor:** `loadSchema` moved to a service, imported
  back — behaviour identical (same cache, same generic fallback, same
  cache-bust). Dead `fs`/`path` imports removed.
- **Schema:** `restaurant.json` gains `features.meals:true`. `public/schemas`
  is NOT a gov-governed path but IS served in prod (CDN/`/me/schema`) → ships
  on push; restaurant-only, additive.
- **Frontend:** nav filter only. No layout/style change to surviving items.

## Behaviour change (intended)
- Non-restaurant brands: Meals tab gone; brand-side `/meals/*` → 403.
- Non-booking verticals (fashion, jewellery, grocery, …): Bookings tab gone;
  `/brands/me/bookings*` → 403.
- car_rental keeps Bookings (booking=true) — it prebooks vehicles.

## Risks & mitigation
- **Fail-closed:** missing brand row → 404; missing schema → generic
  (features false) → 403. A real restaurant could only be blocked if its
  `category` were wrong in the DB — pre-existing data concern, not new code.
- **Direct URL to `/dashboard/meals`** on a non-restaurant brand still
  renders the page shell, but every data call 403s → empty/error state, no
  leak. Page-level redirect deferred (out of scope).
- **Other verticals not declaring `features.meals`** → treated false →
  correctly hidden/blocked. Intended.

## Verification
- `pnpm qa` green (regression net).
- Module-load smoke: all touched backend modules `require()` clean.
- Manual: restaurant sees Meals+Bookings; car_rental sees Bookings only,
  no Meals; fashion sees neither; direct `/meals/config` as car_rental → 403.
