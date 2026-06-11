# sprint2-business-page-ctas

> Sprint 2 of the follower fix plan (founder "pls proceed", 2026-06-11).
> Implements the founder-LOCKED CTA spec (Docs/CTA_SPEC.md) across the 5
> phase-1 businesses and kills the "Pay at salon" leak (walkthrough P4).

## What the audit found (verify-twice)

The business-page engine largely EXISTED: resolveBusinessStore already ships
the category schema as `template`, and BrandStoreScreen renders
`brand_config.actions` via BrandActionRow + dispatchBrandAction. The breaks
were in the DATA and the EDGES:
- fashion_walkin.json had NO actions array at all (and no brand_config) —
  the founder's own store category → fell to hardcoded fallbacks.
- salon.json and car_rental.json were missing their PRIMARY book actions.
- Two verbs for one concept (walkin_pay vs pay_at_store).
- renderTrustChips hardcoded the text 'Pay at salon' for ANY brand with
  walk-in pay — the literal chip in the founder's Charvitha screenshot.
- ProductDetail CTA labels/order didn't match the locked spec (Buy Now,
  Reserve Car, Pay at Salon on salons…).

## Fix

1. **Schemas (6 files, via scripts/apply-cta-spec.js — idempotent):**
   founder's exact CTA sets/labels/order, exactly one primary each,
   canonical verb pay_at_store, actions ALWAYS at brand_config.actions,
   availing_modes aligned. Enquire removed from car rental (founder
   follow-up); enquiry dropped from restaurant CTA bar per spec.
2. **BrandStoreScreen:** dispatch accepts pay_at_store (+ legacy walkin_pay
   for OTA lag) and book_daterange (routes to the fleet tab — date-range
   bookings need a vehicle picked first); trust chip text is now
   category-aware (PAY_CHIP_TEXT map, default 'Pay at store').
3. **ProductDetailScreen:** CATEGORY_CTA_ORDER (locked product-page spec,
   primary first, filtered by the offer's availing modes) + label updates
   (restaurant Add to Cart; fashion/furniture Pay at Store ★ + Order
   Online; salon Book Appointment ★ + Pay at Store; car Book These Dates ★).

## Out of scope

Variant cart (Sprint 3+4 work), business-page block/layout redesign beyond
CTAs (the page already renders schema-driven rows), restaurant detail screen
(already conformed).
