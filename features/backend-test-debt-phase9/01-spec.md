# Feature Spec — backend-test-debt Phase 9

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. Continuation of the
> Phase-8 ladder on the now-DETERMINISTIC qa:db instrument.
> Baseline (post-P8, c222e1f): **343 passed / 39 failed / 382**.

## Problem / goal
P8 cleared the money-convention cluster (49→39). Phase 9 takes
the **listing-service schema cluster** — 10 failing tests in
`tests/listing-engine.test.js`, a cohesive single-area batch
where the backend is VERIFIED CORRECT and the tests hard-code a
STALE snapshot of the category-schema config.

Source of truth (verify-twice): `backend/public/schemas/*.json`
(on-disk, committed) loaded by `listing.service.js loadSchema`
(:18-28), plus `LISTING_ENGINE_PHASE` (env, **=5** in
`backend/.env`, read by globalSetup). The restaurant/salon
schemas have legitimately EVOLVED (real product redesign); the
tests assert the OLD constants.

Authoritative values confirmed against the on-disk schema:
- `restaurant.json`: `card_config.accent` **#dc2626** (test
  asserts #ef4444); `cta_primary.label` **"Order Now"** (test
  "Order"); `quality_rules.length` **13** (test 9),
  `quality_rules[0]` = `restaurant_description`/**5** pts (test
  business_name/15); `listing_steps.length` **9** (test 3),
  ids `basics,location,hours,…` (test basics,menu,preview);
  `action_types` = `{ online_order:{ endpoint:'/follower/
  orders', cart_scope:'brand', min_order_value_field:
  'min_order_value', delivery_fee_field:'delivery_fee' } }`
  (test asserts walkin_pay/book_now/enquiry — removed).
- `salon.json`: `phase` **1** / `status` **active** (test
  asserts 99 / coming_soon).
- `getActivePhaseCategories` predicate = `phase <=
  LISTING_ENGINE_PHASE(5) && status==='active'` → exactly
  **5**: `['car_rental','fashion','fashion_walkin','restaurant',
  'salon']` (test asserts 2 = ['fashion_walkin','restaurant']).
- `isCategoryActive('salon')` → **true** (salon now phase-1
  active; test asserts false).
- The "Quality score increases when products are added" test
  adds **5** products, but the evolved restaurant rule 9
  (`items:'menu_items'`, **min:10**, +15) is the smallest
  product-credit threshold (`calculateQualityScore`
  listing.service.js:246 `productCount >= rule.min`). 5 < 10 →
  score correctly does NOT move. Backend CORRECT; the fixture
  predates the threshold change → class-2 stale scenario.

## Scope (Phase 9 — one measured, evidence-driven batch)
10 failing tests, all class-2/4, backend VERIFIED CORRECT (no
carve):
1. **Lever — schema-constant alignment (class-4 ×9):** align
   the stale assertions in `listing-engine.test.js` to the
   verified on-disk schema values (accent, cta label, salon
   phase/status, active-category set, isCategoryActive(salon),
   quality_rules count + rule[0], listing_steps count + ids,
   action_types shape) + the integration "listing-config"
   (listing_steps 3→9, accent). Stale test NAMES referencing
   old constants corrected for accuracy (documents the verified
   contract — not masking).
2. **Lever — quality-score scenario (class-2 ×1):** the
   "Quality score increases" test adds 10 products (not 5) to
   cross the verified rule-9 menu_items threshold (min:10);
   preserves the test's intent against the evolved rule.
3. CARVE any genuine class-3 RED — NONE (backend verified
   correct: schemas are the committed contract; the score
   behaviour is correct per the evolved rule). Confirm no new
   500s beyond the carved follower-feed-noauth-500.
4. Re-measure honestly vs 343/39; main `pnpm qa` 66/C1/gate-0
   unchanged.

## Out of scope / forbidden
- NOT zero; one measured batch. The other deferred clusters
  (campaigns publish/CRUD, influencer-search response-shape,
  follower-feed, register-422, engagement, the P8
  reclassified-out items) remain → Phase 10.
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Each new value is read from the committed on-disk
  schema (the authoritative contract) — not reverse-engineered.
  Note: `calculateQualityScore` only resolves brand fields
  business_name/city/category (so most restaurant field-rules
  never score) — a PRE-EXISTING backend limitation, NOT
  introduced or masked here; out of scope (not what the 10
  failing tests assert); recorded as an observation.
- No backend/runtime change.

## Surfaces touched
- `backend/tests/listing-engine.test.js` only.
- **Deploy-inert** (tests not in the server import graph; no
  migration/web/mobile/OTA/runtime change → no Render/Vercel).

## Non-functional
- Success = classification grounded in the committed schema +
  honest measured delta on the deterministic instrument + every
  value traceable to the on-disk schema/`listing.service.js`
  line + zero main-lane regression. Big delta via masking =
  FAILURE.
