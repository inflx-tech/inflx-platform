# meals-ai-suggest — AI auto-suggested offers (P-AI-INTEL)

> **Phase P-AI-INTEL.** The heart of the AI vision in mockup 01: the
> moment a restaurant has a menu, the AI proposes offer combinations,
> the owner reviews them as Accept / Modify / Reject cards. **AI picks
> the combinations; the system computes every rupee from the
> restaurant's own dish prices.**

## What's locked
- **AI returns STRUCTURE only** — `party_size`, `offer_kind`,
  `suggested_name`, `items: [{ product_id, qty }]`, `freebies[]`,
  `reasoning`. No prices, no discounts.
- **Backend joins** `brand_products.price` for each `product_id` to
  compute `base_price`. The discount-clock from
  `restaurant_meal_config` still applies at offer time.
- Suggested rows go into `meal_offer_rules` with
  `status='suggested', source='ai'` and surface in the Setup tab's
  AI block. Accept → `status='active'`; Reject → `status='rejected'`
  with the founder's reason (fed into `meal_restaurant_learnings`
  in P6).

## Backend
- `backend/src/services/ai/mock.js` — `suggestOffers({ menu, memory })`
  deterministic combiner (5 party sizes from a biryani menu).
- `backend/src/services/ai/client.js` — `suggestOffers` calls **Claude
  Sonnet** with tool-use forced JSON (`emit_offers` schema; items
  must reference `product_id`s from the menu; system prompt forbids
  prices/discounts).
- `backend/src/services/ai/index.js` — dispatcher with safe
  fallback-to-mock.
- `backend/src/services/meals.service.js#suggestOffersForBrand` —
  loads active `brand_products` + learnings, calls AI, joins prices,
  inserts as `meal_offer_rules` `status='suggested'`.
- `POST /v1/meals/offer-rules/suggest` (brand auth).

## Brand-web
- Setup tab gains an **"✨ AI offer suggestions"** banner with a
  "Generate AI suggestions" button. When the AI returns, suggested
  cards render above the party-size grid with Accept / Modify /
  Reject (lifecycle from P2). The banner shows ai_mode (mock/live).

## Tests
- `backend/tests/meals-suggest.test.js` (3/3) — empty menu → 422;
  with menu → suggestions with prices joined; multiple party sizes
  covered; Accept flips to active.

## Deploy prereqs (for the final prod push)
1. `npm i @anthropic-ai/sdk` in `backend/`.
2. Render env: `ANTHROPIC_API_KEY=...`, `AI_MOCK=false`.
3. AI-eval lane should run against the live model before flip:
   `LIVE_AI=1 pnpm qa:ai-eval` (informational).
