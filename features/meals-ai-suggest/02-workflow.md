# meals-ai-suggest — workflow

## Build
1. `ai/mock.js` + `ai/client.js` + `ai/index.js` — `suggestOffers` (mock + Claude Sonnet + dispatcher).
2. `meals.service.suggestOffersForBrand` (joins prices from `brand_products`, inserts `status='suggested'`).
3. Controller + route `POST /v1/meals/offer-rules/suggest`.
4. brand-web `mealsApi.suggestOffers` + Setup tab AI block.
5. Test `meals-suggest.test.js`.

## Test
- `cd backend && npx jest tests/meals-suggest.test.js --runInBand` → green.
- All meals backend suites + `pnpm qa` green.
- Live model check (optional, gated): `ANTHROPIC_API_KEY=... AI_MOCK=false LIVE_AI=1 pnpm qa:ai-eval`.

## Expected end state
A restaurant with a menu can press "✨ Generate AI suggestions" and
see 3–5 review-ready offer cards (one per party size where it makes
sense). Accepting one flips it to `active` and the customer chat /
store sees it from the next call.
