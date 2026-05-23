# meals-rchat — restaurant chat for offer creation (P-RCHAT)

> **Phase P-RCHAT.** Conversational offer creation for the restaurant
> owner — the brand-side counterpart to the customer's `/meals/chat`.
> Owner types a plain-English description of the offer they want; the
> AI extracts structure referencing their real menu; the backend joins
> menu prices; the result lands in the same `status='suggested'` queue
> as the AI auto-suggest feed (P-AI-INTEL) for Accept / Modify / Reject.

## What's locked
- **AI returns STRUCTURE only.** Items reference real `product_id`s from
  the restaurant's menu. AI may NOT invent dishes or prices.
- **Backend joins** `brand_products.price` for each referenced item to
  compute `base_price` when the owner doesn't assert a base. The
  **owner's discount + freebies** are preserved verbatim — those are
  the owner's calls.
- **Triggers + radius** captured as `trigger_json` (e.g. `{weather:'rain',
  max_km:3, days:'weekend'}`). `offer_kind` derived: trigger present →
  `custom`; only discount → `discount`; only freebies → `free_addon`;
  both → `mixed`; "pre-book/early" cue → `early_order`.

## Backend
- `ai/mock.js` — `extractRestaurantOffer(message, { menu })` — parses
  party-size, items (with explicit quantities + menu match), base,
  discount (`₹X off` / `X% off` / `flat X`), freebies (`free X`),
  triggers (`if raining`, `within N km`, `weekend`).
- `ai/client.js` — `extractRestaurantOffer` calls **Claude Haiku** with
  tool-use forced JSON (`emit_restaurant_offer`); items typed to
  `product_id`; system prompt forbids invented dishes/prices.
- `ai/index.js` — dispatcher with safe fallback-to-mock.
- `meals.service.restaurantChatCreateOffer(brandId, { message,
  partial_offer })` — orchestrator: load menu, call AI, clarify if
  blocking missing field, else join prices + insert
  `meal_offer_rules` row with `status='suggested', source='custom'`.
- `POST /v1/meals/restaurant-chat` (brand auth).

## Brand-web
- Setup tab's "Create your own offer" box now drives the new chat:
  textarea → `Build with chat` → AI reply renders inline (clarify
  question or "Built …" confirmation with a link to the suggested
  card above). The auto-suggest feed (P-AI-INTEL) is unchanged.

## Tests
- `backend/tests/meals-rchat.test.js` (4/4) — empty menu → 422;
  missing party_size → clarify; plain-English with items/discount/
  freebie → suggested rule with prices joined + discount preserved +
  freebie captured + `offer_kind='mixed'`; rainy-day trigger +
  `within 3 km` → `trigger_json` populated + `offer_kind='custom'`.

## Deploy prereqs (same as P-AI-INTEL)
1. `npm i @anthropic-ai/sdk` in `backend/`.
2. Render env: `ANTHROPIC_API_KEY=...`, `AI_MOCK=false`.
