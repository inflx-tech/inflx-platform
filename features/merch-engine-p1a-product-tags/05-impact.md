# Impact Analysis — Product Tags + admin tag-vocabulary

> Step 6. Generated before/with implementation. Reviewed against the lock.

## Affected files (read or change)
- **backend (changed/new):**
  - `migrations/099_product_tags.sql` — **NEW**. `brand_products.tags text[]` (+GIN); `tag_vocabulary` table.
  - `src/services/tags.service.js` — **NEW**. `slugify`, `sanitizeProductTags`, `listTagOptions`.
  - `src/controllers/adminTagVocabulary.controller.js` — **NEW**. vocab list/create/update/delete(soft-hide).
  - `src/controllers/brand.controller.js` — **CHANGED**. import tagsService; `listProducts` SELECT `+tags`; `createProduct` destructure + INSERT `tags` ($19); `updateProduct` `tags` handling; new `getTagOptions`; export.
  - `src/routes/admin.routes.js` — **CHANGED**. mount `/admin/tag-vocabulary` (GET/POST/PATCH/DELETE), `requireAnyAdminRole`.
  - `src/routes/brand.routes.js` — **CHANGED**. `GET /me/tag-options`.
- **web (IMPLEMENTED):**
  - `app/admin/tag-vocabulary/page.js` — **NEW**. Admin Tag-Vocabulary CRUD (scope chips, add, edit/hide, modal) — **navy admin theme** (consistent with the rest of /admin; gold/cream is the follower-app standard).
  - `app/admin/layout.js` — **CHANGED**. Nav entry "Tag Vocabulary" under CONTENT.
  - `app/dashboard/products/page.js` — **CHANGED**. New `ProductTagPicker` inside `ProductFormModal` (fixed chips from `/me/tag-options` + free-tag input) → `form.tags` → create/update.
  - `lib/api.js` — **CHANGED**. `adminApi.{listTagVocabulary,createTagVocab,updateTagVocab,deleteTagVocab}` + `brandApi.getTagOptions`.
  - **Coverage caveat:** the brand tag-picker rides the **standard `ProductFormModal`** flow. The schema-driven **ListingWizard** (`storage_format`/`DynamicField`) and the **drilldown tree wizard** (fashion/furniture → `/dashboard/products/listing`) are separate authoring flows that need their own tag-field wiring — **follow-up slice**.
- **mobile:** none (listing is brand-web).
- **verification gap:** brand-web has no local ESLint/Babel parser available in this env; JSX not machine-checked here. Build + Playwright `qa:web` to run in the dev env. Backend verified (see below).

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /v1/admin/tag-vocabulary | NEW | admin-web |
| POST | /v1/admin/tag-vocabulary | NEW | admin-web |
| PATCH | /v1/admin/tag-vocabulary/:id | NEW | admin-web |
| DELETE | /v1/admin/tag-vocabulary/:id | NEW (soft-hide) | admin-web |
| GET | /v1/brands/me/tag-options | NEW | brand-web listing |
| POST | /v1/brands/me/products | CHANGED (+tags) | brand-web listing |
| PATCH | /v1/brands/me/products/:pid | CHANGED (+tags) | brand-web listing |
| GET | /v1/brands/me/products | CHANGED (+tags in response) | brand-web |

## Affected workflows (regression surface)
- Brand product **create / update / list** — existing listing flows must stay green; `tags` is additive + optional (default `'{}'`).
- No change to offers, campaigns, transactions, attribution, money, quota.

## Migration / deploy / OTA impact
- New migration **099** — production-impacting (Render/Supabase). Auto-applied to test/dev DB by `dev-db-init` (dynamic `readdir` of `migrations/*.sql`); applied to prod via the per-migration `run-NNN.js` mechanism. **Additive + idempotent** (`IF NOT EXISTS`), **zero backfill**.
- Backend + web only → `git push` (Render backend + Vercel brand-web). **No mobile / OTA.**

## Risk notes
- `ADD COLUMN tags ... DEFAULT '{}'` is a constant default → metadata-only, no table rewrite/lock on existing rows (PG 11+). GIN build over ~52 prod rows is trivial.
- No auth / money / attribution change. Vocabulary edits reversible (soft-hide).
- Tags are a **snapshot** on the product (not an FK) → hiding/deleting a vocab tag never mutates products.
- `tags` is `text[]` (not JSON) — `updateProduct` handles it outside the JSON-stringify branch; sanitized to slugs before write.
