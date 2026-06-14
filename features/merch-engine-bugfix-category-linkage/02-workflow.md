# 02-workflow

## Change set
1. `backend/src/services/sectionEngine.service.js`
   - Add `loadCategoryMembers()` → `{ key: member_categories[] }` from
     `follower_categories` (empty/failed → `{}`).
   - Add it to the `Promise.all` in `buildSections`.
   - Per shelf, set `ctx.categoryCats = catMembers[rowCategoryKey] || null`.
2. `backend/src/services/sectionRules.service.js`
   - `categoryFilter` signature `(categoryKey)` → `(ctx)`; prefer
     `ctx.categoryCats`, fall back to `CATEGORY_MAP[ctx.categoryKey]`.
   - Update all ~12 call sites to pass `ctx`.

## Expected end state
- Follower opens "Shop"/"Fashion" → only businesses whose `category` is in that
  tile's `member_categories` (restaurants excluded).
- Admin edits a tile's "Member businesses" → section-engine screen reflects it
  (cache cleared on admin write already).
- Legacy/global shelves with their own `category_key` (e.g. `dining`) unchanged
  via fallback. `groom/travel/events` unchanged.

## Verify
- `node --check` both files.
- `pnpm qa` → 79 GREEN, gate 0.
- Inline proof of `categoryFilter` resolution (db-members win; fallback intact).
- Post-deploy prod read: open Shop category, confirm no restaurants.
