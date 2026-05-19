# Feature Spec — search verification tag (Q3: intended behaviour + explicit tag)

> Step 1. GATED on `lock.json.approved = true`. PRODUCTION-
> IMPACTING (DB-view migration 055 — shared with
> fix-onboarded-creator-city-search — + search controller
> additive field). Resolves carve
> `features/backend-defect-search-includes-pending-influencers`
> as **working-as-intended** per founder product decision
> 2026-05-19.

## Product decision (founder, 2026-05-19 — recorded as durable spec)
`/v1/influencers/search` deliberately returns TWO populations so
the brand⇄influencer chicken-and-egg supply problem is solvable
for an early-stage team:
1. **Registered + admin-verified** influencers → show with a
   **"verified"** tag.
2. **Scraped-from-Instagram, not-registered/not-verified** →
   show with **no** tag.
Internally the platform tracks the fuller taxonomy: registered+
verified · scraped-needs-registration · registered-but-unclaimed
· claimed-in-verification. When a brand picks a scraped/
unverified influencer, the platform later informs that
influencer ("you have an offer") to drive registration/claim.
So including pending/scraped is **intended**, NOT a defect — the
carved test asserted an incorrect "exclude pending" rule.

## Fix
1. **Migration 055** (shared with fix-onboarded-creator-city-
   search; one atomic CREATE OR REPLACE VIEW): onboarded branch
   `TRUE AS is_inflx_verified` → `(u.status = 'approved')`, and
   `'verified' AS internal_verification_status` → `u.status`.
   Pending onboarded stays VISIBLE
   (`WHERE u.status IN ('approved','pending')`) but is correctly
   NOT verified-tagged. Scraped branch unchanged
   (`(cp.verification_status='verified')`).
2. **Search controller** (`influencer.controller.js` ~529):
   add an explicit brand-facing `is_verified` boolean to each
   result (= `r.is_inflx_verified === true`). Additive — keeps
   all existing fields.
3. **Test**: realign the carved test to the product contract —
   both appear; `is_verified` true for approved, false for
   pending. Rename accordingly.
4. **Close the carve** `backend-defect-search-includes-pending-
   influencers` as resolved (working-as-intended + explicit tag
   added).

## Out of scope (recorded follow-up, not built now)
The deeper 4-state taxonomy surfacing (unclaimed vs claimed-in-
verification distinctions; the "inform the scraped influencer
on offer" workflow) is a future product feature — flagged, not
silently built.

## Success
`pnpm qa:db`: the realigned `tests/influencer-search.test.js`
test (both appear; is_verified true/false) GREEN **by the
backend (migration + controller field)** — the test now asserts
the product-confirmed contract, not the old exclude rule. All
other influencer-search tests stay GREEN. Main `pnpm qa`
66/C1/gate-0 unchanged.

## Surfaces / deploy
- `backend/migrations/055_*.sql` + `backend/src/controllers/
  influencer.controller.js` (GOVERNED). **PRODUCTION-IMPACTING**
  (Render migration + backend). Surfaced; founder GO on record.
  Additive controller field + view-only migration → low risk;
  rollback = revert the field + a follow-up view migration.
