# CTA Spec — 5 Phase-1 Businesses (LOCKED by founder 2026-06-11, W7)

> Canonical call-to-action definition per business per page. This is the
> contract input for the Business Page Engine + Product Page sprints.
> First-listed = ★PRIMARY (big button). Labels are founder's exact wording.
> One canonical action vocabulary: pay_at_store · online_order · book_slot ·
> book_daterange · enquiry (+ contact set). The walkin_pay/pay_at_store
> naming split is resolved to **pay_at_store** everywhere.

## Business page

| Business | CTAs (in order) |
|---|---|
| 🍽 Restaurant | ★**Book a Table** · Pay at Restaurant · Order Online |
| 👗 Fashion (walk-in + unified) | ★**Pay at Store** *(rev 3: store level = this only)* |
| 🛋 Furniture | ★**Pay at Store** *(rev 3: store level = this only)* |
| 💇 Salon | ★**Book Appointment** · Pay at Salon |
| 🚗 Car rental | ★**Book Your Dates** · Pay at Garage |

## Product / service page

| Business | CTAs (in order) |
|---|---|
| 🍽 Restaurant (dish) | ★**Add to Cart** · Pay at Restaurant |
| 👗 Fashion (item) | ★**Pay at Store** · Order Online |
| 🛋 Furniture (item) | ★**Pay at Store** · Order Online |
| 💇 Salon (service) | ★**Book Appointment** · Pay at Salon |
| 🚗 Car rental (vehicle) | ★**Book These Dates** |

## Notes (founder decisions)

- Car rental: Enquire REMOVED from both pages (founder, 2026-06-11 follow-up).
- **Revision 3 (founder, 2026-06-11 — the clarified purchase model):**
  - Retail (fashion, fashion_walkin, furniture) **STORE level = ★Pay at Store
    ONLY** (the walk-in INFLX payment). Order Online is NOT a store-level CTA.
  - **PRODUCT level = both**: "At the store? Pay via INFLX — the deal discount
    applies" (offline) OR "Order Online". The product page nudges this choice.
  - Category spec WINS over an offer's availing modes on product pages — a
    creator deal carrying fewer modes must not shrink the buttons.
  - ORGANIC browsing fully supported: product taps open without any creator/
    offer; in-store pay completes as a plain direct payment (zero discount,
    platform fee only — backend store-offer/pay with brand_offer_id optional).
  - Restaurant (3 CTAs), salon, car rental store pages unchanged.
- **Revision 2 (founder, 2026-06-11 post-sprint-2 review):**
  1. CTA buttons render SIDE-BY-SIDE in a sticky BOTTOM bar (business page
     bottom bar; product page footer carries price + all modes) — never
     stacked vertically mid-page.
  2. Salon wording is **"Pay at Salon"** (not Pay at Store) on both pages.
  3. Contacts reduced to **Directions only** — one small chip just below the
     establishment card. Call / WhatsApp / Share Store removed everywhere.

- Restaurant business page drops Send Enquiry (was in old schema).
- Furniture drops Request Quote — pay/order only, same as fashion.
- Fashion walk-in vs unified: same CTA set (Pay at Store ★ + Order Online).
  (Walk-in-only stores that don't ship can disable online_order at brand
  level via availing_modes — engine hides the button.)
- Contact actions (Call · WhatsApp · Directions · Share) remain as a small
  secondary contact row on business pages — not part of the transactional
  CTA bar.
- Open flag (non-blocking): made-to-order furniture items — Order Online
  flows as a normal order for now; revisit if lead-time handling is needed.

## Schema changes implied (land with the Business Page Engine sprint)

- fashion_walkin.json: ADD actions array (none exists today).
- salon.json: ADD missing ★book_slot ("Book Appointment").
- car_rental.json: ADD missing ★book_daterange ("Book Your Dates").
- restaurant.json: align availing_modes with actions; drop enquiry from CTA bar.
- furniture.json: reorder per spec; drop Request Quote; add contact actions.
- All: exactly one primary; canonical vocabulary; labels per the tables above.
