# Workflow — Section placement (Phase 3c)

## Build order (brand-web admin only)
1. `app/admin/sections/page.js`:
   - On load, also fetch `adminApi.listSectionLibrary()` → library sections (by business).
   - Add ADD_PRESETS entry **Library Section** (`rule='library_products'`,
     `shelf_type='products'`, `item_type='products'`).
   - In the row editor, when `rule==='library_products'`, render a **library-section
     dropdown** (grouped/labelled by business); on select → set
     `config_json.library_section_id` + set `title` to the section name (editable).
   - Publish via existing `saveSections` (already persists rule + config_json).

## Verify
- `cd Packages/brand-web && npm run build` → exit 0.
- `pnpm qa` → GREEN gate 0.
- Manual end-to-end: author "Jeans Under ₹499" (3b) → App Sections → Home → add **Library
  Section** → pick it → Publish → open follower Home → the shelf renders with gated jeans.
  Place same section on Creator Store → shows only that creator's allocated jeans.

## Deploy (production-impacting — explicit founder go)
- `git push origin main` → Vercel (admin). No backend redeploy needed for behavior; no OTA.
- released=false until founder verifies the follower render.

## Expected end state
- Admin can place a library section on any follower screen; it renders via the existing
  engine + mobile renderer; context stacks per surface. Phase 3 complete end-to-end.
