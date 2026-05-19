# Expected Outputs — backend-test-debt Phase 9

> Step 3. Measured vs **343 passed / 39 failed / 382** (post-P8,
> deterministic instrument → noise-free delta).

## Per-step expected outputs
| Step | Observable output | Verified by |
|---|---|---|
| 1 Inventory | The 10 listing-engine failing tests (suite › test + signature) | jest summary cross-check |
| 2 Classify | Each 1/2/3/4 with on-disk schema / service `file:line` | restaurant.json/salon.json + listing.service.js reads |
| 3 Align | 9 schema-constant + 1 scenario, each traceable to the committed schema | `git diff backend/tests/listing-engine.test.js` |
| 4 Carve | One `features/backend-defect-<slug>/` per genuine class-3; test RED | none expected |
| 5 Re-measure | Honest delta vs 343/39 + inventory in `lock.json` | fresh `pnpm qa:db` |
| 6 Regression | main `pnpm qa` 66 GREEN / C1 / gate 0; gov-check OK | `pnpm qa`; `qa/reports/latest.md` |

## Verified authoritative values (from committed schema)
- restaurant accent **#dc2626**, cta_primary.label **"Order
  Now"**, icon 🍽️ (unchanged-correct); quality_rules **13**,
  rule[0] field **restaurant_description** / points **5**;
  listing_steps **9** (ids basics,location,hours,…);
  action_types **{ online_order: { endpoint:'/follower/orders',
  cart_scope:'brand', min_order_value_field:'min_order_value',
  delivery_fee_field:'delivery_fee' } }**.
- salon phase **1** / status **active**.
- active categories **5** =
  `['car_rental','fashion','fashion_walkin','restaurant','salon']`;
  isCategoryActive('salon') **true**.
- quality-score scenario: add **10** products (rule 9
  menu_items min:10, +15) so score rises above 0.

## Hard expectations (GOVERNANCE.md §8)
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Negative assertions (isCategoryActive('nonexistent')
  → false; loadSchema('unicorn_spa') → null; 404 cases) left
  intact. Every aligned value comes from the committed on-disk
  schema, not reverse-engineered.
- No test catching a genuine backend bug edited to pass — none
  here (backend verified correct; carve count 0).
- Delta reported truthfully even if small. Determinism → exact.
- The pre-existing `calculateQualityScore` brand-field
  limitation is recorded as an observation, not fixed/masked
  (out of scope; not asserted by the 10 tests).
- migrations stay 53/53 0-error; main lane unchanged
  (Phase 9 = one test file; deploy-inert).

## Evidence
- `qa/artifacts/_p8c_remeasure_qadb.log` (post-P8 inventory) +
  fresh `pnpm qa:db` (post-P9), classified inventory + delta in
  `lock.json` + `04-preview/README.md`, `qa/reports/latest.md`
  (main lane), gov-check pass on push.
