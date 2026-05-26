# billing-feature-support-tier-flags — Phase A12.7

> Final per-feature enforcement after A12.2/A12.3/A12.4/A12.5/A12.6.
> Informational-only flip on the two support-tier features —
> `dedicated_onboarding_call` and `phone_support_24x7`. These features
> have no runtime code gate (they describe humans-doing-things INFLX
> delivers manually, not user-facing endpoints). The flip exists for
> **catalog consistency** — after this migration the admin Features
> page shows `enforced=yes` across all 11 catalog rows.

## What ships

**Migration M068** (only artefact — no backend code change):
- `UPDATE features SET is_enforced=true WHERE feature_key IN
  ('dedicated_onboarding_call','phone_support_24x7') AND is_enforced=false`.
- Idempotent. Forward-only. Mirrors the pattern of M062–M067.

## Why no code gate

These two features represent **human-delivered support tiers**, not
software-enforceable rules:

| Feature | Real-world meaning |
|---------|---------------------|
| `dedicated_onboarding_call` | One-on-one onboarding call with the INFLX team at sign-up. Delivered by the founder / ops team manually. |
| `phone_support_24x7`        | 24x7 phone support hotline. A staffing / SLA commitment, not a code feature. |

Tier defaults from the M061 seed:

| Tier | dedicated_onboarding_call | phone_support_24x7 |
|------|---------------------------|---------------------|
| Free       | false | false |
| Growth     | false | false |
| Pro        | true  | false |
| Enterprise | true  | true  |

The catalog row already drives the brand-facing Subscription page
copy via `listTiers` + `entitlements[]` — that's the only "code path"
touching these flags. There is no gate to wire because there's no
endpoint to gate.

## Verify-twice
Grep of the entire repo for `dedicated_onboarding_call` +
`phone_support_24x7` returned 4 files:
- `backend/migrations/061_features_and_prices.sql` (seed)
- `backend/seeds/feature_catalog_draft.csv` (draft seed)
- `features/billing-enforce-quota-features/01-spec.md` (catalog enumeration)
- `features/billing-tier-features-and-prices/01-spec.md` (catalog enumeration)

No backend controller, no entitlements helper call, no frontend
component reads either feature key as a runtime gate. Confirmed
informational-only.

## Out of scope

- Adding a real code gate (e.g. a "Schedule Onboarding Call" button on
  the brand dashboard that 422s for Free/Growth) — not requested,
  not the design intent. Support tiers are delivered out-of-band.
- Future per-brand override (A14 territory).

## Files
- `backend/migrations/068_enforce_support_tier_flags.sql` +
  `backend/scripts/run-068.js`.
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING in the governance sense (the
  migration writes to prod `features` table) BUT behaviour-inert in
  the runtime sense (no code reads these flags as gates). After M068
  the admin Features page shows the two rows with `enforced=yes`
  badge — that is the only user-visible change anywhere.
- Backend code unchanged.
- No regression surface: pnpm qa runs to confirm baseline 76/76 GREEN
  before push.
- M068 prod run gated on separate explicit founder go.
