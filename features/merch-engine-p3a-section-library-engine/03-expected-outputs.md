# Expected outputs — Section Library engine (Phase 3a)

## Automated (before deploy)
1. `node --check` green on `sectionLibrary.service.js`, `sectionRules.service.js`,
   `sectionEngine.service.js`, `scripts/run-103.js`.
2. `pnpm qa` → GREEN, gate 0, zero regression.
3. `pnpm qa:db` → migration 103 applies in-chain, no MIGRATION FAILED; new test passes;
   failed-count not above the known tier-cascade/OTP baseline.
4. **Evaluator unit/integration behaviour** (seed a tiny fixture):
   - business `fashion` + no other filter → returns only approved + pushed fashion products.
   - + `subcategory_node_id` = a parent node → returns products in that node AND its descendant
     leaves (recursive), not siblings.
   - + `tags:['summer']` → only products whose tags array contains 'summer'; `['summer','casual']`
     → must contain BOTH.
   - + `price_min/price_max` → only products in range (inclusive).
   - `sort: price_asc|price_desc|newest` → correct ordering.
   - visibility gate honored: an un-pushed or inactive or unapproved-brand product never returns.
   - unknown `subcategory_node_id` → empty (never "all").
   - **context stacking**: with `ctx.influencer` set, the SAME rule returns only products
     live-allocated to that creator (∩ allocation); with `ctx.categoryKey` set, only that
     category's members; both together (creator-category surface) AND both — proving
     "same section, different surface, different results" (Layer 6).

## Behavioural (post-deploy)
5. **Dormant**: no follower screen changes (no section_config row uses `library_products`).
   `/follower/home`, `/follower/section/category/*` outputs are byte-identical to pre-3a.
6. Migration verified on prod: `SELECT to_regclass('public.section_library')` is non-null;
   table empty (or only the marked example row).

## Non-goals (NOT expected here)
- Admin rule-builder UI (3b). Followers seeing a data-driven section (3c).
- Trending/bestseller product sort (Phase 7). Collections/Templates (Phase 4).
