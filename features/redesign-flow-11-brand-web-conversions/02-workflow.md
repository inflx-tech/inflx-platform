# Flow 11 · workflow — happy paths preserved

The redesign is **pure restyle**. All happy paths a brand can run today on
`/dashboard/conversions` continue to run identically. This file enumerates
them so the implementation can be checked against the OLD behaviour line by
line.

---

## W1 · Brand lands on /dashboard/conversions (default: Orders tab)

1. Authenticated brand navigates to `/dashboard/conversions`
2. Page mounts; useEffect fires `loadTransactions()` with default
   `page=1, limit=20, type=all`
3. `GET /brands/me/transactions?page=1&limit=20` returns
   `{ data: { transactions, summary }, meta: { page, limit, total } }`
4. **Parallel** useEffect fires `loadEnquiries()` →
   `GET /brands/me/enquiries` (no params) returns `{ data: { enquiries } }`
5. Hero KPIs render from `summary.total_revenue / total_brand_net /
   total_commission`
6. Channel chips render counts from `summary.pay_at_store_count /
   prebook_count / online_order_count`
7. Sub-tab counts: Orders count = `meta.total`, Enquiries count =
   `enquiries.length`
8. Row-card feed renders 20 transactions (or fewer if total < 20)
9. Pagination renders if `meta.total > 20`

## W2 · Brand filters by channel

1. Brand clicks `🏪 Walk-in Payments` channel chip
2. `setType('pay_at_store')` + `setTxPage(1)` → `loadTransactions()` re-fires
3. `GET /brands/me/transactions?page=1&limit=20&type=pay_at_store` returns
   filtered set (summary is unfiltered — stays the same across all-time
   totals)
4. Active chip becomes ink-bg/yellow-text; others become outline
5. Status filter row counts update to reflect the filtered subset of the
   active tab (or stay at "—" for tabs not loaded, per Flow 10 per-tab-
   count discipline)

## W3 · Brand filters by status

1. Brand clicks `Returned` status chip
2. `setStatus('returned')` + `setTxPage(1)` → `loadTransactions()` re-fires
3. `GET /brands/me/transactions?page=1&limit=20&status=returned` returns
   only returned rows
4. Active chip becomes ink-bg/yellow-text
5. Channel chip counts continue to reflect the unfiltered summary

## W4 · Brand expands a transaction row

1. Brand clicks a row card
2. `setExpandedTx(tx.id)` toggles; row container border darkens to ink;
   detail panel renders below the row header
3. Detail grid renders 8 financial-waterfall fields (Bill / Discount /
   Customer Paid / Your Net / Influencer Commission / Platform Fee /
   Coupon / Payment ID)
4. **If the row has rental-shaped booking fields** (`pickup_date` present),
   a second 4×2 grid renders the rental block (Pickup Date / Return Date /
   Duration / Pickup Type / Booking Ref / Customer Phone / Campaign /
   Channel)
5. **If `booking_notes` is present**, a final note card renders the notes
6. Clicking the row again collapses (sets `expandedTx=null`)
7. Clicking a different row swaps the expanded state (only one open at a
   time)

## W5 · Brand paginates

1. Brand clicks `Next →`
2. `setTxPage(p => p + 1)` → `loadTransactions()` re-fires with new page
3. Feed swaps in the new page; `Page N of M` updates
4. `← Previous` disables at page 1; `Next →` disables at last page

## W6 · Brand switches to Enquiries tab

1. Brand clicks Enquiries sub-tab
2. `setActiveTab('enquiries')` — feed swaps to enquiry rows already
   loaded by step W1.4
3. Enquiry-specific status filter chips render
   (Submitted/Responded/Converted/Closed)
4. Hero KPIs **stay** (they're all-time financial totals; relevant to
   both views)
5. Channel chips **hide or disable** when on Enquiries (TBD impl call —
   default: keep them but inactive)

## W7 · Brand expands an enquiry row

1. Brand clicks enquiry row
2. `setExpandedEnq(eq.id)` toggles; ink border + expand panel renders
3. `enq.form_data_json` keys + values render as 2-col `enq-f` cards
4. If `enq.status === 'converted'`, the action footer hides Convert button
   (already converted)
5. If `enq.status !== 'converted'`, footer shows `📧 Send response` +
   `✓ Mark as Converted` buttons

## W8 · Brand marks an enquiry Converted

1. From the expanded enquiry row, brand clicks `✓ Mark as Converted`
2. (Existing behaviour preserved) `prompt('Enter deal value (₹):')` →
   brand types a rupee amount
3. `PATCH /brands/me/enquiries/:id` with body
   `{ status: 'converted', deal_value: <parsed float> }`
4. Backend updates `enquiry_leads`, triggers
   `influencers.pending_balance += deal_value × commission_pct / 100` if
   `commission_pct > 0` and not already triggered
5. Toast: "Marked as converted!"
6. `loadEnquiries()` re-fires; row now shows `Converted` pill + the
   `deal_value` on its right side

## W9 · Empty state (first-run brand)

1. Brand with 0 transactions + 0 enquiries lands on the page
2. Hero KPIs all show `₹0` (from backend zero-summary, NOT from a
   front-end null fallback — backend always returns the summary block)
3. Channel chips show `0`
4. Sub-tab counts show `0`
5. Below sub-tabs, the empty-state gradient card renders with the ✓ icon
   and copy
6. No pagination, no status filter row

---

## Mutation-preservation contract (frozen)

- `PATCH /brands/me/enquiries/:id` body is **exactly**
  `{ status, deal_value }` — no rename, no new field
- `prompt()` for deal_value is **preserved** as the cheapest possible
  capture (founder may swap to a proper inline input in a later flow)
- Status string values written by this UI: `'converted'` only
  (existing PATCH behaviour)

## Query-param contract (frozen)

- `?type=pay_at_store|prebook|online_order` — values exactly as today
- `?status=completed|initiated|returned|refunded` (Orders) /
  `?status=submitted|responded|converted|closed` (Enquiries) — values exactly
  as today, enquiry status filtering is client-side since backend supports
  only one `status` query and enquiries returns the whole array
- `?page=N&limit=20` — values exactly as today

## Localstorage / cookies / role gates

- No change. Page requires authenticated brand role per
  `requireRole('brand')` on both endpoints.
