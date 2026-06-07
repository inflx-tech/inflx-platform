# Workflow — Restaurant edit surfaces (Wave 1 + Wave 2)

> Two waves. Wave 1 = backend-only quality-score fix (shipped first, no mockup).
> Wave 2 = brand-web UX + build-while-pending (needs mockup-lock).

## Wave 1 — Quality-score read fix (backend, DONE)
1. `GET /brands/me/quality-score` → `calculateQualityScore(brandId, category)`.
2. Scorer now SELECTs `b.listing_data` and merges it with typed identity columns
   (`business_name`,`city`,`category`) into one `profile` object.
3. Each rule resolves by scope:
   - `field` (brand) → `hasValue(profile[field])` (handles arrays = empty→false).
   - `type:photos` (brand) → `listing_data.photos[]` length ≥ min.
   - `items` → active product count ≥ min.
   - `scope:item_photos` + `min_pct` → (% products with own image_url) ≥ min_pct.
4. **Expected end state:** a restaurant with a filled profile + dishes scores > 0,
   matching what the owner actually completed (was always 0/100).

## Wave 2 — brand-web UX + build-while-pending (PENDING mockup-lock)
1. **Honest saves:** `lib/api.js` request() returns `{success:false}` on server error
   without throwing; `publishDriver.js` must inspect `res.ok/res.success` and only
   count a real save, collect real errors, and the Done screen must show failures
   instead of "You're live." (Fixes silent data loss platform-wide.)
2. **Build-while-pending:** drop `requireApproved` on `POST /me/products` (+ bulk-upload)
   so a pending brand can complete its listing; ADD a follower-visibility guard so an
   unapproved brand's store/products are not shown to followers until approved
   (auto-go-live on approval). Verify `resolveBusinessStore`/`resolveCategoryStore`/
   section brand rules exclude unapproved brands.
3. **Two surfaces:** returning restaurant (reliable "profile complete" signal) lands on
   a dashboard with **Manage Menu** (dish list + add-dish menu-picker only) and
   **Edit Profile** (sectioned editor). First-time = full wizard unchanged.
4. **Dish defaults:** stop pre-filling `image_url` from master `default_image_url`
   (blank + placeholder); explicit per-dish capture of owner price + owner photo.
5. **Location:** geocoding short-link (`maps.app.goo.gl`) expansion + manual locality.

## Verification
- Wave 1: `pnpm qa` GREEN (regression) + founder dogfood (re-list → score reflects).
- Wave 2: `pnpm qa` GREEN + mockup-lock + `06-diff/notes.md` + founder manual verify on
  the live app; brand-web (Vercel) + backend (Render) deploys surfaced for explicit go.
