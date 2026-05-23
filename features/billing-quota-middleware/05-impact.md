# Impact — billing-quota-middleware (Phase A4)

## Changes
- 1 new middleware file.
- 4 routes wired with `checkQuota(action)`.
- AppError + response + errorHandler extended (1-line each, backward-compat).
- registerBrand factory auto-upserts enterprise tier (test discipline).
- 3 new test assertions; zero pre-existing test changes.

## Blast radius
- All 4 wired endpoints: brand POST to create campaign/set/invite/product.
  - These were previously unbounded; now gated by tier.
  - Existing brands (no subscription row) → lazy-created Free → strict limits apply prospectively.
- Other endpoints (PATCH, DELETE, GET) unaffected.

## Risk
- **Production brand suddenly blocked on legitimate action** — Free
  tier limits (1 campaign, 1 set, 5 inf/cycle, 10 products) are tight.
  A brand mid-campaign creation could hit it. Mitigation: founder
  edits tier limits via admin UI (Phase A7) or upgrades manually
  via SQL until A6 mandate flow ships.
- **Lazy-create race** — two concurrent quota checks for the same
  brand could both try to INSERT a free row. The `uniq_brand_subs_active`
  partial unique index handles it (one INSERT wins, the other no-ops
  via `ON CONFLICT DO NOTHING`). The losing branch refetches via the
  next quota call.

## Rollback
Revert the commit. No migration. AppError/response/errorHandler are
backward-compatible — reverting just makes the `details` field absent
again; no consumers depend on it yet (frontend upgrade modal lands in
Phase A7).

## Pre-push checklist
1. `pnpm qa` main GREEN 67/67.
2. `pnpm qa:db` informational: new quotaCheck.test.js passes; zero
   pre-existing regression (factory auto-enterprise insulates).
3. gov-check exit 0.
