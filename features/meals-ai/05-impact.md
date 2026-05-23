# meals-ai — impact

## Blast radius
- New `backend/src/services/ai/` module + `POST /meals/chat` + env
  additions. `meals.service` gains `chat` + `getCustomerPreferences`
  (additive). No existing route/table touched.
- `qa/` gains an informational lane (`ai-eval.mjs` + golden set) and a
  `qa:ai-eval` script — deploy-inert.

## Regression risk
- **Low.** AI defaults to deterministic mock (no key) so existing tests
  + `pnpm qa` are unaffected; new behaviour covered by `meals-x1`.
- The live client is lazy-required — absence of `@anthropic-ai/sdk`
  cannot break the mock/test path.

## Production posture
- PRODUCTION-IMPACTING (`backend/src/**`) but **not pushed** — bundled
  into the single end-of-program prod push. Backend-only → gov-check
  Rule 1 only.
- **Deploy prerequisites (flagged for the final push):** `npm i
  @anthropic-ai/sdk` in backend, set `ANTHROPIC_API_KEY` + `AI_MOCK=false`
  in prod env. Until then prod can run in mock mode safely.

## Safety
- Money-memory is owner-confirmed, never AI-set; AI returns structure
  only. Any AI error falls back to the deterministic mock.
