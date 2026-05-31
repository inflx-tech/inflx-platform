# Workflow Definition — referral-engine (Contract 1)

> Backend engine contract. "User-observable" steps here are
> **server-side state transitions** triggered by existing money paths;
> each becomes an API/DB assertion in the QA workflow test (no UI).

## Actor
System (webhook handler, return-window cron, escrow tranche release) acting on
behalf of a referred entity that has an active referral edge. Edges are
test-seeded for this contract.

## Preconditions
- A referrer exists with a `referral_codes` row (test seed: one influencer
  referrer for an influencer→influencer edge; one influencer referrer for an
  influencer→brand edge).
- An **active** `referral_edges` row exists (`status='active'`,
  `now() < expires_at`), created via `referral.service` directly (admin/seed).
- The referred entity has the normal platform state needed to generate revenue
  (a subscription that charges; a campaign whose tranche releases; a confirmed
  follower transaction).

## Workflow steps (server-observable)

### A. Subscription accrual (brand referred)
1. Brand's subscription charges → `handleSubscriptionCharged` writes
   `subscription_invoices` row `status='paid'` → engine resolves the brand's
   active edge → **`referral_ledger` row written** with `source='subscription'`,
   `base_amount = invoice.amount_inr`, `amount = base × pct/100`.
2. The same webhook is delivered twice (retry) → **no second ledger row**
   (idempotent on `(source, source_ref_id)`).

### B. Protection-fee accrual (brand referred)
3. A campaign tranche releases via `processTrancheRelease` → engine resolves the
   campaign's brand edge → **ledger row** `source='protection_fee'`,
   `base_amount = tranche.escrow_fee_amount`.
4. Tranches 1/2/3 each release → **three separate ledger rows**, one per
   `escrow_entries.id`; the influencer's `net_to_influencer` credit is unchanged.

### C. Commission accrual (influencer referred)
5. A follower transaction's commission confirms in `commission-confirm.job`
   (pending→wallet after the 30-day window) → engine resolves the influencer's
   edge → **ledger row** `source='commission'`, `base_amount =
   txn.marketplace_fee_amount` → because referrer is an influencer, their
   `wallet_balance` += amount, `referral_earned_total` += amount, ledger row
   `payout_status='paid'`.
6. The referred influencer's own commission credit (pending→wallet) is the
   normal full amount — **unchanged** by the referral accrual.

### D. Guards
7. Revenue event for an entity whose edge `expires_at < now()` → **no ledger
   row** (window closed), host path completes normally.
8. Revenue event for an entity with **no** edge → **no ledger row**.
9. Attempt to seed a second `status='active'` edge for an entity that already
   has one → **insert rejected** by `uniq_referral_active_referred`.
10. Attempt to create an edge where referrer==referred, or a reverse edge while
    the inverse is active → **rejected** by guard (VALIDATION_ERROR).

## Success definition
The contract is SUCCESSFUL only if:
- Each confirmed revenue event with an in-window active edge produces **exactly
  one** `referral_ledger` row with correct `base_amount`, `pct`, and
  `amount = round2(base × pct/100)`.
- Influencer-referrer rows credit `wallet_balance` + `referral_earned_total` and
  are marked `paid`; agency-referrer rows remain `pending`.
- The underlying influencer commission / `net_to_influencer` / brand_net /
  subscription amounts are byte-for-byte unchanged vs. pre-feature.
- Retries/re-runs never create duplicate ledger rows.
- `pnpm qa` stays GREEN (zero regression on existing money workflows).

## Failure / edge workflows
- Accrual throws (e.g. transient DB) → error caught + logged; the host
  subscription charge / tranche release / commission confirmation **still
  commits**. (Referral is best-effort additive; a retry path re-accrues
  idempotently.)
- Edge `pct` is 0 → ledger row with `amount=0` allowed (admin may zero an edge);
  no wallet movement.
