# Backend Defect — `/v1/influencers/search` exposes pending (unapproved) influencers

> Status: **CARVED FINDING** (Phase 10, 2026-05-19). GENUINE
> BACKEND DEFECT (uncertain-intent ⇒ carved, not masked).
> Catching test LEFT RED. Backend NOT patched here — the fix
> (and product-intent confirmation) is its own future contract
> (production-impacting: a DB view migration, gated).

## Symptom
`GET /v1/influencers/search` returns **pending (unapproved)**
onboarded influencers alongside approved ones. Catching test:
`tests/influencer-search.test.js`
`'does NOT include pending (unapproved) influencers in results'`
— creates 1 approved + 1 pending influencer, expects **1**
result → gets **2**. Left **RED**.

## Why it is a genuine backend defect (verify-twice, real code + instrumented)
- The search view's onboarded branch explicitly admits pending
  users: `backend/migrations/045_profile_pic_r2_cache.sql:134-136`
  `FROM influencers i JOIN users u ON u.id = i.user_id
  WHERE u.status IN ('approved', 'pending')`.
- Instrumented evidence (P10 re-measure, real qa:db PG, after
  the cohesive shape-rename so the test fails on the *genuine*
  assertion): `res.body.data.creators.length` Expected 1,
  **Received 2** — the unapproved influencer appears.
- Account approval is the platform's vetting gate (admin
  approves accounts; the brand *caller* is itself gated by
  `requireApproved`). Exposing un-vetted influencer profiles in
  brand discovery is a privacy/quality leak and contradicts the
  test's stated, long-standing rule. The test is correct; the
  view's `IN ('approved','pending')` is the likely defect.
- **Uncertain-intent honesty:** it is *conceivable* the
  `'pending'` inclusion is deliberate (e.g. let brands pre-browse).
  Per GOVERNANCE.md §6 "uncertain ⇒ treat as class-3 (carve);
  never silently fixed" — editing the test to accept `2` would
  be fake-green masking a probable real defect. So it is carved
  RED for an explicit product/eng decision, not silently
  resolved either way.

## Disposition (Phase 10 = triage + carve, NOT backend-fix)
- The catching test stays **RED**. P10 applied the cohesive
  `data.influencers`→`data.creators` + `instagram_handle`→
  `ig_handle` shape-rename uniformly across all 8 search tests;
  for this test that makes it fail on the **genuine** assertion
  (`creators.length` 2 ≠ 1) instead of a stale `undefined`
  TypeError — it now correctly *exposes* the leak, it does
  **not** mask it. No assertion weakened/skipped; the test's
  intent (pending excluded) is unchanged.
- Backend NOT patched here (view migration → production-
  impacting → its own locked, gated contract, where product
  confirms whether `'pending'` should be dropped).

## Scope of the future fix contract (not done here)
Likely minimal: in the `v_searchable_creators` onboarded branch
change `WHERE u.status IN ('approved', 'pending')` →
`WHERE u.status = 'approved'` (pending the product confirmation
that pending influencers must not surface in brand discovery).
Forward-only migration; production-impacting (Render runs
migrations) → explicit Step-14 gate, never silent. Verify:
`pnpm qa:db` this RED test → GREEN by the view migration (not a
test edit) + the scraped branch unchanged + main `pnpm qa`
regression.

## Surfaces
- Defect lives in the DB view migration (`v_searchable_creators`
  onboarded `WHERE u.status IN ('approved','pending')`). The
  future fix is **production-impacting** (migration → Render).
  This carve itself is **deploy-inert** (a tracked finding +
  RED test only).
