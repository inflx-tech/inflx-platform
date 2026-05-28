# wave2-l2-gst-protection-fee — Wave 2 commit 3

> Record + surface GST on the L2 Protection Fee (escrow fee), EXCLUSIVE.
> The brand sees the Protection Fee and its GST as separate lines on the
> per-campaign escrow statement so they can claim input credit (settled
> decision 2).

## Settled decision (2, locked with founder)
GST on the Protection Fee = **EXCLUSIVE display**. Brand sees fee + GST as
separate lines. Platform books clean: fee = revenue, GST = collected. The
Protection Fee = Campaign Assurance Fee = `escrow_fee_amount` (one fee, two
names).

## Scope boundary (important)
This commit **records + displays** the GST on the platform's escrow fee. It
does **NOT** change `net_to_influencer` or the brand's funded amount. The
escrow fee is still computed + (mechanically) netted from the influencer's
tranche exactly as before; `fee_gst_amount` is the GST the platform owes on
that fee, persisted per tranche and surfaced to the brand. The actual GST
invoice / collection + monthly remittance reporting is **Wave 4**.

## What ships

### M076 (gated — applied to prod with M075 in one combined go)
`ALTER TABLE escrow_entries ADD COLUMN fee_gst_amount numeric(10,2)`. Additive,
idempotent. Pre-076 rows keep it NULL; the brand-facing controller derives the
value on read from the current `gst_pct`.

### Backend
- `escrow.service.createEscrowEntries` — at fee capture, compute
  `fee_gst_amount = tax.service.gstOn(escrow_fee_amount)` per tranche
  (EXCLUSIVE, reuses the centralized helper → `payment_config.gst_pct`,
  fallback 18) and persist it.
- `escrow.controller.getCampaignEscrow` — surface `escrow_fee_amount` +
  `fee_gst_amount` (+ `net_to_influencer`) per tranche; derive `fee_gst_amount`
  for pre-076 NULL rows; add `summary.total_fee` + `summary.total_fee_gst`.

### Frontend (brand-web)
- `/dashboard/campaigns/[id]/escrow` — each tranche row gains a sub-line:
  **Protection fee ₹X · GST ₹Y**. Reuses the locked `.esc` palette.

## Verify-twice
- `tax.service.gstOn(amount)` already exists (Wave 1) and reads
  `payment_config.gst_pct` with an 18% fallback — reused, not re-implemented.
- `escrow_fee_amount` is the renamed `platform_fee_amount` (M037); it is the
  L2 Protection Fee, computed in `createEscrowEntries` as `tranche_amount ×
  feePct` and netted from the influencer's tranche.
- `getCampaignEscrow` previously exposed only `amount` per tranche — the brand
  did not see the fee at all; this commit adds fee + GST visibility.

## Out of scope
- Charging the brand the GST / issuing the GST invoice + input-credit
  document (Wave 4).
- Mid-cycle upgrade pro-ration (Wave 2 commit 4).

## Files
- `backend/migrations/076_escrow_fee_gst.sql` + `backend/scripts/run-076.js`
- `backend/src/services/escrow.service.js`
- `backend/src/controllers/escrow.controller.js`
- `backend/tests/escrow-fee-tiers.test.js`
- `Packages/brand-web/app/dashboard/campaigns/[id]/escrow/page.js`
- This contract.

## Non-functional
- Deploy posture: **PRODUCTION-IMPACTING + MIGRATION (M076)**. Surfaced for
  explicit go; M076 batched with M075 for ONE combined prod migration.
- `pnpm qa` GREEN (gate=0). Backend boot smoke clean.
