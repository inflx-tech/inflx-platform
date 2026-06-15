# Expected outputs — Mobile taxonomy cleanup (Phase 2.5b)

## Automated
1. `cd Packages/brand-web && npm run build` → exit 0.
2. `pnpm qa` → GREEN, gate 0, zero regression (same suite count).
3. OTA bundle builds without error (Metro) for the published apps.

## Behavioural (verify after OTA + Vercel)
4. **Brand signup** (mobile + web): pick "Fashion & Apparel" → the brand is created with
   `category = 'fashion'` (check via admin/brand list or DB) — not `fashion_walkin`.
5. **Food tile** (follower app): tap **Food** → renders the **restaurant/dining layout**
   (same as tapping it via the old Eat path), showing restaurants — not the product-grid layout.
6. **Offline fallback**: with the categories API stubbed/unreachable, the Home grid shows
   the 5 launch tiles (Fashion/Furniture/Food/Beauty/Car Rentals), not the old 7.
7. **No regression**: Fashion/Furniture/Beauty/Car Rentals tiles still open correctly;
   creator/brand stores unaffected.

## Non-goals (NOT expected here)
- FindScreen visual change (deferred to Phase 5).
- Emoji fallback maps updated (deferred to 2.5c).
- Legacy screens / schema stubs removed (2.5c).
