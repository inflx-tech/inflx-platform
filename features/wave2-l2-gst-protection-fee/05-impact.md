# 05-impact — wave2-l2-gst-protection-fee

**Verdict: additive, record + display only. New nullable column + one persisted
value + a brand-facing display line. Zero change to money movement —
net_to_influencer, tranche amounts, brand wallet charge, and tranche release
are all untouched.**

## Mechanics
- **M076** adds one nullable column (`escrow_entries.fee_gst_amount`). No
  backfill, no row rewrite, additive — safe to apply before the code deploy.
- **Fee capture** persists `fee_gst_amount = gstOn(escrow_fee_amount)` per new
  tranche. Existing escrow entries are unaffected; their GST is derived on read.
- **Read path** (`getCampaignEscrow`) gains fee + GST fields; pre-076 NULLs are
  derived from the current `gst_pct` so the statement is complete for historic
  campaigns too.
- **UI** adds one sub-line per tranche; reuses the locked `.esc` palette, no new
  design tokens.

## Scope boundary
This commit does NOT charge the brand the GST or change the influencer's net —
it records the GST on the platform's escrow fee and surfaces it for brand
visibility / input-credit. The actual GST invoice + collection + monthly
remittance report is Wave 4.

## Regression
`pnpm qa` GREEN (no Playwright workflow touches the escrow statement math).
Backend boot smoke clean. `escrow-fee-tiers.test.js` extended to assert
`fee_gst_amount` persists (₹360 on a ₹2,000 fee @ 18%).

## Deploy posture
PRODUCTION-IMPACTING + MIGRATION (M076). Surfaced for explicit go; batched with
M075 for ONE combined prod migration at the end of Wave 2.
