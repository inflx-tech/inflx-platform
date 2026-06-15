# Workflow — Mobile taxonomy cleanup (Phase 2.5b)

## Build order
1. Registration value: `BrandRegisterScreen.js` + `login/page.js` `fashion_walkin` → `fashion`.
2. `CategoryListScreen.js`: `isDining` includes `food`.
3. `CategoryGrid.js`: `DEFAULT_CATEGORIES` → 5 launch tiles; `SUPERCAT_ACCENT` + new keys.

## Verify
- `cd Packages/brand-web && npm run build` → exit 0 (catches the web `login/page.js` JSX).
- `pnpm qa` → GREEN, gate 0 (no backend change; web auth flow unaffected).
- Mobile JS bundles cleanly (the OTA publish step bundles via Metro — fails loud on syntax).

## Deploy (production-impacting — explicit founder go)
- `git push origin main` → Vercel redeploys brand-web (signup dropdown). gov-check must pass.
- `pnpm publish-ota:all` → follower/brand/influencer OTA bundles (mobile changes).
- released stays false until founder verifies in prod.

## Expected end state
- New brands save `category='fashion'`. Food tile shows the dining layout. Offline
  fallback matches the 5 tiles. FindScreen unchanged (Phase 5). Zero backend/test change.
