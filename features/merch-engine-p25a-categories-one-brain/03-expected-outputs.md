# Expected outputs — Categories: one brain (Phase 2.5a)

> Concrete, checkable results. Success = these hold, proven by `pnpm qa` + the manual
> acceptance check against prod after deploy.

## Automated (must hold before deploy)
1. `node --check` green on `taxonomy.service.js`, `sectionRules.service.js`,
   `sectionEngine.service.js`, `follower.service.js`, `listing.service.js`.
2. `pnpm qa` → **GREEN, gate 0, zero regression** (same suite count as today, all passing).
3. `pnpm qa:db` → migrations apply **N/N incl. 102**, no `MIGRATION FAILED`. Failed-test
   count does **not rise** beyond the known tier-cascade baseline (classify if it does).
4. `taxonomy.service` unit behaviour:
   - `membersFor('fashion')` → `['fashion']`; `membersFor('food')` → `['restaurant']`.
   - `normalizeBusinessType('fashion_walkin')` → `'fashion'`;
     `normalizeBusinessType('fashion_online')` → `'fashion'`.
   - `tileForBusinessType('salon')` → `'beauty'`.
   - table-unreachable → returns the hardcoded fallback (non-empty), logs once.

## Post-migration data (verify on prod after apply, before/with code push)
5. `SELECT category, count(*) FROM brands GROUP BY 1` → **no** `fashion_walkin` /
   `fashion_online` rows; the previously-split fashion brands now read `fashion`.
6. `SELECT key,label,status FROM follower_categories ORDER BY sort_order` →
   `fashion, furniture, food, beauty, car_rental` = **active**; the 7 legacy keys = **hidden**.
7. `SELECT DISTINCT category_key FROM section_config` → contains `food`/`fashion`,
   **not** `dining`/`shopping`.

## Behavioural acceptance (the whole point — "edit admin → all screens agree")
8. Open the follower app **Fashion** tile → shows only `fashion` businesses/products
   (Charvitha Fashions), **no furniture, no restaurants**.
9. Open **Furniture** → only `furniture` (Pratheek Furniture Mall). Open **Food** → only
   restaurants. Open **Beauty** → only salon. Open **Car Rentals** → only car_rental.
10. **One-edit proof:** in Admin → Follower Categories, add `furniture` to the **Fashion**
    tile's members and save. Re-open the app:
    - Fashion **category screen** now also shows furniture, AND
    - the **Deals tab** filtered to Fashion, AND
    - **Search** within Fashion, AND
    - any Home "Top in Fashion" shelf
    all reflect the change **together**. Remove it again → all revert together.
    *(Before this contract, only some of those moved. That divergence is the bug; this
    test failing on any one surface means the consolidation is incomplete.)*

## Non-goals (explicitly NOT expected here)
- Mobile in-app hardcoded category lists changing (still present until 2.5b).
- Brand-registration emitting `fashion` (still emits `fashion_walkin`, alias-mapped, until 2.5b).
- Legacy follower screens removed (2.5c).
