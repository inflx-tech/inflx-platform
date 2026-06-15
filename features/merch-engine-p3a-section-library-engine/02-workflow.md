# Workflow — Section Library engine (Phase 3a)

## Build order (backend, lowest-risk first)
1. **Migration `103_section_library.sql`** (+ `scripts/run-103.js`) — create `section_library`
   table + indexes. Idempotent. (Optionally one clearly-marked example row for our test.)
2. **`sectionLibrary.service.js`** — CRUD + `resolveRuleSql(ruleJson, ctx)` (pure-ish SQL
   fragment builder) + validation. Unit-testable in isolation.
3. **`library_products` rule** in `sectionRules.service.js` — generalize the existing
   `productsInCategory` rule: same gate (u.status='approved' AND bp.is_active AND
   bp.pushed_to_store) + categoryTaxonomy members for the business, PLUS recursive
   sub-category subtree (CTE on category_nodes), tags `@>`, price range, sort. Honor existing
   ctx (creator allocation, brand scope, city boost, geo). Register in RULES.
4. **Engine wiring** — `sectionEngine.buildSections` passes the section's rule definition into
   ctx (e.g. `ctx.ruleDef = row.config_json.rule` for rows whose rule = `library_products`).
   No behavior change for existing rows (they don't set rule=library_products until 3c).
5. **Tests** — a focused unit/integration test of `resolveRuleSql` + `library_products`
   (sub-category subtree match, tag AND, price bounds, sort, gate). No fake-green.

## Verify
- `node --check` all new/changed files.
- `pnpm qa` → GREEN, gate 0, zero regression (existing rules untouched).
- `pnpm qa:db` → migration 103 applies in-chain (no MIGRATION FAILED); new test green.

## Deploy (production-impacting — explicit founder go)
- Migrate prod first (run-103 via .env.prod-backup), then push backend by path.
- DORMANT: no section uses `library_products` yet → zero follower-visible change. (Visible
  result arrives in 3c.)

## Expected end state
- `section_library` table exists; the data-driven evaluator works and is proven by tests;
  nothing renders yet. Ready for 3b (admin rule-builder) to author sections and 3c to place one.
