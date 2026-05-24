# Flow 11 · preview workflow-prediction — mockup → backend source mapping

Verifies every visible element in `04-preview/mockups/web.html` traces to a
real backend field surfaced today (no phantom metrics, no new endpoints).

---

## State 1 — Orders default

| Mockup element | Backend source | Notes |
|---|---|---|
| Count chip `142 TRANSACTIONS` | `meta.total` from `GET /brands/me/transactions` | per-page-fetch count |
| Hero KPI 1 `₹2,18,450 TOTAL REVENUE` | `summary.total_revenue` (SUM net_amount on completed) | money/rupees |
| Hero KPI 2 `₹1,84,128 YOUR NET` | `summary.total_brand_net` (SUM brand_net) | yellow accent |
| Hero KPI 3 `₹17,892 COMMISSION PAID` | `summary.total_commission` (SUM influencer_commission) | white |
| Channel chip 1 count `68` | `summary.pay_at_store_count` | per-type COUNT |
| Channel chip 2 count `42` | `summary.prebook_count` | per-type COUNT |
| Channel chip 3 count `32` | `summary.online_order_count` | per-type COUNT |
| Sub-tab Orders count `[142]` | `meta.total` | server-pagination total |
| Sub-tab Enquiries count `[8]` | `enquiries.length` | client-loaded |
| Status chip counts (`131/6/3/2`) | **derived client-side** from currently loaded `transactions[]` filtered by status (subject to per-page bias — see Flow 10 per-tab-count discipline) | shows `—` if filtered/empty |
| Row badge (Walk-in/Pre-book/Order/Rental) | `transactions[].transaction_type` + `transactions[].booking_type` (rental override) | OLD page already does this |
| Row name | `transactions[].follower_name` + `· transactions[].product_name` | join already present |
| Row meta `via @handle` | `transactions[].instagram_handle` | join already present |
| Row meta campaign | `transactions[].campaign_name` | join already present |
| Row coupon chip | `transactions[].coupon_code_used` | OLD page surfaces in expand only; NEW surfaces inline |
| Row right ₹net | `transactions[].net_amount` | mono |
| Row right `net ₹brand_net` | `transactions[].brand_net` | mono, success-text green |
| Row status pill | `transactions[].status` | enum: completed/initiated/returned/refunded |
| Row relative date | `transactions[].created_at` via fmtRelative | helper inlined |
| Pagination `Page n of m` | `meta.page` + ceil(`meta.total / limit`) | mono |

## State 2 — Orders row expanded (rental example)

| Mockup element | Backend source |
|---|---|
| Bill Amount | `ft.gross_amount` |
| Discount | `ft.discount_amount` |
| Customer Paid | `ft.net_amount` |
| Your Net | `ft.brand_net` |
| Influencer Commission | `ft.influencer_commission` |
| Platform Fee | `ft.marketplace_fee_amount` (aliased `platform_fee`) |
| Coupon Used | `ft.coupon_code_used` |
| Payment ID | `ft.razorpay_payment_id` (truncated to 16 chars in render) |
| Pickup Date | `fb.pickup_date` — **NEW surface** |
| Return Date | `fb.return_date` — **NEW surface** |
| Duration | `fb.duration_days` — **NEW surface** |
| Pickup Type | `fb.pickup_type` — **NEW surface** |
| Booking Ref | `fb.reference_code` (aliased `booking_ref`) |
| Customer Phone | `u_f.phone` (aliased `follower_phone`) |
| Campaign | `c.name` (aliased `campaign_name`) |
| Channel | `ft.transaction_type` |
| Booking Notes | `fb.notes` (aliased `booking_notes`) — **NEW surface** |

## State 3 — Enquiries expanded

| Mockup element | Backend source |
|---|---|
| Enquiry badge `💬 Enquiry` | static label |
| Row name | `enquiries[].follower_name` + `· {form_data.service_type}` |
| Row meta `via @influencer` | `enquiries[].influencer_name` |
| Row coupon chip | `enquiries[].coupon_code` |
| Row right `₹85,000 deal value` | `enquiries[].deal_value` (only on converted) — **NEW surface** |
| Row status pill | `enquiries[].status` |
| Row relative date | `enquiries[].created_at` via fmtRelative |
| Expand form cards | `enquiries[].form_data_json` Object.entries |
| Send response button | (no backend hook yet — disabled or stubbed for now; placeholder for future PATCH `?status=responded`) |
| Mark Converted button | `PATCH /brands/me/enquiries/:id` body `{ status: 'converted', deal_value: <prompted> }` |

## State 4 — Empty

| Mockup element | Backend source |
|---|---|
| `₹0` KPIs | summary block is always returned (controller does the SUM even at 0 rows) |
| Channel `0` counts | summary COUNT fields likewise |
| Empty card copy | static — no backend lookup |

---

## Verification at impl time

Before merge, grep the implementation file to confirm:

```
grep -n 'summary\.' Packages/brand-web/app/dashboard/conversions/page.js
grep -n 'tx\.\(gross\|discount\|net\|brand\|influencer\|platform\|coupon\|razor\|pickup\|return\|duration\|notes\)' Packages/brand-web/app/dashboard/conversions/page.js
grep -n 'enq\.\(form_data\|deal_value\|status\|coupon\|follower\|influencer\)' Packages/brand-web/app/dashboard/conversions/page.js
```

Every match should correspond to a row in the tables above. Any access
to a field not in the tables = phantom; must be removed before lock.
