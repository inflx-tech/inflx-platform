# Impact Analysis — Restaurant dish search + custom-name flywheel

> Terse verdict for chat; full mechanics here (per impact-terse rule).

## Verdict
**Additive-only. Zero disturbance to existing restaurant listings.** The search box *augments* (does not replace) the browse picker; new tables/extensions/columns only (no drops, no type changes); the existing admin Master Dishes CRUD is untouched and stays complementary.

## Lock decisions (resolved open questions)
1. `PROMOTE_THRESHOLD = 5`, v1 **flags only** (no silent write to `master_dishes`).
2. Seller search box **sits above** the browse grid; browse preserved.
3. Admin queue = **tab inside the existing Master Dishes admin area** (`/admin/master-dishes`), reuses nav + `createMasterDish`.
4. Suggestion shown only at trigram similarity **≥ 0.30**; below → custom-only.

## Data / schema impact (migration 087, additive)
- `CREATE EXTENSION pg_trgm, unaccent` — DB-global, additive, no data change.
- `master_dishes += popularity_rank int default 0` — new nullable-safe column; existing 129 rows default 0.
- New `dish_aliases` (regional/typo → canonical) + GIN trigram index.
- New `pending_dishes` (custom-name queue) + status/norm indexes + unique-per-brand_product.
- No changes to `brand_products` shape (already has `name` + `master_dish_id`).

## API impact
- NEW `GET /brands/me/dishes/search?q=` (brand) — must be registered **above** the admin `/:id` catch-all in `brand.routes.js` (lines ~137) to avoid shadowing.
- `POST /brands/me/products` — additive branch: when `master_dish_id` null + restaurant, also upsert a `pending_dishes` row. Existing callers unaffected.
- NEW `GET/PATCH /admin/master-dishes/queue[...]` (reviewer+) — alias / promote / reject; promote reuses `createMasterDish`.
- Envelope, money (rupees), attribution: unchanged.

## UI impact
- brand-web `RestaurantDishPicker.js`: add search box + custom option + "pending review" chip. Browse path unchanged. Other verticals untouched.
- admin-web `master-dishes/`: add a "Review Queue" tab beside the existing CRUD table. Existing CRUD untouched.

## Blast radius
- **Production-impacting:** YES — Render backend + migration 087 (additive) + Vercel brand-web & admin-web. **Surfaced for explicit go; not auto-applied.**
- **Rollback:** additive migration is inert if web is reverted (tables simply unused); no destructive step to undo.
- **Affected users:** restaurant brands (34 live) + admins. Non-restaurant verticals: zero change. Existing 129-dish dictionary + activations: preserved.

## Regression surface
- `pnpm qa` (web + backend) must stay green; new specs added (Step 7). `qa:db` lane asserts extensions + new tables. Existing master-dish CRUD tests must remain green (shared `createMasterDish`).
