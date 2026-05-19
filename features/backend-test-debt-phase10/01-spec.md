# Feature Spec — backend-test-debt Phase 10

> Step 1. Implementation GATED on `lock.json.approved = true`.
> Ledger: `features/backend-test-debt*`. Continuation of the
> Phase-9 ladder on the now-DETERMINISTIC qa:db instrument.
> Baseline (post-P9, 81137ee): **353 passed / 29 failed / 382**.

## Problem / goal
P9 cleared the listing-service schema cluster (39→29). Phase 10
takes the **influencer-search cluster** — 8 failing tests in
`tests/influencer-search.test.js`, the cluster P7 already
root-caused (Lever 3 cleared the upstream 403 `requireApproved`
gate; the residual is pure response-shape drift). Verified by a
reverted instrumented run against the real qa:db PG (P10
diagnostic, git-clean post-revert):

- The search endpoint returns **200** with
  `res.body.data.creators` (richer `v_searchable_creators`
  projection), NOT the legacy `res.body.data.influencers`;
  `res.body.meta = { page, limit, total }` (meta.total works).
  Field renames: `instagram_handle` → `ig_handle`;
  `engagement_rate` → `view_based_er`. Onboarded (registered)
  influencers DO appear (source `onboarded`), with correct
  `niche` (food/fitness) and `followers_count` (45200/120000) —
  so this is class-2/4 shape drift, backend CORRECT, NOT a
  class-3 "registered influencers unsearchable".
- **EXCEPTION — 1 genuine class-3 defect, carved:** the
  `'filters by city'` test. Instrumented dump showed
  `city: null` for every onboarded creator. Verify-twice:
  influencer registration writes city to `users.city`
  (`influencer.controller.js:218`) but `v_searchable_creators`
  onboarded branch selects `i.city` (always NULL) instead of
  the available `u.city`. Genuine backend defect → carved
  `features/backend-defect-onboarded-creator-city-search/`;
  the catching test is LEFT RED (the view-migration fix is a
  future production-impacting gated contract).

## Scope (Phase 10 — one measured, evidence-driven batch)
8 failing tests in one file; 7 class-2/4 (fixable), 1 class-3
(carved RED):
1. **Lever — response-shape + field rename (class-2/4 ×7):**
   `res.body.data.influencers` → `res.body.data.creators`
   (uniform, all 8); `…creators[0].instagram_handle` →
   `…creators[0].ig_handle` (assertions only — NOT the
   `registerInfluencer({ instagram_handle })` payload);
   `inf.engagement_rate` → `inf.view_based_er` (the
   "no sensitive fields" test). meta.total unchanged (verified
   working). Sensitive-field assertions unchanged (pan_number /
   bank_account_no / upi_id / fcm_token not in the projection →
   correctly `undefined`).
2. **Carve — class-3 ×1:** the shape-rename is applied
   uniformly to `'filters by city'` too, so it fails on the
   GENUINE assertion (`creators.length` 0 ≠ 1) — exposing, not
   masking, the carved `backend-defect-onboarded-creator-city-
   search` defect. Test LEFT RED; backend NOT patched.
3. Re-measure honestly vs 353/29; main `pnpm qa` 66/C1/gate-0
   unchanged.

## Out of scope / forbidden
- NOT zero; one measured batch. Remaining clusters (campaigns
  publish/CRUD, follower-feed, register-422, engagement, the P8
  reclassified-out items) → Phase 11.
- No `.skip`/delete/assertion-weakening/fabricated-data/
  force-pass. Every rename is the verified live response field
  (instrumented), not reverse-engineered. The city defect is
  carved RED, never masked; its test is not weakened.
- No backend/migration/runtime change (the city view fix is the
  carve's own future gated contract).
- `'does NOT include pending'` (#2) is renamed like the rest;
  if the view's approval gate does not exclude the unapproved
  onboarded influencer it would stay RED post-rename — the
  deterministic re-measure is the arbiter; any residual is
  classified honestly, not forced.

## Surfaces touched
- `backend/tests/influencer-search.test.js` only +
  `features/backend-defect-onboarded-creator-city-search/`
  (new carve) + this contract.
- **Deploy-inert** (tests not in the server import graph; no
  migration/web/mobile/OTA/runtime change → no Render/Vercel).

## Non-functional
- Success = classification grounded in the instrumented real
  response + honest measured delta on the deterministic
  instrument + the genuine city defect carved RED (not masked)
  + zero main-lane regression. Big delta via masking the city
  bug = FAILURE.
