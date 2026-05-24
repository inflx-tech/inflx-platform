# Flow 11 · expected outputs — what the user sees per state

These outputs map 1:1 to the 4 states in
`04-preview/mockups/web.html`. Implementation matches.

---

## State 1 · Orders tab, default view (channel = All, status = All)

**Above the fold:**

- Crumb: `/dashboard › conversions`
- Count chip: `{N} TRANSACTIONS` (uses `meta.total`)
- Outfit H1 "Conversions" + yellow rule + sub-line "Orders, payments, and
  enquiry leads attributed to your influencer campaigns."
- INK hero card (3 cells, vertical dividers):
  - `₹2,18,450` (mono, white) · `TOTAL REVENUE` · "gross customer pay · {N} tx"
  - `₹1,84,128` (mono, yellow) · `YOUR NET` · "after commission + platform fee"
  - `₹17,892` (mono, white) · `COMMISSION PAID` · "to influencers · all-time"
- Channel chip row (3 cards): each = icon · mono count · `WALK-IN PAYMENTS`/
  `PRE-BOOKINGS`/`ONLINE ORDERS` Outfit caps. Active = ink bg / yellow accent.
- Sub-tab pills: `Orders & Payments [142]` (active=ink/yellow) · `Enquiries [8]`
- Status chip row: `All [142]` `Completed [131]` `Initiated [6]` `Returned [3]` `Refunded [2]`

**Feed (rows per page = 20):**

- Each row card: `[type badge] [name · product / via @handle / coupon] [₹net /
  net ₹brand_net] [status pill] [relative date]`
- Walk-in badge yellow-pale, pre-book badge info-pale, order badge conv-pale
- Status pills: completed=success-pale, initiated=yellow-pale, returned=
  danger-pale, refunded=bg2
- All monetary values in mono
- All dates as relative ("2h ago", "Yesterday", "4d ago")

**Pagination strip:**

- `← Previous` (disabled at page 1) · `Page {n} of {m}` (mono) · `Next →`

## State 2 · Orders tab with a row expanded

- Clicked row has ink border
- Inline detail panel below row header, bg = `--bg`
- Top financial 4×2 grid (mono values):
  - Bill Amount / Discount (green negative) / Customer Paid (bold) / Your Net (bold)
  - Influencer Commission (orange/danger-text) / Platform Fee (muted) /
    Coupon Used / Payment ID (muted, truncated to first 16 chars)
- **If rental-shaped** (`pickup_date` present), a second 4×2 grid:
  - Pickup Date / Return Date / Duration / Pickup Type / Booking Ref /
    Customer Phone / Campaign / Channel
- **If `booking_notes` present**, a final white card with `BOOKING NOTES`
  label + free-text notes

## State 3 · Enquiries tab with a row expanded

- Sub-tabs: Orders inactive, Enquiries active (ink/yellow)
- Enquiry status filter chips (5: All/Submitted/Responded/Converted/Closed)
- Row format:
  `[💬 badge] [follower name · service from form_data / via @influencer / coupon chip] [— OR ₹deal_value (converted)] [status pill] [relative date]`
- Expanded enquiry row:
  - 2-column grid of `form_data_json` key/value cards
  - Action footer (right-aligned):
    - If `status !== 'converted'`: `📧 Send response` (yellow btn) + `✓ Mark as Converted` (ink btn)
    - If `status === 'converted'`: no action buttons (already done)

## State 4 · Empty (no transactions, no enquiries)

- Count chip: `0 TRANSACTIONS`
- Hero KPIs: all `₹0` (mono)
- Channel chips: `0` each
- Sub-tabs: counts `[0]`
- No status chip row, no row cards, no pagination
- Yellow-pale gradient empty card with:
  - Ink circle + yellow ✓ icon
  - Outfit "No conversions yet"
  - Body copy: "When followers tap your influencers' tracking links and
    pay, book, or enquire — they'll show up here. Publish a campaign +
    assign an influencer to start."

---

## Cross-state invariants

- The INK hero KPI strip is **always visible** above the sub-tabs (Orders
  and Enquiries both show it; the all-time financial totals are relevant
  to both audiences of this page)
- The channel chip row is **always rendered** but only Orders tab makes
  it interactive (clicking on Enquiries tab does nothing — channel is
  a transaction concept)
- The locked palette is the **only** color source — no `text-blue-600`,
  `bg-purple-50`, etc. left from the OLD page
- All numbers / handles / dates / IDs in JetBrains Mono
- All buttons honor CSS scoping discipline: hover re-asserts color,
  disabled locks bg + color
- Loading state = small spinner inline (same chrome as OLD page; not
  redesigned in this flow)
- Error state = silent (errors logged to console as in OLD page; no error
  banner — this is a read-mostly page and adding one is out of scope)
