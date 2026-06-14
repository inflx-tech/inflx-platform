# Impact Analysis — Follower Category admin

> Step 6. Generated with implementation. Reviewed against the lock.

## Affected files (read or change)
- **backend:**
  - `migrations/100_follower_categories.sql` — **NEW**. `follower_categories` table + seed of the 7 current tiles.
  - `scripts/run-100.js` — **NEW**. runner (run-099 precedent).
  - `src/services/listing.service.js` — **CHANGED**. `getSuperCategories()` → **async** DB read (active, by sort_order) mapped to `{key,label,icon,sub_categories}`, **falling back to the `SUPER_CATEGORIES` constant** on empty/error.
  - `src/controllers/follower.controller.js` — **CHANGED**. 3 call sites `await getSuperCategories()` (lines ~740, ~790, ~1092).
  - `src/controllers/adminFollowerCategories.controller.js` — **NEW**. list/create/update/delete(soft-hide).
  - `src/routes/admin.routes.js` — **CHANGED**. mount `/admin/follower-categories` (`requireAnyAdminRole`).
- **web:**
  - `app/admin/follower-categories/page.js` — **NEW** (navy admin theme).
  - `app/admin/layout.js` — **CHANGED**. nav entry under CONTENT.
  - `lib/api.js` — **CHANGED**. `adminApi.{list,create,update,delete}FollowerCategory`.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET/POST/PATCH/DELETE | /v1/admin/follower-categories | NEW | admin-web |
| GET | /v1/follower/categories | CHANGED (DB-driven; output identical post-seed) | follower app |
| GET | /v1/category/:super_category/stores | CHANGED (await) | follower app |
| GET | (follower search by super) | CHANGED (await) | follower app |

## Affected workflows (regression surface)
- The **3 follower category-browse endpoints**. **Seed parity** must hold (pre-edit payload == legacy). Fallback covers empty/error. `getSuperCategories` was **sync → async**; all **3** callers updated to `await` (the only callers — verified by grep). `getSubCategories` has **no backend caller** → left as-is.
- No change to brand registration/schema/listing/allocation/store (those read `brand.category` + schema files, not these tiles — verified).

## Migration / deploy / OTA impact
- Migration **100** — production-impacting (additive table + seed). **Idempotent** (`ON CONFLICT (key) DO NOTHING`). Auto-applied to test/dev by `dev-db-init`; prod via `run-100.js`. Seed = behaviour-identical on deploy.
- Backend + web → `git push`. **No mobile / OTA.**

## Risk notes
- `getSuperCategories` made async — a missed caller would `undefined.find()` crash. All 3 callers updated; grep-verified there are no others.
- Live follower endpoint → **seed parity** asserted in QA; **fallback** to constant guarantees no empty category screen.
- Hiding a tile is reversible (status); member businesses + brand data untouched.
