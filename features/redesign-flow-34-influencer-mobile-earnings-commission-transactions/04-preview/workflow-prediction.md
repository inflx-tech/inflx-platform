# Flow 34 — Workflow prediction (mockup → backend source mapping)

## EarningsScreen tiles

| Mockup element | Backend source |
|---|---|
| "₹18,250" Available to Withdraw | `earnings.available_to_withdraw || earnings.wallet_balance` |
| "₹4,800" Pending | `earnings.pending_balance` |
| "₹2,450" TDS This FY | `earnings.tds_this_financial_year` |
| "₹27,500" Total Earned | `earnings.total_earned` |
| Per-campaign name + brand | `campaignEarnings[i].campaign_name / brand_name` |
| Goal badge (CONVERSION/HYBRID/ENGAGEMENT) | `campaignEarnings[i].goal` |
| Earned / Pending / Total | `campaignEarnings[i].total_earned / total_pending / sum` |
| Progress bar split | `flex:c.total_earned` vs `flex:c.total_pending` |
| Foot meta "2 TRANCHES + 6 COMMISSIONS" | `c.tranche_count + commission_count` |
| TDS preview Requested/TDS/You-Receive | client-side: `amt`, `amt*0.1`, `amt-tds` |
| History rows: net_paid, requested, tds_deducted, method, created_at | `withdrawals[i].*` |
| Status pill on history | `withdrawals[i].status` (processing/completed/failed) |

## CommissionDetailScreen tiles

| Mockup element | Backend source |
|---|---|
| Campaign name + brand | `data.campaign_name / brand_name` |
| Hero earned/pending/total | `summary.total_earned / total_pending / sum` |
| Goal / Status / Fee tiles | `data.goal / ci_status / agreed_fee` |
| Tranche row title | `TRANCHE_LABELS[t.tranche_number]` |
| Tranche amount | `t.amount` |
| Tranche date | `t.released_at` (released) or `t.created_at` (locked) |
| Tranche status pill | `t.status` ('released' or 'locked') |
| Commission % in section title | `data.commission_pct` |
| Confirmed / Pending summary | `summary.commission_confirmed / commission_pending` |
| Commission row type | `c.transaction_type` (formatted via `formatTxType()`) |
| Commission amount | `c.commission_amount` |
| Commission date | `c.created_at` |
| "Xd to confirm" | `c.days_until_confirmed` |

## TransactionFeedScreen tiles

| Mockup element | Backend source |
|---|---|
| Total Commission | `summary.total_commission` |
| Total Orders | `summary.total_transactions` |
| Today | `summary.today_commission` |
| Type pill (🏪/📅/📦/🔗) | `TYPE_LABELS[tx.transaction_type]` (pay_at_store/prebook/online_order/redirect_click) |
| Follower name | `tx.follower_name || 'Customer'` |
| Brand · product | `tx.brand_name / product_name` |
| Campaign · date | `tx.campaign_name / created_at` |
| Commission "+₹XXX" | `tx.influencer_commission` |
| Sale amount | `tx.net_amount` |
| Booking ref | `tx.booking_ref / booking_date / booking_time` |

## Zero phantom

Every mockup metric traces to a real DB field, derived computation, or static config. No tile invented.
