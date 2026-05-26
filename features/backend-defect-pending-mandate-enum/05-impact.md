# Impact — backend-defect-pending-mandate-enum

## Changes
- 1 migration (M071): `ALTER TYPE subscription_status ADD VALUE IF
  NOT EXISTS 'pending_mandate'`.
- 1 runner script.
- 1 contract folder.
- **Zero backend code changes.** The defect is a missing enum
  value, not a logic bug.

## Blast radius
- `subscription_status` enum gets one more value. No existing
  rows affected (the new value isn't used until the next upgrade
  attempt).
- `subscription.controller.upgrade` live-mode path starts
  functioning end-to-end as designed in A6.5.
- All other code paths that read/write `subscription_status` are
  unaffected (they continue to use the existing 4 values).

## Rollback
Removing an enum value in PG requires dropping rows that use it OR
casting them away. Since `pending_mandate` will start being used
the moment M071 lands, rollback is non-trivial. Acceptable forward-
only direction: the enum stays extended permanently.

If a serious problem surfaced, the path is to revert the A6.5
controller change (commit 03f0401) so nothing writes
`'pending_mandate'` going forward; the enum value sits unused.

## Risks
- **Orphan Razorpay subscriptions** during the broken window:
  Aveen's earlier failed attempt created a subscription on Razorpay
  that's now orphaned (no matching brand_subscriptions row). Test
  mode auto-cancels orphans; production behaviour is similar but
  with longer TTL. Acceptable risk.
- **Generic 22P02 → "Invalid ID format" UX**: until M071 the error
  message is misleading. Post-M071 this specific case is fixed,
  but the generic error handler stays the same — any FUTURE enum
  or UUID violation would surface the same vague message. Improving
  the error mapper is a separate follow-up; out of scope here.
- **No regression surface**: backend code unchanged → pnpm qa
  behaviour identical → 76/76 GREEN guaranteed.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. M071 applied to local dev DB.
3. Sanity probe: `\dT+ subscription_status` shows `pending_mandate`.
4. gov-check exit 0.
5. M071 prod run gated on separate explicit founder go after push.
