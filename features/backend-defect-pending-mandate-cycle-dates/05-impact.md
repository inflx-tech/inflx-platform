# Impact — backend-defect-pending-mandate-cycle-dates

## Changes
- 1 controller patch in `subscription.controller.js` — INSERT for
  live-mode upgrade now sets `current_cycle_start` +
  `current_cycle_end`.
- 1 contract folder.
- **Zero migration.** **Zero schema change.**

## Blast radius
- `subscription.controller.upgrade` live-mode path: INSERT now
  matches mock-mode's column coverage. Mock-mode path itself is
  unchanged.
- All other reads/writes of brand_subscriptions are unaffected.
- The webhook handler at `subscription.authenticated` already
  overwrites these cycle date columns with Razorpay's actual
  values, so the placeholders set at INSERT are short-lived (only
  exist during the brief `pending_mandate` window).

## Rollback
Revert this commit. The upgrade flow returns to the pre-fix
INTERNAL_ERROR state. Existing brand_subscriptions rows are
unaffected.

## Risks
- **Placeholder cycle dates briefly inaccurate**: between INSERT
  (status='pending_mandate', cycle_start=today) and webhook arrival
  (status='active', cycle_start=Razorpay's authenticated_at), the
  dates may be off by a few seconds to minutes. Acceptable — no
  brand-facing UI reads these during pending_mandate (only the
  status pill is shown).
- **No regression surface**: pnpm qa doesn't exercise live-mode
  upgrade; 76/76 GREEN unchanged.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean.
3. gov-check exit 0.
