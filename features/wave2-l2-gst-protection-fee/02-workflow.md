# 02-workflow — wave2-l2-gst-protection-fee

## Fee capture (contract activation)
1. A contract activates → `escrow.service.createEscrowEntries(client, ci, fee, pct)`
   builds 3 tranches (25/25/50).
2. Per tranche:
   - `amount = fee × tranche_pct`
   - `escrow_fee_amount = amount × feePct` (resolved tier / override / fallback)
   - `fee_gst_amount = tax.service.gstOn(escrow_fee_amount)`  ← NEW (EXCLUSIVE)
   - `net_to_influencer = amount − escrow_fee_amount` (unchanged)
   - INSERT escrow_entries with `fee_gst_amount` persisted.

## Brand views the statement
3. Brand opens `/dashboard/campaigns/[id]/escrow` → `GET /brands/me/campaigns/:id/escrow`.
4. Controller returns each tranche with `amount`, `escrow_fee_amount`,
   `fee_gst_amount`, `net_to_influencer`. For pre-M076 rows
   (`fee_gst_amount` NULL) it derives `escrow_fee_amount × gst_pct/100`.
5. The tranche row renders a sub-line: **Protection fee ₹X · GST ₹Y**.
6. Summary gains `total_fee` + `total_fee_gst`.

## Notes
- No change to money movement: the brand funds `amount`; the influencer
  receives `net_to_influencer`; tranche release is unchanged. `fee_gst_amount`
  is recorded + displayed only (Wave 4 issues the actual GST invoice).
- `gst_pct` comes from `payment_config` (admin-editable, Wave 1); default 18.
