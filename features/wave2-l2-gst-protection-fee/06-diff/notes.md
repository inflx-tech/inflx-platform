# 06-diff — wave2-l2-gst-protection-fee (Wave 2 commit 3)

**Before:** `escrow_entries` recorded `escrow_fee_amount` (the Protection Fee)
but no GST figure. The brand's per-campaign escrow statement
(`/dashboard/campaigns/[id]/escrow`) showed only the gross `amount` per tranche
— the brand never saw the Protection Fee, let alone its GST. The platform had
no per-tranche record of the GST owed on its fee revenue.

**After:**

*Schema.* M076 adds `escrow_entries.fee_gst_amount numeric(10,2)` (nullable,
additive).

*Fee capture.* `createEscrowEntries` computes
`fee_gst_amount = tax.service.gstOn(escrow_fee_amount)` per tranche (EXCLUSIVE,
reuses the Wave 1 centralized helper → `payment_config.gst_pct`, fallback 18)
and persists it alongside the fee.

*Read path.* `getCampaignEscrow` now returns `escrow_fee_amount`,
`fee_gst_amount`, and `net_to_influencer` per tranche, plus `summary.total_fee`
and `summary.total_fee_gst`. Pre-076 rows (NULL GST) are derived on read from
the current `gst_pct`, so historic campaigns show a complete statement.

*UI.* Each tranche row on the brand escrow statement gains a sub-line:
**Protection fee ₹X · GST ₹Y** (hidden when the fee is 0, e.g. conversion-only
campaigns). Reuses the locked `.esc` palette — one new `.tr-fee` class composed
of existing tokens.

**Why EXCLUSIVE + a distinct GST figure:** the brand needs the GST shown as a
separate line to claim input credit (decision 2). The platform books fee =
revenue, GST = owed/collected.

**Scope boundary (deliberate):** record + display only. `net_to_influencer`,
tranche `amount`, the brand's funded amount, and tranche release are all
UNCHANGED. The actual GST invoice / collection is Wave 4.

**Verified locally:** backend boot smoke clean; `escrow-fee-tiers.test.js`
green incl. the new `fee_gst_amount` assertion (₹360 on a ₹2,000 fee @ 18%);
brand-web production build compiles (exit 0); `pnpm qa` 76/76 GREEN (gate=0).
