# Flow 16 · workflow — happy paths preserved

## Meals page

### W1 · Setup tab default
- `mealsApi.listOfferRules` + `mealsApi.getConfig` in parallel
- Render AI suggestions card (suggested count from rules.filter(status==='suggested'))
- Party-size chips with counts per party (excluding suggested)
- Show offers for active party + create-by-chat box
- Sidebar: DiscountClock editor + Limits card

### W2 · AI generate suggestions
- Click Generate → `mealsApi.suggestOffers()` → sets ai_mode → reload rules
- New suggestions appear with "Accept/Modify/Reject" buttons

### W3 · Accept / Modify / Reject offer
- Accept → `updateOfferRule(id, { status: 'active' })` → reload
- Reject → `updateOfferRule(id, { status: 'rejected', rejected_reason: 'owner rejected' })` → reload
- Modify → preserved (no backend action — placeholder for future inline edit)

### W4 · Create offer by chat
- Brand types description + clicks Build
- Auto-append party size if not in text
- `restaurantChat({ message })` → returns `stage === 'clarify'` with question OR `stage === 'built'` with offer_rule
- Built case → toast/feedback message → reload
- Clarify case → bot message in thread

### W5 · DiscountClock save
- Brand edits clock rows · clicks Save → `putConfig({ ...config, discount_clock })`

### W6 · Today tab
- `mealsApi.getDashboard()` → stats + orders + prep_summary + unmatched
- Render 4 stat tiles + progress bar (confirmed/capacity) + orders table + sidebar
- "Mark delivered" → `deliverOrder(id)` → reload

## Orders page

### W7 · Default load
- `GET /brands/me/transactions?page=1&limit=20` with active type filter
- Render hero + channel chips + status filter + row cards + pagination

### W8 · Filter / paginate (preserved)

## Bookings page

### W9 · Default load (Pending tab)
- `GET /brands/me/bookings?status=pending`
- Render stat tiles + sub-tabs + booking cards
- Tab switch → re-fetch with new status

### W10 · Confirm / Reject pending booking
- Confirm → `POST /brands/me/bookings/{id}/confirm` → reload
- Reject → `POST /brands/me/bookings/{id}/reject` → reload
- Acting state preserved (busy disables other buttons)

## Enquiries page

### W11 · Default load
- `brandApi.getEnquiries()` → all enquiries
- Render 5-chip status filter + row cards
- Click row → inline expand with form_data + actions (only for non-converted)

### W12 · Mark Converted (preserved)
- `prompt('Enter deal value (₹):')` → `updateEnquiry(id, { status: 'converted', deal_value })`
- Toast success/failure
- Reload list

---

## Mutation-preservation (frozen)
- All 8 mealsApi mutations unchanged
- `bookings/confirm` + `bookings/reject` unchanged
- `updateEnquiry` body shape `{ status, deal_value }` unchanged
- `updateOfferRule` body shape unchanged
- `putConfig` body shape unchanged
- prompt/alert/confirm dialogs preserved
