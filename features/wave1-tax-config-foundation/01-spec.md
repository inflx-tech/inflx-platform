# wave1-tax-config-foundation

> First commit of Wave 1 of the Tax/Settlement Roadmap. Centralizes
> every tax/limit/identity value that's currently hardcoded or
> globally-only-configurable into per-row admin-controllable config.
> Builds the slots + service-layer reads — Wave 2/3 will plug them
> into the engagement + commerce settlement flows. Admin UI for the
> new fields lands in a follow-up commit (`wave1-admin-ui-tax-controls`).

## What ships in this commit

### Migrations

**M072 — payment_config tax + identity columns**
- `gst_pct numeric(5,2) NOT NULL DEFAULT 18.00` — single source of truth for GST
- `tcs_pct numeric(5,2) NOT NULL DEFAULT 1.00` — TCS rate (Sec 52 CGST)
- `tcs_active boolean NOT NULL DEFAULT false` — toggle: gate TCS deduction
- `tcs_active_from_date date` — earliest date TCS may be deducted
- `platform_gstin varchar(15)` — platform's GSTIN (for invoices)
- `platform_business_name varchar(255)`
- `platform_business_address text`
- `platform_state_code varchar(2)`
- `invoice_prefix_subscription varchar(20) NOT NULL DEFAULT 'INF-SUB'`
- `invoice_prefix_commerce varchar(20) NOT NULL DEFAULT 'INF-COM'`

**M073 — per-actor override columns**
- `categories.return_window_days int NOT NULL DEFAULT 30` — per-category
  commerce-commission return window (replaces the global value)
- `influencers.tds_override_pct numeric(5,2)` — per-influencer TDS rate
- `influencers.tds_exempt boolean NOT NULL DEFAULT false` — for influencers
  with TDS exemption certificates
- `brands.commerce_commission_override_pct numeric(5,2)` — per-brand L3
  commission override (parallel to existing escrow_fee_override_pct)

**M074 — payment_config T3 release time-of-day**
- `tranche_3_release_time_ist time NOT NULL DEFAULT '03:00:00'` — admin
  picks the IST clock time at which T3 releases fire on the +N-day cron
  (admin already controls the "+N days" via existing config)

All 3 migrations are additive + idempotent (CREATE COLUMN IF NOT EXISTS
pattern via DO-blocks).

### Backend code

- `paymentConfig.service.js` — `getConfig()` SELECT extended; cache shape
  gains: `gstPct, tcsPct, tcsActive, tcsActiveFromDate, platformGstin,
  platformBusinessName, platformBusinessAddress, platformStateCode,
  invoicePrefixSubscription, invoicePrefixCommerce, tranche3ReleaseTimeIst`.
  `updateConfig()` allowed-list extended to accept all new columns.
- `tax.service.js` (new) — centralized helpers:
  - `gstOn(amount)` → returns GST amount as numeric (2 dp)
  - `withTax(base)` → `{ base, gst, total }`
  - `tcsOn(brandPortion[, asOf])` → 0 if TCS not active, else `pct%` of portion
  - `getTcsConfig()` → `{ pct, active, activeFrom }`
  - `getInvoiceIdentity()` → `{ gstin, businessName, address, stateCode, prefixSub, prefixCom }`
  - `getTrancheReleaseTimeIst()` → 'HH:MM:SS' string
  - Defensive: every call falls back to safe defaults if payment_config
    DB read fails OR new columns aren't yet on the row.
- `subscription.controller.js` — 5 hardcoded `GST_PCT = 18.00` sites
  replaced with `await tax.service.gstOn(amount)` / `await tax.service.withTax(amount)`.
- `webhook.controller.js` — 2 hardcoded `* 18 / 100` sites replaced.
- `withdrawal.service.js` — TDS rate read becomes:
  `influencer.tds_exempt ? 0 : (influencer.tds_override_pct ?? payment_config.tds_pct)`.
- `pricing.service.js` — `computeL3OnFollowerTxn` applies per-brand
  `commerce_commission_override_pct` when present (overrides
  category × path rate); also exposes `getReturnWindowForCategory(category_key)`
  reading `categories.return_window_days` (falls back to global
  `payment_config.return_window_days`).
- `escrow.service.js` — T3 release predicate uses
  `now() >= content_live + (N_days)` with a time-of-day comparison
  against `payment_config.tranche_3_release_time_ist`. The existing
  T3 cron query is updated to use the configured time.

### Run scripts

- `backend/scripts/run-072.js` — applies M072.
- `backend/scripts/run-073.js` — applies M073.
- `backend/scripts/run-074.js` — applies M074.

(Each follows the established `run-NNN.js` pattern: trap+restore-aware,
loads `.env`, runs the SQL, sanity-prints the new columns.)

## What's NOT in this commit

- Admin UI surfaces for the new fields — separate follow-up commit
  (`wave1-admin-ui-tax-controls`).
- Actual GST math on Protection Fee — Wave 2 (`escrow-protection-fee-gst`).
- Actual TCS math on follower purchases — Wave 3.
- Mid-cycle subscription pro-ration — Wave 2.

## Verify-twice notes

- `paymentConfig.service` has a 60s cache; updates bust it. New fields
  added to SELECT — old config rows without these columns get `null` →
  defensive `??` fallback in tax.service.
- M072/M073/M074 ordering: all additive, no FK dependencies between
  them. Can be applied in any order. We ship them as 3 separate scripts
  for clarity + per-migration audit.
- `withdrawal.service.js` line 142-143 currently reads `payment_config.tds_pct`
  globally — updating to first check `influencers.tds_exempt` then
  `influencers.tds_override_pct` then fall back to global. Existing
  withdrawal records unaffected.
- `pricing.service.computeL3OnFollowerTxn` reads `categories.path_a_pct/b_pct/c_pct`
  today. Adding override check above category lookup.
- `escrow.service` T3 cron: currently `WHERE NOW() >= content_live + 30 days`.
  Updated to `WHERE (NOW() AT TIME ZONE 'Asia/Kolkata')::time >= release_time
  AND (NOW() AT TIME ZONE 'Asia/Kolkata')::date >= content_live::date + days`.

## Files

- `backend/migrations/072_payment_config_tax_identity.sql`
- `backend/migrations/073_per_actor_overrides.sql`
- `backend/migrations/074_payment_config_t3_release_time.sql`
- `backend/scripts/run-072.js`, `run-073.js`, `run-074.js`
- `backend/src/services/paymentConfig.service.js` — extended
- `backend/src/services/tax.service.js` (new)
- `backend/src/controllers/subscription.controller.js` — GST sites
- `backend/src/controllers/webhook.controller.js` — GST sites
- `backend/src/services/withdrawal.service.js` — TDS lookup
- `backend/src/services/pricing.service.js` — L3 override + per-category window
- `backend/src/services/escrow.service.js` — T3 timing
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING (Render redeploys backend with
  the service changes). 3 prod migrations needed (M072 + M073 + M074),
  bundled into one combined founder go after push.
- Backward compatible: all new column reads use defensive `??` fallbacks
  so the code works pre- and post-migration without producing different
  behaviour on existing data.
- pnpm qa main lane GREEN expected to remain — no business-logic
  behaviour change yet; only config plumbing.
