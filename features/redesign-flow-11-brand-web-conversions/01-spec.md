# Flow 11 · brand-web conversions — spec

**Slug:** `redesign-flow-11-brand-web-conversions`
**Status:** locked (mockup approved 2026-05-24)
**Wave:** wave2 redesign (palette · row-card pattern · backend-first tiles)

---

## What this flow restyles

`Packages/brand-web/app/dashboard/conversions/page.js` — the brand's single
view of money + leads attributed to their influencer campaigns. Two tabs
joined under one URL:

1. **Orders & Payments** — completed/initiated follower transactions
   across all three channels (`pay_at_store`, `prebook`, `online_order`)
2. **Enquiries** — `enquiry_leads` rows submitted by followers through
   influencer-shared service pages, with brand-side status workflow
   (submitted → responded → converted/closed)

393 LOC OLD page (multi-color tile grid + table + modal) → ~650 LOC
locked-palette page (ink hero KPIs + clickable channel chips + status
filter + row-card feed + inline expand).

---

## Backend audit — every visible number traces to a real field

**Endpoint 1 · `GET /brands/me/transactions`**
Controller: `backend/src/controllers/brand.controller.js:657-741`
Route: `backend/src/routes/brand.routes.js:58`
Role gate: `requireRole('brand')`
Query params consumed today: `type`, `campaign_id`, `influencer_id`,
`status`, `page`, `limit`
Response shape:

| Field | Source | Surfaced in mockup |
|---|---|---|
| `summary.total_revenue` | SUM(net_amount) on completed | Hero KPI 1 |
| `summary.total_brand_net` | SUM(brand_net) on completed | Hero KPI 2 |
| `summary.total_commission` | SUM(influencer_commission) on completed | Hero KPI 3 |
| `summary.total_platform_fee` | SUM(marketplace_fee_amount) on completed | _row expand only_ |
| `summary.pay_at_store_count` | per-type COUNT | Channel chip 1 |
| `summary.prebook_count` | per-type COUNT | Channel chip 2 |
| `summary.online_order_count` | per-type COUNT | Channel chip 3 |
| `summary.total_transactions` | COUNT(*) on completed | Header count chip |
| `transactions[].id` | ft.id | row key |
| `transactions[].transaction_type` | ft.transaction_type | type badge |
| `transactions[].status` | ft.status | status pill |
| `transactions[].gross_amount` | ft.gross_amount | expand: Bill Amount |
| `transactions[].discount_amount` | ft.discount_amount | expand: Discount |
| `transactions[].net_amount` | ft.net_amount | row right + expand: Customer Paid |
| `transactions[].brand_net` | ft.brand_net | row right + expand: Your Net |
| `transactions[].influencer_commission` | ft.influencer_commission | expand: Influencer Commission |
| `transactions[].platform_fee` | ft.marketplace_fee_amount | expand: Platform Fee |
| `transactions[].coupon_code_used` | ft.coupon_code_used | row chip + expand |
| `transactions[].razorpay_payment_id` | ft.razorpay_payment_id | expand: Payment ID |
| `transactions[].created_at` | ft.created_at | relative date |
| `transactions[].campaign_name` | c.name | row meta |
| `transactions[].follower_name` | u_f.name | row name |
| `transactions[].follower_phone` | u_f.phone | expand: Customer Phone |
| `transactions[].influencer_name` | u_i.name | _unused but available_ |
| `transactions[].instagram_handle` | i.instagram_handle | row meta `via @handle` |
| `transactions[].product_name` | bp.name | row name suffix |
| `transactions[].product_section` | bp.section | _unused; not surfaced_ |
| `transactions[].booking_type` | fb.booking_type | _used to label rental vs prebook_ |
| `transactions[].booking_date` / `booking_time` | fb.booking_date / fb.booking_time | row meta + expand |
| `transactions[].pickup_date` / `return_date` / `duration_days` / `pickup_type` | fb.* | **NEW — rental expand block** |
| `transactions[].booking_notes` | fb.notes | **NEW — expand note card** |
| `transactions[].booking_ref` | fb.reference_code | expand: Booking Ref |
| `transactions[].order_status` | fo.order_status | row meta when applicable |
| `meta.total` | COUNT(*) over filtered set | pagination |

