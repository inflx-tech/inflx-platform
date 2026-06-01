# Workflow Definition — referral-agency-role (Contract 3a)

> Backend-only contract. Steps are API/DB state transitions; each becomes a
> jest assertion. No UI in 3a (mobile app is 3b).

## Actors
- **Agency user** (new role) — signs up, registers a profile, withdraws.
- **Admin** — approves/rejects agencies.
- **Brand / influencer** — redeems an agency code.
- **System** — the referral engine (settlement on confirmed revenue).

## Preconditions
- Migrations 078 + 079 applied; migration 080 (agency enum + tables +
  `agency_tds_pct`) applied with the enum value committed.
- `referral_settings.default_pct` seeded (Contract 2).

## Workflow steps (server-observable)

### A. Agency onboarding
1. Agency completes OTP `verify-otp` with `role='agency'` → `users` row
   `role='agency'`, `status='pending'`.
2. `POST /agencies/register` (authed) with agency_name + contact + payout →
   `agencies` row created, `wallet_balance=0`, linked to the user.
3. `GET /agencies/me` → returns profile + wallet + a referral **code**
   (lazily created on first read via `getOrCreateCode`).
4. Admin `GET /admin/queue/agencies` lists the pending agency;
   `PATCH /admin/agencies/:id/status {status:'approved'}` → `users.status
   ='approved'`, `agencies.approved_at/by` set. (Reject → `rejected` + reason.)

### B. Code redeem (referred entity attaches to the agency)
5. A brand/influencer (authed) `POST /referrals/redeem {code}` →
   `lookupCode(code)` resolves the agency referrer → `createEdge(referrer=
   agency, referred=caller, source='signup', pct=default_pct)` → active edge,
   expires +12mo.
6. Redeem when the caller already has an active referrer → engine dedup →
   `409`/`422`, no new edge.
7. Redeem an unknown / self / circular code → `404` / `422`.

### C. Settlement (the activation)
8. The referred entity generates confirmed revenue (subscription / protection
   fee / commission) → the C1 engine resolves the agency edge → writes the
   ledger row AND (new in 3a) **credits `agencies.wallet_balance` +
   `referral_earned_total`** and marks the row `paid` — inline, like an
   influencer referrer.
9. Pre-3a behaviour (agency rows stuck `pending`) no longer occurs for new
   accruals; the agency's wallet reflects confirmed earnings immediately.

### D. Agency withdrawal
10. Approved agency `POST /agencies/me/withdraw {amount, method, payout}` →
    TDS 194H computed at `agency_tds_pct` (default 5%) →
    `agency_withdrawals` row (`tds_deducted`, `net_paid`), `wallet_balance`
    debited, RazorpayX payout initiated (mock in dev/test).
11. `GET /agencies/me/withdrawals` → the agency's withdrawal history.
12. Withdraw > balance, below min, or while not approved → rejected (422/403),
    no balance change.

## Success definition
- An agency can be created, approved, and obtain a code.
- A redeemed code creates exactly one active edge (guards intact).
- Agency referral accrual credits the agency wallet + marks ledger `paid`
  (settlement), with the platform-slice invariant unchanged (influencer net /
  brand net / escrow untouched).
- Agency withdrawal deducts TDS 194H @ 5% correctly, debits the wallet, writes
  an `agency_withdrawals` row, and never overdraws.
- `pnpm qa` GREEN; existing influencer/brand/withdrawal/engine suites
  unregressed (influencer TDS stays 10%, brand stays no-TDS).

## Failure / edge workflows
- New enum value usage in the same txn as `ADD VALUE` → avoided by committing
  the enum migration first (standalone runner).
- Settlement throws → caught (C1 isolation), host revenue path still commits,
  ledger row stays `pending` → re-accrue is idempotent on (source, source_ref_id).
- Code redeem race (two redeems) → partial unique index keeps ≤1 active edge.
