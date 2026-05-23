# billing-subscriptions-schema — INFLX Revenue Model schema (Phase A1)

> **Phase A1 of the INFLX 3-Layer Revenue Model rollout.** Schema only —
> no controllers, no routes, no UI, no Razorpay calls. It lays the
> tables the later phases (A2 column rename → A6 mandate billing → A8
> reconciliation) build on. Backend-governed (`backend/migrations/`,
> `backend/scripts/`), additive, idempotent, production-impacting
> (Render runs the migration on Supabase prod on push). Pushed only on
> explicit founder go; never silent.

## What the INFLX Revenue Model is (recap, from the locked design)

Replaces the legacy flat 8% per-brand platform fee with three
independent layers, every percentage admin-editable, nothing
hardcoded:

| Layer | Charged at | Charged to | Base | Rate source |
|---|---|---|---|---|
| **L1 Subscription** | Cycle anchor (monthly) | Brand | Tier price | `subscription_tiers.monthly_price_inr` |
| **L2 Marketplace (escrow) fee** | Campaign publish | Brand (locked) | Σ engagement+hybrid set_budgets | `escrow_fee_tiers` (M037 — already live) |
| **L3 Marketplace fee** | Follower transaction | Brand (deducted from gross) | `net_amount` | `categories.path_{a,b,c}_pct` based on path classification |

Three follower→brand paths drive the L3 %:
- **Path A — direct**: no influencer click ever for this (follower,brand); no active attribution.
- **Path B — influencer_direct**: the follower's purchase carries a valid `cid` (active campaign-influencer match in the URL chain).
- **Path C — influencer_attributed**: no current click but an unexpired `attribution_clicks` row exists for (follower, influencer) within the last 30 days.

## Goal of this phase
Create the schema that holds:
1. **L1** — `subscription_tiers` (admin-editable rows; 4 seeded), `brand_subscriptions` (one active per brand), `subscription_invoices` (history + GST line items).
2. **L3** — `categories` (admin-editable rows; 16 seeded with placeholders for the 16 verticals in the Glow Studio walkthrough; Path A/B/C % per category) + `attribution_clicks` (the 30-day Path-C window).
3. **L2** — **no schema work**: `escrow_fee_tiers` (M037) already exists with admin CRUD. Recorded here for traceability.

**No behaviour ships.** `git push` of this migration only adds tables;
the runtime keeps using the legacy `brands.platform_fee_pct` until
Phase A3 (pricing.service extensions) + Phase A5 (transaction.controller
wiring) flip the read paths.

## Scope
- **In scope:** Migration 058 + run-058.js + seed-draft CSVs (gitignored,
  for founder review per `feedback_csv_first_seeds.md`). Idempotent
  `CREATE TABLE IF NOT EXISTS` + `DO $$ ... EXCEPTION WHEN
  duplicate_object` enum guards + `ON CONFLICT (key) DO NOTHING` seeds.
- **Explicitly out of scope:** controllers, routes, services,
  middleware, UI, the actual Razorpay integration, the column rename
  (Phase A2), any read-path change, mobile.

## Surfaces touched
- **App(s):** backend only (`backend/migrations/058_billing_subscriptions.sql`, `backend/scripts/run-058.js`).
- **Roles involved:** none at runtime (schema only); admin CRUD lands in Phase A7.

## Data / contracts
- **New tables (5):** `subscription_tiers`, `brand_subscriptions`,
  `subscription_invoices`, `categories`, `attribution_clicks`.
- **New enums (4):** `subscription_status`, `mandate_status`,
  `invoice_status`, `attribution_path` (the last is reserved; not yet
  written by any code in this phase).
- **No tables touched / no columns dropped / no constraints removed.**
  Migration is strictly additive.
- **Money convention:** all monetary columns `numeric(10,2)` rupees per
  CLAUDE.md money rule. Razorpay-boundary paise conversion stays in
  `utils/money.js` (Phase A6).
- **No new API endpoints.** No envelope changes.

## Schema-design decisions taken (founder broad-delegation 2026-05-23 "take your best decision on backend and tables and all")

1. **L3 model = `categories` table with `path_{a,b,c}_pct` columns** —
   NOT a separate `pricing_tiers (category_id, path, pct)` matrix.
   Rationale: compact, matches the Glow Studio walkthrough, simpler
   admin UI. A `pricing_tiers` matrix can be added later only if
   tier×category×path actually diverges.
2. **L2 fee transparency** — surface the locked L2 % + ₹ on the brand's
   wallet-hold receipt at publish (compliance posture). Implementation
   lives in Phase A7 UI; schema unaffected.
3. **Free-tier wall** — hard `422 QUOTA_EXCEEDED` (no soft nudge).
   Implementation lives in Phase A4 middleware; schema unaffected.
4. **Idempotency convention** — `IF NOT EXISTS` + `DO $$ EXCEPTION
   WHEN duplicate_object THEN NULL; END $$;` per M037/M057 precedent.
5. **One-active-sub invariant** — partial unique index
   `uniq_brand_subs_active` on `(brand_id) WHERE status = 'active'`
   guarantees no double-active subscription per brand. Historical
   rows stay; only the active one is unique.
6. **Backward compat** — every existing brand keeps working with no
   `brand_subscriptions` row; Phase A4's quota middleware lazily
   creates a `free`-tier row on first quota check (no backfill needed,
   no migration data step, smaller blast radius).
7. **`attribution_clicks` WRITE site** — verify-twice catch on §13(e)
   of the brief: at `/s/{handle}` redirect time the follower is NOT
   yet authenticated; we cannot legitimately set `follower_id`. So
   attribution rows are written **at follower-transaction time inside
   `transaction.controller`** when we already have both follower_id +
   influencer_id from the CI row (Phase A5). `tracking.controller`
   keeps writing `link_clicks` only — unchanged. Documented inline in
   the migration comment.
8. **Subscription invoices include GST** — `gst_amount_inr` column
   (18% IGST default; admin can override per invoice for inter-state
   subtleties later); `total_inr` is a `GENERATED ALWAYS AS STORED`
   column for query convenience.

## Non-functional
- **Auth/role gates:** none in this phase (no endpoints).
- **Failure modes:** none at runtime. Migration failure during Render
  deploy would block the deploy — covered by the idempotency guards
  (re-applying the same SQL produces no-ops, no errors).
- **Rollback strategy:** additive-only — rollback = revert the commit
  + drop the 5 tables + drop the 4 enums on prod. Both safe (no other
  code reads/writes them in this phase). Documented in 05-impact.md.

## Files in this contract
- `backend/migrations/058_billing_subscriptions.sql` — the migration.
- `backend/scripts/run-058.js` — per-batch runner (per the M035/M055 precedent; `migrate.js` is broken past M013).
- `backend/seeds/subscription_tiers_draft.csv` — for founder review (gitignored).
- `backend/seeds/categories_draft.csv` — for founder review (gitignored).
- This contract: spec / workflow / expected-outputs / impact / lock.json.

## Related contracts
- `features/escrow-fee-tiers-l2/` (M037 — L2 fee tiers, lives in `pricing.service.js`)
- `features/billing-column-rename/` (Phase A2 — coordinated `platform_fee` → `marketplace_fee_amount`)
- `features/billing-pricing-service/` (Phase A3 — extend pricing.service.js)
- `features/billing-quota-middleware/` (Phase A4)
- `features/billing-attribution-l3/` (Phase A5)
- `features/billing-subscription-mandate/` (Phase A6)
- `features/billing-admin-and-brand-ui/` (Phase A7)
- `features/billing-revenue-reconciliation/` (Phase A8)
