# Workflow — Categories: one brain (Phase 2.5a)

> The ordered steps the implementation executes, and the end state proven by `pnpm qa`.

## Build order (backend, lowest-risk first)

1. **Add `taxonomy.service.js`** (pure read layer over `follower_categories` + alias map).
   - Unit-testable in isolation; no callers changed yet. `node --check` green.

2. **Migration `102_categories_one_brain.sql`** (+ `scripts/run-102.js`).
   - Data merge: `brands.category` fashion_walkin/online → `fashion`.
   - Upsert 5 launch tiles; hide the other 7.
   - Reconcile `section_config.category_key`: `dining`→`food`, `shopping`→`fashion`.
   - Idempotent (`ON CONFLICT (key) DO UPDATE`; updates are re-runnable).

3. **Repoint the readers to `taxonomy.service`** (one file at a time, qa after each):
   - `sectionRules.service.js` — `categoryFilter(ctx)` resolves members via
     `taxonomy.membersFor(ctx.categoryKey)`; the local `CATEGORY_MAP` is removed
     (or demoted to the service's internal DB-unreachable fallback only).
   - `sectionEngine.service.js` — `loadCategoryMembers` + `CATEGORY_LABELS` read tile
     label/members from `taxonomy.service` (so `{category}` interpolation uses the real
     tile label, and ctx.categoryCats comes from the one source).
   - `follower.service.js` — `getDealsByCategory` uses `taxonomy.membersFor(category)`
     (deletes the duplicate, smaller `CATEGORY_MAP`); `resolveCategoryStore` verified
     to use the same.
   - `listing.service.js` — `getSuperCategories` delegates to / stays consistent with
     `taxonomy.service` (single read path; keep its hardcoded constant only as the
     shared fallback).

4. **Update tests honestly** (`backend/tests/listing-engine.test.js`):
   - Expectations that asserted `fashion_walkin` as an active category → assert
     `fashion` (the merged truth). The alias-normalisation tests in
     `pricing-service.test.js` STAY (they prove the alias still works). No `.skip`, no
     deletion of coverage — assertions move to the new correct values.

5. **Run `pnpm qa`** → expect GREEN, gate 0, zero regression.
6. **Run `pnpm qa:db`** → confirm migrations apply N/N incl. 102, no MIGRATION FAILED.
   (The pre-existing tier-cascade DB-lane failures remain informational, not the gate.)

## Deploy (production-impacting — explicit founder go required)
Order = migrate prod FIRST, then push code.
1. Apply `102` to prod via the `.env.prod-backup` inline-node pattern; verify:
   `SELECT category, count(*) FROM brands GROUP BY 1` shows no fashion_walkin/online;
   `SELECT key,label,status FROM follower_categories` shows the 5 active + 7 hidden.
2. Stage ONLY this contract's files **by path** (shared working tree — never `git add -A`),
   including `lock.json`.
3. Commit (Co-Authored-By trailer) → `git push origin main` → Render auto-deploys backend.
   No Vercel runtime change (no web files), no OTA (no mobile files).

## Expected end state
- `follower_categories` = 5 active tiles, single-type members; brands carry `fashion`.
- Every backend category filter reads `taxonomy.service` → one source.
- **Acceptance:** editing a tile's members in admin changes the category screen, the
  deals tab, search, and home shelves **identically** — provable by the test in
  `03-expected-outputs.md`.
