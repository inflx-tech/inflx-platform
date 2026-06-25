# 02 — Workflow
1. Verify DB CHECKs (083) reject the new types → confirmed the real second gate.
2. Migration 119 (drop+re-add named CHECKs, idempotent) + run-119.js applier.
3. buildSections: add brandId opt + scope/vertical/brandId to ctx + cache key.
4. SCREENS += 'business'. 5. Verify: backend load OK, pnpm qa GREEN, admin-sections 8/8.
6. Run migration 119 on prod (founder go) → applier prints constraints (proof).
7. Commit + push backend (Render). End state: business scope + new section types
accepted by DB; every rule receives placement context.
