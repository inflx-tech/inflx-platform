# Flow 16 · brand-web restaurant bundle — spec

**Slug:** `redesign-flow-16-brand-web-restaurant`
**Status:** locked
**Wave:** wave2 redesign

---

## Files (5 files across 4 routes)

| Route | File | LOC OLD |
|---|---|---:|
| `/dashboard/meals` | `meals/page.js` | 484 |
| `/dashboard/orders` | `orders/page.js` | 221 |
| `/dashboard/bookings` | `bookings/page.js` (14) + `bookings/components/BookingsInbox.js` (317) | 331 |
| `/dashboard/enquiries` | `enquiries/page.js` | 87 |
| **Total** | | **1,123** |

---

## Backend audit (all preserved verbatim)

### Meals endpoints
- `mealsApi.listOfferRules()` → `{ offer_rules[] }`
- `mealsApi.updateOfferRule(id, { status, rejected_reason? })`
- `mealsApi.getConfig()` → `{ config }`
- `mealsApi.putConfig(config)`
- `mealsApi.suggestOffers()` → `{ ai_mode }`
- `mealsApi.restaurantChat({ message })` → `{ stage, question?, offer_rule? }`
- `mealsApi.getDashboard()` → `{ stats, orders[], prep_summary[], unmatched[] }`
- `mealsApi.deliverOrder(id)`

### Orders endpoints (same as Conversions)
- `brandApi.get('/brands/me/transactions?page=&limit=&type=')` → `{ transactions, summary, meta }`

### Bookings endpoints
- `brandApi.get('/brands/me/bookings?status=')` → `{ bookings, stats }`
- `brandApi.post('/brands/me/bookings/:id/confirm')`
- `brandApi.post('/brands/me/bookings/:id/reject')`

### Enquiries endpoints (same as Conversions)
- `brandApi.getEnquiries()` → `{ enquiries }`
- `brandApi.updateEnquiry(id, { status, deal_value })`

No phantom fields. No API contract changes.

---

## Scope (in-scope)

### `/dashboard/meals` (`.ml` wrapper)
- INK 2-tab pills (Offers & setup / Today's orders) with mono counts
- **Setup tab**: AI suggestions yellow-pale gradient panel · party-size chips with mono counts · suggested offer cards + active offer cards (success-bordered) · create-by-chat box (yellow-dashed border with palette ink chat thread) · sidebar with DiscountClock editor card + Limits card
- **Today tab**: 4 mono stat tiles (Confirmed/Capacity Left attn yellow/Locked Revenue green/Meals to Cook) · INK progress card with order book fill (yellow→hover gradient) · incoming orders table with status pills + "Mark delivered" actions · sidebar (Kitchen prep mono counts + Unmatched requests)
- AI restaurant-chat preserved verbatim including stage handling (clarify / built)
- All 8 endpoints preserved

### `/dashboard/orders` (`.ord` wrapper)
- Flow 11 Conversions Orders tab pattern: INK 3-KPI hero (Revenue · Your Net yellow · Commission) · 3 channel chip cards (clickable filters) · 5-chip status filter · row cards with inline expand · pagination preserved
- Mono everywhere
- Diff note: flag duplication with Conversions

### `/dashboard/bookings` (`.bk` wrapper)
- page.js: thin wrapper preserved
- BookingsInbox.js: full rewrite under `.bk` scope
- 4 mono stat tiles (Pending attn yellow / Today / Upcoming / Revenue 7d green)
- INK 5-tab pills with mono counts (Pending / Today / Upcoming / Completed / Cancelled)
- Date-badge booking cards (66px square: Outfit day + JBM month + time) with party-of-N + status pill + booking_type tag + creator attribution pill (success-pale) OR direct-booking text + REF code + customer notes (italic) + brand review note (yellow-pale)
- Right rail: mono amount + advance + Confirm (ink+yellow) / Reject (danger outline) inline for pending · "confirmed" or "cancelled" tag for non-pending
- Error/loading/empty states palette-aligned

### `/dashboard/enquiries` (`.enq` wrapper)
- Flow 11 Conversions Enquiries tab pattern: 5-chip status filter (canonical statuses: submitted/responded/converted/closed; drop dead new/contacted) · compact row cards · inline expand (replaces modal) · form_data fields rendered as kv grid · Send response yellow + Mark Converted ink+yellow buttons · converted rows show deal_value mono
- markConverted preserved (uses `prompt()` per OLD)

### Cross-cutting
- All numbers / amounts / dates / IDs in JetBrains Mono
- CSS scoping discipline under per-route wrappers
- alert/confirm dialogs preserved
- AI suggest button + restaurant-chat preserved verbatim
- Date helpers preserved
- Pagination on /orders preserved

## Out of scope

- Backend changes
- Deduplicating /orders + /enquiries vs Conversions (preserved per "behavior frozen" rule)
- Full meals page rebuild (preserve all 8 endpoints + AI chat)
- File upload for offer photos (not in OLD)
