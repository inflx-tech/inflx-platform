# Expected Outputs — billing-feature-support-tier-flags (A12.7)

## Database (after M068)
- `features.is_enforced = true` for `dedicated_onboarding_call`.
- `features.is_enforced = true` for `phone_support_24x7`.

## API JSON shapes
**Unchanged.** No new endpoints. The existing
`GET /v1/admin/features` already returns `is_enforced` per row; after
M068 the two rows just flip their flag in that response.

## Test results
- pnpm qa main lane GREEN unchanged.
- Local sanity probe via run-068.js shows both rows with
  is_enforced=true.

## Deploy posture
PRODUCTION-IMPACTING in the governance sense (prod DB write on
`features` table), BUT functionally **behaviour-inert** — no runtime
code path reads is_enforced for either feature, so user-facing
behaviour is identical before and after M068.

The only user-visible change anywhere on the platform is the admin
Features page badge flipping from `enforced=no` to `enforced=yes` on
these two rows.

M068 prod run gated on separate explicit founder go.
