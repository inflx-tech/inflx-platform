# Flow 16 · preview workflow-prediction

## Meals field mapping
| Element | Backend |
|---|---|
| AI suggestions panel count | `rules.filter(r => r.status === 'suggested').length` |
| AI mode label | `data.ai_mode` from suggestOffers response |
| Suggested offer cards | `rules.filter(r => r.status === 'suggested')` |
| Active offer cards (per party) | `rules.filter(r => r.party_size === party && r.status !== 'suggested')` |
| Party chip counts | `rules.filter(r => r.party_size === key && r.status !== 'suggested').length` |
| Offer Accept | `updateOfferRule(id, { status: 'active' })` |
| Offer Reject | `updateOfferRule(id, { status: 'rejected', rejected_reason: 'owner rejected' })` |
| Offer Remove | `updateOfferRule(id, { status: 'archived' })` |
| Discount clock save | `putConfig({ ...config, discount_clock })` |
| Limits values | `config.{never_below_cost, max_discount_pct, delivery_radius_km, auto_offer}` |
| Today stats | `dashboard.stats.{confirmed, capacity, capacity_left, revenue, meals}` |
| Order book progress | derived: confirmed / capacity * 100 |
| Incoming orders | `dashboard.orders[]` |
| Mark delivered | `deliverOrder(order.id)` |
| Kitchen prep rows | `dashboard.prep_summary[]` |
| Unmatched requests | `dashboard.unmatched[]` |
| Restaurant chat | `restaurantChat({ message })` → `stage`/`question`/`offer_rule` |

## Orders field mapping
Same as Flow 11 (Conversions Orders tab) — see flow-11 workflow-prediction.

## Bookings field mapping
| Element | Backend |
|---|---|
| Stat tiles | `stats.{pending, today, upcoming, revenue_7d}` |
| Tab counts | `stats.{pending}` (only pending shown inline; others derived per-tab load) |
| Date badge | `booking.booking_date || pickup_date` |
| Time | `booking.booking_time` |
| Name | `booking.follower_name` |
| Party of | `booking.guest_count` |
| Status pill | `booking.brand_status` (pending/confirmed/rejected) + `booking_status` (cancelled override) |
| Booking type | `booking.booking_type` |
| Creator pill | `booking.instagram_handle` (or "direct booking" text if missing) |
| REF code | `booking.reference_code` |
| Customer notes | `booking.notes` |
| Brand review note | `booking.brand_review_note` |
| Amount | `booking.net_amount || gross_amount` |
| Advance | `booking.advance_paid` |
| Confirm/Reject | `POST /brands/me/bookings/:id/{confirm|reject}` |

## Enquiries field mapping
Same as Flow 11 (Conversions Enquiries tab) — see flow-11 workflow-prediction.
