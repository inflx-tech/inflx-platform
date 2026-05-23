# meals-p1-vertical-slice — INFLX Meals end-to-end skeleton (P1)

> **Phase P1.** The first end-to-end slice for ONE restaurant, proving
> the whole chain works: restaurant setup → customer intent →
> deterministic offer shortlist → lock + pay → manual deliver. Backend
> only, **deterministic (no AI yet)**, fully testable via API/DB.
> Builds on the P0 schema (`features/meals-schema/`).

## Endpoints (mounted at `/v1/meals`)
Restaurant (role `brand`):
- `PUT /meals/config` — enable Meals, set radius / max-discount / never-
  below-cost / auto-offer / editable discount-clock.
- `POST /meals/slots` — create a slot (label, serve_time,
  cutoff_minutes_before, capacity).
- `POST /meals/offer-rules` — create an offer rule (party_size,
  offer_kind, items, base_price, discount, freebies, photo, slot).
- `POST /meals/orders/:id/deliver` — mark an order delivered.

Customer (role `follower`):
- `POST /meals/intents` — state an intent (brand, party_size, items,
  slot, drop-location, budget).
- `POST /meals/intents/:id/offers` — compute the deterministic
  shortlist (cheapest-first; top one flagged best-value). No match →
  `intent_status: "no_match"`, empty list (decision 2).
- `POST /meals/orders` — lock + pay an offer (mock Razorpay).
  Rejected if the slot cutoff has passed (`OFFER_EXPIRED`).
- `GET /meals/orders/:id` — track the order.

## Deterministic pricing (the rule that matters)
All rupee math is in `meals.service.computePrice`: `base_price` (or the
sum of item prices) with the rule's discount applied (`flat` /
`percentage`), rounded to whole rupees. **AI never sets prices** — it
will only rank/recommend in a later phase. P1's "recommended" pick is
the deterministic lowest price.

## Out of scope (later phases)
AI intent extraction + ranking (X1), 5 km routing + capacity + discount-
clock decay + order-book freeze (P3), the setup/dashboard UI (P2), the
customer store/chat UI (P4), commission rate (P-REV).

## Success
The E2E test in `backend/tests/meals-p1.test.js` walks the full chain
green; `pnpm qa` stays GREEN (zero regression). Money in rupees; FKs
resolve; no existing behaviour changed (new `/meals` namespace only).