**Endpoint 2 · `GET /brands/me/enquiries`**
Controller: `backend/src/controllers/enquiry.controller.js:73-108`
Route: `backend/src/routes/brand.routes.js:45`
Query params consumed today: `status` (optional)
Response shape (every field returned by the JOIN):

| Field | Source | Surfaced |
|---|---|---|
| `enquiries[].id` | el.id | row key |
| `enquiries[].status` | el.status | status pill |
| `enquiries[].deal_value` | el.deal_value | **NEW — shown on converted rows** |
| `enquiries[].commission_triggered` | el.commission_triggered | expand inline note |
| `enquiries[].form_data_json` | el.form_data_json | expand: form fields |
| `enquiries[].created_at` | el.created_at | relative date |
| `enquiries[].follower_name` | u_f.name | row name |
| `enquiries[].follower_phone` | u_f.phone | expand: Phone |
| `enquiries[].coupon_code` | ci.coupon_code | row chip |
| `enquiries[].influencer_name` | u_i.name | row meta |
| `enquiries[].campaign_influencer_id` | el.campaign_influencer_id | _unused but available_ |

**Endpoint 3 · `PATCH /brands/me/enquiries/:id`** (mutation only)
Controller: `enquiry.controller.js:112-183`
Body: `{ status, deal_value }`
Backend triggers influencer commission (`pending_balance += deal_value × commission_pct / 100`) when status flips to `converted` and a `deal_value` is supplied and `commission_triggered` was previously false. **Preserved verbatim — this redesign does not touch the mutation shape.**

## Verified — no phantom fields, no API call-shape changes

- No new endpoint
- No new query param consumed
- No new request body field
- No new response field consumed (all already join-loaded today)
- No new column accessed
- No schema migration

## Scope (in-scope)

- Rewrite `Packages/brand-web/app/dashboard/conversions/page.js` against
  the locked mockup at
  `features/redesign-flow-11-brand-web-conversions/04-preview/mockups/web.html`
- Locked palette (8 hexes + extensions) + Outfit/Plus Jakarta/JetBrains Mono
- INK hero KPI strip (3 KPIs: Revenue · Your Net · Commission)
- Clickable channel chip row (Walk-in · Pre-bookings · Online Orders)
- Sub-tabs INK pill style: Orders & Payments · Enquiries
- Status filter chips (Orders: All/Completed/Initiated/Returned/Refunded ·
  Enquiries: All/Submitted/Responded/Converted/Closed)
- Row-card feed with inline expand (replaces modal)
- Rental-block fields surfaced on prebook rows with booking_type='rental' or
  the rental-shaped fb fields (pickup_date / return_date / duration_days /
  pickup_type)
- `deal_value` shown on converted enquiry rows
- Relative date formatter ("2h ago" / "Yesterday" / "4d ago") via Flow 10
  `fmtRelative`
- All money/dates/IDs/handles in JetBrains Mono
- CSS scoping discipline from day 1: every rule under `.cnv` wrapper, every
  `:hover:not(:disabled)` re-asserts color, every `:disabled` locks both
  background + color
- Adjacent-fix: drop dead `new`/`contacted` enquiry status colors (backend
  never writes them; canonical values = submitted/responded/converted/closed)
- Pagination kept (existing `?page=`)

## Out of scope

- Any backend touch (controllers, routes, migrations, services)
- Any change to API request body / response shape
- Any new endpoint
- Trend/delta widgets (no time-window backend support today — would be
  phantom)
- Export/CSV download (separate flow if requested)
- Admin/mobile/influencer/follower views of the same data
- Restaurant-only `/dashboard/orders` page (separate Flow 16 bundle)
