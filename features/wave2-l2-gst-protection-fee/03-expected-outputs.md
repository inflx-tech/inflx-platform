# 03-expected-outputs — wave2-l2-gst-protection-fee

## escrow_entries (after fee capture)
Each tranche row now carries `fee_gst_amount`:
- `escrow_fee_amount = tranche_amount × feePct`
- `fee_gst_amount    = escrow_fee_amount × gst_pct/100` (gst_pct default 18)

Worked example — agreed fee ₹100,000, feePct 2%, gst 18%:

| Tranche | amount | escrow_fee_amount | fee_gst_amount | net_to_influencer |
|--------:|-------:|------------------:|---------------:|------------------:|
| 1 (25%) | 25,000 | 500 | 90 | 24,500 |
| 2 (25%) | 25,000 | 500 | 90 | 24,500 |
| 3 (50%) | 50,000 | 1,000 | 180 | 49,000 |
| **Σ**   | 100,000 | **2,000** | **360** | 98,000 |

## GET /v1/brands/me/campaigns/:id/escrow
Each tranche in `influencer_breakdown[].tranches[]` now includes:
```json
{ "tranche_number": 1, "amount": "25000.00", "escrow_fee_amount": 500,
  "fee_gst_amount": 90, "net_to_influencer": "24500.00",
  "status": "locked", "trigger_event": "contract_signed", ... }
```
`summary` gains `total_fee` + `total_fee_gst`.

Pre-M076 rows (NULL `fee_gst_amount`) are derived on read:
`fee_gst_amount = escrow_fee_amount × current gst_pct / 100`.

## Brand escrow statement UI
Each tranche row shows a sub-line: **Protection fee ₹X · GST ₹Y**
(hidden when `escrow_fee_amount` is 0, e.g. conversion-only campaigns).

## Invariants
- `net_to_influencer`, tranche `amount`, brand wallet charge, and tranche
  release are all UNCHANGED — `fee_gst_amount` is record + display only.
- `tax.service.gstOn` is the single source of the GST rate.
